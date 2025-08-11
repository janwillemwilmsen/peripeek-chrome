// Background service worker for the Chrome extension
let isCustomPageActive = false;
let originalUrl = null;

// Promisified Chrome Debugger helpers
const dbg = {
  attach: (tabId) => new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      const err = chrome.runtime.lastError; if (err) return reject(new Error(err.message)); resolve();
    });
  }),
  detach: (tabId) => new Promise((resolve, reject) => {
    chrome.debugger.detach({ tabId }, () => {
      const err = chrome.runtime.lastError; if (err) return reject(new Error(err.message)); resolve();
    });
  }),
  send: (tabId, method, params) => new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (result) => {
      const err = chrome.runtime.lastError; if (err) return reject(new Error(err.message)); resolve(result);
    });
  })
};

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

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PANZOOM_KEY') {
    chrome.storage.local.get('tabId', (data) => {
      if (data.tabId) {
        chrome.tabs.sendMessage(data.tabId, {
          type: 'PANZOOM_KEY',
          key: message.key
        });
      }
    });
  }

  if (message.type === 'FULLPAGE_CAPTURE') {
    (async () => {
      try {
        const originalTabId = sender && sender.tab && sender.tab.id;
        const url = message.url;
        // Open temp focused window for CDP control
        const tempWindow = await chrome.windows.create({ url, focused: true, state: 'maximized' });
        const tempWindowId = tempWindow.id;
        // Find the tab we just opened (windows.create may not populate tabs)
        let tempTabId;
        for (let i = 0; i < 50; i++) { // up to ~5s
          const tabs = await chrome.tabs.query({ windowId: tempWindowId });
          if (tabs && tabs.length) { tempTabId = tabs[0].id; break; }
          await new Promise(r => setTimeout(r, 100));
        }
        if (!tempTabId) throw new Error('Failed to locate temp tab');
        // Wait for load complete
        await new Promise((resolve) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === tempTabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });

        // Try CDP tiling with explicit clip + captureBeyondViewport to avoid repeats and size caps
        let cdpImages;
        try {
          await dbg.attach(tempTabId);
          await dbg.send(tempTabId, 'Page.enable');
          await dbg.send(tempTabId, 'Emulation.setEmulatedMedia', { media: 'screen' });
          const lm = await dbg.send(tempTabId, 'Page.getLayoutMetrics');
          const cs = lm && lm.contentSize ? lm.contentSize : { width: 1200, height: 2000 };
          const contentW = Math.ceil(Math.min(16384, cs.width));
          const contentH = Math.ceil(Math.min(16384, cs.height));
          const tileH = 2000; // safe tile height
          // Keep a sane viewport height to avoid layout jumps
          await dbg.send(tempTabId, 'Emulation.setDeviceMetricsOverride', {
            width: contentW,
            height: Math.min(tileH, contentH),
            deviceScaleFactor: 1,
            mobile: false,
            screenWidth: contentW,
            screenHeight: Math.min(tileH, contentH),
            fitWindow: false
          });
          await dbg.send(tempTabId, 'Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
          await new Promise(r => setTimeout(r, 150));
          cdpImages = [];
          for (let y = 0; y < contentH; y += tileH) {
            const h = Math.min(tileH, contentH - y);
            const cap = await dbg.send(tempTabId, 'Page.captureScreenshot', {
              format: 'png',
              fromSurface: true,
              captureBeyondViewport: true,
              clip: { x: 0, y, width: contentW, height: h, scale: 1 }
            });
            if (cap && cap.data) cdpImages.push('data:image/png;base64,' + cap.data);
            await new Promise(r => setTimeout(r, 100));
          }
          await dbg.detach(tempTabId);
        } catch (cdpErr) {
          console.warn('CDP tiling failed:', cdpErr);
          try { await dbg.detach(tempTabId); } catch {}
        }

        if (cdpImages && cdpImages.length) {
          try { await chrome.windows.remove(tempWindowId); } catch {}
          if (originalTabId) { try { await chrome.tabs.update(originalTabId, { active: true }); } catch {} }
          sendResponse({ ok: true, cdp: true, images: cdpImages, url });
          return;
        }

        // Fallback to image scroll+stitch
        const [{ result: metrics }] = await chrome.scripting.executeScript({
          target: { tabId: tempTab.id },
          func: () => ({
            scrollHeight: Math.max(
              document.documentElement ? document.documentElement.scrollHeight : 0,
              document.body ? document.body.scrollHeight : 0,
              window.innerHeight
            ),
            innerHeight: window.innerHeight,
            innerWidth: window.innerWidth,
            dpr: window.devicePixelRatio || 1
          })
        });
        const totalH = Math.max(metrics.scrollHeight, metrics.innerHeight);
        const vpH = metrics.innerHeight;
        const vpW = metrics.innerWidth;
        const steps = Math.max(1, Math.ceil(totalH / vpH));
        const images = [];
        for (let i = 0; i < steps; i++) {
          const y = Math.min(i * vpH, totalH - vpH);
          await chrome.scripting.executeScript({ target: { tabId: tempTab.id }, func: (yy) => window.scrollTo(0, yy), args: [y] });
          await new Promise(r => setTimeout(r, 200));
          const vis = await chrome.tabs.captureVisibleTab(tempWindowId, { format: 'png' });
          if (!vis) throw new Error('captureVisibleTab returned empty');
          images.push(vis);
        }
        try { await chrome.windows.remove(tempWindowId); } catch {}
        if (originalTabId) { try { await chrome.tabs.update(originalTabId, { active: true }); } catch {} }
        sendResponse({ ok: true, images, vpW, vpH, totalH, dpr: metrics.dpr, url });
      } catch (e) {
        console.error('FULLPAGE_CAPTURE error', e);
        sendResponse({ ok: false, error: e && (e.message || String(e)) });
      }
    })();
    return true;
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

// Removed MV2 webRequest blocking listener; using declarativeNetRequest rules instead. 