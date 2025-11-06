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

// Load rewards
async function loadRewards() {
  try {
    const response = await fetch(`${API_BASE}/api/shop/items/`);
    if (response.ok) {
      const data = await response.json();
      rewards = data.items || [];
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

  if (rewards.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No rewards yet. Click "Add Reward" to create one!</p>';
    return;
  }

  container.innerHTML = rewards.map(reward => createRewardCard(reward)).join('');
  
  // Add event listeners to purchase buttons
  rewards.forEach(reward => {
    const purchaseBtn = document.getElementById(`purchaseBtn-${reward.id}`);
    if (purchaseBtn) {
      purchaseBtn.addEventListener('click', () => purchaseReward(reward.id));
    }
    const editBtn = document.getElementById(`editBtn-${reward.id}`);
    if (editBtn) {
      editBtn.addEventListener('click', () => editReward(reward.id));
    }
  });
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
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
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
      const error = await response.json();
      alert(error.error || 'Failed to save reward');
    }
  } catch (error) {
    console.error('Error saving reward:', error);
    alert('Failed to save reward');
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
async function purchaseReward(rewardId) {
  if (!userProfile) {
    alert('User profile not loaded');
    return;
  }

  const reward = rewards.find(r => r.id === rewardId);
  if (!reward) return;

  if (userProfile.coins < reward.price) {
    alert('Insufficient coins');
    return;
  }

  if (!confirm(`Purchase "${reward.name}" for ${reward.price} coins?`)) {
    return;
  }

  try {
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

