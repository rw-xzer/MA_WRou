// Study Stats Page JavaScript

const API_BASE = '';

let currentView = 'monthly';
let dailyChart = null;
let subjectChart = null;
let statsData = null;
let colorLegend = {};
let currentWeekOffset = 0; // For weekly view week navigation, 0 = current week
let currentMonthOffset = 0; // For monthly view month navigation, 0 = current month
let allWeekDays = [];

// Initialize the stats page
document.addEventListener('DOMContentLoaded', async () => {
  // Check for active study session first - if redirect happens, don't continue
  const redirected = await checkActiveSessionAndRedirect();
  if (redirected) {
    return; // Stop initialization if redirecting
  }
  
  setupEventListeners();
  // Set initial active button style
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
  loadStats('monthly');
  updateMonthLabel();
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

  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      navigateMonth(-1);
    });
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      navigateMonth(1);
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

  // Show/hide day navigation and week summary
  const dayNav = document.getElementById('dayNavigation');
  const weekSummary = document.getElementById('weekSummaryStats');
  
  if (dayNav) {
      if (view === 'weekly') {
        dayNav.classList.remove('hidden');
        currentWeekOffset = 0;
        allWeekDays = [];
      } else {
      dayNav.classList.add('hidden');
    }
  }
  
  if (weekSummary) {
    if (view === 'weekly') {
      weekSummary.classList.remove('hidden');
    } else {
      weekSummary.classList.add('hidden');
    }
  }
  
  const monthNav = document.getElementById('monthNavigation');
  if (monthNav) {
    if (view === 'monthly') {
      monthNav.classList.remove('hidden');
      currentMonthOffset = 0;
      updateMonthLabel();
    } else {
      monthNav.classList.add('hidden');
    }
  }
  
  loadStats(view);
}

// Load stats data
async function loadStats(viewType) {
  try {
    console.log('Loading stats for view type:', viewType);
    const url = viewType === 'weekly' 
      ? `${API_BASE}/api/study/stats/?type=${viewType}&week_offset=${currentWeekOffset}`
      : `${API_BASE}/api/study/stats/?type=${viewType}&month_offset=${currentMonthOffset}`;
    const response = await fetch(url);
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
    console.log('By day data:', statsData.by_day);

    updateTotalHours(statsData.total_hours || 0);
    updateColorLegend();
    
    // For weekly view, update week summary stats
    if (viewType === 'weekly') {
      updateWeekSummaryStats(statsData);
    }
    
    // For weekly view, if current week has no data, find most recent week with data
    if (viewType === 'weekly') {
      const byDay = statsData.by_day || {};
      const byDayKeys = Object.keys(byDay);
      
      if (byDayKeys.length === 0) {
        // Current week has no data - try to find most recent week with data
        // We'll need to fetch monthly data to find dates with data
        // For now, just use current week and let user navigate with date picker
        console.log('No data in current week. Use date picker to navigate to weeks with data.');
        allWeekDays = [];
      } else {
        // Has data - use the dates from the response
        // The week calculation will happen in renderWeeklyDailyChart
        allWeekDays = [];
      }
    }
    
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

// Update week summary stats
function updateWeekSummaryStats(data) {
  const container = document.getElementById('weekStatsContent');
  if (!container) return;
  
  const byDay = data.by_day || {};
  const bySubject = data.by_subject || {};
  const totalHours = data.total_hours || 0;
  
  // Calculate stats
  const allSessions = [];
  Object.keys(byDay).forEach(dayStr => {
    const dayData = byDay[dayStr];
    if (dayData.sessions) {
      allSessions.push(...dayData.sessions);
    }
  });
  
  const totalSessions = allSessions.length;
  const daysWithSessions = Object.keys(byDay).length;
  const avgHoursPerDay = daysWithSessions > 0 ? (totalHours / daysWithSessions).toFixed(1) : 0;
  
  // Find longest session
  let longestSession = null;
  let longestDuration = 0;
  allSessions.forEach(session => {
    const duration = session.duration_minutes || 0;
    if (duration > longestDuration) {
      longestDuration = duration;
      longestSession = session;
    }
  });
  
  // Find most studied subject
  let mostStudiedSubject = null;
  let mostStudiedHours = 0;
  Object.keys(bySubject).forEach(subject => {
    const hours = bySubject[subject] || 0;
    if (hours > mostStudiedHours) {
      mostStudiedHours = hours;
      mostStudiedSubject = subject;
    }
  });
  
  // Calculate subject breakdown
  const subjectBreakdown = Object.keys(bySubject)
    .map(subject => ({
      subject,
      hours: bySubject[subject] || 0
    }))
    .sort((a, b) => b.hours - a.hours);
  
  let html = '';
  
  // Total hours
  const totalH = Math.floor(totalHours);
  const totalM = Math.round((totalHours - totalH) * 60);
  html += `
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div class="text-xs text-gray-600">Total Hours</div>
      <div class="text-xl font-bold">${totalH}h ${totalM}m</div>
    </div>
  `;
  
  // Total sessions
  html += `
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
      <div class="text-xs text-gray-600">Sessions</div>
      <div class="text-lg font-bold">${totalSessions}</div>
    </div>
  `;
  
  // Days with sessions
  html += `
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
      <div class="text-xs text-gray-600">Active Days</div>
      <div class="text-lg font-bold">${daysWithSessions}/7</div>
    </div>
  `;
  
  // Average hours per day
  html += `
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
      <div class="text-xs text-gray-600">Avg/Day</div>
      <div class="text-lg font-bold">${avgHoursPerDay}h</div>
    </div>
  `;
  
  // Most studied subject
  if (mostStudiedSubject) {
    const msh = Math.floor(mostStudiedHours);
    const msm = Math.round((mostStudiedHours - msh) * 60);
    html += `
      <div class="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
        <div class="text-xs text-gray-600">Most Studied</div>
        <div class="text-sm font-bold truncate" title="${mostStudiedSubject}">${mostStudiedSubject}</div>
        <div class="text-xs text-gray-500">${msh}h ${msm}m</div>
      </div>
    `;
  }
  
  // Longest session
  if (longestSession) {
    const lh = Math.floor(longestDuration / 60);
    const lm = longestDuration % 60;
    html += `
      <div class="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
        <div class="text-xs text-gray-600">Longest</div>
        <div class="text-sm font-bold truncate" title="${longestSession.subject}">${longestSession.subject}</div>
        <div class="text-xs text-gray-500">${lh}h ${lm}m</div>
      </div>
    `;
  }
  
  // Subject breakdown - spans both columns
  if (subjectBreakdown.length > 0) {
    html += `
      <div class="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
        <div class="mb-1.5 text-xs font-semibold text-gray-700">By Subject</div>
        <div class="space-y-1">
    `;
    
    subjectBreakdown.forEach(({ subject, hours }) => {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      const percentage = totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0;
      const color = colorLegend[subject] || '#3b82f6';
      
      html += `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 min-w-0">
            <div class="h-2.5 w-2.5 rounded-full flex-shrink-0" style="background-color: ${color}"></div>
            <span class="text-xs truncate">${subject}</span>
          </div>
          <div class="text-right flex-shrink-0 ml-2">
            <div class="text-xs font-medium">${h}h ${m}m</div>
            <div class="text-[10px] text-gray-500">${percentage}%</div>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
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
  const container = document.getElementById('dailyChartContainer');
  const chartWrapper = document.getElementById('dailyChartWrapper');

  if (dailyChart) {
    dailyChart.destroy();
  }

  const titleEl = document.getElementById('dailyChartTitle');

  if (currentView === 'monthly') {
    titleEl.textContent = 'Daily Study Hours (Monthly)';
    // Set height for monthly view to accommodate all days
    if (container) {
      container.style.height = '800px';
    }
    // Reset wrapper width for monthly view
    if (chartWrapper) {
      chartWrapper.classList.remove('w-32');
      chartWrapper.classList.add('flex-1');
    }
    renderMonthlyDailyChart(ctx);
  } else {
    titleEl.textContent = 'Daily Study Hours (Weekly)';
    if (chartWrapper) {
      chartWrapper.classList.remove('flex-1');
      chartWrapper.classList.add('flex-1');
    }
    if (container) {
      container.style.height = '700px';
    }
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

  // Create dataset for each subject
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

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[month - 1];
  const currentDate = new Date();
  const isCurrentMonth = (year === currentDate.getFullYear() && month === currentDate.getMonth() + 1);
  const labels = allDays.map(d => {
    const isToday = isCurrentMonth && d === currentDate.getDate();
    return isToday ? `${monthName} ${d} (Today)` : `${monthName} ${d}`;
  });

  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
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
          ticks: {
            autoSkip: false, // Show all labels
            maxRotation: 0, // Keep labels horizontal
            minRotation: 0,
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

function navigateWeekDay(direction) {
  currentWeekOffset += direction;
  allWeekDays = [];
  updateDayLabel();
  loadStats('weekly');
}

function navigateMonth(direction) {
  currentMonthOffset += direction;
  updateMonthLabel();
  loadStats('monthly');
}

function updateMonthLabel() {
  const monthLabel = document.getElementById('currentMonthLabel');
  if (monthLabel) {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + currentMonthOffset, 1);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[targetDate.getMonth()];
    const year = targetDate.getFullYear();
    
    const isCurrentMonth = currentMonthOffset === 0;
    const indicator = isCurrentMonth ? ' (Current)' : '';
    
    monthLabel.textContent = `${monthName} ${year}${indicator}`;
    monthLabel.style.minWidth = '200px';
  }
}

function updateDayLabel() {
  const dayLabel = document.getElementById('currentDayLabel');
  if (dayLabel) {
    const now = new Date();
    const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - daysSinceMonday);
    startOfCurrentWeek.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(startOfCurrentWeek);
    startOfWeek.setDate(startOfCurrentWeek.getDate() + (currentWeekOffset * 7));
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startDayName = dayNames[0];
    const startDayNum = startOfWeek.getDate();
    const startMonthName = monthNames[startOfWeek.getMonth()];
    
    const endDayName = dayNames[6];
    const endDayNum = endOfWeek.getDate();
    const endMonthName = monthNames[endOfWeek.getMonth()];
    
    const isCurrentWeek = currentWeekOffset === 0;
    const indicator = isCurrentWeek ? ' (Current)' : '';
    
    const labelText = `${startDayName} ${startDayNum} ${startMonthName} - ${endDayName} ${endDayNum} ${endMonthName}${indicator}`;
    dayLabel.textContent = labelText;
    dayLabel.style.minWidth = '200px';
  }
}

// Render weekly daily chart - timetable style showing session times
function renderWeeklyDailyChart(ctx) {
  const byDay = statsData.by_day || {};

  if (allWeekDays.length === 0) {
    const now = new Date();
    const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - daysSinceMonday);
    startOfCurrentWeek.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(startOfCurrentWeek);
    startOfWeek.setDate(startOfCurrentWeek.getDate() + (currentWeekOffset * 7));

    allWeekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const year = day.getFullYear();
      const month = String(day.getMonth() + 1).padStart(2, '0');
      const date = String(day.getDate()).padStart(2, '0');
      allWeekDays.push(`${year}-${month}-${date}`);
    }
  }

  updateDayLabel();

  const dayLabels = allWeekDays.map((dayStr) => {
    const date = new Date(dayStr + 'T00:00:00');
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayName = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1];
    return dayName;
  });

  const datasets = [];
  const sessionData = [];

  allWeekDays.forEach((dayStr, dayIndex) => {
    const dayData = byDay[dayStr] || {};
    if (dayData.sessions && dayData.sessions.length > 0) {
      dayData.sessions.forEach(session => {
        const startTime = new Date(session.start_time);
        const hour = startTime.getHours();
        const minutes = startTime.getMinutes();
        const startTimeInHours = hour + minutes / 60;
        const durationHours = (session.duration_minutes || 0) / 60;
        const endTimeInHours = startTimeInHours + durationHours;

        // Check if session crosses midnight (goes past 24:00)
        if (endTimeInHours > 24) {
          // Split into two parts; 1. end 24:00, 2. start 00:00 next day
          const hoursUntilMidnight = 24 - startTimeInHours;
          const hoursAfterMidnight = endTimeInHours - 24;
          
          // First
          sessionData.push({
            x: dayIndex,
            y: startTimeInHours,
            width: 0.6,
            height: hoursUntilMidnight,
            subject: session.subject,
            color: session.color || colorLegend[session.subject] || '#3b82f6',
            startTime: session.start_time,
            durationMinutes: session.duration_minutes || 0,
            isSplit: true,
            part: 'first',
          });
          
          // Second
          if (dayIndex < 6) { // Only if not the last day of the week
            sessionData.push({
              x: dayIndex + 1,
              y: 0,
              width: 0.6,
              height: hoursAfterMidnight,
              subject: session.subject,
              color: session.color || colorLegend[session.subject] || '#3b82f6',
              startTime: session.start_time,
              durationMinutes: session.duration_minutes || 0,
              isSplit: true,
              part: 'second',
            });
          }
        } else {
          sessionData.push({
            x: dayIndex,
            y: startTimeInHours,
            width: 0.6,
            height: durationHours,
            subject: session.subject,
            color: session.color || colorLegend[session.subject] || '#3b82f6',
            startTime: session.start_time,
            durationMinutes: session.duration_minutes || 0,
          });
        }
      });
    }
  });

  dailyChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
      onHover: (event, elements) => {
        const canvas = event.native.target;
        const x = event.native.offsetX;
        const y = event.native.offsetY;
        
        const xScale = dailyChart.scales.x;
        const yScale = dailyChart.scales.y;
        const dayIndex = Math.round(xScale.getValueForPixel(x));
        const timeValue = yScale.getValueForPixel(y);
        
        const hoveredSession = sessionData.find(s => {
          const dayMatch = Math.abs(s.x - dayIndex) < 0.5;
          // For split sessions, check if we're in the valid time range
          if (s.isSplit && s.part === 'second') {
            return dayMatch && timeValue >= 0 && timeValue <= s.height;
          } else {
            return dayMatch && timeValue >= s.y && timeValue <= (s.y + s.height);
          }
        });
        
        if (hoveredSession) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'default';
        }
      },
      scales: {
        x: {
          min: -0.5,
          max: 6.5,
          title: {
            display: true,
            text: 'Day',
          },
          ticks: {
            stepSize: 1,
            callback: function(value, index) {
              return '';
            },
          },
          grid: {
            offset: false,
            drawOnChartArea: true,
          },
        },
        y: {
          reverse: true,
          min: 0,
          max: 24,
          title: {
            display: true,
            text: 'Time',
          },
          ticks: {
            stepSize: 1,
            callback: function(value) {
              return `${String(Math.floor(value)).padStart(2, '0')}:00`;
            },
          },
        },
      },
      onClick: (event) => {
        if (currentView === 'weekly') {
          const canvas = event.native.target;
          const rect = canvas.getBoundingClientRect();
          const x = event.native.offsetX;
          const y = event.native.offsetY;
          
          const xScale = dailyChart.scales.x;
          const yScale = dailyChart.scales.y;
          const dayIndex = Math.round(xScale.getValueForPixel(x));
          const timeValue = yScale.getValueForPixel(y);
          
          const clickedSession = sessionData.find(s => {
            const dayMatch = Math.abs(s.x - dayIndex) < 0.5;
            // For split sessions, check if we're in the valid time range
            if (s.isSplit && s.part === 'second') {
              return dayMatch && timeValue >= 0 && timeValue <= s.height;
            } else {
              return dayMatch && timeValue >= s.y && timeValue <= (s.y + s.height);
            }
          });
          
          if (clickedSession) {
            const dayStr = allWeekDays[dayIndex];
            const dayData = byDay[dayStr] || {};
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
    },
    plugins: [{
      id: 'drawSessionBars',
      afterDraw: (chart) => {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        
        sessionData.forEach(session => {
          const x = xScale.getPixelForValue(session.x);
          const yStart = yScale.getPixelForValue(session.y);
          const yEnd = yScale.getPixelForValue(session.y + session.height);
          
          const barWidth = 30;
          const barHeight = yStart - yEnd;
          
          ctx.save();
          ctx.fillStyle = session.color;
          ctx.strokeStyle = session.color;
          ctx.lineWidth = 1;
          ctx.fillRect(x - barWidth / 2, yEnd, barWidth, barHeight);
          ctx.strokeRect(x - barWidth / 2, yEnd, barWidth, barHeight);
          ctx.restore();
        });
        
        // Draw day labels at bar positions (centers)
        dayLabels.forEach((label, index) => {
          const x = xScale.getPixelForValue(index);
          const y = yScale.bottom;
          ctx.save();
          ctx.fillStyle = '#666';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(label, x, y + 5);
          ctx.restore();
        });
      },
      afterEvent: (chart, args) => {
        if (!args.event || !args.event.native) return;
        
        let tooltipEl = document.getElementById('sessionTooltip');
        if (!tooltipEl) {
          tooltipEl = document.createElement('div');
          tooltipEl.id = 'sessionTooltip';
          tooltipEl.style.cssText = 'position: fixed; background: rgba(0, 0, 0, 0.85); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 10000; display: none; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
          document.body.appendChild(tooltipEl);
        }
        
        const eventType = args.event.type || args.event.native.type;
        
        if (eventType === 'mousemove') {
          const canvas = chart.canvas;
          const rect = canvas.getBoundingClientRect();
          const x = args.event.native.offsetX || (args.event.native.clientX - rect.left);
          const y = args.event.native.offsetY || (args.event.native.clientY - rect.top);
          
          const xScale = chart.scales.x;
          const yScale = chart.scales.y;
          const dayIndex = Math.round(xScale.getValueForPixel(x));
          const timeValue = yScale.getValueForPixel(y);
          
          const session = sessionData.find(s => {
            const dayMatch = Math.abs(s.x - dayIndex) < 0.5;
            // For split sessions, check if we're in the valid time range
            if (s.isSplit && s.part === 'second') {
              return dayMatch && timeValue >= 0 && timeValue <= s.height;
            } else {
              return dayMatch && timeValue >= s.y && timeValue <= (s.y + s.height);
            }
          });
          
          if (session) {
            const startTime = new Date(session.startTime);
            const hours = startTime.getHours();
            const minutes = startTime.getMinutes();
            const h = Math.floor(session.durationMinutes / 60);
            const m = session.durationMinutes % 60;
            const startTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            
            tooltipEl.innerHTML = `<div style="font-weight: bold; margin-bottom: 4px;">${session.subject}</div><div>Start: ${startTimeStr}</div><div>Duration: ${h}h ${m}m</div>`;
            tooltipEl.style.display = 'block';
            tooltipEl.style.left = (args.event.native.clientX + 15) + 'px';
            tooltipEl.style.top = (args.event.native.clientY - 10) + 'px';
            canvas.style.cursor = 'pointer';
          } else {
            tooltipEl.style.display = 'none';
            canvas.style.cursor = 'default';
          }
        } else if (eventType === 'mouseout') {
          tooltipEl.style.display = 'none';
        }
      },
    }],
  });
  
  // Attach mousemove event directly to canvas for tooltip
  const canvas = ctx.canvas;
  let tooltipEl = document.getElementById('sessionTooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'sessionTooltip';
    tooltipEl.style.cssText = 'position: fixed; background: rgba(0, 0, 0, 0.85); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 10000; display: none; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
    document.body.appendChild(tooltipEl);
  }
  
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.offsetX;
    const y = e.offsetY;
    
    const xScale = dailyChart.scales.x;
    const yScale = dailyChart.scales.y;
    const dayIndex = Math.round(xScale.getValueForPixel(x));
    const timeValue = yScale.getValueForPixel(y);
    
    const session = sessionData.find(s => {
      const dayMatch = Math.abs(s.x - dayIndex) < 0.5;
      // For split sessions, check if we're in the valid time range
      if (s.isSplit && s.part === 'second') {
        return dayMatch && timeValue >= 0 && timeValue <= s.height;
      } else {
        return dayMatch && timeValue >= s.y && timeValue <= (s.y + s.height);
      }
    });
    
    if (session) {
      const startTime = new Date(session.startTime);
      const hours = startTime.getHours();
      const minutes = startTime.getMinutes();
      const h = Math.floor(session.durationMinutes / 60);
      const m = session.durationMinutes % 60;
      const startTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      
      tooltipEl.innerHTML = `<div style="font-weight: bold; margin-bottom: 4px;">${session.subject}</div><div>Start: ${startTimeStr}</div><div>Duration: ${h}h ${m}m</div>`;
      tooltipEl.style.display = 'block';
      tooltipEl.style.left = (e.clientX + 15) + 'px';
      tooltipEl.style.top = (e.clientY - 10) + 'px';
      canvas.style.cursor = 'pointer';
    } else {
      tooltipEl.style.display = 'none';
      canvas.style.cursor = 'default';
    }
  });
  
  canvas.addEventListener('mouseout', () => {
    if (tooltipEl) {
      tooltipEl.style.display = 'none';
    }
  });
}

// Render subject comparison chart
function renderSubjectChart() {
  const ctx = document.getElementById('subjectChart').getContext('2d');
  const container = document.getElementById('subjectChartContainer');

  if (subjectChart) {
    subjectChart.destroy();
  }

  // Get subjects from the data (only subjects that appear in this view)
  const bySubject = statsData.by_subject || {};
  
  // For weekly view, only show subjects that appear in the week
  // For monthly view, show all subjects from color legend
  let subjects;
  if (currentView === 'weekly') {
    // Only show subjects that have hours in this week
    subjects = Object.keys(bySubject).filter(s => bySubject[s] > 0).sort((a, b) => bySubject[b] - bySubject[a]);
  } else {
    // Monthly view show all subjects from color legend
    const allSubjects = Object.keys(colorLegend).sort();
    allSubjects.forEach(subject => {
      if (!(subject in bySubject)) {
        bySubject[subject] = 0;
      }
    });
    subjects = Object.keys(bySubject).sort((a, b) => bySubject[b] - bySubject[a]);
  }
  const data = subjects.map(s => bySubject[s]);
  const colors = subjects.map(s => colorLegend[s] || '#3b82f6');

  const fixedBarHeight = 32;
  const minHeight = 128;
  const padding = 80;
  const calculatedHeight = Math.max(minHeight, subjects.length * fixedBarHeight + padding);
  
  if (container) {
    container.style.height = `${calculatedHeight}px`;
  }

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
        maxBarThickness: fixedBarHeight,
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
          ticks: {
            autoSkip: false,
          },
          categoryPercentage: 0.8,
          barPercentage: 1.0,
        },
      },
    },
  });
}

// Show day details modal
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

// Store original subject names for renaming
let subjectRenames = {};

// Show color organization modal
async function showColorOrganizationModal() {
  console.log('showColorOrganizationModal called');
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
  
  const preservedColorLegend = Object.keys(colorLegend).length > 0 ? { ...colorLegend } : null;
  const preservedRenames = Object.keys(subjectRenames).length > 0 ? { ...subjectRenames } : null;
  
  listEl.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/api/study/colors`);
    if (response.ok) {
      const data = await response.json();
      const apiColorLegend = data.color_legend || {};
      
      // Start with API data
      let modalColorLegend = { ...apiColorLegend };
      
      if (preservedRenames) {
        subjectRenames = { ...preservedRenames };
        
        // For each rename update modalColorLegend
        Object.keys(subjectRenames).forEach(newName => {
          const originalName = subjectRenames[newName];
          if (originalName !== newName) {
            if (modalColorLegend[originalName]) {
              delete modalColorLegend[originalName];
            }
            // Add new name with color
            if (preservedColorLegend && preservedColorLegend[newName]) {
              modalColorLegend[newName] = preservedColorLegend[newName];
            } else if (apiColorLegend[originalName]) {
              modalColorLegend[newName] = apiColorLegend[originalName];
            }
          }
        });
      } else {
        // No preserved renames
        subjectRenames = {};
        Object.keys(modalColorLegend).forEach(subject => {
          subjectRenames[subject] = subject;
        });
      }
      
      // Apply any other color changes
      if (preservedColorLegend) {
        Object.keys(preservedColorLegend).forEach(subject => {
          // Check if renamed subject
          const isRenamed = preservedRenames && subject in preservedRenames && preservedRenames[subject] !== subject;
          
          if (!isRenamed) {
            modalColorLegend[subject] = preservedColorLegend[subject];
          }
        });
      }
      
      Object.keys(modalColorLegend).forEach(subject => {
        if (!(subject in subjectRenames)) {
          subjectRenames[subject] = subject;
        }
      });
      
      const subjects = Object.keys(modalColorLegend).sort();
      console.log('Subjects in modal color legend:', subjects);
      
      subjects.forEach(subject => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50';
        
        // Color circle
        const colorCircle = document.createElement('button');
        colorCircle.type = 'button';
        colorCircle.className = 'h-8 w-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform flex-shrink-0';
        colorCircle.style.backgroundColor = modalColorLegend[subject] || '#3b82f6';
        colorCircle.dataset.subject = subject;
        colorCircle.title = 'Click to change color';
        colorCircle.addEventListener('click', () => {
          showColorPickerForSubject(subject);
        });
        
        // Subject name
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
      colorLegend = modalColorLegend;
    } else {
      console.error('Failed to load current month colors');
      alert('Failed to load color legend. Please try again.');
      return;
    }
  } catch (error) {
    console.error('Error loading current month colors:', error);
    alert('Failed to load color legend. Please try again.');
    return;
  }

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
      // Update the global colorLegend
      colorLegend[subject] = shade;
      closeModal('colorPickerModal');
      showColorOrganizationModal();
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
    // Track the rename
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
    // Filter out renames where old equals new
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

// Show date picker modal
function showDatePicker() {
  const modal = document.getElementById('datePickerModal');
  const input = document.getElementById('datePickerInput');
  if (modal && input && allWeekDays.length > 0) {
    const startOfWeek = allWeekDays[0];
    input.value = startOfWeek;
    modal.classList.remove('hidden');
  }
}

// Apply date picker selection
function applyDatePicker() {
  const input = document.getElementById('datePickerInput');
  if (!input || !input.value) return;
  
  const selectedDate = input.value;
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const now = new Date();
  const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const startOfCurrentWeek = new Date(now);
  startOfCurrentWeek.setDate(now.getDate() - daysSinceMonday);
  startOfCurrentWeek.setHours(0, 0, 0, 0);
  
  const selectedDaysSinceMonday = selectedDateObj.getDay() === 0 ? 6 : selectedDateObj.getDay() - 1;
  const startOfSelectedWeek = new Date(selectedDateObj);
  startOfSelectedWeek.setDate(selectedDateObj.getDate() - selectedDaysSinceMonday);
  startOfSelectedWeek.setHours(0, 0, 0, 0);
  
  const diffTime = startOfSelectedWeek - startOfCurrentWeek;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  currentWeekOffset = Math.floor(diffDays / 7);
  
  allWeekDays = [];
  closeModal('datePickerModal');
  updateDayLabel();
  loadStats('weekly');
}

// Make functions globally accessible
window.showDatePicker = showDatePicker;
window.applyDatePicker = applyDatePicker;

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
window.showColorOrganizationModal = showColorOrganizationModal;