// Utility functions

// get CSRF token
function getCsrfToken() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken') {
      return value;
    }
  }
  return '';
}

// Show message banner
function showMessageBanner(message) {
  const banner = document.getElementById('messageBanner');
  const messageText = document.getElementById('messageText');

  if (banner && messageText) {
    messageText.textContent = message;
    banner.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 5000);
  } else {
    alert(message);
  }
}

//close modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Transform button into input field
function transformButtonToInput(button, type) {
  if (button.dataset.isInput === 'true') {
    return;
  }

  // Store original content
  button.dataset.originalHTML = button.innerHTML;
  button.dataset.originalClasses = button.className;
  button.dataset.isInput = 'true';
  quickCreateMode = type;

  // Create input element
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = type === 'habit' ? 'Type habit name...' : 'Type task name...';
  input.className = 'w-full bg-transparent border-none outline-none px-0 py-0';
  if (button.classList.contains('text-white')) {
    input.style.color = 'white';
    input.style.caretColor = 'white';
  }
  input.style.fontSize = 'inherit';
  input.style.fontFamily = 'inherit';
  
  // Replace button content with input
  button.innerHTML = '';
  button.appendChild(input);
  button.style.cursor = 'text';
  
  // Focus input
  setTimeout(() => input.focus(), 0);

  // Handle Enter key
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value.trim();
      if (value) {
        let success = false;
        if (type === 'habit') {
          success = await quickCreateHabit(value);
        } else if (type === 'task') {
          success = await quickCreateTask(value);
        }
        
        if (success) {
          // Reset button
          restoreButton(button);
          searchQuery = '';
          loadHabits();
          loadTasks();
        }
      } else {
        // Empty value, restore button
        restoreButton(button);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      restoreButton(button);
    }
  });

  // Handle blur
  input.addEventListener('blur', (e) => {
    // Small delay to allow Enter key handler first
    setTimeout(() => {
      if (button.dataset.isInput === 'true') {
        const value = input.value.trim();
        if (!value) {
          restoreButton(button);
        }
      }
    }, 200);
  });
}

// Restore button from input field
function restoreButton(button) {
  if (button.dataset.isInput !== 'true') {
    return;
  }

  const originalHTML = button.dataset.originalHTML;
  const originalClasses = button.dataset.originalClasses;
  
  button.innerHTML = originalHTML;
  button.className = originalClasses;
  button.style.cursor = '';
  delete button.dataset.isInput;
  delete button.dataset.originalHTML;
  delete button.dataset.originalClasses;
  quickCreateMode = null;
  
  // Reset other buttons
  const addHabitBtn = document.getElementById('addHabitBtn');
  const addTaskBtn = document.getElementById('addTaskBtn');
  const addTaskBtn2 = document.getElementById('addTaskBtn2');
  
  if (addHabitBtn && addHabitBtn !== button) {
    addHabitBtn.classList.remove('bg-gray-200');
    addHabitBtn.classList.add('bg-gray-100');
  }
  if (addTaskBtn && addTaskBtn !== button) {
    addTaskBtn.classList.remove('bg-blue-600', 'text-white');
    addTaskBtn.classList.add('bg-blue-400');
  }
  if (addTaskBtn2 && addTaskBtn2 !== button) {
    addTaskBtn2.classList.remove('bg-gray-200');
    addTaskBtn2.classList.add('bg-gray-100');
  }
}

// Expose functions globally
window.closeModal = closeModal;

// Set up event listeners
function setupEventListeners() {
  const addTaskBtn = document.getElementById('addTaskBtn');
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
      showAddItemModal();
    });
  }

  const addHabitBtn = document.getElementById('addHabitBtn');
  if (addHabitBtn) {
    addHabitBtn.addEventListener('click', (e) => {
      // Don't transform if already an input
      if (addHabitBtn.dataset.isInput === 'true') {
        return;
      }
      // Reset other buttons first
      const addTaskBtn = document.getElementById('addTaskBtn');
      const addTaskBtn2 = document.getElementById('addTaskBtn2');
      if (addTaskBtn && addTaskBtn.dataset.isInput === 'true') {
        restoreButton(addTaskBtn);
      }
      if (addTaskBtn2 && addTaskBtn2.dataset.isInput === 'true') {
        restoreButton(addTaskBtn2);
      }
      transformButtonToInput(addHabitBtn, 'habit');
    });
  }

  // Handle second add task button (in tasks section)
  const addTaskBtn2 = document.getElementById('addTaskBtn2');
  if (addTaskBtn2) {
    addTaskBtn2.addEventListener('click', (e) => {
      // Don't transform if already an input
      if (addTaskBtn2.dataset.isInput === 'true') {
        return;
      }
      // Reset other buttons first
      const addTaskBtn = document.getElementById('addTaskBtn');
      const addHabitBtn = document.getElementById('addHabitBtn');
      if (addTaskBtn && addTaskBtn.dataset.isInput === 'true') {
        restoreButton(addTaskBtn);
      }
      if (addHabitBtn && addHabitBtn.dataset.isInput === 'true') {
        restoreButton(addHabitBtn);
      }
      transformButtonToInput(addTaskBtn2, 'task');
    });
  }

  document.querySelectorAll('.task-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      taskFilter = e.target.dataset.filter;
      updateTaskFilters();
      loadTasks();
    });
  });

  document.querySelectorAll('.habit-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      habitFilter = e.target.dataset.filter;
      updateHabitFilters();
      loadHabits();
    });
  });

  document.querySelectorAll('.stat-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      showStatSlotModal(parseInt(slot.dataset.slot));
    });
  });

  // Search input
  const searchInput = document.getElementById('search');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const value = e.target.value.trim();
      
      // If in quick create mode, don't search
      if (quickCreateMode) {
        return;
      }
      
      searchTimeout = setTimeout(() => {
        searchQuery = value;
        loadHabits();
        loadTasks();
      }, 300);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        searchQuery = e.target.value.trim();
        loadHabits();
        loadTasks();
      }
    });
  } else {
    console.error('Search input element not found');
  }

  // Tags dropdown
  const tagsIcon = document.getElementById('tagsIcon');
  const tagsDropdown = document.getElementById('tagsDropdown');
  if (tagsIcon && tagsDropdown) {
    tagsIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      tagsDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!tagsIcon.contains(e.target) && !tagsDropdown.contains(e.target)) {
        tagsDropdown.classList.add('hidden');
      }
    });
  }
}

