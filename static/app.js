// Main JavaScript file

// API base URL
const API_BASE = '';

// Global state
let userProfile = null;
let habits = [];
let tasks = [];
let activeStudySession = null;
let habitFilter = 'all';
let taskFilter = 'all';
let searchQuery = '';
let selectedTags = [];
let allTags = [];

// Study session state
let studySessionTimer = null;
let studySessionStartTime = null;
let studySessionDuration = null;
let studySessionMode = 'timer';
let studySessionPaused = false;
let studySessionPausedStartTime = null;
let studySessionTotalPausedTime = 0;
let subjectColors = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadUserProfile();
  loadTags();
  loadHabits();
  loadTasks();
  loadRecap();
  checkDailies();
  loadStatSlots();
  setupEventListeners();
  initializeColorPicker();
  loadSubjectColors();
  setupStudySubjectAutoColor();

  checkActiveStudySession().then(() => {
    // Update stats link after checking active session
    updateStudyStatsLink();
  });
  
  // Update link more frequently to catch immediate changes
  setInterval(updateStudyStatsLink, 1000);
  
  // Keeps prefix Coins:
  // Don't remove else only number is shown
  const fixCoinsText = () => {
    const coinsText = document.getElementById('coinsText');
    if (coinsText) {
      const currentText = coinsText.textContent.trim();
      if (/^\d+$/.test(currentText)) {
        coinsText.textContent = `Coins: ${currentText}`;
      } else if (userProfile && !currentText.startsWith('Coins:')) {
        coinsText.textContent = `Coins: ${userProfile.coins || 0}`;
      } else if (userProfile && currentText.startsWith('Coins:')) {
        const match = currentText.match(/Coins:\s*(\d+)/);
        if (match && match[1] !== String(userProfile.coins || 0)) {
          coinsText.textContent = `Coins: ${userProfile.coins || 0}`;
        }
      }
    }
  };
  
  // Start observing once the element exists
  const observeCoinsText = () => {
    const coinsText = document.getElementById('coinsText');
    if (coinsText) {
      coinsTextObserver.observe(coinsText, {
        childList: true,
        characterData: true,
        subtree: true
      });
      fixCoinsText();
    } else {
      setTimeout(observeCoinsText, 50);
    }
  };
  observeCoinsText();
});

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
    addHabitBtn.addEventListener('click', () => {
      showHabitModal();
    });
  }

  document.querySelectorAll('.task-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      taskFilter = e.target.dataset.filter;
      updateTaskFilters();
      loadTasks();
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
      searchTimeout = setTimeout(() => {
        searchQuery = e.target.value.trim();
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

// Load user profile
async function loadUserProfile() {
  try {
    const response = await fetch(`${API_BASE}/api/profile/`);
    userProfile = await response.json();
    updateUserProfile();
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

// Update user profile UI
function updateUserProfile() {
  if (!userProfile) return;

  // Update health/xp bars
  const healthBar = document.getElementById('healthBar');
  const xpBar = document.getElementById('xpBar');
  const healthText = document.getElementById('healthText');
  const xpText = document.getElementById('xpText');
  const lvlText = document.getElementById('lvlText');
  const coinsText = document.getElementById('coinsText');

  if (healthBar) {
    const healthPercent = (userProfile.hp / userProfile.max_hp) * 100;
    healthBar.style.width = `${healthPercent}%`;
  }

  if (xpBar) {
    const xpPercent = (userProfile.xp / userProfile.max_xp) * 100;
    xpBar.style.width = `${xpPercent}%`;
  }

  if (healthText) healthText.textContent = `${userProfile.hp}/${userProfile.max_hp}`;
  if (xpText) xpText.textContent = `${userProfile.xp}/${userProfile.max_xp}`;
  
  // Ensure coins text is always set and visible
  if (coinsText) {
    const coinsValue = userProfile.coins != null ? userProfile.coins : 0;
    coinsText.textContent = `Coins: ${coinsValue}`;
    coinsText.style.display = '';
    coinsText.style.visibility = 'visible';
    
    // Double-check immediately after setting (in case something overwrites it)
    setTimeout(() => {
      const currentText = coinsText.textContent.trim();
      if (!currentText.startsWith('Coins:') || /^\d+$/.test(currentText)) {
        coinsText.textContent = `Coins: ${coinsValue}`;
      }
    }, 0);
  }

  // Update avatar state
  updateAvatar(userProfile.avatar_state);

}

// Update avatar animation
function updateAvatar(state) {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;

  avatar.className = `avatar avatar-${state}`;
}

// Load tags
async function loadTags() {
  try {
    const response = await fetch(`${API_BASE}/api/tags/`);
    const data = await response.json();
    const seen = new Set();
    allTags = data.tags.filter(tag => {
      const normalized = tag.toLowerCase().trim();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
    allTags.sort();
    renderTagsDropdown();
    renderTagCheckboxes();
  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

// Render tags dropdown
function renderTagsDropdown() {
  const tagsList = document.getElementById('tagsList');
  if (!tagsList) return;

  tagsList.innerHTML = '';

  const allTagsBtn = document.createElement('button');
  allTagsBtn.className = 'w-full text-left px-3 py-2 rounded hover:bg-gray-100 font-semibold mb-2';
  allTagsBtn.textContent = 'All Tags';
  allTagsBtn.addEventListener('click', () => {
    selectedTags = [];
    loadHabits();
    loadTasks();
  });
  tagsList.appendChild(allTagsBtn);

  const tagsGrid = document.createElement('div');
  tagsGrid.className = 'grid grid-cols-2 gap-2';

  allTags.forEach(tag => {
    const tagItem = document.createElement('label');
    tagItem.className = 'flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 cursor-pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = tag;
    checkbox.className = 'rounded';
    checkbox.checked = selectedTags.includes(tag);
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!selectedTags.includes(tag)) {
          selectedTags.push(tag);
        }
      } else {
        selectedTags = selectedTags.filter(t => t !== tag);
      }
      loadHabits();
      loadTasks();
    });

    const tagText = document.createElement('span');
    tagText.className = 'text-sm';
    tagText.textContent = tag;

    tagItem.appendChild(checkbox);
    tagItem.appendChild(tagText);
    tagsGrid.appendChild(tagItem);
  });

  tagsList.appendChild(tagsGrid);
}

// Render tag checkboxes in modals
function renderTagCheckboxes() {
  // Habit modal tags
  const habitTagsContainer = document.getElementById('habitTagsContainer');
  if (habitTagsContainer) {
    habitTagsContainer.innerHTML = '';

    // Add custom tag input
    const customTagDiv = document.createElement('div');
    customTagDiv.className = 'mb-3 flex gap-2';
    const customTagInput = document.createElement('input');
    customTagInput.type = 'text';
    customTagInput.id = 'habitCustomTag';
    customTagInput.placeholder = 'Add custom tag...';
    customTagInput.className = 'flex-1 rounded border border-black px-2 py-1 text-sm';
    const addTagBtn = document.createElement('button');
    addTagBtn.type = 'button';
    addTagBtn.textContent = 'Add';
    addTagBtn.className = 'rounded border border-black bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200';
    addTagBtn.addEventListener('click', () => {
      const tagName = customTagInput.value.trim();
      if (tagName) {
        const normalizedTag = tagName.toLowerCase();
        const exists = allTags.some(tag => tag.toLowerCase() === normalized);
        if (!exists) {
          allTags.push(tagName);
          allTags.sort();
          renderTagCheckboxes();
          renderTagsDropdown();
          customTagInput.value = '';
        }
      }
    });
    customTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTagBtn.click();
      }
    });
    customTagDiv.appendChild(customTagInput);
    customTagDiv.appendChild(addTagBtn);
    habitTagsContainer.appendChild(customTagDiv);

    const tagsGrid = document.createElement('div');
    tagsGrid.className = 'grid grid-cols-2 gap-2';

    allTags.forEach(tag => {
      const tagItem = document.createElement('label');
      tagItem.className = 'flex items-center gap-2 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 cursor-pointer';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = tag;
      checkbox.className = 'habit-tag-checkbox rounded';
      checkbox.dataset.tag = tag;

      const tagText = document.createElement('span');
      tagText.className = 'text-sm';
      tagText.textContent = tag;

      tagItem.appendChild(checkbox);
      tagItem.appendChild(tagText);
      tagsGrid.appendChild(tagItem);
    });

    habitTagsContainer.appendChild(tagsGrid);
  }

  // Task modal tags
  const taskTagsContainer = document.getElementById('taskTagsContainer');
  if (taskTagsContainer) {
    taskTagsContainer.innerHTML = '';

    // Add custom tag input
    const customTagDiv = document.createElement('div');
    customTagDiv.className = 'mb-3 flex gap-2';
    const customTagInput = document.createElement('input');
    customTagInput.type = 'text';
    customTagInput.id = 'taskCustomTag';
    customTagInput.placeholder = 'Add custom tag...';
    customTagInput.className = 'flex-1 rounded border border-black px-2 py-1 text-sm';
    const addTagBtn = document.createElement('button');
    addTagBtn.type = 'button';
    addTagBtn.textContent = 'Add';
    addTagBtn.className = 'rounded border border-black bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200';
    addTagBtn.addEventListener('click', () => {
      const tagName = customTagInput.value.trim();
      if (tagName) {
        const normalized = tagName.toLowerCase();
        const exists = allTags.some(tag => tag.toLowerCase() === normalized);
        if(!exists) {
          allTags.push(tagName);
          allTags.sort();
          renderTagCheckboxes();
          renderTagsDropdown();
          customTagInput.value = '';
        }
      }
    });
    customTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTagBtn.click();
      }
    });
    customTagDiv.appendChild(customTagInput);
    customTagDiv.appendChild(addTagBtn);
    taskTagsContainer.appendChild(customTagDiv);

    const tagsGrid = document.createElement('div');
    tagsGrid.className = 'grid grid-cols-2 gap-2';

    allTags.forEach(tag => {
      const tagItem = document.createElement('label');
      tagItem.className = 'flex items-center gap-2 px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 cursor-pointer';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = tag;
      checkbox.className = 'task-tag-checkbox rounded';
      checkbox.dataset.tag = tag;

      const tagText = document.createElement('span');
      tagText.className = 'text-sm';
      tagText.textContent = tag;

      tagItem.appendChild(checkbox);
      tagItem.appendChild(tagText);
      tagsGrid.appendChild(tagItem);
    });

    taskTagsContainer.appendChild(tagsGrid);
  }
}

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

// load tasks
async function loadTasks() {
  try {
    let url = `${API_BASE}/api/tasks/?filter=${taskFilter}`;
    if (searchQuery) {
      url += `&search=${encodeURIComponent(searchQuery)}`;
    }
    if (selectedTags.length > 0) {
      url += `&tag=${encodeURIComponent(selectedTags[0])}`;
    }
    const response = await fetch(url);
    const data = await response.json();
    tasks = data.tasks;
    renderTasks();
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

//render tasks
function renderTasks() {
  const container = document.getElementById('tasksContainer');
  if (!container) return;

  container.innerHTML = '';

  // Today's date for filtering tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter tasks based on current filter
  let filteredTasks = tasks;

  // For completed tasks, only show those completed today
  const completedToday = tasks.filter(t => {
    if (!t.completed || !t.completed_at || t.task_type === 'daily') return false;
    const completedDate = new Date(t.completed_at);
    completedDate.setHours(0, 0, 0, 0);
    return completedDate.getTime() === today.getTime();
  });

  if (taskFilter === 'scheduled') {
    filteredTasks = filteredTasks.filter(t => t.task_type === 'scheduled' && !t.completed);
  } else if (taskFilter === 'dailies') {
    filteredTasks = filteredTasks.filter(t => t.task_type === 'daily');
  } else {
    filteredTasks = filteredTasks.filter(t => t.task_type === 'daily' || !t.completed);
  }

  // Separate tasks into categories
  const dailies = filteredTasks.filter(t => t.task_type === 'daily');
  const scheduled = filteredTasks.filter(t => t.task_type === 'scheduled' && t.due);
  const tasksWithoutDue = filteredTasks.filter(t => t.task_type === 'scheduled' && !t.due);

  const hasIncompleteTasks = dailies.length > 0 || scheduled.length > 0 || tasksWithoutDue.length > 0;
  const hasCompletedToday = completedToday.length > 0;

  if (!hasIncompleteTasks && !hasCompletedToday) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No tasks yet. Create one to get started!</p>';
    return;
  }

  // render dailies
  if (dailies.length > 0) {
    const dailiesSection = document.createElement('div');
    dailiesSection.className = 'mb-4';
    dailiesSection.innerHTML = '<h3 class="mb-2 text-sm font-medium text-gray-600">Dailies</h3>';

    dailies.forEach(task => {
      const taskCard = createTaskCard(task);
      dailiesSection.appendChild(taskCard);
    });

    container.appendChild(dailiesSection);
  }

  // render scheduled tasks
  if (scheduled.length > 0) {
    const scheduledSection = document.createElement('div');
    scheduledSection.className = 'mb-4';
    scheduledSection.innerHTML = '<h3 class="mb-2 text-sm font-medium text-gray-600">Scheduled</h3>';

    scheduled.forEach(task => {
      const taskCard = createTaskCard(task);
      scheduledSection.appendChild(taskCard);
    });

    container.appendChild(scheduledSection);
  }

  // Render tasks without due dates
  if (tasksWithoutDue.length > 0) {
    const tasksSection = document.createElement('div');
    tasksSection.className = 'mb-4';
    tasksSection.innerHTML = '<h3 class="mb-2 text-sm font-medium text-gray-600">Tasks</h3>';

    tasksWithoutDue.forEach(task => {
      const taskCard = createTaskCard(task);
      tasksSection.appendChild(taskCard);
    });

    container.appendChild(tasksSection);
  }

  // Render completed tasks today
  if (hasCompletedToday) {
    const completedSection = document.createElement('div');
    completedSection.className = 'mb-4';
    completedSection.innerHTML = '<h3 class="mb-2 text-sm font-medium text-gray-600">Completed</h3>';

    completedToday.forEach(task => {
      const taskCard = createTaskCard(task);
      completedSection.appendChild(taskCard);
    });

    container.appendChild(completedSection);
  }
}

// Create task card element
function createTaskCard(task) {
  const card = document.createElement('div');
  const isCompleted = task.completed;
  const grayOutClass = isCompleted ? 'opacity-50' : '';

  card.className = `mb-2 flex rounded-lg border border-black bg-white ${grayOutClass}`;
  card.style.borderLeftColor = task.color;
  card.style.borderLeftWidth = '8px';

  const isOverdue = task.overdue && task.task_type === 'scheduled';
  const dueDateText = task.due ? new Date(task.due).toLocaleDateString() : '';

  card.innerHTML = `
    <div class="flex flex-1 items-center justify-between p-3">
      <div class="flex items-center gap-3 flex-1 min-w-0">
         <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="completeTask(${task.id}, this.checked)" class="h-5 w-5 rounded border border-black flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="font-bold ${isOverdue ? 'text-red-600' : ''}">${task.title}</div>
          <div class="text-sm text-gray-600">${task.details || ''}</div>
          <div class="mt-1 flex items-center gap-2 text-xs">
            ${task.task_type === 'daily' ? `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-3 w-3 flex-shrink-0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 8.038 7.047 8.287 8.287 0 0 0 5 9.601a8.983 8.983 0 0 1 1.5-4.396 8.288 8.288 0 0 0 7.496 0M15 21a2.25 2.25 0 0 0 4.5 0A9.178 9.178 0 0 0 15 5.435c-2.485 0-4.5 2.015-4.5 4.5 0 1.204.497 2.292 1.302 3.08M15 21a2.25 2.25 0 0 1-4.5 0c0-1.204.497-2.292 1.302-3.08" />
              </svg>
              <span class="flex-shrink-0">${task.streak}</span>
              ` : task.due ? `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-3 w-3 flex-shrink-0">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <span class="${isOverdue ? 'text-red-600' : ''} flex-shrink-0">${dueDateText}</span>
              ` : ''}
            ${task.tags && task.tags.length > 0 ? `
              <div class="relative group flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-3 w-3 text-gray-500 cursor-pointer">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                  <div class="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg">
                    ${task.tags.join(', ')}
                  </div>
                  <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div class="border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              ` : ''}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0 ml-4">
        <button onclick="editTask(${task.id})" class="flex h-8 w-8 items-center justify-center rounded-full border border-black hover:bg-blue-100 flex-shrink-0" title="Edit task">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
      </div>
    </div>
  `;

  return card;
}

// complete task
async function completeTask(taskId, isChecked) {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}/complete/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({ completed: isChecked }),
    });

    if (response.ok) {
      const data = await response.json();
      loadTasks();
      loadUserProfile();
      loadStatSlots();

      if (data.level_up) {
        showLevelUpAnimation();
      }
    }
  } catch (error) {
    console.error('Error completing task:', error);
  }
}

// load recap
async function loadRecap() {
  try {
    const response = await fetch(`${API_BASE}/api/recap/`);
    const data = await response.json();
    updateRecap(data);
  } catch (error) {
    console.error('Error loading recap:', error);
  }
}

// Update recap UI (horizontally scrollable)
function updateRecap(data) {
  const container = document.getElementById('recapContainer');
  if (!container) return;
  
  container.innerHTML = '';

  const statBoxesContainer = document.getElementById('recapStatBoxes');
  
  // Update recap cards
  const hoursCard = document.getElementById('hoursCard');
  const tasksCard = document.getElementById('tasksCard');
  const dailiesCard = document.getElementById('dailiesCard');
  const bestHabitCard = document.getElementById('bestHabitCard');
  
  // Update best habit card
  if (bestHabitCard && data.best_habit_title) {
    bestHabitCard.textContent = data.best_habit_title;
  }
  
  // Add horizontally scrollable recap items if available
  if (data.items && data.items.length > 0) {
    if (statBoxesContainer) {
      statBoxesContainer.style.display = 'flex';
    }

    if (hoursCard && data.hours_studied !== undefined) {
      hoursCard.textContent = `${data.hours_studied} hours studied last week`;
    }
    if (tasksCard && data.hours_studied !== undefined) {
      tasksCard.textContent = `${data.tasks_completed} tasks completed`;
    }
    if (dailiesCard && data.missed_dailies !== undefined) {
      dailiesCard.textContent = `Missed ${data.missed_dailies} dailies`;
    }

    const recapText = document.getElementById('recapText');
    if (recapText) {
      recapText.textContent = data.recap || 'Standout achievements:';
    }
    
    data.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'flex-shrink-0 flex items-center gap-2 rounded-lg border border-black bg-white px-4 py-2';
      
      let iconSvg = '';
      console.log('Highlight item:', item.type, 'icon:', item.icon, 'title:', item.title);
      if (item.icon === 'clock') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" class="h-6 w-6 flex-shrink-0"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M528 320C528 434.9 434.9 528 320 528C205.1 528 112 434.9 112 320C112 205.1 205.1 112 320 112C434.9 112 528 205.1 528 320zM64 320C64 461.4 178.6 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"/></svg>';
      } else if (item.icon === 'clipboard') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 flex-shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h5.25c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>';
      } else if (item.icon === 'flame') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 640 640" class="h-6 w-6 flex-shrink-0"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M256.5 37.6C265.8 29.8 279.5 30.1 288.4 38.5C300.7 50.1 311.7 62.9 322.3 75.9C335.8 92.4 352 114.2 367.6 140.1C372.8 133.3 377.6 127.3 381.8 122.2C382.9 120.9 384 119.5 385.1 118.1C393 108.3 402.8 96 415.9 96C429.3 96 438.7 107.9 446.7 118.1C448 119.8 449.3 121.4 450.6 122.9C460.9 135.3 474.6 153.2 488.3 175.3C515.5 219.2 543.9 281.7 543.9 351.9C543.9 475.6 443.6 575.9 319.9 575.9C196.2 575.9 96 475.7 96 352C96 260.9 137.1 182 176.5 127C196.4 99.3 216.2 77.1 231.1 61.9C239.3 53.5 247.6 45.2 256.6 37.7zM321.7 480C347 480 369.4 473 390.5 459C432.6 429.6 443.9 370.8 418.6 324.6C414.1 315.6 402.6 315 396.1 322.6L370.9 351.9C364.3 359.5 352.4 359.3 346.2 351.4C328.9 329.3 297.1 289 280.9 268.4C275.5 261.5 265.7 260.4 259.4 266.5C241.1 284.3 207.9 323.3 207.9 370.8C207.9 439.4 258.5 480 321.6 480z"/></svg>';
      } else if (item.icon === 'thumbs-up') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 flex-shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.1 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904"/></svg>';
      } else if (item.icon === 'star') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 flex-shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>';
      } else {
        console.warn('Unknown icon:', item.icon);
      }
      
      const textContent = item.description ? `${item.title}: ${item.description}` : item.title;
      card.innerHTML = `${iconSvg}<span class="text-sm font-medium">${textContent}</span>`;
      container.appendChild(card);
    });
  } else {
    if (statBoxesContainer) {
      statBoxesContainer.style.display = 'none';
    }

    const recapText = document.getElementById('recapText');
    if (recapText && data.recap) {
      recapText.textContent = data.recap;
    }
  }
}

// check dailies
async function checkDailies() {
  try {
    // Check if modal has already been shown today
    const today = new Date().toDateString();
    const lastShownDate = localStorage.getItem('pendingItemsModalShown');
    
    if (lastShownDate === today) {
      // Modal already shown today, skip
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
        // Mark as shown today
        localStorage.setItem('pendingItemsModalShown', today);
      }
    }
  } catch (error) {
    console.error('Error checking dailies;', error);
  }
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
      // Mark modal as shown today (already done when modal was opened, but ensure it's set)
      const today = new Date().toDateString();
      localStorage.setItem('pendingItemsModalShown', today);
      
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

// load stat slots
async function loadStatSlots() {
  try {
    const response = await fetch(`${API_BASE}/api/stats/slots/`);
    const data = await response.json();
    const slots = data.slots;
    
    for (let slotNum = 1; slotNum <= 2; slotNum++) {
      const slot = document.getElementById(`statSlot${slotNum}`);
      if (!slot) continue;

      const statType = slots[slotNum];
      if (statType) {
        try {
          const valueResponse = await fetch(`${API_BASE}/api/stats/value/?type=${statType}`);
          const valueData = await valueResponse.json();

          const valueEl = slot.querySelector('.stat-value');
          const labelEl = slot.querySelector('.stat-label');

          if (valueEl) valueEl.textContent = valueData.value;
          if (labelEl) {
            const labels = {
              'hours_studied': 'hours studied',
              'tasks_completed': 'tasks completed',
              'habits_completed': 'habits completed',
              'current_streak': 'current streak',
              'longest_streak': 'longest streak',
              'coins_earned': 'coins earned',
              'level': 'level',
            };
            labelEl.textContent = labels[statType] || '';
          }
        } catch (error) {
          console.error('Error loading stat value:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error loading stat slots:', error);
  }
}

// add item modal
function showAddItemModal() {
  const modal = document.getElementById('addItemModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

//Habit modal
function showHabitModal(habitId = null) {
  const modal = document.getElementById('habitModal');
  const form = document.getElementById('habitForm');
  const deleteButton = document.getElementById('habitDeleteButton');
  if (modal && form) {
    // Clear form if creating new
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

//task modal
function showTaskModal(taskId = null) {
  const modal = document.getElementById('taskModal');
  const form = document.getElementById('taskForm');
  const deleteButton = document.getElementById('taskDeleteButton');
  if (modal && form) {
    // Clear form if creating new
    if (!taskId) {
      form.reset();
      form.dataset.taskId = '';
      document.querySelector('#taskModal h3').textContent = 'Add Task';
      document.querySelector('#taskModal button[type="submit"]').textContent = 'Create';
      toggleTaskDateField();
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

    // Populate form
    document.getElementById('habitTitle').value = habit.title;
    document.getElementById('habitDetails').value = habit.details || '';
    document.getElementById('habitDifficulty').value = habit.diff;
    document.getElementById('habitAllowPositive').checked = habit.allow_pos;
    document.getElementById('habitAllowNegative').checked = habit.allow_neg;
    document.getElementById('habitResetFreq').value = habit.reset_freq || 'never';

    // Set tag checkboxes
    document.querySelectorAll('.habit-tag-checkbox').forEach(checkbox => {
      checkbox.checked = habit.tags.includes(checkbox.dataset.tag);
    });

    // Set form to edit mode
    const form = document.getElementById('habitForm');
    form.dataset.habitId = habitId;
    document.querySelector('#habitModal h3').textContent = 'Edit Habit';
    document.querySelector('#habitModal button[type="submit"]').textContent = 'Update';

    showHabitModal(habitId);
  } catch (error) {
    console.error('Error loading habit for editing:', error);
  }
}

// Edit task
async function editTask(taskId) {
  try {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      console.error('Task not found');
      return;
    }

    // Populate form
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDetails').value = task.details || '';
    document.getElementById('taskType').value = task.task_type;
    document.getElementById('taskDifficulty').value = task.diff;
    
    // Set tag checkboxes
    document.querySelectorAll('.task-tag-checkbox').forEach(checkbox => {
      checkbox.checked = task.tags.includes(checkbox.dataset.tag);
    });

    // Handle due date
    if (task.due && task.task_type === 'scheduled') {
      const dueDate = new Date(task.due);
      const localDate = new Date(dueDate.getTime() - dueDate.getTimezoneOffset() * 60000);
      document.getElementById('taskDueDate').value = localDate.toISOString().slice(0, 16);
    }

    toggleTaskDateField();

    // Set form to edit mode
    const form = document.getElementById('taskForm');
    form.dataset.taskId = taskId;
    document.querySelector('#taskModal h3').textContent = 'Edit Task';
    document.querySelector('#taskModal button[type="submit"]').textContent = 'Update';

    showTaskModal(taskId);
  } catch (error) {
    console.error('Error loading task for editing:', error);
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

// Delete task
async function deleteTask() {
  const form = document.getElementById('taskForm');
  const taskId = form.dataset.taskId;
  
  if (!taskId) {
    console.error('No task ID found');
    return;
  }

  if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}/delete/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
    });

    if (response.ok) {
      closeModal('taskModal');
      loadTasks();
    } else {
      const data = await response.json();
      alert('Error deleting task: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    alert('Error deleting task. Please try again.');
  }
}

// study session modal
function showStudyModal() {
  const modal = document.getElementById('studyModal');
  if (modal) {
    modal.classList.remove('hidden');
    
    // Reset form
    document.getElementById('studySubject').value = '';
    document.getElementById('studyMode').value = 'timer';
    document.getElementById('studyDuration').value = '25';
    document.getElementById('selectedColor').value = '#3b82f6'
    toggleStudyDurationField()
    //Reset color picker
    const shadePicker = document.getElementById('shadeColorPicker');
    if (shadePicker) {
      shadePicker.classList.add('hidden');
    }
    document.querySelectorAll('.base-color-btn').forEach(btn => {
      btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
    });

    // reload current month colors when opening modal
    loadCurrentMonthColors().then(() => {
      // Select first base color by default
      const firstBaseBtn = document.querySelector('.base-color-btn');
      if (firstBaseBtn) {
        const baseColor = firstBaseBtn.dataset.baseColor;
        showColorShades(0, baseColor);
        setTimeout(() => {
          const firstShadeBtn = document.querySelector('.shade-color-btn');
          if (firstShadeBtn) {
            selectColor(firstShadeBtn.dataset.color);
          }
        }, 100);
      }
    });
  }
}

//initialize color picker with 8 base colors and 10 shades each
function initializeColorPicker() {
  const baseColors = [
    { name: 'Red', base: '#c52626ff' },
    { name: 'Blue', base: '#2354beff' },
    { name: 'Green', base: '#2e7d32ff' },
    { name: 'Yellow', base: '#f9a825ff' },
    { name: 'Purple', base: '#6a1b9aff' },
    { name: 'Orange', base: '#ef6c00ff' },
    { name: 'Pink', base: '#d81b60ff' },
    { name: 'Cyan', base: '#00acc1ff' },
  ];

  const baseColorPicker = document.getElementById('baseColorPicker');
  if (!baseColorPicker) return;

  baseColors.forEach((color, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'base-color-btn h-10 w-10 rounded-full border-2 border-black hover:scale-110 transition-transform';
    btn.style.backgroundColor = color.base;
    btn.dataset.colorIndex = index;
    btn.dataset.baseColor = color.base;
    btn.title = color.name;
    btn.addEventListener('click', () => showColorShades(index, color.base));
    baseColorPicker.appendChild(btn);
  });
}

// Show color shades for selected base color
function showColorShades(colorIndex, baseColor) {
  const shadePicker = document.getElementById('shadeColorPicker');
  const baseBtns = document.querySelectorAll('.base-color-btn');

  // Reset base color buttons
  baseBtns.forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
  });
  baseBtns[colorIndex].classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');

  //Generate 10 shades
  shadePicker.innerHTML = '';
  const shades = generateColorShades(baseColor, 10);

  shades.forEach((shade, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shade-color-btn h-8 w-8 rounded-full border border-gray-300 hover:scale-110 transition-transform';
    btn.style.backgroundColor = shade;
    btn.dataset.color = shade;
    btn.title = shade;
    btn.addEventListener('click', () => selectColor(shade));
    shadePicker.appendChild(btn);
  });

  shadePicker.classList.remove('hidden');
}

// Generate color shades
function generateColorShades(baseColor, count) {
  let hex = baseColor.replace('#', '');
  // Handle 8-character hex (with alpha channel) by removing last 2 characters
  if (hex.length === 8) {
    hex = hex.substr(0, 6);
  }
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const shades = [];
  for (let i = 0; i < count; i++) {
    const factor = i / (count - 1);
    const newR = Math.max(0, Math.min(255, Math.round(r * (1 - factor * 0.4))));
    const newG = Math.max(0, Math.min(255, Math.round(g * (1 - factor * 0.4))));
    const newB = Math.max(0, Math.min(255, Math.round(b * (1 - factor * 0.4))));
    
    const hexR = newR.toString(16).padStart(2, '0');
    const hexG = newG.toString(16).padStart(2, '0');
    const hexB = newB.toString(16).padStart(2, '0');
    shades.push(`#${hexR}${hexG}${hexB}`);
  }
  return shades;
}

// Select a color shade
function selectColor(color) {
  const colorInput = document.getElementById('selectedColor');
  if (colorInput) {
    colorInput.value = color;
  }
  const shadeBtns = document.querySelectorAll('.shade-color-btn');
  shadeBtns.forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
    if (btn.dataset.color === color) {
      btn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
    }
  });
}

// Toggle study duration field based on mode
function toggleStudyDurationField() {
  const mode = document.getElementById('studyMode').value;
  const durationField = document.getElementById('studyDurationField');
  if (mode === 'stopwatch') {
    durationField.style.display = 'none';
  } else {
    durationField.style.display = 'block';
  }
}

//load subject colors from localStorage
function loadSubjectColors() {
  const stored = localStorage.getItem('subjectColors');
  if (stored) {
    subjectColors = JSON.parse(stored);
  }
}

//Save subject colors to localStorage
function saveSubjectColors() {
  localStorage.setItem('subjectColors', JSON.stringify(subjectColors));
}

// Get color for subject
function getSubjectColor(subject) {
  if (subjectColors[subject]) {
    return subjectColors[subject];
  }
  return '#3b82f6';
}

// Setup auto-color selection when typing subject name
let currentMonthColors = {};
let currentMonthUsedColors = new Set();

async function setupStudySubjectAutoColor() {
  // Load current month's colors
  await loadCurrentMonthColors();

  const subjectInput = document.getElementById('studySubject');
  if (subjectInput) {
    subjectInput.addEventListener('input', async (e) => {
      const subject = e.target.value.trim();
      if (subject) {
        await handleSubjectColorAutoSelect(subject);
      }
    });
  }
}

// Load current month's color legend
async function loadCurrentMonthColors() {
  try {
    const response = await fetch(`${API_BASE}/api/study/colors`);
    const data = await response.json();
    currentMonthColors = data.color_legend || {};
    currentMonthUsedColors = new Set(data.used_colors || []);
  } catch (error) {
    console.error('Error loading current month colors:', error);
  }
}

// Handle autocolor selection for subject
async function handleSubjectColorAutoSelect(subject) {
  await loadCurrentMonthColors();
  if (currentMonthColors[subject]) {
    const existingColor = currentMonthColors[subject];
    selectColorInPicker(existingColor);
    return;
  }
  
  // New subject
  const defaultColor = '#3b82f6';
  if (!currentMonthUsedColors.has(defaultColor)) {
    selectColorInPicker(defaultColor);
    return;
  }

  // Default color is taken
  const availableColor = findRandomAvailableColor();
  if(availableColor) {
    selectColorInPicker(availableColor);
  }
}

// Find random color
function findRandomAvailableColor() {
  const baseColors = [
    '#c52626', '#2354be', '#2e7d32', '#f9a825',
    '#6a1b9a', '#ef6c00', '#d81b60', '#00acc1'
  ];

  const allPossibleColors = [];
  baseColors.forEach(baseColor => {
    const shades = generateColorShades(baseColor + 'ff', 10);
    allPossibleColors.push(...shades);
  });

  const availableColors = allPossibleColors.filter(color => !currentMonthUsedColors.has(color));

  if (availableColors.length > 0) {
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  }

  return '#3b82f6';
}

// Select color in the color picker
function selectColorInPicker(color) {
  const colorInput = document.getElementById('selectedColor');
  if (colorInput) {
    colorInput.value = color;
  }

  const baseColors = [
    { name: 'Red', base: '#c52626ff' },
    { name: 'Blue', base: '#2354beff' },
    { name: 'Green', base: '#2e7d32ff' },
    { name: 'Yellow', base: '#f9a825ff' },
    { name: 'Purple', base: '#6a1b9aff' },
    { name: 'Orange', base: '#ef6c00ff' },
    { name: 'Pink', base: '#d81b60ff' },
    { name: 'Cyan', base: '#00acc1ff' },
  ];

  const normalizedColor = color.length === 7 ? color : color.substring(0, 7);

  // Find base color
  for (let i = 0; i < baseColors.length; i++) {
    const baseColor = baseColors[i];
    const shades = generateColorShades(baseColor.base, 10);

    const matchingShadeIndex = shades.findIndex(shade => {
      const normalizedShade = shade.length === 7 ? shade : shade.substring(0, 7);
      return normalizedShade.toLowerCase() === normalizedColor.toLowerCase();
    });

    if (matchingShadeIndex !== -1) {
      showColorShades(i, baseColor.base);

      setTimeout(() => {
        const shadeBtns = document.querySelectorAll('.shade-color-btn');
        shadeBtns.forEach((btn, idx) => {
          if (idx === matchingShadeIndex) {
            selectColor(btn.dataset.color);
          }
        });
      }, 50);
      return;
    }
  }

  selectColor(color);
}

//close modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
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

// Create or Update Task
async function createTask(formData) {
  const form = document.getElementById('taskForm');
  const taskId = form.dataset.taskId;

  try {
    let url, method;
    if (taskId) {
      url = `${API_BASE}/api/tasks/${taskId}/update/`;
      method = 'PUT';
    } else {
      url = `${API_BASE}/api/tasks/create/`;
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
      closeModal('taskModal');
      loadTasks();
      loadTags();
    }
  } catch (error) {
    console.error('Error saving task:', error);
  }
}

// start study session
async function startStudySession(params) {
  // Support both object and individual parameters for backwards compatibility
  let subject, mode, duration, color;
  
  if (typeof params === 'object' && params !== null && params.subject !== undefined) {
    // New signature: called with object {subject, mode, duration, color}
    subject = params.subject;
    mode = params.mode || 'timer';
    duration = params.duration || 25;
    color = params.color || '#3b82f6';
  } else {
    // Old signature: (subject, mode, duration, color) - called with individual params
    subject = arguments[0];
    mode = arguments[1] || 'timer';
    duration = arguments[2] || 25;
    color = arguments[3] || '#3b82f6';
  }

  if (!subject) {
    console.error('Subject is required');
    alert('Please enter a subject name');
    return;
  }

  console.log('Starting study session:', { subject, mode, duration, color });

  try {
    // Check if this is the first session of the month (non-blocking)
    let carryOverColors = false;
    try {
      const firstSessionThisMonth = await checkFirstSessionOfMonth();
      if (firstSessionThisMonth){
        // Check if user wants to carry over colors
        const lastMonthColors = await getLastMonthColors();
        if (lastMonthColors && Object.keys(lastMonthColors).length > 0) {
          const shouldCarryOver = confirm(
            'Would you like to carry over the color legend from last month?'
          );
          if (shouldCarryOver) {
            carryOverColors = true;
          }
        }
      }
    } catch (error) {
      // If checking first session fails, just continue without carry-over
      console.warn('Could not check first session of month:', error);
    }

    console.log('Sending study session request...');
    const response = await fetch(`${API_BASE}/api/habits/study/start/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        subject: subject,
        color: color,
        carry_over_colors: carryOverColors,
      }),
    });

    console.log('Study session response status:', response.status);
    if (response.ok) {
      const data = await response.json();

      // Handle subject change due to color conflict
      if (data.subject_changed && data.subject !== subject) {
        showMessageBanner(
          `The color you selected is already being used by "${data.subject}". Your study subject has been changed to "${data.subject}".`,
        );
        subject = data.subject;
      }
      activeStudySession = {
        id: data.id,
        subject: subject,
        mode: mode,
        duration:duration,
        color: data.color || color,
        startTime: Date.now(),
      };

      //save subject color
      subjectColors[subject] = data.color || color;
      saveSubjectColors();

      // Save session state to localStorage for restoration after refresh
      localStorage.setItem('activeStudySessionState', JSON.stringify({
        mode: mode,
        duration: duration,
        startTime: Date.now(),
        sessionId: data.id
      }));

      //start timer/stopwatch
      startStudyTimer(mode, duration);

      //show active session
      showActiveStudySession();

      //disable non-productivity features
      disableNonProductivityFeatures();

      // Gray out stats link immediately (don't wait for async)
      hasActiveSessionForLink = true;
      const statsLink = document.getElementById('studyStatsLink');
      if (statsLink) {
        statsLink.classList.remove('text-gray-700', 'hover:text-black', 'text-black', 'font-bold', 'text-lg');
        statsLink.classList.add('text-gray-400', 'cursor-not-allowed', 'opacity-50');
      }
      // Also update via API check (async)
      updateStudyStatsLink();

      closeModal('studyModal');
      loadUserProfile();
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error starting study session:', response.status, errorData);
      alert('Failed to start study session. Please try again.');
    }
  } catch (error) {
    console.error('Error starting study session:', error);
    alert('Failed to start study session. Please check the console for details.');
  }
}

// start study timer/stopwatch
function startStudyTimer(mode, durationMinutes) {
  studySessionMode = mode;
  studySessionPaused = false;
  studySessionStartTime = null;
  studySessionTotalPausedTime = 0;

  if (mode === 'timer') {
    studySessionDuration = durationMinutes * 60;
    studySessionStartTime = Date.now();
  } else {
    studySessionDuration = 0;
    studySessionStartTime = Date.now();
  }

  updateStudyTimerDisplay();
  studySessionTimer = setInterval(updateStudyTimerDisplay, 1000);
}

// Update study timer display
function updateStudyTimerDisplay() {
  const timerDisplay = document.getElementById('studySessionTimer');
  if (!timerDisplay || !activeStudySession) return;

  let displaySeconds = 0;

  if (studySessionMode === 'timer') {
    if (studySessionPaused) {
      displaySeconds = studySessionDuration;
    } else {
      const elapsed = Math.floor((Date.now() - studySessionStartTime) / 1000) - studySessionTotalPausedTime;
      displaySeconds = Math.max(0, studySessionDuration - elapsed);

      // Timer finished
      if (displaySeconds <= 0) {
        clearInterval(studySessionTimer);
        displaySeconds = 0;
        stopStudySession();
        alert('Study session complete!');
      }
    }
  } else {
    // Stopwatch mode
    if (studySessionPaused) {
      displaySeconds = studySessionDuration;
    } else {
      const elapsed = Math.floor((Date.now() - studySessionStartTime) / 1000) - studySessionTotalPausedTime;
      displaySeconds = studySessionDuration + elapsed;
    }
  }

  // Format as HH:MM:SS
  const hours = Math.floor(displaySeconds / 3600);
  const minutes = Math.floor((displaySeconds % 3600) / 60);
  const seconds = displaySeconds % 60;
  timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// show active study session
function showActiveStudySession() {
  const modal = document.getElementById('activeStudySessionModal');
  if (!modal || !activeStudySession) return;

  const subjectEl = document.getElementById('studySessionSubject');
  const colorIndicator = document.getElementById('studySessionColorIndicator');
  
  if (subjectEl) {
    subjectEl.textContent = activeStudySession.subject;
  }
  if (colorIndicator) {
    colorIndicator.style.backgroundColor = activeStudySession.color;
  }
  
  modal.classList.remove('hidden');
}

// hide active study session modal
function hideActiveStudySession() {
  const modal = document.getElementById('activeStudySessionModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Pause/resume study session
function pauseStudySession() {
  if (!activeStudySession) return;

  const pauseText = document.getElementById('studySessionPauseText');
  if (!pauseText) return;

  if (!studySessionPaused) {
    // Pause
    clearInterval(studySessionTimer);
    const now = Date.now();
    const elapsed = Math.floor((now - studySessionStartTime) / 1000) - studySessionTotalPausedTime;

    if (studySessionMode === 'stopwatch') {
      studySessionDuration += elapsed;
    } else {
      studySessionDuration = Math.max(0, studySessionDuration - elapsed);
    }

    studySessionPaused = true;
    studySessionPausedStartTime = now;
    pauseText.textContent = 'Resume';
  } else {
    //Resume
    if (studySessionPausedStartTime) {
      const pausedDuration = Math.floor((Date.now() - studySessionPausedStartTime) / 1000);
      studySessionTotalPausedTime += pausedDuration;
    }
    studySessionPaused = false;
    studySessionPausedStartTime = null;
    studySessionTimer = setInterval(updateStudyTimerDisplay, 1000);
    pauseText.textContent = 'Pause';
  }
}

// Disable non-productivity features during study session
function disableNonProductivityFeatures() {
  // disable shop
  const shopLink = document.querySelector('a[href="/shop/"]');
  if (shopLink) {
    shopLink.style.pointerEvents = 'none';
    shopLink.style.opacity = '0.5';
    shopLink.style.cursor = 'not-allowed';
  }

  // TODO: disable other non-productivity features if added in future
}

// Enable non-productivity features after study session
function enableNonProductivityFeatures() {
  // enable shop
  const shopLink = document.querySelector('a[href="/shop/"]');
  if (shopLink) {
    shopLink.style.pointerEvents = '';
    shopLink.style.opacity = '';
    shopLink.style.cursor = '';
  }
}

// stop study session
async function stopStudySession() {
  try {
    const response = await fetch(`${API_BASE}/api/habits/study/stop/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
    });

    if (response.ok) {
      const data = await response.json();

      // Clear timer
      if (studySessionTimer) {
        clearInterval(studySessionTimer);
        studySessionTimer = null;
      }

      activeStudySession = null;
      hasActiveSessionForLink = false;
      
      // Clear stored session state
      localStorage.removeItem('activeStudySessionState');
      
      // Update link color immediately (don't wait for async)
      const statsLink = document.getElementById('studyStatsLink');
      if (statsLink) {
        statsLink.classList.remove('text-gray-400', 'cursor-not-allowed', 'opacity-50');
        if (window.location.pathname === '/stats/') {
          statsLink.classList.add('font-bold', 'text-lg', 'text-black');
        } else {
          statsLink.classList.add('text-gray-700', 'hover:text-black');
        }
      }
      // Also update via API check (async)
      updateStudyStatsLink();
      hideActiveStudySession();
      enableNonProductivityFeatures();
      loadUserProfile();
      loadStatSlots();
      loadRecap();

      if (data.level_up) {
        showLevelUpAnimation();
      }

      // Show completion modal with session stats
      showStudySessionCompletionModal(data);
    }
  } catch (error) {
    console.error('Error stopping study session:', error);
  }
}

// Show study session completion modal
function showStudySessionCompletionModal(data) {
  if (!data) {
    console.error('No data provided to showStudySessionCompletionModal');
    return;
  }

  const modal = document.getElementById('studySessionCompletionModal');
  const hoursEl = document.getElementById('completionHours');
  const xpEl = document.getElementById('completionXP');
  const coinsEl = document.getElementById('completionCoins');

  if (!modal) {
    console.error('Modal element not found');
    return;
  }

  if (!hoursEl || !xpEl || !coinsEl) {
    console.error('Modal content elements not found');
    return;
  }

  const hours = data.hours || (data.duration_minutes ? (data.duration_minutes / 60.0).toFixed(2) : '0');
  const xp = data.xp_earned || 0;
  const coins = data.coins_earned || 0;

  hoursEl.textContent = `${hours} hours`;
  xpEl.textContent = `+${xp}`;
  coinsEl.textContent = `+${coins}`;

  modal.classList.remove('hidden');
  console.log('Study session completion modal shown', { hours, xp, coins });
}

// stop active study session (wrapper)
function stopActiveStudySession() {
  stopStudySession();
}

// Update Study Stats link color based on active session
let hasActiveSessionForLink = false;

// Global function to handle stats link clicks (called from onclick in HTML)
function handleStatsLinkClick(event) {
  if (hasActiveSessionForLink) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    alert('Please finish your active study session before viewing statistics.');
    return false;
  }
  return true;
}

async function updateStudyStatsLink() {
  const statsLink = document.getElementById('studyStatsLink');
  if (!statsLink) {
    // Retry after a short delay if link doesn't exist yet
    setTimeout(updateStudyStatsLink, 100);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/habits/study/stop/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const hasActive = data.active || data.has_active_session;
      hasActiveSessionForLink = hasActive;

      if (hasActive) {
        // Gray out the link (like disabled state)
        statsLink.classList.remove('text-gray-700', 'hover:text-black', 'text-black', 'font-bold', 'text-lg');
        statsLink.classList.add('text-gray-400', 'cursor-not-allowed', 'opacity-50');
      } else {
        // Reset to normal styling
        statsLink.classList.remove('text-gray-400', 'cursor-not-allowed', 'opacity-50');
        if (window.location.pathname === '/stats/') {
          statsLink.classList.add('font-bold', 'text-lg', 'text-black');
        } else {
          statsLink.classList.add('text-gray-700', 'hover:text-black');
        }
      }
    }
  } catch (error) {
    console.error('Error checking active session for stats link:', error);
  }
}

// check active study session
async function checkActiveStudySession() {
  try {
    // Always check for active session, not just when avatar_state is 'studying'
    const response = await fetch(`${API_BASE}/api/habits/study/stop/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.active || data.has_active_session) {
        // Restore active session state
        activeStudySession = {
          id: data.session_id || null,
          subject: data.subject || 'Unknown',
          color: data.color || '#3b82f6',
          startTime: data.start_time ? new Date(data.start_time) : Date.now(),
        };
        
        // Update user profile avatar state
        if (userProfile) {
          userProfile.avatar_state = 'studying';
        }
        
        // Restore timer - calculate elapsed time from start_time
        if (data.start_time) {
          const startTime = new Date(data.start_time);
          studySessionStartTime = startTime.getTime();
          studySessionPaused = false;
          studySessionTotalPausedTime = 0;
          
          // Try to restore mode and duration from localStorage
          const storedState = localStorage.getItem('activeStudySessionState');
          let restoredMode = 'stopwatch';
          let restoredDuration = 0;
          
          if (storedState) {
            try {
              const state = JSON.parse(storedState);
              // Only use stored state if session ID matches
              if (state.sessionId === data.session_id) {
                restoredMode = state.mode || 'stopwatch';
                restoredDuration = state.duration || 0;
              }
            } catch (e) {
              console.error('Error parsing stored session state:', e);
            }
          }
          
          studySessionMode = restoredMode;
          
          if (restoredMode === 'timer' && restoredDuration > 0) {
            // Timer mode: set original duration, elapsed will be calculated in display function
            studySessionDuration = restoredDuration * 60; // Convert minutes to seconds
          } else {
            // Stopwatch mode: duration starts at 0, elapsed will be added in display function
            studySessionDuration = 0;
          }
          
          // Restart the timer display
          if (studySessionTimer) {
            clearInterval(studySessionTimer);
          }
          updateStudyTimerDisplay();
          studySessionTimer = setInterval(updateStudyTimerDisplay, 1000);
        }
        
        // Show active session UI
        showActiveStudySession();
        disableNonProductivityFeatures();
      } else {
        // No active session - make sure UI is cleared
        if (activeStudySession) {
          activeStudySession = null;
          hideActiveStudySession();
          enableNonProductivityFeatures();
        }
      }
    }
  } catch (error) {
    console.error('Error checking active study session:', error);
  }
}

// show stat slot modal
function showStatSlotModal(slotNum) {
  const modal = document.getElementById('statSlotModal');
  if (modal) {
    modal.dataset.slot = slotNum;
    modal.classList.remove('hidden');
  }
}

// update stat slot
async function updateStatSlot(slotNum, statType) {
  try {
    const response = await fetch(`${API_BASE}/api/stats/slots/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        slot_number: slotNum,
        stat_type: statType,
      }),
    });

    if (response.ok) {
      closeModal('statSlotModal');
      await loadStatValue(slotNum, statType);
      loadStatSlots();
    }
  } catch (error) {
    console.error('Error updating stat slot:', error);
  }
}

async function loadStatValue(slotNum, statType) {
  try {
    const valueResponse = await fetch(`${API_BASE}/api/stats/value/?type=${statType}`);
    const valueData = await valueResponse.json();

    const slot = document.getElementById(`statSlot${slotNum}`);
    if (slot) {
      const valueEl = slot.querySelector('.stat-value');
      const labelEl = slot.querySelector('.stat-label');

      if (valueEl) valueEl.textContent = valueData.value;
      if (labelEl) {
        const labels = {
          'hours_studied': 'hours studied',
          'tasks_completed': 'tasks completed',
          'habits_completed': 'habits completed',
          'current_streak': 'current streak',
          'longest_streak': 'longest streak',
          'coins_earned': 'coins earned',
          'level': 'level',
        };
        labelEl.textContent = labels[statType] || '';
      }
    }
  } catch (error) {
    console.error('Error loading stat value:', error);
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

function updateTaskFilters() {
  document.querySelectorAll('.task-filter').forEach(btn => {
    if (btn.dataset.filter === taskFilter) {
      btn.classList.add('font-medium');
      btn.classList.remove('text-gray-600');
    } else {
      btn.classList.remove('font-medium');
      btn.classList.add('text-gray-600');
    }
  });
}

// Check if this is the first study session of the month
async function checkFirstSessionOfMonth() {
  try {
    const response = await fetch(`${API_BASE}/api/study/stats/?type=monthly`);
    if (!response.ok) {
      console.warn('Failed to fetch monthly stats:', response.status);
      return false;
    }
    const data = await response.json();
    // If no sessions this month
    return Object.keys(data.by_day || {}).length === 0;
  } catch (error) {
    console.error('Error checking first session of month:', error);
    return false;
  }
}

// Get last month's color legend
async function getLastMonthColors() {
  try {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const response = await fetch(`${API_BASE}/api/study/colors`);
    if (!response.ok) {
      console.warn('Failed to fetch colors:', response.status);
      return null;
    }
    const data = await response.json();
    return data.color_legend || null;
  } catch (error) {
    console.error('Error getting last month colors:', error);
    return null;
  }
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

// Show Level Up Animation
function showLevelUpAnimation() {
  const avatar = document.getElementById('avatar');
  if (avatar) {
    avatar.classList.add('celebrating');
    setTimeout(() => {
      avatar.classList.remove('celebrating');
    }, 2000);
  }
}

// Make functions available globally
window.togglePendingItem = togglePendingItem;
window.confirmPendingItems = confirmPendingItems;