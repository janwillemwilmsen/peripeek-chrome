// Content script that runs on web pages
// This can be used for any page-specific functionality

console.log('Peripeek extension content script loaded');

// Keyboard event listener for pan/zoom keys
document.addEventListener('keydown', (event) => {
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '=', '-'];
  const target = event.target;
  const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
  const isEditable = (tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable));
  if (isEditable) return;
  if (keys.includes(event.key)) {
    // Prevent default behavior in iframe
    event.preventDefault();
    // Send message to background
    chrome.runtime.sendMessage({
      type: 'PANZOOM_KEY',
      key: event.key
    });
  }
});

// You can add any page-specific functionality here
// For example, detecting when the user is on the custom page
if (window.location.href.includes('custom.html')) {
  console.log('User is on the custom Peripeek page');
} 