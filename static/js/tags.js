// Tag management

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

