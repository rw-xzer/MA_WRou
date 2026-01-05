// Study Session Management

// Study session state for auto-color
let currentMonthColors = {};
let currentMonthUsedColors = new Set();

// study session modal
async function showStudyModal() {
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

    // Check if first session of month and show carry-over prompt
    // Explicitly set to false first to ensure no accidental carry-over
    modal.dataset.colorsCarriedOver = 'false';
    
    try {
      const firstSessionThisMonth = await checkFirstSessionOfMonth();
      if (firstSessionThisMonth) {
        const lastMonthColors = await getLastMonthColors();
        if (lastMonthColors && Object.keys(lastMonthColors).length > 0) {
          const shouldCarryOver = confirm(
            'Would you like to carry over the color legend from last month?'
          );
          if (shouldCarryOver) {
            // Carry over colors immediately so auto-color selection works
            try {
              const response = await fetch(`${API_BASE}/api/study/colors/carry-over`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-CSRFToken': getCsrfToken(),
                },
              });
              if (response.ok) {
                const data = await response.json();
                // Store that we carried over colors so startStudySession knows
                modal.dataset.colorsCarriedOver = 'true';
              } else {
                const errorData = await response.json().catch(() => ({}));
                console.warn('Failed to carry over colors:', response.status, errorData);
                modal.dataset.colorsCarriedOver = 'false';
              }
            } catch (error) {
              console.error('Error carrying over colors:', error);
              modal.dataset.colorsCarriedOver = 'false';
            }
          }
          // If user clicked "No" or closed the dialog, colorsCarriedOver stays 'false'
        }
      }
    } catch (error) {
      console.warn('Could not check first session of month:', error);
      // Ensure it's false on error
      modal.dataset.colorsCarriedOver = 'false';
    }

    // reload current month colors when opening modal (after potential carry-over)
    await loadCurrentMonthColors();
    
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

  try {
    // Check if colors were already carried over in the modal
    let carryOverColors = false;
    const studyModal = document.getElementById('studyModal');
    if (studyModal) {
      const colorsCarriedOver = studyModal.dataset.colorsCarriedOver;
      if (colorsCarriedOver === 'true') {
        carryOverColors = true;
      }
      // Clear the flag after checking
      delete studyModal.dataset.colorsCarriedOver;
    }

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
      
      // Reload current month colors after session starts (in case colors were carried over)
      await loadCurrentMonthColors();

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
}

// stop active study session (wrapper)
function stopActiveStudySession() {
  stopStudySession();
}

// Update Study Stats link color based on active session
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

function handleShopLinkClick(event) {
  if (hasActiveSessionForLink) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    alert('Please finish your active study session before accessing the shop.');
    return false;
  }
  return true;
}

async function updateStudyStatsLink() {
  const statsLink = document.getElementById('studyStatsLink');
  const shopLink = document.getElementById('shopLink');
  
  if (!statsLink || !shopLink) {
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
        // Gray out the stats link
        statsLink.classList.remove('text-gray-700', 'hover:text-black', 'text-black', 'font-bold', 'text-lg');
        statsLink.classList.add('text-gray-400', 'cursor-not-allowed', 'opacity-50');
        
        // Gray out the shop link
        shopLink.classList.remove('text-gray-700', 'hover:text-black', 'text-black', 'font-bold', 'text-lg');
        shopLink.classList.add('text-gray-400', 'cursor-not-allowed', 'opacity-50');
      } else {
        // Reset stats link to normal styling
        statsLink.classList.remove('text-gray-400', 'cursor-not-allowed', 'opacity-50');
        if (window.location.pathname === '/stats/') {
          statsLink.classList.add('font-bold', 'text-lg', 'text-black');
        } else {
          statsLink.classList.add('text-gray-700', 'hover:text-black');
        }
        
        // Reset shop link to normal styling
        shopLink.classList.remove('text-gray-400', 'cursor-not-allowed', 'opacity-50');
        if (window.location.pathname === '/shop/') {
          shopLink.classList.add('font-bold', 'text-lg', 'text-black');
        } else {
          shopLink.classList.add('text-gray-700', 'hover:text-black');
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
    // Always check for active session
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
            // Timer mode: set original duration
            studySessionDuration = restoredDuration * 60; // Convert minutes to seconds
          } else {
            // Stopwatch mode: duration starts at 0
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
    const response = await fetch(`${API_BASE}/api/study/colors?last_month=true`);
    if (!response.ok) {
      console.warn('Failed to fetch last month colors:', response.status);
      return null;
    }
    const data = await response.json();
    return data.color_legend || null;
  } catch (error) {
    console.error('Error getting last month colors:', error);
    return null;
  }
}

// Expose functions globally for HTML onclick handlers
window.showStudyModal = showStudyModal;
window.startStudySession = startStudySession;
window.stopActiveStudySession = stopActiveStudySession;
window.pauseStudySession = pauseStudySession;
window.toggleStudyDurationField = toggleStudyDurationField;
window.handleStatsLinkClick = handleStatsLinkClick;
window.handleShopLinkClick = handleShopLinkClick;

