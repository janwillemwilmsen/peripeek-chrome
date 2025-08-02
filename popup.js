// Popup script for the extension
document.addEventListener('DOMContentLoaded', async () => {
  const statusElement = document.getElementById('status');
  
  try {
    // Get current status from storage
    const data = await chrome.storage.local.get(['isCustomPageActive']);
    
    if (data.isCustomPageActive) {
      statusElement.textContent = 'Custom page is currently active';
      statusElement.style.background = 'rgba(76, 175, 80, 0.2)';
    } else {
      statusElement.textContent = 'Ready to toggle to custom page';
      statusElement.style.background = 'rgba(255, 255, 255, 0.1)';
    }
  } catch (error) {
    console.error('Error getting status:', error);
    statusElement.textContent = 'Error getting status';
  }
}); 