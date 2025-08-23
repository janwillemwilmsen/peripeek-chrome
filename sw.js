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
        const wantMobile = !!message.mobile;
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

        // Pull removal selectors configured in UI and prepare injector
        const { ['peripeek.bridge.selectors']: selRaw } = await chrome.storage.local.get(['peripeek.bridge.selectors']);
        const removalSelectors = (selRaw || '').split(',').map(s => s.trim()).filter(Boolean);
        const removeFunc = (selectors) => {
          try {
            selectors.forEach((sel) => {
              try {
                const nodes = document.querySelectorAll(sel);
                nodes.forEach((n) => {
                  try { n.remove(); } catch { try { n.style.setProperty('display','none','important'); } catch {} }
                });
              } catch {}
            });
          } catch {}
        };
        const execRemove = async () => {
          if (!removalSelectors.length) return;
          try { await chrome.scripting.executeScript({ target: { tabId: tempTabId }, func: removeFunc, args: [removalSelectors] }); } catch {}
        };

        // Try CDP viewport scrolling + capture (no clip) to avoid site reactions and repeats
        let cdpImages;
        try {
          await dbg.attach(tempTabId);
          await dbg.send(tempTabId, 'Page.enable');
          await dbg.send(tempTabId, 'Emulation.setEmulatedMedia', { media: 'screen' });
          const lm = await dbg.send(tempTabId, 'Page.getLayoutMetrics');
          const cssVp = lm && lm.cssLayoutViewport ? lm.cssLayoutViewport : { clientWidth: 1200, clientHeight: 800 };
          const cs = lm && lm.contentSize ? lm.contentSize : { width: cssVp.clientWidth, height: 2000 };
          let vpW = Math.ceil(cssVp.clientWidth);
          let vpH = Math.ceil(cssVp.clientHeight);
          let contentH = Math.ceil(Math.min(32760, cs.height));
          // Warm: scroll to bottom to trigger lazy load, then back to top, then re-measure
          await dbg.send(tempTabId, 'Runtime.evaluate', { expression: 'window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight || 0)' });
          await new Promise(r => setTimeout(r, 600));
          await dbg.send(tempTabId, 'Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
          await new Promise(r => setTimeout(r, 600));
          const lm2 = await dbg.send(tempTabId, 'Page.getLayoutMetrics');
          const cs2 = lm2 && lm2.contentSize ? lm2.contentSize : null;
          if (cs2 && cs2.height) {
            const contentH2 = Math.ceil(Math.min(32760, cs2.height));
            if (contentH2 > contentH) contentH = contentH2;
          }
          const overlapPx = 0; // we will produce non-overlapping slices
          const step = vpH; // exact steps
          // Keep current viewport metrics (avoid drastic changes)
          if (wantMobile) {
            // Emulate a common mobile viewport (e.g. iPhone X-ish)
            vpW = 375; vpH = 812;
            await dbg.send(tempTabId, 'Emulation.setDeviceMetricsOverride', {
              width: vpW,
              height: vpH,
              deviceScaleFactor: 2,
              mobile: true,
              screenWidth: vpW,
              screenHeight: vpH,
              fitWindow: false
            });
            await dbg.send(tempTabId, 'Emulation.setUserAgentOverride', {
              userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1 Mobile/15E148 Safari/604.1',
              platform: 'iPhone'
            });
          } else {
            await dbg.send(tempTabId, 'Emulation.setDeviceMetricsOverride', {
              width: vpW,
              height: vpH,
              deviceScaleFactor: 1,
              mobile: false,
              screenWidth: vpW,
              screenHeight: vpH,
              fitWindow: false
            });
          }
          // Try single full-page capture to avoid seams entirely
          try {
            await dbg.send(tempTabId, 'Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
            await execRemove();
            await new Promise(r => setTimeout(r, 300));
            const capFull = await dbg.send(tempTabId, 'Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true });
            if (capFull && capFull.data) {
              try { await dbg.detach(tempTabId); } catch {}
              try { await chrome.windows.remove(tempWindowId); } catch {}
              if (originalTabId) { try { await chrome.tabs.update(originalTabId, { active: true }); } catch {} }
              sendResponse({ ok: true, cdp: true, single: true, image: 'data:image/png;base64,' + capFull.data, url });
              return;
            }
          } catch (e) {
            // proceed to segmented approach
          }
          // Ensure top
          await dbg.send(tempTabId, 'Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
          await execRemove();
          await new Promise(r => setTimeout(r, 300));
          cdpImages = [];
          // Capture top with sticky elements visible once
          const topCap = await dbg.send(tempTabId, 'Page.captureScreenshot', {
            format: 'png', fromSurface: true,
            clip: { x: 0, y: 0, width: vpW, height: Math.max(1, Math.min(vpH, contentH)), scale: 1 }
          });
          if (topCap && topCap.data) cdpImages.push('data:image/png;base64,' + topCap.data);

          // Hide sticky/fixed elements to avoid duplication during scrolling
          await dbg.send(tempTabId, 'Runtime.evaluate', { expression: `(() => { try {
            const H = [];
            const nodes = document.body ? document.body.getElementsByTagName('*') : [];
            for (let i = 0; i < nodes.length; i++) {
              const el = nodes[i];
              const cs = getComputedStyle(el);
              if (cs && (cs.position === 'fixed' || cs.position === 'sticky')) {
                H.push([el, el.getAttribute('style') || '']);
                el.style.setProperty('visibility','hidden','important');
              }
            }
            window.__peripeekHidden = H; return H.length;
          } catch(e) { return -1; } })()` });

          // Build Y positions as exact, non-overlapping slices after the first viewport. Include bottom only if needed
          const ys = [];
          const bottomY = Math.max(0, contentH - vpH);
          if (contentH > vpH) {
            for (let y = step; y < bottomY; y += step) ys.push(y);
            if (ys[ys.length - 1] !== bottomY) ys.push(bottomY);
          }
          const uniqYs = Array.from(new Set(ys)).sort((a,b)=>a-b);

          for (let idx = 0; idx < uniqYs.length; idx++) {
            const targetY = uniqYs[idx];
            await dbg.send(tempTabId, 'Runtime.evaluate', { expression: `window.scrollTo(0, ${targetY})` });
            await execRemove();
            await new Promise(r => setTimeout(r, 400));
            const evalRes = await dbg.send(tempTabId, 'Runtime.evaluate', { expression: 'Math.floor(window.scrollY)||0' });
            const curY = (evalRes && evalRes.result && typeof evalRes.result.value === 'number') ? evalRes.result.value : targetY;
            const h = Math.max(1, Math.min(vpH, contentH - curY));
            const cap = await dbg.send(tempTabId, 'Page.captureScreenshot', { 
              format: 'png', fromSurface: true,
              clip: { x: 0, y: curY, width: vpW, height: h, scale: 1 }
            });
            if (cap && cap.data) cdpImages.push('data:image/png;base64,' + cap.data);
          }

          // Restore hidden elements
          await dbg.send(tempTabId, 'Runtime.evaluate', { expression: `(() => { try {
            const H = window.__peripeekHidden || [];
            for (let i = 0; i < H.length; i++) { const el = H[i][0]; const css = H[i][1]; if (el) { if (css) el.setAttribute('style', css); else el.removeAttribute('style'); } }
            window.__peripeekHidden = null; return H.length;
          } catch(e) { return -1; } })()` });

          // Detach debugger before closing window
          try { await dbg.detach(tempTabId); } catch {}

          try { await chrome.windows.remove(tempWindowId); } catch {}
          if (originalTabId) { try { await chrome.tabs.update(originalTabId, { active: true }); } catch {} }
          sendResponse({ ok: true, cdp: true, noOverlap: true, images: cdpImages, vpH, overlapPx, url });
          return;

          await dbg.detach(tempTabId);
        } catch (cdpErr) {
          console.warn('CDP scroll-capture failed:', cdpErr);
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
          target: { tabId: tempTabId },
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
          await chrome.scripting.executeScript({ target: { tabId: tempTabId }, func: (yy) => window.scrollTo(0, yy), args: [y] });
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