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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadUserProfile();
  loadHabits();
  loadTasks();
  loadRecap();
  checkDailies();
  loadStatSlots();
  setupEventListeners();

  checkActiveStudySession();
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
  if (coinsText) coinsText.textContent = userProfile.coins;

  // Update avatar state
  updateAvatar(userProfile.avatar_state);

}

// Update avatar animation
function updateAvatar(state) {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;

  avatar.className = `avatar avatar-${state}`;
}

// Load habits
async function loadHabits() {
  try {
    const response = await fetch(`${API_BASE}/api/habits/?filter=${habitFilter}`);
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
        ${habit.allow_pos ? `
          <button onclick="completeHabit(${habit.id}, true)" class="flex h-8 w-8 items-center justify-center rounded-full border border-black hover:bg-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        ` : ''}
        <div class="flex-1">
          <div class="font-bold">${habit.title}</div>
          <div class="text-sm text-gray-600">${habit.details || ''}</div>
          <div class="mt-1 flex items-center gap-2 text-xs">
            <span>+${habit.pos_count} | -${habit.neg_count}</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="h-3 w-3">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="editHabit(${habit.id})" class="flex h-8 w-8 items-center justify-center rounded-full border border-black hover:bg-blue-100" title="Edit habit">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
        ${habit.allow_neg ? `
          <button onclick="completeHabit(${habit.id}, false)" class="flex h-8 w-8 items-center justify-center rounded-full border border-black hover:bg-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15" />
            </svg>
          </button>
        ` : ''}
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
    const response = await fetch(`${API_BASE}/api/tasks/?filter=${taskFilter}`);
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

  // Filter tasks based on current filter
  let filteredTasks = tasks;
  if (taskFilter === 'scheduled') {
    filteredTasks = tasks.filter(t => t.task_type === 'scheduled');
  } else if (taskFilter === 'dailies') {
    filteredTasks = tasks.filter(t => t.task_type === 'daily');
  }

  if (filteredTasks.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No tasks yet. Create one to get started!</p>';
    return;
  }

  const dailies = filteredTasks.filter(t => t.task_type === 'daily');
  const scheduled = filteredTasks.filter(t => t.task_type === 'scheduled');

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
}

// Create task card element
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'mb-2 flex rounded-lg border border-black bg-white';
  card.style.borderLeftColor = task.color;
  card.style.borderLeftWidth = '8px';

  const isOverdue = task.overdue && task.task_type === 'scheduled';
  const dueDateText = task.due ? new Date(task.due).toLocaleDateString() : '';

  card.innerHTML = `
    <div class="flex flex-1 items-center justify-between p-3">
      <div class="flex items-center gap-3">
         <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="completeTask(${task.id})" class="h-5 w-5 rounded border border-black" />
        <div class="flex-1">
          <div class="font-bold ${isOverdue ? 'text-red-600' : ''}">${task.title}</div>
          <div class="text-sm text-gray-600">${task.details || ''}</div>
          <div class="mt-1 flex items-center gap-2 text-xs">
            ${task.task_type === 'daily' ? `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-3 w-3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 8.038 7.047 8.287 8.287 0 0 0 5 9.601a8.983 8.983 0 0 1 1.5-4.396 8.288 8.288 0 0 0 7.496 0M15 21a2.25 2.25 0 0 0 4.5 0A9.178 9.178 0 0 0 15 5.435c-2.485 0-4.5 2.015-4.5 4.5 0 1.204.497 2.292 1.302 3.08M15 21a2.25 2.25 0 0 1-4.5 0c0-1.204.497-2.292 1.302-3.08" />
              </svg>
              <span>${task.streak}</span>
              ` : `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-3 w-3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <span class="${isOverdue ? 'text-red-600' : ''}">${dueDateText}</span>
              `}
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="ml-auto h-3 w-3">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="editTask(${task.id})" class="flex h-8 w-8 items-center justify-center rounded-full border border-black hover:bg-blue-100" title="Edit task">
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
async function completeTask(taskId) {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}/complete/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
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
  
  // Update metric cards
  const hoursCard = document.getElementById('hoursCard');
  const tasksCard = document.getElementById('tasksCard');
  const dailiesCard = document.getElementById('dailiesCard');
  
  if (hoursCard && data.hours_studied !== undefined) {
    hoursCard.textContent = `${data.hours_studied} hours studied last week`;
  }
  if (tasksCard && data.tasks_completed !== undefined) {
    tasksCard.textContent = `${data.tasks_completed} Tasks completed`;
  }
  if (dailiesCard && data.missed_dailies !== undefined) {
    dailiesCard.textContent = `Missed ${data.missed_dailies} Dailies`;
  }
  
  // Add horizontally scrollable recap items if available
  if (data.items && data.items.length > 0) {
    const recapText = document.getElementById('recapText');
    if (recapText) {
      recapText.textContent = 'Standout achievements:';
    }
    
    data.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'flex-shrink-0 flex items-center gap-2 rounded-lg border border-black bg-white px-4 py-2';
      
      let iconSvg = '';
      if (item.icon === 'clock') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>';
      } else if (item.icon === 'clipboard') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h5.25c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>';
      } else if (item.icon === 'flame') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 8.038 7.047 8.287 8.287 0 0 0 5 9.601a8.983 8.983 0 0 1 1.5-4.396 8.288 8.288 0 0 0 7.496 0M15 21a2.25 2.25 0 0 0 4.5 0A9.178 9.178 0 0 0 15 5.435c-2.485 0-4.5 2.015-4.5 4.5 0 1.204.497 2.292 1.302 3.08M15 21a2.25 2.25 0 0 1-4.5 0c0-1.204.497-2.292 1.302-3.08" /></svg>';
      } else if (item.icon === 'thumbs-up') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.1 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m14.141-2.25a11.999 11.999 0 0 0-2.5 5.642M11.25 2.25H9A2.25 2.25 0 0 0 6.75 4.5v15A2.25 2.25 0 0 0 9 21.75h2.25A2.25 2.25 0 0 0 13.5 19.5v-15a2.25 2.25 0 0 0-2.25-2.25Z" /></svg>';
      } else if (item.icon === 'star') {
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>';
      }
      
      const textContent = item.description ? `${item.title}: ${item.description}` : item.title;
      card.innerHTML = `${iconSvg}<span class="text-sm font-medium">${textContent}</span>`;
      container.appendChild(card);
    });
  } else {
    const recapText = document.getElementById('recapText');
    if (recapText && data.recap) {
      recapText.textContent = data.recap;
    }
  }
}

// check dailies
async function checkDailies() {
  try {
    await fetch(`${API_BASE}/api/dailies/check`, {
      method: 'GET',
    });
  } catch (error) {
    console.error('Error checking dailies;', error);
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
    document.getElementById('habitTags').value = habit.tags.join(', ');

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
    document.getElementById('taskTags').value = task.tags.join(', ');

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
  }
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
    }
  } catch (error) {
    console.error('Error saving task:', error);
  }
}

// start study session
async function startStudySession(subject) {
  try {
    const response = await fetch(`${API_BASE}/api/habits/study/start/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({ subject }),
    });

    if (response.ok) {
      activeStudySession = true;
      closeModal('studyModal');
      loadUserProfile();
    }
  } catch (error) {
    console.error('Error starting study session:', error);
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
      activeStudySession = false;
      loadUserProfile();
      loadStatSlots();
      loadRecap();
    }
  } catch (error) {
    console.error('Error stopping study session:', error);
  }
}

// check active study session
async function checkActiveStudySession() {
  // TODO: implement this function; too tired rn
  // For now, assume no active session on page load
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
      loadStatSlots();
    }
  } catch (error) {
    console.error('Error updating stat slot:', error);
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