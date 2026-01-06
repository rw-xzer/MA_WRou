// Week Recap & Stats Management

// load recap
async function loadRecap() {

  if (!userProfile || !userProfile.user_id) {
    // Wait a bit for userProfile to load, then retry
    setTimeout(loadRecap, 100);
    return;
  }
  
  const userId = userProfile.user_id;
  const currentUserIdKey = 'current_recap_user_id';
  const storedUserId = localStorage.getItem(currentUserIdKey);
  
  // If user changed, clear all old recap cache
  if (storedUserId && storedUserId !== String(userId)) {
    // Clear all recap-related cache entries
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('recap_') || key.startsWith('recap_date_'))) {
        localStorage.removeItem(key);
      }
    }
  }
  
  // Store current user ID
  localStorage.setItem(currentUserIdKey, String(userId));
  
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday etc
  
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysSinceMonday);
  lastMonday.setHours(0, 0, 0, 0);
  const lastMondayKey = lastMonday.toISOString().split('T')[0];
  
  // Check for cached recap
  const cacheKey = `recap_${userId}_${lastMondayKey}`;
  const cachedRecap = localStorage.getItem(cacheKey);
  const cachedDate = localStorage.getItem(`recap_date_${userId}_${lastMondayKey}`);
  
  // use cached data
  if (cachedRecap && cachedDate === lastMondayKey && dayOfWeek !== 1) {
    try {
      const data = JSON.parse(cachedRecap);
      updateRecap(data);
      return;
    } catch (error) {
      console.error('Error parsing cached recap:', error);
    }
  }
  
  // Load new recap
  try {
    const response = await fetch(`${API_BASE}/api/recap/`);
    if (!response.ok) {
      throw new Error('Failed to fetch recap');
    }
    const data = await response.json();
    updateRecap(data);
    
    // Cache the recap for this week
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(`recap_date_${userId}_${lastMondayKey}`, lastMondayKey);
    
    // Clean up old recap caches for this user
    const twoWeeksAgo = new Date(lastMonday);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`recap_${userId}_`) && !key.startsWith(`recap_date_${userId}_`)) {
        const dateStr = key.replace(`recap_${userId}_`, '');
        const cacheDate = new Date(dateStr);
        if (cacheDate < twoWeeksAgo) {
          localStorage.removeItem(key);
          localStorage.removeItem(`recap_date_${userId}_${dateStr}`);
        }
      }
    }
  } catch (error) {
    console.error('Error loading recap:', error);
    const recapText = document.getElementById('recapText');
    if (recapText) {
      recapText.textContent = 'Unable to load recap.';
    }
    if (cachedRecap) {
      try {
        const data = JSON.parse(cachedRecap);
        updateRecap(data);
      } catch (e) {
      }
    }
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
      // Filter out habit completion highlights and thumbs-up items
      if (item.type === 'habit' || item.icon === 'thumbs-up') {
        return;
      }
      
      const card = document.createElement('div');
      card.className = 'flex-shrink-0 flex items-center gap-2 rounded-lg border border-black bg-white px-4 py-2';
      
      let iconSvg = '';
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
      statBoxesContainer.style.display = 'flex';
    }

    if (hoursCard && data.hours_studied !== undefined) {
      hoursCard.textContent = `${data.hours_studied} hours studied last week`;
    }
    if (tasksCard && data.tasks_completed !== undefined) {
      tasksCard.textContent = `${data.tasks_completed} tasks completed`;
    }
    if (dailiesCard && data.missed_dailies !== undefined) {
      dailiesCard.textContent = `Missed ${data.missed_dailies} dailies`;
    }

    const recapText = document.getElementById('recapText');
    if (recapText) {
      recapText.textContent = data.recap || 'No standout achievements last week.';
    }
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
        };
        labelEl.textContent = labels[statType] || '';
      }
    }
  } catch (error) {
    console.error('Error loading stat value:', error);
  }
}

// Expose functions globally
window.updateStatSlotFromModal = function(statType) {
  const modal = document.getElementById('statSlotModal');
  const slotNum = parseInt(modal.dataset.slot);
  // Use provided statType or get from select element
  if (!statType) {
    statType = document.getElementById('statSlotType').value;
  }
  updateStatSlot(slotNum, statType);
};
window.showStatSlotModal = showStatSlotModal;

