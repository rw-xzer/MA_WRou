// Daily Tasks Check Management

// check dailies
async function checkDailies() {
  try {
    const today = new Date().toDateString();
    const modalDismissed = localStorage.getItem('pendingItemsModalDismissed');
    const modalConfirmed = localStorage.getItem('pendingItemsModalConfirmed');
    
    // Don't show modal if it was already dismissed or confirmed today
    if (modalDismissed === today || modalConfirmed === today) {
      return;
    }
    
    const response = await fetch(`${API_BASE}/api/dailies/check`, {
      method: 'GET',
    });
    const data = await response.json();

    if (data.needs_check && (data.pending_dailies.length > 0 || data.pending_tasks.length > 0)) {
      // Filter to only show unchecked items
      const uncheckedDailies = data.pending_dailies.filter(item => !item.completed);
      const uncheckedTasks = data.pending_tasks.filter(item => !item.completed);
      
      if (uncheckedDailies.length > 0 || uncheckedTasks.length > 0) {
        showPendingItemsModal(uncheckedDailies, uncheckedTasks);
      }
    }
  } catch (error) {
    console.error('Error checking dailies:', error);
  }
}

// Dismiss pending items modal
function dismissPendingItemsModal() {
  const today = new Date().toDateString();
  localStorage.setItem('pendingItemsModalDismissed', today);
  closeModal('pendingItemsModal');
  
  // Still apply penalties/rewards when dismissed
  confirmPendingItems();
}

// Show pending items modal
function showPendingItemsModal(pendingDailies, pendingTasks) {
  const modal = document.getElementById('pendingItemsModal');
  const listContainer = document.getElementById('pendingItemsList');

  if (!modal || !listContainer) return;

  listContainer.innerHTML = '';

  const allPending = [...pendingDailies, ...pendingTasks];
  
  // Filter to only show unchecked items
  const uncheckedPending = allPending.filter(item => !item.completed);

  if (uncheckedPending.length === 0) {
    listContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No pending items.</p>';
    return;
  }

  uncheckedPending.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'mb-2 flex items-center gap-3 rounded-lg border border-gray-300 p-3 transition-opacity duration-300';
    itemDiv.dataset.itemId = item.id;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `pending_${item.id}`;
    checkbox.dataset.itemId = item.id;
    checkbox.dataset.itemType = item.type;
    checkbox.checked = false;
    checkbox.className = 'h-5 w-5 rounded border border-black';
    checkbox.addEventListener('change', () => {
      togglePendingItem(item.id, item.type, checkbox.checked, itemDiv);
    });

    const label = document.createElement('label');
    label.htmlFor = `pending_${item.id}`;
    label.className = 'flex-1 cursor-pointer';
    label.innerHTML = `
      <div class="font-medium">${item.title}</div>
      <div class="text-sm text-gray-500">${item.type === 'daily' ? 'Daily' : 'Scheduled Task'}</div>
    `;

    itemDiv.appendChild(checkbox);
    itemDiv.appendChild(label);
    listContainer.appendChild(itemDiv);
  });

  modal.classList.remove('hidden');
}

// Toggle pending item; check and uncheck
async function togglePendingItem(itemId, itemType, isChecked, itemDiv) {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${itemId}/complete/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({ completed: isChecked }),
    });

    if (response.ok) {
      // Update local state
      const task = tasks.find(t => t.id === itemId);
      if (task) {
        task.completed = isChecked;
      }
      
      // Fade out the item when checked
      if (isChecked && itemDiv) {
        itemDiv.style.opacity = '0.3';
        itemDiv.style.pointerEvents = 'none';
      } else if (!isChecked && itemDiv) {
        itemDiv.style.opacity = '1';
        itemDiv.style.pointerEvents = 'auto';
      }
    }
  } catch (error) {
    console.error('Error toggling pending item:', error);
  }
}

// Confirm pending items and reset dailies
async function confirmPendingItems() {
  try {
    const response = await fetch(`${API_BASE}/api/dailies/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
    });

    if (response.ok) {
      // Mark modal as confirmed today so it doesn't show again
      const today = new Date().toDateString();
      localStorage.setItem('pendingItemsModalConfirmed', today);
      localStorage.removeItem('pendingItemsModalDismissed');
      
      closeModal('pendingItemsModal');
      loadTasks();
      loadUserProfile();
      loadStatSlots();
    }
  } catch (error) {
    console.error('Error confirming pending items:', error);
    alert('Error resetting dailies. Please try again.');
  }
}

// Expose functions globally
window.togglePendingItem = togglePendingItem;
window.dismissPendingItemsModal = dismissPendingItemsModal;
window.confirmPendingItems = confirmPendingItems;

