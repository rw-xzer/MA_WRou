// Modal management functions

// add item modal
function showAddItemModal() {
  const modal = document.getElementById('addItemModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

// Expose functions globally
window.showAddItemModal = showAddItemModal;

