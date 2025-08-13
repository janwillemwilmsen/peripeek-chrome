document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Peripeek custom page loaded - Starting initialization');
    
    const viewport = document.getElementById('viewport');
    const canvas = document.getElementById('canvas');

    console.log('📋 Elements found:', { viewport: !!viewport, canvas: !!canvas });

    // --- SETTINGS MANAGEMENT ---
    const settings = {
        currentWidth: 800,
        currentHeight: 600,
        applyToExisting: true,
        autoLayoutOnResize: true,
        presets: {
            mobile: { width: 375, height: 667, name: 'Mobile (iPhone)' },
            tablet: { width: 768, height: 1024, name: 'Tablet (iPad)' },
            desktop: { width: 1200, height: 800, name: 'Desktop' }
        }
    };

    // Get settings elements
    const widthInput = document.getElementById('iframe-width');
    const heightInput = document.getElementById('iframe-height');
    const applySizeBtn = document.getElementById('apply-size');
    const presetButtons = document.querySelectorAll('[data-preset]');
    const applyAllBtn = document.getElementById('apply-all');
    const applyNewBtn = document.getElementById('apply-new');
    const gridLayoutBtn = document.getElementById('grid-layout');
    const horizontalLayoutBtn = document.getElementById('horizontal-layout');
    const verticalLayoutBtn = document.getElementById('vertical-layout');
    const autoLayoutToggle = document.getElementById('auto-layout-toggle');

    // --- NATIVE ZOOM & PAN STATE ---
    let transform = {
        x: 0,
        y: 0,
        scale: 0.5
    };

    let isPanning = false;
    let lastPanPoint = { x: 0, y: 0 };
    let isDragging = false;
    let isResizing = false;

    // --- IFRAME DEFINITIONS (dynamic, persisted) ---
    const defaultSites = [
        { url: 'https://tesla.com', x: 0, y: 0 },
        { url: 'https://en.wikipedia.org/wiki/Main_Page', x: 1000, y: 0 },
        { url: 'https://snelste.nl', x: 0, y: 800 },
        { url: 'https://programmablebrowser.com', x: 1000, y: 800 },
        { url: 'https://www.energiedirect.nl', x: 2000, y: 0 },
        { url: 'https://essent.nl', x: 3000, y: 0 },
        { url: 'https://dividendstocks.cash/dividend-calendar', x: 4000, y: 0 }
    ];

    let sites = [];

    const loadSites = () => {
        try {
            const raw = localStorage.getItem('peripeek.sites');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.every(s => typeof s.url === 'string')) {
                    sites = parsed.map((s, i) => ({
                        url: s.url,
                        x: typeof s.x === 'number' ? s.x : (i % 3) * (settings.currentWidth + 50),
                        y: typeof s.y === 'number' ? s.y : Math.floor(i / 3) * (settings.currentHeight + 50)
                    }));
                    return;
                }
            }
        } catch {}
        sites = [...defaultSites];
    };

    const saveSites = () => {
        const slim = sites.map(s => ({ url: s.url, x: s.x, y: s.y }));
        localStorage.setItem('peripeek.sites', JSON.stringify(slim));
    };

    // --- NATIVE TRANSFORM FUNCTION ---
    const applyTransform = () => {
        const transformString = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
        canvas.style.transform = transformString;
        console.log('Applied transform:', transformString);
    };

    // --- NATIVE ZOOM FUNCTIONS ---
    const zoomIn = () => {
        transform.scale = Math.min(transform.scale * 1.2, 5);
        applyTransform();
    };

    const zoomOut = () => {
        transform.scale = Math.max(transform.scale / 1.2, 0.1);
        applyTransform();
    };

    const zoomToPoint = (delta, point) => {
        const oldScale = transform.scale;
        const newScale = delta > 0 ? 
            Math.min(oldScale * 1.1, 5) : 
            Math.max(oldScale / 1.1, 0.1);
        
        if (newScale !== oldScale) {
            const rect = viewport.getBoundingClientRect();
            const offsetX = point.x - rect.left;
            const offsetY = point.y - rect.top;
            
            // Calculate new transform to zoom toward mouse point
            transform.x = offsetX - (offsetX - transform.x) * (newScale / oldScale);
            transform.y = offsetY - (offsetY - transform.y) * (newScale / oldScale);
            transform.scale = newScale;
            
            applyTransform();
        }
    };

    // --- NATIVE PAN FUNCTIONS ---
    const panBy = (deltaX, deltaY) => {
        transform.x += deltaX;
        transform.y += deltaY;
        applyTransform();
    };

    // --- IFRAME CREATION WITH NATIVE DRAG & RESIZE ---
    const clearIframes = () => {
        while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
    };

    const createIframes = () => {
        console.log('🌐 Creating iframes for sites:', sites);
        clearIframes();
        
        sites.forEach((site, index) => {
            const container = document.createElement('div');
            container.className = 'iframe-container';
            container.style.position = 'absolute';
            container.style.left = `${site.x}px`;
            container.style.top = `${site.y}px`;
            container.style.width = `${settings.currentWidth}px`;
            container.style.height = `${settings.currentHeight}px`;
            container.style.backgroundColor = 'white';
            container.style.border = '2px solid #333';
            container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            container.style.borderRadius = '8px';
            container.style.overflow = 'hidden';
            container.id = `container-${index}`;

            // Loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.style.position = 'absolute';
            loadingDiv.style.top = '10px';
            loadingDiv.style.left = '10px';
            loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
            loadingDiv.style.color = 'white';
            loadingDiv.style.padding = '5px 10px';
            loadingDiv.style.borderRadius = '3px';
            loadingDiv.style.fontSize = '12px';
            loadingDiv.style.zIndex = '10';
            loadingDiv.textContent = 'Queued...';
            container.appendChild(loadingDiv);

            // Create iframe
            const iframe = document.createElement('iframe');
            iframe.src = 'about:blank';
            iframe.dataset.src = site.url;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.backgroundColor = '#ffffff';

            iframe.onload = () => {
                if (iframe.src !== 'about:blank') {
                    loadingDiv.textContent = '✓ Loaded';
                    loadingDiv.style.backgroundColor = 'rgba(76,175,80,0.8)';
                    setTimeout(() => {
                        loadingDiv.style.opacity = '0';
                        loadingDiv.style.transition = 'opacity 0.5s';
                        setTimeout(() => loadingDiv.remove(), 500);
                    }, 2000);
                }
            };

            iframe.onerror = () => {
                if (iframe.src !== 'about:blank') {
                    loadingDiv.textContent = '✗ Failed';
                    loadingDiv.style.backgroundColor = 'rgba(244,67,54,0.8)';
                }
            };

            // Create drag handle
            const dragHandle = document.createElement('div');
            dragHandle.style.position = 'absolute';
            dragHandle.style.top = '0';
            dragHandle.style.left = '0';
            dragHandle.style.right = '0';
            dragHandle.style.height = '25px';
            dragHandle.style.backgroundColor = 'rgba(0,0,0,0.1)';
            dragHandle.style.cursor = 'grab';
            dragHandle.style.borderBottom = '1px solid rgba(0,0,0,0.2)';
            dragHandle.style.display = 'flex';
            dragHandle.style.alignItems = 'center';
            dragHandle.style.justifyContent = 'space-between';
            dragHandle.style.fontSize = '10px';
            dragHandle.style.color = 'rgba(0,0,0,0.6)';
            dragHandle.style.userSelect = 'none';
            dragHandle.style.zIndex = '1001';
            dragHandle.className = 'drag-handle';

            // Left: clickable URL
            const link = document.createElement('a');
            link.href = site.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = site.url;
            link.textContent = site.url;
            link.style.color = '#2c3e50';
            link.style.textDecoration = 'none';
            link.style.padding = '0 8px';
            link.style.flex = '1';
            link.style.overflow = 'hidden';
            link.style.whiteSpace = 'nowrap';
            link.style.textOverflow = 'ellipsis';
            // Prevent drag start when clicking the link
            link.addEventListener('mousedown', (ev) => ev.stopPropagation());
            link.addEventListener('click', (ev) => ev.stopPropagation());

            // Right: controls (Reload)
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.alignItems = 'center';
            controls.style.gap = '6px';
            controls.style.padding = '0 6px';

            const reloadBtn = document.createElement('button');
            reloadBtn.type = 'button';
            reloadBtn.title = 'Reload iframe';
            reloadBtn.textContent = '↻';
            reloadBtn.style.cursor = 'pointer';
            reloadBtn.style.border = 'none';
            reloadBtn.style.background = 'transparent';
            reloadBtn.style.fontSize = '12px';
            reloadBtn.style.padding = '4px 6px';
            reloadBtn.style.lineHeight = '1';
            reloadBtn.style.borderRadius = '4px';
            reloadBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                // Show loading state
                loadingDiv.textContent = 'Loading...';
                loadingDiv.style.opacity = '1';
                loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
                // Safe reload for cross-origin
                const current = iframe.src;
                iframe.src = current;
            });

            // Screenshot button
            const screenshotBtn = document.createElement('button');
            screenshotBtn.type = 'button';
            screenshotBtn.title = 'Screenshot iframe';
            screenshotBtn.textContent = '📸';
            screenshotBtn.style.cursor = 'pointer';
            screenshotBtn.style.border = 'none';
            screenshotBtn.style.background = 'transparent';
            screenshotBtn.style.fontSize = '12px';
            screenshotBtn.style.padding = '4px 6px';
            screenshotBtn.style.lineHeight = '1';
            screenshotBtn.style.borderRadius = '4px';
            screenshotBtn.addEventListener('mousedown', (ev) => ev.stopPropagation());
            screenshotBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                try {
                    // Ask background to capture full page of the iframe URL
                    const response = await chrome.runtime.sendMessage({ type: 'FULLPAGE_CAPTURE', url: site.url });
                    if (!response || !response.ok) {
                        // Fallback to visible crop
                        const rect = iframe.getBoundingClientRect();
                        const dpr = window.devicePixelRatio || 1;
                        chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
                            if (!dataUrl) { alert('Screenshot failed'); return; }
                            const img = new Image();
                            img.onload = () => {
                                const sx = Math.max(0, Math.round(rect.left * dpr));
                                const sy = Math.max(0, Math.round(rect.top * dpr));
                                const sw = Math.max(1, Math.round(rect.width * dpr));
                                const sh = Math.max(1, Math.round(rect.height * dpr));
                                const c = document.createElement('canvas');
                                c.width = sw; c.height = sh;
                                c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
                                const png = c.toDataURL('image/png');
                                const a = document.createElement('a');
                                const host = (() => { try { return new URL(site.url).host; } catch { return 'iframe'; } })();
                                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                                a.href = png; a.download = `${host}-${ts}.png`; document.body.appendChild(a); a.click(); a.remove();
                            };
                            img.src = dataUrl;
                        });
                        return;
                    }
                    // Single full-page image path
                    if (response.cdp && response.single && response.image) {
                        const a = document.createElement('a');
                        const host = (() => { try { return new URL(site.url).host; } catch { return 'iframe'; } })();
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        a.href = response.image;
                        a.download = `${host}-fullpage-${ts}.png`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        return;
                    }
                    // If background guarantees non-overlapping tiles, do a straight stack
                    if (response.cdp && response.noOverlap && Array.isArray(response.images) && response.images.length) {
                        const imgEls = await Promise.all(response.images.map(src => new Promise((res, rej) => {
                            const im = new Image();
                            im.onload = () => res(im);
                            im.onerror = rej;
                            im.src = src;
                        })));
                        const sw = imgEls[0].naturalWidth;
                        let totalH = 0;
                        imgEls.forEach(im => { totalH += im.naturalHeight; });
                        const canvasShot = document.createElement('canvas');
                        canvasShot.width = sw;
                        canvasShot.height = Math.max(1, totalH);
                        const ctx = canvasShot.getContext('2d');
                        let yOff = 0;
                        imgEls.forEach((im) => {
                            ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, yOff, im.naturalWidth, im.naturalHeight);
                            yOff += im.naturalHeight;
                        });
                        const png = canvasShot.toDataURL('image/png');
                        const a = document.createElement('a');
                        const host = (() => { try { return new URL(site.url).host; } catch { return 'iframe'; } })();
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        a.href = png;
                        a.download = `${host}-fullpage-${ts}.png`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        return;
                    }
                    // If CDP returned tiled images, stitch them using seam matching to avoid duplicates
                    if (response.cdp && Array.isArray(response.images) && response.images.length) {
                        const imgEls = await Promise.all(response.images.map(src => new Promise((res, rej) => {
                            const im = new Image();
                            im.onload = () => res(im);
                            im.onerror = rej;
                            im.src = src;
                        })));
                        const sw = imgEls[0].naturalWidth;
                        const maxOverlap = Math.max(80, Math.round((response.vpH || imgEls[0].naturalHeight) * 0.33));

                        // Precompute best overlaps between consecutive tiles using grayscale + gradient matching
                        const overlaps = [];
                        const offPrev = document.createElement('canvas');
                        const offCurr = document.createElement('canvas');
                        offPrev.width = offCurr.width = sw;
                        offPrev.height = offCurr.height = maxOverlap;
                        const pctx = offPrev.getContext('2d');
                        const cctx = offCurr.getContext('2d');

                        function diffScore(prevImg, currImg, overlap) {
                            pctx.clearRect(0,0,sw,maxOverlap);
                            cctx.clearRect(0,0,sw,maxOverlap);
                            pctx.drawImage(prevImg, 0, prevImg.naturalHeight - overlap, sw, overlap, 0, 0, sw, overlap);
                            cctx.drawImage(currImg, 0, 0, sw, overlap, 0, 0, sw, overlap);
                            const a = pctx.getImageData(0, 0, sw, overlap).data;
                            const b = cctx.getImageData(0, 0, sw, overlap).data;
                            let sum = 0;
                            const stepX = 4;
                            for (let y = 1; y < overlap; y += 1) {
                                for (let x = 0; x < sw - stepX; x += stepX) {
                                    const i = (y * sw + x) * 4;
                                    const j = ((y-1) * sw + x) * 4;
                                    // grayscale
                                    const ga = 0.299*a[i] + 0.587*a[i+1] + 0.114*a[i+2];
                                    const gb = 0.299*b[i] + 0.587*b[i+1] + 0.114*b[i+2];
                                    // simple vertical gradient magnitude
                                    const gpa = Math.abs( (0.299*a[j] + 0.587*a[j+1] + 0.114*a[j+2]) - ga );
                                    const gpb = Math.abs( (0.299*b[j] + 0.587*b[j+1] + 0.114*b[j+2]) - gb );
                                    sum += Math.abs(ga - gb) + Math.abs(gpa - gpb);
                                }
                            }
                            return sum;
                        }

                        for (let i = 1; i < imgEls.length; i++) {
                            const prev = imgEls[i-1];
                            const curr = imgEls[i];
                            let best = Math.min(maxOverlap, prev.naturalHeight, curr.naturalHeight) - 1;
                            let bestScore = Infinity;
                            const minOverlap = Math.min(120, best);
                            // coarse search
                            for (let ov = minOverlap; ov <= best; ov += 12) {
                                const s = diffScore(prev, curr, ov);
                                if (s < bestScore) { bestScore = s; best = ov; }
                            }
                            // refine around best
                            const start = Math.max(minOverlap, best - 12);
                            const end = Math.min(best + 12, Math.min(maxOverlap, prev.naturalHeight, curr.naturalHeight) - 1);
                            for (let ov = start; ov <= end; ov += 2) {
                                const s = diffScore(prev, curr, ov);
                                if (s < bestScore) { bestScore = s; best = ov; }
                            }
                            overlaps.push(best);
                        }

                        // Compute final height
                        let totalH = imgEls[0].naturalHeight;
                        for (let i = 1; i < imgEls.length; i++) {
                            totalH += imgEls[i].naturalHeight - overlaps[i-1];
                        }
                        const canvasShot = document.createElement('canvas');
                        canvasShot.width = sw;
                        canvasShot.height = Math.max(1, totalH);
                        const ctx = canvasShot.getContext('2d');

                        // Draw first
                        let yOff = 0;
                        ctx.drawImage(imgEls[0], 0, 0);
                        yOff += imgEls[0].naturalHeight - (overlaps[0] || 0);
                        for (let i = 1; i < imgEls.length; i++) {
                            const ov = overlaps[i-1] || 0;
                            const im = imgEls[i];
                            ctx.drawImage(im, 0, ov, sw, im.naturalHeight - ov, 0, yOff, sw, im.naturalHeight - ov);
                            yOff += im.naturalHeight - ov;
                        }

                        const png = canvasShot.toDataURL('image/png');
                        const a = document.createElement('a');
                        const host = (() => { try { return new URL(site.url).host; } catch { return 'iframe'; } })();
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        a.href = png;
                        a.download = `${host}-fullpage-${ts}.png`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        return;
                    }

                    // Otherwise stitch fallback images
                    const { images, vpW, vpH } = response;
                    if (!Array.isArray(images) || images.length === 0) {
                        alert('Screenshot failed');
                        return;
                    }
                    const dpr = window.devicePixelRatio || 1;
                    const imgEls = await Promise.all(images.map(src => new Promise((res, rej) => {
                        const im = new Image();
                        im.onload = () => res(im);
                        im.onerror = rej;
                        im.src = src;
                    })));
                    const sw = Math.round(vpW * dpr);
                    const sh = imgEls.length * Math.round(vpH * dpr);
                    const canvasShot = document.createElement('canvas');
                    canvasShot.width = sw;
                    canvasShot.height = sh;
                    const ctx = canvasShot.getContext('2d');
                    let yOff = 0;
                    imgEls.forEach((im) => {
                        const sliceH = Math.round(vpH * dpr);
                        ctx.drawImage(im, 0, 0, sw, sliceH, 0, yOff, sw, sliceH);
                        yOff += sliceH;
                    });
                    const png = canvasShot.toDataURL('image/png');
                    const a = document.createElement('a');
                    const host = (() => { try { return new URL(site.url).host; } catch { return 'iframe'; } })();
                    const ts = new Date().toISOString().replace(/[:.]/g, '-');
                    a.href = png;
                    a.download = `${host}-fullpage-${ts}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                } catch (err) {
                    console.error('Screenshot error', err);
                    alert('Screenshot failed');
                }
            });

            controls.appendChild(reloadBtn);
            controls.appendChild(screenshotBtn);
            dragHandle.appendChild(link);
            dragHandle.appendChild(controls);

            // Adjust iframe for drag handle
            iframe.style.marginTop = '25px';
            iframe.style.height = 'calc(100% - 25px)';

            // Create resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.style.position = 'absolute';
            resizeHandle.style.bottom = '0';
            resizeHandle.style.right = '0';
            resizeHandle.style.width = '20px';
            resizeHandle.style.height = '20px';
            resizeHandle.style.cursor = 'se-resize';
            resizeHandle.style.backgroundColor = 'rgba(100,100,100,0.5)';
            resizeHandle.style.borderLeft = '3px solid #666';
            resizeHandle.style.borderTop = '3px solid #666';
            resizeHandle.style.zIndex = '1002';
            resizeHandle.className = 'resize-handle';

            // --- DRAG FUNCTIONALITY ---
            let dragState = null;

            dragHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                isDragging = true;
                dragState = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startLeft: parseInt(container.style.left),
                    startTop: parseInt(container.style.top)
                };

                dragHandle.style.cursor = 'grabbing';
                container.style.zIndex = '1001';
                container.style.opacity = '0.9';
                iframe.style.pointerEvents = 'none';

                console.log(`Started dragging iframe ${index}`);
            });

            // --- RESIZE FUNCTIONALITY ---
            let resizeState = null;

            resizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                isResizing = true;
                resizeState = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startWidth: parseInt(container.style.width),
                    startHeight: parseInt(container.style.height)
                };

                console.log(`Started resizing iframe ${index}`);
            });

            // Global mouse handlers for this iframe's drag and resize
            document.addEventListener('mousemove', (e) => {
                if (dragState && isDragging) {
                    const deltaX = (e.clientX - dragState.startX) / transform.scale;
                    const deltaY = (e.clientY - dragState.startY) / transform.scale;
                    
                    container.style.left = (dragState.startLeft + deltaX) + 'px';
                    container.style.top = (dragState.startTop + deltaY) + 'px';
                }
                
                if (resizeState && isResizing) {
                    const deltaX = e.clientX - resizeState.startX;
                    const deltaY = e.clientY - resizeState.startY;
                    
                    const newWidth = Math.max(200, resizeState.startWidth + deltaX);
                    const newHeight = Math.max(150, resizeState.startHeight + deltaY);
                    
                    container.style.width = newWidth + 'px';
                    container.style.height = newHeight + 'px';
                }
            });

            document.addEventListener('mouseup', (e) => {
                if (dragState && isDragging) {
                    isDragging = false;
                    // Persist new position
                    const left = parseInt(container.style.left);
                    const top = parseInt(container.style.top);
                    sites[index].x = left;
                    sites[index].y = top;
                    saveSites();
                    dragState = null;
                    
                    dragHandle.style.cursor = 'grab';
                    container.style.zIndex = '1000';
                    container.style.opacity = '1';
                    iframe.style.pointerEvents = 'auto';
                    
                    console.log(`Finished dragging iframe ${index}`);
                }
                
                if (resizeState && isResizing) {
                    isResizing = false;
                    // Persist new size into settings? We keep per-container size only visually
                    resizeState = null;
                    
                    console.log(`Finished resizing iframe ${index}`);
                }
            });

            container.appendChild(iframe);
            container.appendChild(dragHandle);
            container.appendChild(resizeHandle);
            canvas.appendChild(container);
        });
    };

    // Sequentially load iframes one-by-one to reduce initial network contention
    const loadIframesSequentially = async () => {
        const containers = Array.from(document.querySelectorAll('.iframe-container'));
        for (const container of containers) {
            const iframe = container.querySelector('iframe');
            const loadingDiv = container.querySelector('div');
            if (!iframe) continue;
            const target = iframe.dataset.src;
            if (!target) continue;
            if (loadingDiv) {
                loadingDiv.textContent = 'Loading...';
                loadingDiv.style.opacity = '1';
                loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
            }
            iframe.src = target;
            await new Promise((resolve) => {
                let settled = false;
                const done = () => { if (!settled) { settled = true; resolve(); } };
                const onLoad = () => { iframe.removeEventListener('load', onLoad); iframe.removeEventListener('error', onError); done(); };
                const onError = () => { iframe.removeEventListener('load', onLoad); iframe.removeEventListener('error', onError); done(); };
                iframe.addEventListener('load', onLoad, { once: true });
                iframe.addEventListener('error', onError, { once: true });
                // Hard timeout to avoid stalls
                setTimeout(done, 8000);
            });
            // brief breather between loads
            await new Promise(r => setTimeout(r, 150));
        }
    };

    // --- LAYOUT FUNCTIONS ---
    const gridLayoutIframes = () => {
        console.log('📦 Applying grid layout...');
        
        const containers = document.querySelectorAll('.iframe-container');
        if (containers.length === 0) return;
        
        const padding = 50;
        const maxColumns = 3;
        let currentX = 0;
        let currentY = 0;
        let maxHeightInRow = 0;
        let itemsInCurrentRow = 0;
        
        containers.forEach((container, index) => {
            const width = parseInt(container.style.width) || settings.currentWidth;
            const height = parseInt(container.style.height) || settings.currentHeight;
            
            if (itemsInCurrentRow >= maxColumns) {
                currentX = 0;
                currentY += maxHeightInRow + padding;
                maxHeightInRow = 0;
                itemsInCurrentRow = 0;
            }
            
            container.style.left = currentX + 'px';
            container.style.top = currentY + 'px';
            
            currentX += width + padding;
            maxHeightInRow = Math.max(maxHeightInRow, height);
            itemsInCurrentRow++;
            
            console.log(`Grid positioned iframe ${index}: x=${container.style.left}, y=${container.style.top}`);
        });
        
        console.log('✅ Grid layout complete');
    };

    const horizontalLayoutIframes = () => {
        console.log('↔️ Applying horizontal layout...');
        
        const containers = document.querySelectorAll('.iframe-container');
        if (containers.length === 0) return;
        
        const padding = 50;
        let currentX = 0;
        const y = 100; // Fixed Y position for horizontal layout
        
        containers.forEach((container, index) => {
            const width = parseInt(container.style.width) || settings.currentWidth;
            
            container.style.left = currentX + 'px';
            container.style.top = y + 'px';
            
            currentX += width + padding;
            
            console.log(`Horizontal positioned iframe ${index}: x=${container.style.left}, y=${container.style.top}`);
        });
        
        console.log('✅ Horizontal layout complete');
    };

    const verticalLayoutIframes = () => {
        console.log('↕️ Applying vertical layout...');
        
        const containers = document.querySelectorAll('.iframe-container');
        if (containers.length === 0) return;
        
        const padding = 50;
        let currentY = 0;
        const x = 100; // Fixed X position for vertical layout
        
        containers.forEach((container, index) => {
            const height = parseInt(container.style.height) || settings.currentHeight;
            
            container.style.left = x + 'px';
            container.style.top = currentY + 'px';
            
            currentY += height + padding;
            
            console.log(`Vertical positioned iframe ${index}: x=${container.style.left}, y=${container.style.top}`);
        });
        
        console.log('✅ Vertical layout complete');
    };

    // --- VIEWPORT EVENT HANDLERS ---
    viewport.addEventListener('mousedown', (e) => {
        if (e.target === viewport || e.target === canvas) {
            if (!isDragging && !isResizing) {
                isPanning = true;
                lastPanPoint = { x: e.clientX, y: e.clientY };
                viewport.style.cursor = 'grabbing';
                e.preventDefault();
            }
        }
    });

    viewport.addEventListener('mousemove', (e) => {
        if (isPanning && !isDragging && !isResizing) {
            const deltaX = e.clientX - lastPanPoint.x;
            const deltaY = e.clientY - lastPanPoint.y;
            
            panBy(deltaX, deltaY);
            
            lastPanPoint = { x: e.clientX, y: e.clientY };
        }
    });

    viewport.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            viewport.style.cursor = 'grab';
        }
    });

    viewport.addEventListener('mouseleave', () => {
        if (isPanning) {
            isPanning = false;
            viewport.style.cursor = 'grab';
        }
    });

    // Mouse wheel zoom
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomToPoint(e.deltaY, { x: e.clientX, y: e.clientY });
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case '+':
            case '=':
                e.preventDefault();
                zoomIn();
                break;
            case '-':
                e.preventDefault();
                zoomOut();
                break;
            case 'ArrowUp':
                e.preventDefault();
                panBy(0, 50);
                break;
            case 'ArrowDown':
                e.preventDefault();
                panBy(0, -50);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                panBy(50, 0);
                break;
            case 'ArrowRight':
                e.preventDefault();
                panBy(-50, 0);
                break;
        }
    });

    // --- SETTINGS EVENT LISTENERS ---
    
    // Update current size when inputs change
    widthInput.addEventListener('input', () => {
        settings.currentWidth = parseInt(widthInput.value) || 800;
    });
    
    heightInput.addEventListener('input', () => {
        settings.currentHeight = parseInt(heightInput.value) || 600;
    });

    // Apply size to existing iframes
    applySizeBtn.addEventListener('click', () => {
        if (settings.applyToExisting) {
            document.querySelectorAll('.iframe-container').forEach(container => {
                container.style.width = settings.currentWidth + 'px';
                container.style.height = settings.currentHeight + 'px';
            });
            console.log(`Applied size ${settings.currentWidth}x${settings.currentHeight} to all iframes`);
            if (settings.autoLayoutOnResize) {
                gridLayoutIframes();
            }
        }
    });

    // Preset buttons
    presetButtons.forEach(button => {
        button.addEventListener('click', () => {
            const presetName = button.dataset.preset;
            const preset = settings.presets[presetName];
            
            if (preset) {
                settings.currentWidth = preset.width;
                settings.currentHeight = preset.height;
                widthInput.value = preset.width;
                heightInput.value = preset.height;
                
                presetButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                if (settings.applyToExisting) {
                    document.querySelectorAll('.iframe-container').forEach(container => {
                        container.style.width = preset.width + 'px';
                        container.style.height = preset.height + 'px';
                    });
                    if (settings.autoLayoutOnResize) {
                        gridLayoutIframes();
                    }
                }
                
                console.log(`Applied ${preset.name} preset: ${preset.width}x${preset.height}`);
            }
        });
    });

    // Apply mode buttons
    applyAllBtn.addEventListener('click', () => {
        settings.applyToExisting = true;
        applyAllBtn.classList.add('active');
        applyNewBtn.classList.remove('active');
        console.log('Mode: Apply to all iframes');
    });

    applyNewBtn.addEventListener('click', () => {
        settings.applyToExisting = false;
        applyNewBtn.classList.add('active');
        applyAllBtn.classList.remove('active');
        console.log('Mode: Apply to new iframes only');
    });

    // Layout buttons
    gridLayoutBtn.addEventListener('click', () => {
        gridLayoutIframes();
        // Update active button
        [gridLayoutBtn, horizontalLayoutBtn, verticalLayoutBtn].forEach(btn => btn.classList.remove('active'));
        gridLayoutBtn.classList.add('active');
    });

    horizontalLayoutBtn.addEventListener('click', () => {
        horizontalLayoutIframes();
        // Update active button
        [gridLayoutBtn, horizontalLayoutBtn, verticalLayoutBtn].forEach(btn => btn.classList.remove('active'));
        horizontalLayoutBtn.classList.add('active');
    });

    verticalLayoutBtn.addEventListener('click', () => {
        verticalLayoutIframes();
        // Update active button
        [gridLayoutBtn, horizontalLayoutBtn, verticalLayoutBtn].forEach(btn => btn.classList.remove('active'));
        verticalLayoutBtn.classList.add('active');
    });

    // Auto-layout toggle
    autoLayoutToggle.addEventListener('click', () => {
        settings.autoLayoutOnResize = !settings.autoLayoutOnResize;
        autoLayoutToggle.classList.toggle('active', settings.autoLayoutOnResize);
        console.log(`Auto-layout on resize: ${settings.autoLayoutOnResize ? 'enabled' : 'disabled'}`);
    });

    // --- UPDATE URLS MODAL LOGIC ---
    const modal = document.getElementById('update-urls-modal');
    const openModalBtn = document.getElementById('open-update-urls');
    const urlsTextarea = document.getElementById('urls-textarea');
    const urlsFileInput = document.getElementById('urls-file-input');
    const sitemapInput = document.getElementById('sitemap-url');
    const fetchSitemapBtn = document.getElementById('fetch-sitemap');
    const resetUrlsBtn = document.getElementById('reset-urls');
    const clearUrlsBtn = document.getElementById('clear-urls');
    const saveUrlsBtn = document.getElementById('save-urls');
    const urlsCountEl = document.getElementById('urls-count');
    const filterInput = document.getElementById('urls-filter-input');
    const filterCountEl = document.getElementById('urls-filter-count');
    const useFilterForPreview = document.getElementById('use-filter-for-preview');

    const sitesToTextarea = () => {
        urlsTextarea.value = sites.map(s => s.url).join('\n');
        urlsCountEl.textContent = sites.length.toString();
        updateFilterCount();
    };

    const getTextareaLines = () => urlsTextarea.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const applyFilter = (lines) => {
        const q = filterInput.value.trim().toLowerCase();
        if (!q) return lines;
        return lines.filter(l => l.toLowerCase().includes(q));
    };

    const updateFilterCount = () => {
        const lines = getTextareaLines();
        const matches = applyFilter(lines);
        filterCountEl.textContent = `Matches: ${matches.length}`;
        urlsCountEl.textContent = lines.length.toString();
    };

    const textareaToSites = () => {
        let lines = getTextareaLines();
        if (useFilterForPreview.checked) {
            lines = applyFilter(lines);
        }
        sites = lines.map((url, i) => ({
            url,
            x: (i % 3) * (settings.currentWidth + 50),
            y: Math.floor(i / 3) * (settings.currentHeight + 50)
        }));
    };

    // Fetch sitemap and parse <loc>
    fetchSitemapBtn.addEventListener('click', async () => {
        const url = sitemapInput.value.trim();
        if (!url) return;
        try {
            const res = await fetch(url);
            const xml = await res.text();
            lastFetchedSitemapXml = xml; // remember last fetched XML
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');

            // Collect <loc> elements regardless of namespace (e.g., q1:loc, ns:loc, default ns)
            let locNodes = Array.from(doc.getElementsByTagNameNS('*', 'loc'));

            // Fallback: scan all elements and match by localName
            if (locNodes.length === 0) {
                locNodes = Array.from(doc.getElementsByTagName('*')).filter(n => n.localName === 'loc');
            }

            // Another fallback: sometimes <url><loc> or <sitemap><loc>
            if (locNodes.length === 0) {
                const urlNodes = Array.from(doc.getElementsByTagNameNS('*', 'url'));
                locNodes = urlNodes
                    .map(n => Array.from(n.getElementsByTagNameNS('*', 'loc'))[0])
                    .filter(Boolean);
            }

            const urls = locNodes.map(n => (n.textContent || '').trim()).filter(Boolean);

            if (urls.length) {
                urlsTextarea.value = urls.join('\n');
                updateFilterCount();
            } else {
                alert('No <loc> entries found in sitemap');
            }
        } catch (err) {
            console.error('Failed to fetch sitemap', err);
            alert('Failed to fetch sitemap');
        }
    });

    // Load from .txt file (one URL per line)
    urlsFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        urlsTextarea.value = lines.join('\n');
        updateFilterCount();
    });

    // Wire up data-folder buttons
    const fileNameInput = document.getElementById('file-name-input');
    const saveListBtn = document.getElementById('save-list-btn');
    const saveXmlBtn = document.getElementById('save-xml-btn');

    saveListBtn?.addEventListener('click', async () => {
        const name = (fileNameInput?.value || '').trim();
        if (!name) { alert('Please enter a file name'); return; }
        await saveTextAsFile(name, urlsTextarea.value || '');
        await refreshSavedFilesList();
    });

    saveXmlBtn?.addEventListener('click', async () => {
        const name = (fileNameInput?.value || '').trim();
        if (!name) { alert('Please enter a file name'); return; }
        if (!lastFetchedSitemapXml) { alert('No sitemap XML fetched yet'); return; }
        await saveXmlAsFile(name, lastFetchedSitemapXml);
        await refreshSavedFilesList();
    });

    openModalBtn.addEventListener('click', async () => {
        sitesToTextarea();
        await refreshSavedFilesList();
        modal.showModal();
        urlsTextarea.focus();
        urlsTextarea.setSelectionRange(urlsTextarea.value.length, urlsTextarea.value.length);
    });

    resetUrlsBtn.addEventListener('click', () => {
        sites = [...defaultSites];
        sitesToTextarea();
    });

    clearUrlsBtn.addEventListener('click', () => {
        urlsTextarea.value = '';
        updateFilterCount();
    });

    // Live updates of counts while typing and filtering
    urlsTextarea.addEventListener('input', updateFilterCount);
    filterInput.addEventListener('input', updateFilterCount);

    // Save URLs -> rebuild iframes and persist (only when Save is clicked)
    document.getElementById('update-urls-form').addEventListener('submit', (e) => {
        const submitter = e.submitter || document.activeElement;
        if (submitter && submitter.id === 'save-urls') {
            e.preventDefault();
            textareaToSites();
            saveSites();
            createIframes();
            loadIframesSequentially(); // Sequential load after saving
            gridLayoutIframes();
            modal.close('ok');
        }
        // If not Save (e.g., Cancel), allow default dialog behavior to close without changes
    });

    // --- STORAGE BACKED DATA FOLDER HELPERS ---
	const DATA_INDEX_KEY = 'peripeek.data.index';
	const DATA_FILE_PREFIX = 'peripeek.data.file:';
	let lastFetchedSitemapXml = '';

	async function readStorage(keys) {
		return await chrome.storage.local.get(keys);
	}

	async function writeStorage(obj) {
		return await chrome.storage.local.set(obj);
	}

	async function removeStorage(keys) {
		return await chrome.storage.local.remove(keys);
	}

	async function listDataFiles() {
		const res = await readStorage([DATA_INDEX_KEY]);
		const idx = Array.isArray(res[DATA_INDEX_KEY]) ? res[DATA_INDEX_KEY] : [];
		return idx;
	}

	async function saveDataIndex(names) {
		await writeStorage({ [DATA_INDEX_KEY]: names });
	}

	async function saveTextAsFile(name, text) {
		const safe = name.trim().replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-');
		if (!safe) throw new Error('Invalid name');
		const key = DATA_FILE_PREFIX + safe;
		const now = new Date().toISOString();
		await writeStorage({ [key]: { type: 'text', name: safe, createdAt: now, updatedAt: now, payload: text } });
		const list = await listDataFiles();
		if (!list.includes(safe)) {
			list.push(safe);
			await saveDataIndex(list);
		}
		return safe;
	}

	async function saveXmlAsFile(name, xml) {
		const safe = name.trim().replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-');
		if (!safe) throw new Error('Invalid name');
		const key = DATA_FILE_PREFIX + safe;
		const now = new Date().toISOString();
		await writeStorage({ [key]: { type: 'xml', name: safe, createdAt: now, updatedAt: now, payload: xml } });
		const list = await listDataFiles();
		if (!list.includes(safe)) {
			list.push(safe);
			await saveDataIndex(list);
		}
		return safe;
	}

	async function loadDataFile(name) {
		const key = DATA_FILE_PREFIX + name;
		const res = await readStorage([key]);
		return res[key] || null;
	}

	async function deleteDataFile(name) {
		const key = DATA_FILE_PREFIX + name;
		await removeStorage([key]);
		const list = await listDataFiles();
		const next = list.filter(n => n !== name);
		await saveDataIndex(next);
	}

	function renderSavedFilesList(items) {
		const listEl = document.getElementById('saved-files-list');
		if (!listEl) return;
		listEl.innerHTML = '';
		if (!items || !items.length) {
			listEl.textContent = 'No files saved yet';
			return;
		}
		items.forEach(async (name) => {
			const file = await loadDataFile(name);
			if (!file) return;
			const row = document.createElement('div');
			row.style.display = 'flex';
			row.style.alignItems = 'center';
			row.style.gap = '8px';
			row.style.borderBottom = '1px solid #eee';
			row.style.padding = '6px 0';
			const meta = document.createElement('div');
			meta.style.flex = '1';
			meta.innerHTML = `<strong>${file.name}</strong> <span style="color:#888; font-size:12px;">(${file.type})</span>`;
			const loadBtn = document.createElement('button');
			loadBtn.type = 'button';
			loadBtn.className = 'preset-button';
			loadBtn.textContent = 'Load';
			loadBtn.addEventListener('click', async (ev) => {
				ev.preventDefault(); ev.stopPropagation();
				if (file.type === 'xml') {
					// Extract <loc> entries and put into textarea
					try {
						const parser = new DOMParser();
						const doc = parser.parseFromString(file.payload, 'text/xml');
						let locNodes = Array.from(doc.getElementsByTagNameNS('*', 'loc'));
						if (locNodes.length === 0) locNodes = Array.from(doc.getElementsByTagName('*')).filter(n => n.localName === 'loc');
						if (locNodes.length === 0) {
							const urlNodes = Array.from(doc.getElementsByTagNameNS('*', 'url'));
							locNodes = urlNodes.map(n => Array.from(n.getElementsByTagNameNS('*', 'loc'))[0]).filter(Boolean);
						}
						const urls = locNodes.map(n => (n.textContent || '').trim()).filter(Boolean);
						urlsTextarea.value = urls.join('\n');
						updateFilterCount();
					} catch {}
				} else if (file.type === 'text') {
					urlsTextarea.value = (file.payload || '').trim();
					updateFilterCount();
				}
			});
			const exportBtn = document.createElement('button');
			exportBtn.type = 'button';
			exportBtn.className = 'preset-button';
			exportBtn.style.background = '#16a085';
			exportBtn.textContent = 'Export';
			exportBtn.addEventListener('click', (ev) => {
				ev.preventDefault(); ev.stopPropagation();
				const blob = new Blob([file.payload || ''], { type: file.type === 'xml' ? 'application/xml' : 'text/plain' });
				const a = document.createElement('a');
				const ts = new Date().toISOString().replace(/[:.]/g, '-');
				a.href = URL.createObjectURL(blob);
				a.download = `${file.name}-${ts}.${file.type === 'xml' ? 'xml' : 'txt'}`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(a.href);
			});
			const delBtn = document.createElement('button');
			delBtn.type = 'button';
			delBtn.className = 'preset-button';
			delBtn.style.background = '#c0392b';
			delBtn.textContent = 'Delete';
			delBtn.addEventListener('click', async (ev) => {
				ev.preventDefault(); ev.stopPropagation();
				await deleteDataFile(file.name);
				renderSavedFilesList(await listDataFiles());
			});
			row.appendChild(meta);
			row.appendChild(loadBtn);
			row.appendChild(exportBtn);
			row.appendChild(delBtn);
			listEl.appendChild(row);
		});
	}

	async function refreshSavedFilesList() {
		renderSavedFilesList(await listDataFiles());
	}

    // --- INITIALIZATION ---
    console.log('🎯 Starting initialization...');
    loadSites();
    createIframes();
    loadIframesSequentially();
    
    // Set initial transform
    transform.x = 200;
    transform.y = 150;
    applyTransform();

    // Set initial modes
    applyAllBtn.classList.add('active');
    gridLayoutBtn.classList.add('active'); // Default to grid layout
    viewport.style.cursor = 'grab';

    console.log('✅ Native JavaScript initialization complete');
}); 