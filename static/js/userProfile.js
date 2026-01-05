// User Profile & Avatar Management

// Load user profile
async function loadUserProfile() {
  try {
    const response = await fetch(`${API_BASE}/api/profile/`);
    userProfile = await response.json();
    updateUserProfile(isInitialPageLoad);
    isInitialPageLoad = false;
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

// Update user profile UI
function updateUserProfile(isInitialLoad = false) {
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
  if (lvlText) lvlText.textContent = `Lv. ${userProfile.level}`;
  
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

  // Update avatar background colors
  const avatarSection = document.querySelector('#avatar')?.closest('section');
  const avatarFloor = document.getElementById('avatar-floor');
  const healthXpSection = document.getElementById('healthXpSection');
  
  const bgColor = userProfile.avatar_background_color || '#d8b9b9';
  const floorColor = userProfile.avatar_floor_color || '#d8aeae';
  
  // Darken background color for health/XP section
  function darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
    const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - percent)));
    const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - percent)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
  
  if (avatarSection) {
    avatarSection.style.backgroundColor = bgColor;
  }
  if (healthXpSection) {
    const darkBgColor = darkenColor(bgColor, 0.25);
    healthXpSection.style.backgroundColor = darkBgColor;
  }
  if (avatarFloor) {
    avatarFloor.style.backgroundColor = floorColor;
    // Calculate a slightly darker color for border
    const borderColor = floorColor;
    avatarFloor.style.borderTopColor = borderColor;
  }

  // Update avatar state
  let currentState = userProfile.avatar_state || 'idle';
  
  if (isInitialLoad && currentState === 'celebrating') {
    currentState = 'idle';
    userProfile.avatar_state = 'idle';
    fetch(`${API_BASE}/api/profile/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({ avatar_state: 'idle' }),
    }).catch(() => {});
  }
  
  updateAvatar(currentState);
  
  if (currentState === 'hurt') {
    setTimeout(() => {
      if (userProfile && userProfile.avatar_state === 'hurt') {
        userProfile.avatar_state = 'idle';
        updateAvatar('idle');
        fetch(`${API_BASE}/api/profile/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken(),
          },
          body: JSON.stringify({ avatar_state: 'idle' }),
        }).catch(() => {});
      }
    }, 500);
  }
}

function updateAvatar(state) {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;

  const avatarState = state || 'idle';
  
  if (avatarState === 'hurt' && previousAvatarState !== 'hurt') {
    previousAvatarState = avatarState;
  } else if (avatarState !== 'hurt' && previousAvatarState === 'hurt') {
    currentAvatarFrame = 0;
    previousAvatarState = avatarState;
  } else if ((avatarState === 'idle' && previousAvatarState === 'studying') || 
             (avatarState === 'studying' && previousAvatarState === 'idle')) {
    currentAvatarFrame = 0;
    previousAvatarState = avatarState;
  } else if (avatarState !== 'hurt') {
    previousAvatarState = avatarState;
  }
  
  avatar.className = `avatar avatar-${avatarState}`;
  
  if (avatarAnimationInterval) {
    if (typeof avatarAnimationInterval === 'number') {
      clearTimeout(avatarAnimationInterval);
    } else {
      clearInterval(avatarAnimationInterval);
    }
    avatarAnimationInterval = null;
  }

  if (avatarState === 'idle' || avatarState === 'studying') {
    startIdleAnimation();
  } else if (avatarState === 'hurt') {
    startHurtAnimation();
  } else if (avatarState === 'celebrating') {
    startCelebrateAnimation();
  }
}

function startIdleAnimation() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  
  const character = userProfile?.avatar_character || 'default_girl';
  const shirt = userProfile?.avatar_shirt || 'default';
  const pants = userProfile?.avatar_pants || 'default';
  const socks = userProfile?.avatar_socks || 'default';
  const shoes = userProfile?.avatar_shoes || 'default';
  
  avatar.style.animation = 'none';
  void avatar.offsetWidth;
  avatar.style.animation = null;
  
  currentAvatarFrame = 0;
  
  const updateFrame = () => {
    const frameNum = avatarFrameSequence[currentAvatarFrame];
    const basePath = `/static/avatars`;
    
    document.getElementById('avatar-body').src = `${basePath}/${character}/idle/idle${frameNum}_body.svg`;
    document.getElementById('avatar-hair').src = `${basePath}/${character}/idle/idle${frameNum}_hair.svg`;
    document.getElementById('avatar-socks').src = `${basePath}/clothes/${socks}/idle${frameNum}/socks.svg`;
    document.getElementById('avatar-pants').src = `${basePath}/clothes/${pants}/idle${frameNum}/pants.svg`;
    document.getElementById('avatar-shoes').src = `${basePath}/clothes/${shoes}/idle${frameNum}/shoes.svg`;
    document.getElementById('avatar-shirt').src = `${basePath}/clothes/${shirt}/idle${frameNum}/shirt.svg`;
    
    const baseDelay = 750;
    const delay = frameNum === 1 ? baseDelay * 2 : baseDelay;
    
    currentAvatarFrame = (currentAvatarFrame + 1) % avatarFrameSequence.length;
    
    if (avatarAnimationInterval) {
      if (typeof avatarAnimationInterval === 'number') {
        clearTimeout(avatarAnimationInterval);
      } else {
        clearInterval(avatarAnimationInterval);
      }
    }
    
    avatarAnimationInterval = setTimeout(updateFrame, delay);
  };
  
  updateFrame();
}

function startHurtAnimation() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  
  const character = userProfile?.avatar_character || 'default_girl';
  const shirt = userProfile?.avatar_shirt || 'default';
  const pants = userProfile?.avatar_pants || 'default';
  const socks = userProfile?.avatar_socks || 'default';
  const shoes = userProfile?.avatar_shoes || 'default';
  const basePath = `/static/avatars`;
  
  avatar.style.animation = 'none';
  void avatar.offsetWidth;
  avatar.style.animation = null;
  
  document.getElementById('avatar-body').src = `${basePath}/${character}/hurt/hurt1_body.svg`;
  document.getElementById('avatar-hair').src = `${basePath}/${character}/hurt/hurt1_hair.svg`;
  document.getElementById('avatar-socks').src = `${basePath}/clothes/${socks}/hurt1/socks.svg`;
  document.getElementById('avatar-pants').src = `${basePath}/clothes/${pants}/hurt1/pants.svg`;
  document.getElementById('avatar-shoes').src = `${basePath}/clothes/${shoes}/hurt1/shoes.svg`;
  document.getElementById('avatar-shirt').src = `${basePath}/clothes/${shirt}/hurt1/shirt.svg`;
  
  avatarAnimationInterval = setTimeout(() => {
    document.getElementById('avatar-body').src = `${basePath}/${character}/hurt/hurt2_body.svg`;
    document.getElementById('avatar-hair').src = `${basePath}/${character}/hurt/hurt2_hair.svg`;
    document.getElementById('avatar-socks').src = `${basePath}/clothes/${socks}/hurt2/socks.svg`;
    document.getElementById('avatar-pants').src = `${basePath}/clothes/${pants}/hurt2/pants.svg`;
    document.getElementById('avatar-shoes').src = `${basePath}/clothes/${shoes}/hurt2/shoes.svg`;
    document.getElementById('avatar-shirt').src = `${basePath}/clothes/${shirt}/hurt2/shirt.svg`;
    avatarAnimationInterval = null;
  }, 150);
}

function startCelebrateAnimation() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  
  const character = userProfile?.avatar_character || 'default_girl';
  const shirt = userProfile?.avatar_shirt || 'default';
  const pants = userProfile?.avatar_pants || 'default';
  const socks = userProfile?.avatar_socks || 'default';
  const shoes = userProfile?.avatar_shoes || 'default';
  const basePath = `/static/avatars`;
  
  avatar.style.animation = 'none';
  void avatar.offsetWidth;
  avatar.style.animation = null;
  
  let frameNum = 1;
  
  const updateFrame = () => {
    document.getElementById('avatar-body').src = `${basePath}/${character}/celebrate/celebrate${frameNum}_body.svg`;
    document.getElementById('avatar-hair').src = `${basePath}/${character}/celebrate/celebrate${frameNum}_hair.svg`;
    document.getElementById('avatar-socks').src = `${basePath}/clothes/${socks}/celebrate${frameNum}/socks.svg`;
    document.getElementById('avatar-pants').src = `${basePath}/clothes/${pants}/celebrate${frameNum}/pants.svg`;
    document.getElementById('avatar-shoes').src = `${basePath}/clothes/${shoes}/celebrate${frameNum}/shoes.svg`;
    document.getElementById('avatar-shirt').src = `${basePath}/clothes/${shirt}/celebrate${frameNum}/shirt.svg`;
    
    frameNum++;
    if (frameNum > 3) {
      if (avatarAnimationInterval) {
        if (typeof avatarAnimationInterval === 'number') {
          clearTimeout(avatarAnimationInterval);
        } else {
          clearInterval(avatarAnimationInterval);
        }
        avatarAnimationInterval = null;
      }
      if (userProfile) {
        userProfile.avatar_state = 'idle';
        updateAvatar('idle');
      }
      return;
    }
  };
  
  createConfetti();
  updateFrame();
  avatarAnimationInterval = setInterval(updateFrame, 400);
}

function createConfetti() {
  const confettiContainer = document.getElementById('confetti-container');
  if (!confettiContainer) return;
  
  const colors = ['#ff6b9d', '#ffd93d', '#6bcf7f', '#4d9de0', '#e15554', '#ffa500'];
  const confettiCount = 50;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    confetti.style.animationDuration = (Math.random() * 1 + 1.5) + 's';
    confettiContainer.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 3000);
  }
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

// Avatar Customization Functions
async function showAvatarCustomizationModal() {
  const modal = document.getElementById('avatarCustomizationModal');
  if (modal) {
    // Load owned items if not already loaded
    if (!ownedCustomizationItems) {
      await loadOwnedCustomizationItems();
    }
    modal.classList.remove('hidden');
    switchCustomizationCategory('avatar');
  }
}

function switchCustomizationCategory(category) {
  currentCustomizationCategory = category;
  
  // Update active button
  document.querySelectorAll('.category-btn').forEach(btn => {
    if (btn.dataset.category === category) {
      btn.classList.add('bg-gray-200');
    } else {
      btn.classList.remove('bg-gray-200');
    }
  });
  
  loadOwnedCustomizationItems().then(() => {
    loadCustomizationItems(category);
  });
}

// Load owned customization items
async function loadOwnedCustomizationItems() {
  try {
    const response = await fetch(`${API_BASE}/api/customization/owned/`);
    if (response.ok) {
      const data = await response.json();
      ownedCustomizationItems = data.owned_items;
      // Update userProfile with current background if available
      if (data.owned_items && data.owned_items.backgrounds && data.owned_items.backgrounds.length > 0) {
        // Find the currently selected background (non-default)
        const selectedBg = data.owned_items.backgrounds.find(bg => !bg.is_default && bg.color === userProfile?.avatar_background_color);
        if (selectedBg && userProfile) {
          userProfile.avatar_background_color = selectedBg.color;
          userProfile.avatar_floor_color = selectedBg.floor_color;
        }
      }
    }
  } catch (error) {
    console.error('Error loading owned customization items:', error);
    // Fallback to defaults
    ownedCustomizationItems = {
      avatars: [{ id: 'default_girl', name: 'Default Girl', type: 'avatar', is_default: true }],
      shirts: [{ id: 'default', name: 'Default Shirt', type: 'shirt', is_default: true }],
      pants: [{ id: 'default', name: 'Default Pants', type: 'pants', is_default: true }],
      socks: [{ id: 'default', name: 'Default Socks', type: 'socks', is_default: true }],
      shoes: [{ id: 'default', name: 'Default Shoes', type: 'shoes', is_default: true }],
      backgrounds: [{ id: 'default', name: 'Default', color: '#d8b9b9', floor_color: '#d8aeae', type: 'background', is_default: true }]
    };
  }
}

function loadCustomizationItems(category) {
  const container = document.getElementById('customizationItemsContainer');
  if (!container) return;
  
  container.innerHTML = '<div class="text-center py-4">Loading...</div>';
  
  // Always reload owned items to get latest purchases
  loadOwnedCustomizationItems().then(() => {
    if (!ownedCustomizationItems) {
      const container = document.getElementById('customizationItemsContainer');
      if (container) {
        container.innerHTML = '<div class="text-center py-4 text-red-500">Error loading items</div>';
      }
      return;
    }
    renderCustomizationItems(category);
  });
}

function renderCustomizationItems(category) {
  const container = document.getElementById('customizationItemsContainer');
  if (!container || !ownedCustomizationItems) return;
  
  container.innerHTML = '';
  
  if (category === 'avatar') {
    // Show owned avatars
    const avatars = ownedCustomizationItems.avatars || [];
    avatars.forEach(avatar => {
      const card = document.createElement('div');
      const isSelected = userProfile?.avatar_character === avatar.id || (!userProfile?.avatar_character && avatar.is_default);
      card.className = `rounded-lg border-2 bg-white p-4 cursor-pointer hover:border-blue-400 ${isSelected ? 'border-blue-400' : 'border-gray-300'}`;
      card.innerHTML = `
        <div class="mb-3 flex items-center justify-center" style="height: 120px; background-color: ${userProfile?.avatar_background_color || '#d8b9b9'};">
          <div class="relative" style="height: 100px; width: 100px;">
            <img src="/static/avatars/${avatar.id}/idle/idle1_body.svg" class="absolute inset-0 h-full w-full object-contain" style="z-index: 1;" />
            <img src="/static/avatars/clothes/${userProfile?.avatar_socks || 'default'}/idle1/socks.svg" class="absolute inset-0 h-full w-full object-contain" style="z-index: 2;" />
            <img src="/static/avatars/clothes/${userProfile?.avatar_pants || 'default'}/idle1/pants.svg" class="absolute inset-0 h-full w-full object-contain" style="z-index: 3;" />
            <img src="/static/avatars/clothes/${userProfile?.avatar_shoes || 'default'}/idle1/shoes.svg" class="absolute inset-0 h-full w-full object-contain" style="z-index: 4;" />
            <img src="/static/avatars/clothes/${userProfile?.avatar_shirt || 'default'}/idle1/shirt.svg" class="absolute inset-0 h-full w-full object-contain" style="z-index: 5;" />
            <img src="/static/avatars/${avatar.id}/idle/idle1_hair.svg" class="absolute inset-0 h-full w-full object-contain" style="z-index: 6;" />
          </div>
        </div>
        <h4 class="text-sm font-semibold text-center">${avatar.name}</h4>
      `;
      card.onclick = () => selectAvatarItem(avatar.id);
      container.appendChild(card);
    });
  } else if (category === 'background') {
    // Show owned backgrounds
    const backgrounds = ownedCustomizationItems.backgrounds || [];
    if (backgrounds.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-gray-500">No backgrounds available</div>';
      return;
    }
    backgrounds.forEach(bg => {
      const currentBg = userProfile?.avatar_background_color || null;
      const isSelected = (currentBg && currentBg.toLowerCase().trim() === bg.color.toLowerCase().trim()) || (!currentBg && bg.is_default);
      const card = document.createElement('div');
      card.className = `rounded-lg border-2 bg-white p-4 cursor-pointer hover:border-blue-400 ${isSelected ? 'border-blue-400' : 'border-gray-300'}`;
      card.innerHTML = `
        <div class="mb-3 h-20 rounded border border-gray-300" style="background-color: ${bg.color};">
          <div class="h-8 w-8 rounded-full border-2 border-black mx-auto mt-4" style="background-color: ${bg.floor_color};"></div>
        </div>
        <h4 class="text-sm font-semibold text-center">${bg.name}</h4>
      `;
      card.onclick = () => selectBackground(bg.color, bg.floor_color);
      container.appendChild(card);
    });
  } else {
    // For clothes items - show owned items
    // Map category to the correct plural key (pants, socks, shoes are already plural)
    const categoryMap = {
      'shirt': 'shirts',
      'pants': 'pants',
      'socks': 'socks',
      'shoes': 'shoes'
    };
    const categoryKey = categoryMap[category] || `${category}s`;
    const items = ownedCustomizationItems[categoryKey] || [];
    items.forEach(item => {
      const isSelected = userProfile?.[`avatar_${category}`] === item.id || (!userProfile?.[`avatar_${category}`] && item.is_default);
      const card = document.createElement('div');
      card.className = `rounded-lg border-2 bg-white p-4 cursor-pointer hover:border-blue-400 ${isSelected ? 'border-blue-400' : 'border-gray-300'}`;
      card.innerHTML = `
        <div class="mb-3 flex items-center justify-center" style="height: 120px;">
          <img src="/static/avatars/clothes/${item.id}/idle1/${category}.svg" class="h-20 w-20 object-contain" />
        </div>
        <h4 class="text-sm font-semibold text-center">${item.name}</h4>
      `;
      card.onclick = () => selectClothingItem(category, item.id);
      container.appendChild(card);
    });
  }
}

async function selectAvatarItem(avatarId) {
  if (!userProfile) return;
  
  // Update user profile
  userProfile.avatar_character = avatarId;
  
  // Save to backend
  try {
    const response = await fetch(`${API_BASE}/api/profile/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        avatar_character: avatarId
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      userProfile.avatar_character = data.avatar_character || avatarId;
      // Reload avatar to show new character
      updateAvatar(userProfile.avatar_state || 'idle');
      // Refresh the modal to show updated selection
      loadCustomizationItems(currentCustomizationCategory);
    }
  } catch (err) {
    console.error('Error saving avatar:', err);
  }
}

async function selectClothingItem(type, itemId) {
  if (!userProfile) return;
  
  // Update user profile based on clothing type
  const fieldMap = {
    'shirt': 'avatar_shirt',
    'pants': 'avatar_pants',
    'socks': 'avatar_socks',
    'shoes': 'avatar_shoes'
  };
  
  const fieldName = fieldMap[type];
  if (!fieldName) return;
  
  userProfile[fieldName] = itemId;
  
  // Save to backend
  try {
    const updateData = { [fieldName]: itemId };
    
    const response = await fetch(`${API_BASE}/api/profile/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(updateData),
    });
    
    if (response.ok) {
      const data = await response.json();
      // Update local profile
      if (data[fieldName]) userProfile[fieldName] = data[fieldName];
      // Reload avatar to show new clothes
      updateAvatar(userProfile.avatar_state || 'idle');
      // Refresh the modal to show updated selection
      loadCustomizationItems(currentCustomizationCategory);
    }
  } catch (err) {
    console.error('Error saving clothing:', err);
  }
}

async function selectBackground(bgColor, floorColor) {
  // Update background colors
  if (userProfile) {
    userProfile.avatar_background_color = bgColor;
    userProfile.avatar_floor_color = floorColor;
    updateUserProfile();
    
    // Save to backend
    try {
      const response = await fetch(`${API_BASE}/api/profile/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({
          avatar_background_color: bgColor,
          avatar_floor_color: floorColor
        }),
      });
      
      if (response.ok) {
        // Refresh the modal to show updated selection
        loadCustomizationItems(currentCustomizationCategory);
      }
    } catch (err) {
      console.error('Error saving background:', err);
    }
  }
}

// Expose functions globally for HTML onclick handlers
window.showAvatarCustomizationModal = showAvatarCustomizationModal;
window.switchCustomizationCategory = switchCustomizationCategory;
window.showLevelUpAnimation = showLevelUpAnimation;

