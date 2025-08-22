// Content script that runs on web pages
// This can be used for any page-specific functionality

console.log('Peripeek extension content script loaded');

// Bridge: receive remove_selectors messages from extension page
window.addEventListener('message', (event) => {
  try {
    // The source is null in extension contexts; check payload channel instead
    const data = event.data || {};
    if (data && data.channel === 'peripeek' && data.cmd === 'remove_selectors') {
      const selectors = Array.isArray(data.selectors) ? data.selectors : [];
      const seen = new Set();
      const nuke = (root) => {
        for (const sel of selectors) {
          try {
            const nodes = root.querySelectorAll(sel);
            nodes.forEach((n) => {
              if (!seen.has(n)) { seen.add(n); try { n.remove(); } catch { try { n.style.setProperty('display','none','important'); } catch {} } }
            });
          } catch {}
        }
      };
      nuke(document);
      // short observer to catch late mounts
      const mo = new MutationObserver(() => nuke(document));
      try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch {}
      setTimeout(() => { try { mo.disconnect(); } catch {} }, 2000);
    }
  } catch {}
}, false);

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