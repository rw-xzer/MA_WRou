// Task Management

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

  if (tasks.length === 0) {
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

//task modal
function showTaskModal(taskId = null) {
  const modal = document.getElementById('taskModal');
  const form = document.getElementById('taskForm');
  const deleteButton = document.getElementById('taskDeleteButton');
  if (modal && form) {
    renderTagCheckboxes();
    
    // Clear form if creating new task
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

// Toggle task date field based on task type
function toggleTaskDateField() {
  const taskType = document.getElementById('taskType').value;
  const dateField = document.getElementById('taskDateField');
  if (dateField) {
    if (taskType === 'daily') {
      dateField.style.display = 'none';
    } else {
      dateField.style.display = 'block';
    }
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

    // Set form to edit mode
    const form = document.getElementById('taskForm');
    form.dataset.taskId = taskId;
    document.querySelector('#taskModal h3').textContent = 'Edit Task';
    document.querySelector('#taskModal button[type="submit"]').textContent = 'Update';

    showTaskModal(taskId);

    // Populate form after modal is shown and tags are rendered
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDetails').value = task.details || '';
    document.getElementById('taskType').value = task.task_type;
    document.getElementById('taskDifficulty').value = task.diff;

    // Handle due date
    if (task.due && task.task_type === 'scheduled') {
      const dueDate = new Date(task.due);
      const localDate = new Date(dueDate.getTime() - dueDate.getTimezoneOffset() * 60000);
      document.getElementById('taskDueDate').value = localDate.toISOString().slice(0, 16);
    }

    toggleTaskDateField();
    
    // Set tag checkboxes after renderTagCheckboxes has run
    setTimeout(() => {
      document.querySelectorAll('.task-tag-checkbox').forEach(checkbox => {
        checkbox.checked = task.tags && task.tags.includes(checkbox.dataset.tag);
      });
    }, 0);
  } catch (error) {
    console.error('Error loading task for editing:', error);
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

// Quick create task with default settings
async function quickCreateTask(title) {
  if (!title || !title.trim()) {
    return;
  }

  const formData = {
    title: title.trim(),
    details: '',
    task_type: 'scheduled',
    diff: 'trivial',
    tags: [],
    // No due_date means no due date
  };

  try {
    const response = await fetch(`${API_BASE}/api/tasks/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      loadTasks();
      loadTags();
      return true;
    } else {
      console.error('Error creating task:', await response.json());
      return false;
    }
  } catch (error) {
    console.error('Error creating task:', error);
    return false;
  }
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

// Expose functions globally for HTML onclick handlers
window.completeTask = completeTask;
window.editTask = editTask;
window.deleteTask = deleteTask;
window.showTaskModal = showTaskModal;
window.createTask = createTask;
window.toggleTaskDateField = toggleTaskDateField;
window.updateTaskFilters = updateTaskFilters;
window.quickCreateTask = quickCreateTask;

