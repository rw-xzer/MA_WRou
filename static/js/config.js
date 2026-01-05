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

// Avatar animation state
let avatarAnimationInterval = null;
let currentAvatarFrame = 0;
let previousAvatarState = 'idle';
const avatarFrameSequence = [1, 2, 3, 2, 1, 2, 3, 2];

// Study session link state
let hasActiveSessionForLink = false;

// Avatar customization state
let currentCustomizationCategory = 'avatar';
let ownedCustomizationItems = null;

let isInitialPageLoad = true;

// Quick create mode: 'habit', 'task'
let quickCreateMode = null;

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
  updateHabitFilters();
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
      const coinsTextObserver = new MutationObserver(() => {
        fixCoinsText();
      });
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

