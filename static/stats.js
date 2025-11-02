// Study Stats Page JavaScript

const API_BASE = '';

let currentView = 'monthly';
let dailyChart = null;
let subjectChart = null;
let statsData = null;
let colorLegend = {};
let currentWeekDayIndex = 0; // For weekly view day navigation
let allWeekDays = []; // Store week days for navigation

// Initialize the stats page
document.addEventListener('DOMContentLoaded', async () => {
  // Check for active study session first - if redirect happens, don't continue
  const redirected = await checkActiveSessionAndRedirect();
  if (redirected) {
    return; // Stop initialization if redirecting
  }
  
  setupEventListeners();
  // Set initial active button style (without loading stats yet)
  currentView = 'monthly';
  document.querySelectorAll('.view-toggle').forEach(btn => {
    if (btn.dataset.view === 'monthly') {
      btn.classList.add('bg-blue-500', 'text-white');
      btn.classList.remove('bg-white', 'text-gray-700');
    } else {
      btn.classList.remove('bg-blue-500', 'text-white');
      btn.classList.add('bg-white', 'text-gray-700');
    }
  });
  // Load stats
  loadStats('monthly');
});

// Check for active study session and redirect if found
async function checkActiveSessionAndRedirect() {
  try {
    const response = await fetch(`${API_BASE}/api/habits/study/stop/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // If there's an active session, redirect to home
      if (data.active || data.has_active_session) {
        alert('Please finish your active study session before viewing statistics.');
        window.location.href = '/';
        return true; // Indicate redirect happened
      }
    }
  } catch (error) {
    console.error('Error checking active session:', error);
  }
  return false; // No redirect
}

// Set up event listeners
function setupEventListeners() {
  // View toggle buttons
  const monthlyBtn = document.getElementById('monthlyBtn');
  const weeklyBtn = document.getElementById('weeklyBtn');
  const tagButton = document.getElementById('tagButton');
  
  if (monthlyBtn) {
    monthlyBtn.addEventListener('click', () => {
      console.log('Monthly button clicked');
      switchView('monthly');
    });
  } else {
    console.error('Monthly button not found');
  }
  
  if (weeklyBtn) {
    weeklyBtn.addEventListener('click', () => {
      console.log('Weekly button clicked');
      switchView('weekly');
    });
  } else {
    console.error('Weekly button not found');
  }

  // Tag button
  if (tagButton) {
    tagButton.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Tag button clicked');
      showColorOrganizationModal();
    });
  } else {
    console.error('Tag button not found');
  }

  // Day navigation buttons (for weekly view)
  const prevDayBtn = document.getElementById('prevDayBtn');
  const nextDayBtn = document.getElementById('nextDayBtn');
  if (prevDayBtn) {
    prevDayBtn.addEventListener('click', () => {
      navigateWeekDay(-1);
    });
  }
  if (nextDayBtn) {
    nextDayBtn.addEventListener('click', () => {
      navigateWeekDay(1);
    });
  }
}

// Switch between monthly and weekly view
function switchView(view) {
  console.log('Switching view to:', view);
  currentView = view;

  // Update button styles
  const buttons = document.querySelectorAll('.view-toggle');
  console.log('Found buttons:', buttons.length);
  buttons.forEach(btn => {
    if (btn.dataset.view === view) {
      btn.classList.add('bg-blue-500', 'text-white');
      btn.classList.remove('bg-white', 'text-gray-700');
      console.log('Activated button:', btn.dataset.view);
    } else {
      btn.classList.remove('bg-blue-500', 'text-white');
      btn.classList.add('bg-white', 'text-gray-700');
    }
  });

  // Show/hide day navigation
  const dayNav = document.getElementById('dayNavigation');
  if (dayNav) {
    if (view === 'weekly') {
      dayNav.classList.remove('hidden');
      // Reset to first day when switching to weekly
      currentWeekDayIndex = 0;
    } else {
      dayNav.classList.add('hidden');
    }
  }

  loadStats(view);
}

// Load stats data
async function loadStats(viewType) {
  try {
    console.log('Loading stats for view type:', viewType);
    const response = await fetch(`${API_BASE}/api/study/stats/?type=${viewType}`);
    if (!response.ok) {
      console.error('Failed to load stats:', response.status);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }
    statsData = await response.json();
    colorLegend = statsData.color_legend || {};
    console.log('Loaded color legend:', colorLegend);
    console.log('Stats data:', statsData);

    updateTotalHours(statsData.total_hours || 0);
    updateColorLegend();
    renderDailyChart();
    renderSubjectChart();
  } catch (error) {
    console.error('Error loading stats:', error);
    alert('Failed to load study statistics. Please refresh the page.');
  }
}

// Update total hours display
function updateTotalHours(hours) {
  const totalHoursEl = document.getElementById('totalHours');
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  totalHoursEl.textContent = `${h}h ${m}m`;
}

// Update color legend
function updateColorLegend() {
  const legendEl = document.getElementById('colorLegend');
  if (!legendEl) {
    console.error('Color legend element not found');
    return;
  }
  
  legendEl.innerHTML = '';
  
  const subjects = Object.keys(colorLegend).sort();
  console.log('Updating color legend with subjects:', subjects);

  if(subjects.length === 0) {
    legendEl.innerHTML = '<p class="text-sm text-gray-500">No subjects yet. Start a study session to assign colors to subjects.</p>';
    return;
  }

  subjects.forEach(subject => {
    const item = document.createElement('div');
    item.className = 'flex items-center gap-2';
    const color = colorLegend[subject] || '#3b82f6';
    item.innerHTML = `
    <div class="h-4 w-4 rounded border border-gray-300" style="background-color: ${color}"></div>
    <span class="text-sm">${subject}</span>
    `;
    legendEl.appendChild(item);
  });
}

// Render daily study chart
function renderDailyChart() {
  const ctx = document.getElementById('dailyChart').getContext('2d');

  if (dailyChart) {
    dailyChart.destroy();
  }

  const titleEl = document.getElementById('dailyChartTitle');

  if (currentView === 'monthly') {
    titleEl.textContent = 'Daily Study Hours (Monthly)';
    renderMonthlyDailyChart(ctx);
  } else {
    titleEl.textContent = 'Daily Study Hours (Weekly)';
    renderWeeklyDailyChart(ctx);
  }
}

// Render monthly daily chart
function renderMonthlyDailyChart(ctx) {
  const byDay = statsData.by_day || {};
  const days = Object.keys(byDay).sort();

  // Get all days in the month
  const now = new Date();
  const year = statsData.year || now.getFullYear();
  const month = statsData.month || now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const allDays = [];
  const datasets = [];
  const subjectTotals = {};

  // Initialize all subjects from color legend with arrays of zeros
  Object.keys(colorLegend).forEach(subject => {
    subjectTotals[subject] = new Array(daysInMonth).fill(0);
  });

  // Initialize all days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    allDays.push(day);

    // Process data for this day
    if (byDay[dateStr]) {
      const dayData = byDay[dateStr];
      Object.keys(dayData).forEach(subject => {
        if (!subjectTotals[subject]) {
          subjectTotals[subject] = new Array(daysInMonth).fill(0);
        }
        subjectTotals[subject][day - 1] = dayData[subject];
      });
    }
  }

  // Create dataset for each subject (only if they have data or are in color legend)
  Object.keys(subjectTotals).forEach(subject => {
    datasets.push({
      label: subject,
      data: subjectTotals[subject],
      backgroundColor: colorLegend[subject] || '#3b82f6',
      borderColor: colorLegend[subject] || '#3b82f6',
      borderWidth: 1,
    });
  });

  // Calculate total hours per day for labels
  const totalHoursPerDay = allDays.map((day, index) => {
    let total = 0;
    Object.keys(subjectTotals).forEach(subject => {
      total += subjectTotals[subject][index] || 0;
    });
    return total;
  });

  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allDays.map(d => `Day ${d}`),
      datasets: datasets,
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const hours = context.parsed.x;
              const h = Math.floor(hours);
              const m = Math.round((hours - h) * 60);
              return `${context.dataset.label}: ${h}h ${m}m`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: 'Hours Studied',
          },
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: 'Day of Month',
          },
        },
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const dayIndex = elements[0].index;
          const day = dayIndex + 1;
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          showDayDetails(dateStr, totalHoursPerDay[dayIndex]);
        }
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      },
    },
  });
}

// Navigate to previous/next day in weekly view
function navigateWeekDay(direction) {
  currentWeekDayIndex += direction;
  if (currentWeekDayIndex < 0) {
    currentWeekDayIndex = 6;
  } else if (currentWeekDayIndex > 6) {
    currentWeekDayIndex = 0;
  }
  updateDayLabel();
  renderDailyChart();
}

// Update the current day label
function updateDayLabel() {
  const dayLabel = document.getElementById('currentDayLabel');
  if (dayLabel && allWeekDays.length > 0) {
    const dayStr = allWeekDays[currentWeekDayIndex];
    const date = new Date(dayStr);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayName = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1];
    const dayNum = date.getDate();
    dayLabel.textContent = `${dayName} ${dayNum}`;
  }
}

// Render weekly daily chart (timetable style)
function renderWeeklyDailyChart(ctx) {
  const byDay = statsData.by_day || {};

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const datasets = [];

  // Get all 7 days of the week
  const now = new Date();
  const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  allWeekDays = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    allWeekDays.push(day.toISOString().split('T')[0]);
  }

  // Update day label
  updateDayLabel();

  // Get the selected day
  const selectedDayStr = allWeekDays[currentWeekDayIndex];
  const selectedDayData = byDay[selectedDayStr] || {};
  
  // Store for use in tooltip callbacks
  window.selectedDayStr = selectedDayStr;
  window.selectedDayData = selectedDayData;

  // Prepare session data for scatter chart (only for selected day)
  const sessionPoints = [];

  if (selectedDayData.sessions) {
    selectedDayData.sessions.forEach(session => {
      const startTime = new Date(session.start_time);
      const hour = startTime.getHours();
      const minutes = startTime.getMinutes();
      const timeInHours = hour + minutes / 60;

      // Create a point for the start of the session
      sessionPoints.push({
        x: 0, // All points on same day, so x = 0
        y: timeInHours,
        duration: (session.duration_minutes || 0) / 60,
        subject: session.subject,
        color: session.color || colorLegend[session.subject] || '#3b82f6',
        startTime: session.start_time,
        durationMinutes: session.duration_minutes || 0
      });
    });
  }

  // Group sessions by subject for different datasets
  const sessionsBySubject = {};
  sessionPoints.forEach(point => {
    if (!sessionsBySubject[point.subject]) {
      sessionsBySubject[point.subject] = [];
    }
    sessionsBySubject[point.subject].push({
      x: point.x,
      y: point.y,
      duration: point.duration,
      color: point.color,
      startTime: point.startTime,
      durationMinutes: point.durationMinutes
    });
  });

  // Create datasets for each subject
  Object.keys(sessionsBySubject).forEach(subject => {
    const sessions = sessionsBySubject[subject];
    datasets.push({
      label: subject,
      data: sessions.map(s => ({ x: s.x, y: s.y })),
      backgroundColor: colorLegend[subject] || '#3b82f6',
      borderColor: colorLegend[subject] || '#3b82f6',
      pointRadius: 8,
      pointHoverRadius: 10,
      pointStyle: 'circle',
      showLine: false,
    });
  });

  dailyChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              const dayStr = window.selectedDayStr || allWeekDays[currentWeekDayIndex];
              const date = new Date(dayStr);
              const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              const dayName = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1];
              const dayNum = date.getDate();
              return `${dayName} ${dayNum}`;
            },
            label: function(context) {
              const point = context.raw;
              const hour = Math.floor(point.y);
              const minutes = Math.round((point.y - hour) * 60);
              const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              
              // Find the session to get duration
              const dayData = window.selectedDayData || {};
              let durationStr = '';
              if (dayData.sessions) {
                const session = dayData.sessions.find(s => {
                  const startTime = new Date(s.start_time);
                  const sHour = startTime.getHours();
                  const sMinutes = startTime.getMinutes();
                  const sTimeInHours = sHour + sMinutes / 60;
                  return Math.abs(sTimeInHours - point.y) < 0.1;
                });
                if (session) {
                  const durHours = Math.floor(session.duration_minutes / 60);
                  const durMins = session.duration_minutes % 60;
                  durationStr = ` - ${durHours}h ${durMins}m`;
                }
              }
              
              return `${context.dataset.label} at ${timeStr}${durationStr}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          min: -0.5,
          max: 0.5,
          ticks: {
            display: false,
          },
          title: {
            display: false,
          },
        },
        y: {
          type: 'linear',
          min: 0,
          max: 24,
          reverse: false,
          ticks: {
            stepSize: 1,
            callback: function(value) {
              return `${value.toString().padStart(2, '0')}:00`;
            },
          },
          title: {
            display: true,
            text: 'Time',
          },
        },
      },
      onClick: (event, elements) => {
        if (elements.length > 0 && currentView === 'weekly') {
          const dayStr = window.selectedDayStr || allWeekDays[currentWeekDayIndex];
          const dayData = window.selectedDayData || {};
          if (dayStr) {
            let totalHours = 0;
            if (dayData.subjects) {
              Object.values(dayData.subjects).forEach(hours => {
                totalHours += hours;
              });
            }
            showDayDetails(dayStr, totalHours);
          }
        }
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      },
    },
  });
}

// Render subject comparison chart
function renderSubjectChart() {
  const ctx = document.getElementById('subjectChart').getContext('2d');

  if (subjectChart) {
    subjectChart.destroy();
  }

  // Get all subjects from color legend, even if they have 0 hours
  const allSubjects = Object.keys(colorLegend).sort();
  const bySubject = statsData.by_subject || {};
  
  // Ensure all subjects from color legend are included, even with 0 hours
  allSubjects.forEach(subject => {
    if (!(subject in bySubject)) {
      bySubject[subject] = 0;
    }
  });
  
  // Sort by hours (descending), but include all subjects
  const subjects = Object.keys(bySubject).sort((a, b) => bySubject[b] - bySubject[a]);
  const data = subjects.map(s => bySubject[s]);
  const colors = subjects.map(s => colorLegend[s] || '#3b82f6');

  subjectChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: subjects,
      datasets: [{
        label: 'Hours Studied',
        data: data,
        backgroundColor: colors,
        borderColor: colors.map(c => c),
        borderWidth: 1,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const hours = context.parsed.x;
              const h = Math.floor(hours);
              const m = Math.round((hours - h) * 60);
              return `${h}h ${m}m`;
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Hours Studied',
          },
        },
        y: {
          title: {
            display: true,
            text: 'Subject',
          },
        },
      },
    },
  });
}

// Show day details modal (for weekly view)
function showDayDetails(dayStr, totalHours) {
  if (currentView !== 'weekly') {
    return;
  }

  const dayData = statsData.by_day[dayStr];
  if (!dayData || !dayData.sessions) {
    return;
  }

  const date = new Date(dayStr);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[date.getDay()];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[date.getMonth()];

  document.getElementById('dayDetailsTitle').textContent = `${dayName}, ${monthName} ${date.getDate()}`;

  const contentEl = document.getElementById('dayDetailsContent');
  contentEl.innerHTML = '';

  // Sort sessions by start time
  const sessions = [...dayData.sessions].sort((a, b) => {
    return new Date(a.start_time) - new Date(b.start_time);
  });

  if (sessions.length === 0) {
    contentEl.innerHTML = '<p class="text-gray-500">No study sessions on this day.</p>';
  } else {
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    contentEl.innerHTML += `<p class="mb-3 font-semibold">Total: ${h}h ${m}m</p>`;

    sessions.forEach(session => {
      const startTime = new Date(session.start_time);
      const hours = Math.floor(session.duration_minutes / 60);
      const minutes = session.duration_minutes % 60;

      const item = document.createElement('div');
      item.className = 'flex items-center gap-3 rounded-lg border border-gray-200 p-3';
      item.innerHTML = `
        <div class="h-4 w-4 rounded border border-gray-300" style="background-color: ${session.color}"></div>
        <div class="flex-1">
          <p class="font-medium">${session.subject}</p>
          <p class="text-sm text-gray-600">${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${hours}h ${minutes}m</p>
        </div>
      `;
      contentEl.appendChild(item);
    });
  }

  document.getElementById('dayDetailsModal').classList.remove('hidden');
}

// Store original subject names for renaming (maps new_name -> old_name)
let subjectRenames = {};

// Show color organization modal
function showColorOrganizationModal() {
  console.log('showColorOrganizationModal called, colorLegend:', colorLegend);
  const modal = document.getElementById('colorModal');
  if (!modal) {
    console.error('Color modal not found');
    alert('Color modal element not found. Please refresh the page.');
    return;
  }
  
  const listEl = document.getElementById('colorOrganizationList');
  if (!listEl) {
    console.error('Color organization list not found');
    alert('Color organization list element not found. Please refresh the page.');
    return;
  }
  
  listEl.innerHTML = '';
  subjectRenames = {};

  const subjects = Object.keys(colorLegend).sort();
  console.log('Subjects in color legend:', subjects);
  
  subjects.forEach(subject => {
    // Track original name (if not already tracked, assume it's the same)
    if (!(subject in subjectRenames)) {
      subjectRenames[subject] = subject;
    }
    const item = document.createElement('div');
    item.className = 'flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50';
    
    // Color circle (clickable)
    const colorCircle = document.createElement('button');
    colorCircle.type = 'button';
    colorCircle.className = 'h-8 w-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform flex-shrink-0';
    colorCircle.style.backgroundColor = colorLegend[subject] || '#3b82f6';
    colorCircle.dataset.subject = subject;
    colorCircle.title = 'Click to change color';
    colorCircle.addEventListener('click', () => {
      showColorPickerForSubject(subject);
    });
    
    // Subject name (clickable to rename)
    const subjectName = document.createElement('div');
    subjectName.className = 'flex-1 cursor-pointer px-2 py-1 rounded hover:bg-gray-100';
    subjectName.textContent = subject;
    subjectName.dataset.subject = subject;
    subjectName.addEventListener('click', () => {
      renameSubject(subject);
    });
    
    item.appendChild(colorCircle);
    item.appendChild(subjectName);
    listEl.appendChild(item);
  });

  // Add button handler
  const addBtn = document.getElementById('addSubjectBtn');
  if (addBtn) {
    addBtn.onclick = () => addNewSubject();
  }

  modal.classList.remove('hidden');
}

// Show color picker for a subject
function showColorPickerForSubject(subject) {
  const modal = document.getElementById('colorPickerModal');
  const content = document.getElementById('colorPickerContent');
  if (!modal || !content) {
    console.error('Color picker modal not found');
    return;
  }

  content.innerHTML = '';
  
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

  // Base colors
  const basePicker = document.createElement('div');
  basePicker.className = 'mb-4';
  basePicker.innerHTML = '<p class="mb-2 text-sm font-medium">Base Colors</p><div class="flex gap-2 flex-wrap"></div>';
  const baseContainer = basePicker.querySelector('div');
  
  baseColors.forEach((color, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'h-10 w-10 rounded-full border-2 border-black hover:scale-110 transition-transform';
    btn.style.backgroundColor = color.base;
    btn.dataset.colorIndex = index;
    btn.dataset.baseColor = color.base;
    btn.title = color.name;
    btn.addEventListener('click', () => {
      showShadesForColorPicker(subject, index, color.base, content);
    });
    baseContainer.appendChild(btn);
  });
  content.appendChild(basePicker);

  // Show shades for current color
  const currentColor = colorLegend[subject] || '#3b82f6';
  let baseIndex = 0;
  for (let i = 0; i < baseColors.length; i++) {
    const shades = generateColorShades(baseColors[i].base, 10);
    const normalizedCurrent = currentColor.length === 7 ? currentColor : currentColor.substring(0, 7);
    if (shades.some(shade => {
      const normalizedShade = shade.length === 7 ? shade : shade.substring(0, 7);
      return normalizedShade.toLowerCase() === normalizedCurrent.toLowerCase();
    })) {
      baseIndex = i;
      break;
    }
  }
  showShadesForColorPicker(subject, baseIndex, baseColors[baseIndex].base, content);

  modal.classList.remove('hidden');
}

// Show shades in color picker
function showShadesForColorPicker(subject, colorIndex, baseColor, content) {
  // Remove existing shade picker if any
  const existingShades = content.querySelector('.shade-picker-container');
  if (existingShades) {
    existingShades.remove();
  }

  // Reset base color buttons
  content.querySelectorAll('[data-color-index]').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
  });
  const clickedBtn = content.querySelector(`[data-color-index="${colorIndex}"]`);
  if (clickedBtn) {
    clickedBtn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
  }

  // Create shade picker
  const shadePicker = document.createElement('div');
  shadePicker.className = 'shade-picker-container';
  shadePicker.innerHTML = '<p class="mb-2 text-sm font-medium">Shades</p><div class="grid grid-cols-5 gap-2"></div>';
  const shadeContainer = shadePicker.querySelector('div');
  
  const shades = generateColorShades(baseColor, 10);
  shades.forEach((shade, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'h-8 w-8 rounded-full border border-gray-300 hover:scale-110 transition-transform';
    btn.style.backgroundColor = shade;
    btn.dataset.color = shade;
    btn.title = shade;
    
    const currentColor = colorLegend[subject] || '#3b82f6';
    const normalizedShade = shade.length === 7 ? shade : shade.substring(0, 7);
    const normalizedCurrent = currentColor.length === 7 ? currentColor : currentColor.substring(0, 7);
    if (normalizedShade.toLowerCase() === normalizedCurrent.toLowerCase()) {
      btn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
    }
    
    btn.addEventListener('click', () => {
      colorLegend[subject] = shade;
      closeModal('colorPickerModal');
      showColorOrganizationModal(); // Refresh the list
    });
    shadeContainer.appendChild(btn);
  });
  
  content.appendChild(shadePicker);
}

// Rename a subject
function renameSubject(oldName) {
  const newName = prompt(`Rename "${oldName}" to:`, oldName);
  if (newName && newName.trim() && newName.trim() !== oldName) {
    const trimmedName = newName.trim();
    if (colorLegend[trimmedName]) {
      alert('A subject with this name already exists!');
      return;
    }
    // Track the rename (map new name to original name)
    const originalName = subjectRenames[oldName] || oldName;
    subjectRenames[trimmedName] = originalName;
    delete subjectRenames[oldName];
    
    // Update color legend
    colorLegend[trimmedName] = colorLegend[oldName];
    delete colorLegend[oldName];
    
    // Refresh the modal
    showColorOrganizationModal();
  }
}

// Add new subject
function addNewSubject() {
  const newName = prompt('Enter subject name:');
  if (newName && newName.trim()) {
    const trimmedName = newName.trim();
    if (colorLegend[trimmedName]) {
      alert('A subject with this name already exists!');
      return;
    }
    // Find an available color
    const baseColors = [
      '#c52626ff', '#2354beff', '#2e7d32ff', '#f9a825ff',
      '#6a1b9aff', '#ef6c00ff', '#d81b60ff', '#00acc1ff'
    ];
    const usedColors = new Set(Object.values(colorLegend));
    let defaultColor = '#3b82f6';
    
    for (const base of baseColors) {
      const shades = generateColorShades(base, 10);
      const availableShade = shades.find(shade => !usedColors.has(shade));
      if (availableShade) {
        defaultColor = availableShade;
        break;
      }
    }
    
    colorLegend[trimmedName] = defaultColor;
    subjectRenames[trimmedName] = trimmedName; // New subject, so original = new
    showColorOrganizationModal();
  }
}

// Generate color shades (same as in app.js)
function generateColorShades(baseColor, count) {
  let hex = baseColor.replace('#', '');
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

// Show color shades for a subject in the organization modal
function showColorShadesForSubject(subject, colorIndex, baseColor, shadePickerEl) {
  // Reset base color buttons for this subject
  const subjectBaseBtns = document.querySelectorAll(`[data-subject="${subject}"].base-color-btn`);
  subjectBaseBtns.forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
  });
  const clickedBtn = document.querySelector(`[data-subject="${subject}"][data-color-index="${colorIndex}"]`);
  if (clickedBtn) {
    clickedBtn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
  }

  // Generate and show shades
  shadePickerEl.innerHTML = '';
  const shades = generateColorShades(baseColor, 10);

  shades.forEach((shade, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shade-color-btn h-8 w-8 rounded-full border border-gray-300 hover:scale-110 transition-transform';
    btn.style.backgroundColor = shade;
    btn.dataset.color = shade;
    btn.dataset.subject = subject;
    btn.title = shade;
    
    // Check if this is the current color
    const currentColor = colorLegend[subject] || '#3b82f6';
    const normalizedShade = shade.length === 7 ? shade : shade.substring(0, 7);
    const normalizedCurrent = currentColor.length === 7 ? currentColor : currentColor.substring(0, 7);
    if (normalizedShade.toLowerCase() === normalizedCurrent.toLowerCase()) {
      btn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
    }
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newColor = shade;
      colorLegend[subject] = newColor;
      updateColorPickerSelection(subject, newColor);
      console.log(`Changed ${subject} color to ${newColor}`);
    });
    shadePickerEl.appendChild(btn);
  });

  shadePickerEl.classList.remove('hidden');
}

function updateColorPickerSelection(subject, color) {
  // Update shade buttons
  document.querySelectorAll(`[data-subject="${subject}"].shade-color-btn`).forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
    const btnColor = btn.dataset.color;
    const normalizedBtn = btnColor.length === 7 ? btnColor : btnColor.substring(0, 7);
    const normalizedColor = color.length === 7 ? color : color.substring(0, 7);
    if (normalizedBtn.toLowerCase() === normalizedColor.toLowerCase()) {
      btn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
    }
  });
}

// Save color organization
async function saveColorOrganization() {
  try {
    // Filter out renames where old === new (no actual rename happened)
    const actualRenames = {};
    Object.keys(subjectRenames).forEach(newName => {
      const oldName = subjectRenames[newName];
      if (oldName !== newName) {
        actualRenames[newName] = oldName;
      }
    });
    
    const response = await fetch(`${API_BASE}/api/study/colors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({ 
        color_legend: colorLegend,
        subject_renames: actualRenames
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Colors saved successfully:', result);
      closeModal('colorModal');
      await loadStats(currentView);
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error saving colors:', response.status, errorData);
      const errorMessage = errorData.error || errorData.message || 'Failed to save color changes. Please try again.';
      alert(`Error: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error saving colors:', error);
    alert(`Failed to save color changes: ${error.message}`);
  }
}

// Close modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  } else {
    console.error('Modal not found:', modalId);
  }
}

// Get CSRF token from cookies
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

// Expose functions globally
window.saveColorOrganization = saveColorOrganization;
window.closeModal = closeModal;
window.showColorOrganizationModal = showColorOrganizationModal;