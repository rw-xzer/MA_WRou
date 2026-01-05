// Habit Management

// Load habits
async function loadHabits() {
  try {
    let url = `${API_BASE}/api/habits/?filter=${habitFilter}`;
    if (searchQuery) {
      url += `&search=${encodeURIComponent(searchQuery)}`;
    }
    if (selectedTags.length > 0) {
      url += `&tag=${encodeURIComponent(selectedTags[0])}`;
    }
    const response = await fetch(url);
    const data = await response.json();
    habits = data.habits;
    renderHabits();
  } catch (error) {
    console.error('Error loading habits:', error);
  }
}

// Render habits
function renderHabits() {
  const container = document.getElementById('habitsContainer');
  if (!container) return;

  container.innerHTML = '';

  if (habits.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No habits yet. Create one to get started!</p>';
    return;
  }

  habits.forEach(habit => {
    const habitCard = createHabitCard(habit);
    container.appendChild(habitCard);
  });
}

// Create habit card element
function createHabitCard(habit) {
  const card = document.createElement('div');
  card.className = 'relative flex rounded-lg border border-black bg-white';
  card.style.borderLeftColor = habit.color;
  card.style.borderRightColor = habit.color;
  card.style.borderLeftWidth = '8px';
  card.style.borderRightWidth = '8px';

  card.innerHTML = `
    <div class="flex flex-1 items-center justify-between p-3">
      <div class="flex items-center gap-3">
        <button ${habit.allow_pos ? `onclick="completeHabit(${habit.id}, true)"` : 'disabled'} class="flex h-8 w-8 items-center justify-center rounded-full border ${habit.allow_pos ? 'border-black hover:bg-green-100' : 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5 ${habit.allow_pos ? '' : 'text-gray-400'}">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
        <div class="flex-1">
          <div class="font-bold">${habit.title}</div>
          <div class="text-sm text-gray-600">${habit.details || ''}</div>
          <div class="mt-1 flex items-center gap-2 text-xs">
            ${habit.allow_pos && habit.allow_neg ? `
              <span>+${habit.pos_count} | -${habit.neg_count}</span>
              ` : habit.allow_pos ? `
              <span>+${habit.pos_count}</span>
              ` : habit.allow_neg ? `
              <span>-${habit.neg_count}</span>
              ` : ''}
            ${habit.tags && habit.tags.length > 0 ? `
              <div class="relative group flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-3 w-3 text-gray-500 cursor-pointer">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                  <div class="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg">
                    ${habit.tags.join(', ')}
                  </div>
                  <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div class="border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0 ml-2">
        <button onclick="editHabit(${habit.id})" class="flex h-8 w-8 items-center justify-center rounded-full border border-black hover:bg-blue-100" title="Edit habit">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
        <button ${habit.allow_neg ? `onclick="completeHabit(${habit.id}, false)"` : 'disabled'} class="flex h-8 w-8 items-center justify-center rounded-full border ${habit.allow_neg ? 'border-black hover:bg-red-100' : 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5 ${habit.allow_neg ? '' : 'text-gray-400'}">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15" />
          </svg>
        </button>
      </div>
    </div>
  `;

  return card;
}

// complete habit
async function completeHabit(habitId, isPositive) {
  try {
    const response = await fetch(`${API_BASE}/api/habits/${habitId}/complete/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({ positive: isPositive }),
    });

    if (response.ok) {
      loadHabits();
      loadUserProfile();
      loadStatSlots();
    }
  } catch (error) {
    console.error('Error completing habit:', error);
  }
}

//Habit modal
function showHabitModal(habitId = null) {
  const modal = document.getElementById('habitModal');
  const form = document.getElementById('habitForm');
  const deleteButton = document.getElementById('habitDeleteButton');
  if (modal && form) {
    renderTagCheckboxes();
    
    // Clear form if creating new habit
    if (!habitId) {
      form.reset();
      form.dataset.habitId = '';
      document.querySelector('#habitModal h3').textContent = 'Add Habit';
      document.querySelector('#habitModal button[type="submit"]').textContent = 'Create';
      if (deleteButton) deleteButton.classList.add('hidden');
    } else {
      if (deleteButton) deleteButton.classList.remove('hidden');
    }
    modal.classList.remove('hidden');
  }
}

// Edit habit
async function editHabit(habitId) {
  try {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) {
      console.error('Habit not found');
      return;
    }

    // Set form to edit mode
    const form = document.getElementById('habitForm');
    form.dataset.habitId = habitId;
    document.querySelector('#habitModal h3').textContent = 'Edit Habit';
    document.querySelector('#habitModal button[type="submit"]').textContent = 'Update';

    showHabitModal(habitId);

    // Populate form after modal is shown and tags are rendered
    document.getElementById('habitTitle').value = habit.title;
    document.getElementById('habitDetails').value = habit.details || '';
    document.getElementById('habitDifficulty').value = habit.diff;
    document.getElementById('habitAllowPositive').checked = habit.allow_pos;
    document.getElementById('habitAllowNegative').checked = habit.allow_neg;
    document.getElementById('habitResetFreq').value = habit.reset_freq || 'never';

    // Set tag checkboxes after renderTagCheckboxes has run
    setTimeout(() => {
      document.querySelectorAll('.habit-tag-checkbox').forEach(checkbox => {
        checkbox.checked = habit.tags && habit.tags.includes(checkbox.dataset.tag);
      });
    }, 0);
  } catch (error) {
    console.error('Error loading habit for editing:', error);
  }
}

// Delete habit
async function deleteHabit() {
  const form = document.getElementById('habitForm');
  const habitId = form.dataset.habitId;
  
  if (!habitId) {
    console.error('No habit ID found');
    return;
  }

  if (!confirm('Are you sure you want to delete this habit? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/habits/${habitId}/delete/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
    });

    if (response.ok) {
      closeModal('habitModal');
      loadHabits();
    } else {
      const data = await response.json();
      alert('Error deleting habit: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error deleting habit:', error);
    alert('Error deleting habit. Please try again.');
  }
}

// Create or Update Habit
async function createHabit(formData) {
  const form = document.getElementById('habitForm');
  const habitId = form.dataset.habitId;

  try {
    let url, method;
    if (habitId) {
      url = `${API_BASE}/api/habits/${habitId}/update/`;
      method = 'PUT';
    } else {
      url = `${API_BASE}/api/habits/create/`;
      method = 'POST';
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      closeModal('habitModal');
      loadHabits();
      loadTags();
    }
  } catch (error) {
    console.error('Error saving habit:', error);
  }
}

// Quick create habit with default settings
async function quickCreateHabit(title) {
  if (!title || !title.trim()) {
    return;
  }

  const formData = {
    title: title.trim(),
    details: '',
    difficulty: 'trivial',
    allow_positive: true,
    allow_negative: true,
    reset_freq: 'never',
    tags: [],
  };

  try {
    const response = await fetch(`${API_BASE}/api/habits/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      loadHabits();
      loadTags();
      return true;
    } else {
      console.error('Error creating habit:', await response.json());
      return false;
    }
  } catch (error) {
    console.error('Error creating habit:', error);
    return false;
  }
}

// update filters
function updateHabitFilters() {
  document.querySelectorAll('.habit-filter').forEach(btn => {
    if (btn.dataset.filter === habitFilter) {
      btn.classList.add('font-medium');
      btn.classList.remove('text-gray-600');
    } else {
      btn.classList.remove('font-medium');
      btn.classList.add('text-gray-600');
    }
  });
}

// Expose functions globally for HTML onclick handlers
window.completeHabit = completeHabit;
window.editHabit = editHabit;
window.deleteHabit = deleteHabit;
window.showHabitModal = showHabitModal;
window.createHabit = createHabit;
window.updateHabitFilters = updateHabitFilters;
window.quickCreateHabit = quickCreateHabit;

