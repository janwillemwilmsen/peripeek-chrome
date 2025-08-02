// Content script that runs on web pages
// This can be used for any page-specific functionality

console.log('Peripeek extension content script loaded');

// You can add any page-specific functionality here
// For example, detecting when the user is on the custom page
if (window.location.href.includes('custom.html')) {
  console.log('User is on the custom Peripeek page');
} 