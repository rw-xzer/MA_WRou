// Shop page JavaScript

// API base URL
const API_BASE = '';

// Global state
let userProfile = null;
let rewards = [];
let editingRewardId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadUserProfile();
  loadRewards();
  setupEventListeners();
});

// Set up event listeners
function setupEventListeners() {
  const addRewardBtn = document.getElementById('addRewardBtn');
  if (addRewardBtn) {
    addRewardBtn.addEventListener('click', () => {
      showRewardModal();
    });
  }
}

// Load user profile
async function loadUserProfile() {
  try {
    const response = await fetch(`${API_BASE}/api/profile/`);
    if (response.ok) {
      userProfile = await response.json();
      updateCoinsDisplay();
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

// Update coins display
function updateCoinsDisplay() {
  const coinsText = document.getElementById('coinsText');
  if (coinsText && userProfile) {
    coinsText.textContent = `Coins: ${userProfile.coins || 0}`;
  }
}

// Global state for shop items
let userItems = [];
let customizationItems = [];

// Load rewards
async function loadRewards() {
  try {
    const response = await fetch(`${API_BASE}/api/shop/items/?_=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
      userItems = data.user_items || [];
      customizationItems = data.customization_items || [];
      rewards = [...userItems, ...customizationItems];
      renderRewards();
    }
  } catch (error) {
    console.error('Error loading rewards:', error);
  }
}

// Render rewards
function renderRewards() {
  const container = document.getElementById('rewardsContainer');
  if (!container) return;

  let html = '';
  
  // User-defined items section
  if (userItems.length > 0) {
    html += '<div class="mb-12"><h2 class="text-xl font-bold mb-4">Your Rewards</h2>';
    html += '<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">';
    html += userItems.map(reward => createRewardCard(reward)).join('');
    html += '</div></div>';
  }
  
  // Customization items section
  if (customizationItems.length > 0) {
    html += '<div class="border-t border-gray-300 pt-8 mb-8">';
    html += '<h2 class="text-xl font-bold mb-4">Customization</h2>';
    html += '<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">';
    html += customizationItems.map(item => createCustomizationCard(item)).join('');
    html += '</div></div>';
  }
  
  if (html === '') {
    html = '<p class="text-gray-500">No items available. Click "Add Reward" to create one!</p>';
  }

  container.innerHTML = html;
  
  // Add event listeners to purchase buttons
  [...userItems, ...customizationItems].forEach(item => {
    const purchaseBtn = document.getElementById(`purchaseBtn-${item.id}`);
    if (purchaseBtn) {
      purchaseBtn.addEventListener('click', () => purchaseReward(item.id, item));
    }
    const editBtn = document.getElementById(`editBtn-${item.id}`);
    if (editBtn) {
      editBtn.addEventListener('click', () => editReward(item.id));
    }
  });
}

// Create customization card HTML (for background colors, etc.)
function createCustomizationCard(item) {
  const canAfford = userProfile && userProfile.coins >= item.price;
  const isBackground = item.background_color && item.floor_color;
  
  let previewHtml = '';
  if (isBackground) {
    previewHtml = `
      <div class="mb-2 h-16 rounded border border-gray-300 flex items-center justify-center" style="background-color: ${item.background_color};">
        <div class="h-8 w-8 rounded-full border-2 border-black" style="background-color: ${item.floor_color};"></div>
      </div>
    `;
  }
  
  return `
    <div class="rounded-lg border border-gray-300 bg-white p-4">
      ${previewHtml}
      <div class="mb-3">
        <h3 class="text-lg font-semibold">${escapeHtml(item.name)}</h3>
        ${item.description ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(item.description)}</p>` : ''}
      </div>
      <div class="flex items-center justify-between">
        <span class="text-lg font-bold text-blue-600">${item.price} coins</span>
        <button
          id="purchaseBtn-${item.id}"
          class="rounded-lg border border-black px-3 py-1 text-sm font-medium ${
            canAfford 
              ? 'bg-blue-400 text-white hover:bg-blue-500' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }"
          ${!canAfford ? 'disabled' : ''}
        >
          Purchase
        </button>
      </div>
    </div>
  `;
}

// Create reward card HTML
function createRewardCard(reward) {
  const canAfford = userProfile && userProfile.coins >= reward.price;
  return `
    <div class="rounded-lg border border-gray-300 bg-white p-4">
      <div class="mb-3">
        <h3 class="text-lg font-semibold">${escapeHtml(reward.name)}</h3>
        ${reward.description ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(reward.description)}</p>` : ''}
      </div>
      <div class="flex items-center justify-between">
        <span class="text-lg font-bold text-blue-600">${reward.price} coins</span>
        <div class="flex gap-2">
          <button
            id="editBtn-${reward.id}"
            class="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
          >
            Edit
          </button>
          <button
            id="purchaseBtn-${reward.id}"
            class="rounded-lg border border-black px-3 py-1 text-sm font-medium ${
              canAfford 
                ? 'bg-blue-400 text-white hover:bg-blue-500' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }"
            ${!canAfford ? 'disabled' : ''}
          >
            Purchase
          </button>
        </div>
      </div>
    </div>
  `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show reward modal
function showRewardModal(rewardId = null) {
  const modal = document.getElementById('rewardModal');
  const form = document.getElementById('rewardForm');
  const title = document.getElementById('rewardModalTitle');
  const deleteBtn = document.getElementById('rewardDeleteButton');
  
  editingRewardId = rewardId;
  
  if (rewardId) {
    // Editing existing reward
    const reward = rewards.find(r => r.id === rewardId);
    if (reward) {
      title.textContent = 'Edit Reward';
      document.getElementById('rewardName').value = reward.name;
      document.getElementById('rewardDescription').value = reward.description || '';
      document.getElementById('rewardPrice').value = reward.price;
      deleteBtn.classList.remove('hidden');
    }
  } else {
    // Adding new reward
    title.textContent = 'Add Reward';
    form.reset();
    deleteBtn.classList.add('hidden');
  }
  
  if (modal) {
    modal.classList.remove('hidden');
  }
}

// Close modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
  editingRewardId = null;
}

// Create reward from form
async function createRewardFromForm() {
  const name = document.getElementById('rewardName').value.trim();
  const description = document.getElementById('rewardDescription').value.trim();
  const price = parseInt(document.getElementById('rewardPrice').value);

  if (!name || !price || price < 1) {
    alert('Please enter a valid reward name and price (at least 1 coin)');
    return;
  }

  const rewardData = {
    name,
    description,
    price
  };

  try {
    let response;
    if (editingRewardId) {
      // Update existing reward
      response = await fetch(`${API_BASE}/api/shop/rewards/${editingRewardId}/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify(rewardData)
      });
    } else {
      // Create new reward
      response = await fetch(`${API_BASE}/api/shop/rewards/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify(rewardData)
      });
    }

    if (response.ok) {
      closeModal('rewardModal');
      loadRewards();
    } else {
      let errorMessage = 'Failed to save reward';
      try {
        const error = await response.json();
        console.error('Reward save error:', error);
        errorMessage = error.error || error.message || errorMessage;
      } catch (e) {
        console.error('Error parsing error response:', e);
        errorMessage = `Failed to save reward (status: ${response.status})`;
      }
      alert(errorMessage);
    }
  } catch (error) {
    console.error('Error saving reward:', error);
    alert(`Failed to save reward: ${error.message || error}`);
  }
}

// Edit reward
function editReward(rewardId) {
  showRewardModal(rewardId);
}

// Delete reward
async function deleteReward() {
  if (!editingRewardId) return;

  if (!confirm('Are you sure you want to delete this reward?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/shop/rewards/${editingRewardId}/delete/`, {
      method: 'DELETE',
      headers: {
        'X-CSRFToken': getCsrfToken()
      }
    });

    if (response.ok) {
      closeModal('rewardModal');
      loadRewards();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to delete reward');
    }
  } catch (error) {
    console.error('Error deleting reward:', error);
    alert('Failed to delete reward');
  }
}

// Purchase reward
async function purchaseReward(rewardId, item = null) {
  if (!userProfile) {
    alert('User profile not loaded');
    return;
  }

  const reward = item || rewards.find(r => r.id === rewardId);
  if (!reward) return;

  if (userProfile.coins < reward.price) {
    alert('Insufficient coins');
    return;
  }

  if (!confirm(`Purchase "${reward.name}" for ${reward.price} coins?`)) {
    return;
  }

  try {
    // Handle background color purchases
    if (reward.background_color && reward.floor_color) {
      const response = await fetch(`${API_BASE}/api/shop/purchase/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({
          item_id: reward.id
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        userProfile.coins = data.coins_left;
        updateCoinsDisplay();
        alert(`Purchased "${reward.name}"! You can equip it from the customization menu.`);
        await new Promise(resolve => setTimeout(resolve, 100));
        // Reload rewards to remove purchased item from shop
        await loadRewards();
        if (typeof loadOwnedCustomizationItems === 'function') {
          await loadOwnedCustomizationItems();
        }
      } else {
        let errorMessage = 'Failed to purchase item';
        try {
          const error = await response.json();
          console.error('Purchase failed:', error);
          errorMessage = error.error || error.message || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
          errorMessage = `Purchase failed with status ${response.status}`;
        }
        alert(errorMessage);
      }
      return;
    }
    
    // Regular item purchase
    const response = await fetch(`${API_BASE}/api/shop/purchase/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify({ item_id: rewardId })
    });

    if (response.ok) {
      const data = await response.json();
      userProfile.coins = data.coins_left;
      updateCoinsDisplay();
      alert(`Purchased "${reward.name}"! Enjoy your reward!`);
      loadRewards(); // Refresh to update purchase button states
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to purchase reward');
    }
  } catch (error) {
    console.error('Error purchasing reward:', error);
    alert('Failed to purchase reward');
  }
}

// Get CSRF token from cookies
function getCsrfToken() {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Expose functions globally for inline onclick handlers
window.closeModal = closeModal;
window.createRewardFromForm = createRewardFromForm;
window.deleteReward = deleteReward;

