// Background service worker for the Chrome extension
let isCustomPageActive = false;
let originalUrl = null;

// Listen for extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!isCustomPageActive) {
      // Store the original URL and switch to custom page
      originalUrl = tab.url;
      const customPageUrl = chrome.runtime.getURL('custom.html');
      
      await chrome.tabs.update(tab.id, { url: customPageUrl });
      isCustomPageActive = true;
      
      // Store state in chrome.storage
      await chrome.storage.local.set({
        isCustomPageActive: true,
        originalUrl: originalUrl,
        tabId: tab.id
      });
    } else {
      // Return to the original URL
      if (originalUrl) {
        await chrome.tabs.update(tab.id, { url: originalUrl });
      }
      isCustomPageActive = false;
      
      // Clear stored state
      await chrome.storage.local.remove(['isCustomPageActive', 'originalUrl', 'tabId']);
    }
  } catch (error) {
    console.error('Error handling extension click:', error);
  }
});

// Handle tab updates to reset state when user navigates away
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const customPageUrl = chrome.runtime.getURL('custom.html');
    
    // If user navigated away from our custom page, reset the state
    if (tab.url !== customPageUrl && isCustomPageActive) {
      isCustomPageActive = false;
      await chrome.storage.local.remove(['isCustomPageActive', 'originalUrl', 'tabId']);
    }
  }
});

// Restore state when extension starts
chrome.runtime.onStartup.addListener(async () => {
  try {
    const data = await chrome.storage.local.get(['isCustomPageActive', 'originalUrl', 'tabId']);
    if (data.isCustomPageActive) {
      isCustomPageActive = data.isCustomPageActive;
      originalUrl = data.originalUrl;
    }
  } catch (error) {
    console.error('Error restoring state:', error);
  }
});

// Also restore state when extension is loaded
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const data = await chrome.storage.local.get(['isCustomPageActive', 'originalUrl', 'tabId']);
    if (data.isCustomPageActive) {
      isCustomPageActive = data.isCustomPageActive;
      originalUrl = data.originalUrl;
    }
  } catch (error) {
    console.error('Error restoring state:', error);
  }
}); 

const ruleId = 1;
chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [ruleId],
  addRules: [{
    id: ruleId,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "x-frame-options", operation: "remove" },
        { header: "content-security-policy", operation: "remove" },
        { header: "cross-origin-embedder-policy", operation: "remove" },
        { header: "cross-origin-opener-policy", operation: "remove" },
        { header: "cross-origin-resource-policy", operation: "remove" },
        { header: "content-security-policy-report-only", operation: "remove" }
      ]
    },
    condition: {
      resourceTypes: ["sub_frame"],
      urlFilter: "*://*/*"
    }
  }]
}); 

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type === 'sub_frame') {
      details.responseHeaders.forEach(header => {
        if (header.name.toLowerCase() === 'set-cookie') {
          let cookieValue = header.value;
          if (!cookieValue.includes('SameSite=')) {
            cookieValue += '; SameSite=None';
          }
          if (!cookieValue.includes('Secure')) {
            cookieValue += '; Secure';
          }
          header.value = cookieValue;
        }
      });
    }
    return { responseHeaders: details.responseHeaders };
  },
  { urls: ['<all_urls>'], types: ['sub_frame'] },
  ['blocking', 'responseHeaders', 'extraHeaders']
); 