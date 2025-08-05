document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Peripeek custom page loaded - Starting initialization');
    
    const viewport = document.getElementById('viewport');
    const canvas = document.getElementById('canvas');

    console.log('📋 Elements found:', { viewport: !!viewport, canvas: !!canvas });

    // --- STATE MANAGEMENT ---
    const state = {
        pan: { x: 200, y: 150 }, // Initial pan
        zoom: 0.5,             // Initial zoom
        isPanning: false,
        startPan: { x: 0, y: 0 }
    };
    
    // --- IFRAME DEFINITIONS ---
         const sites = [
            { url: 'https://tesla.com', x: 0, y: 0 },
            { url: 'https://en.wikipedia.org/wiki/Main_Page', x: 1000, y: 0 },
            { url: 'https://snelste.nl', x: 0, y: 800 },
            { url: 'https://programmablebrowser.com', x: 1000, y: 800 },
            { url: 'https://www.energiedirect.nl', x: 2000, y: 0 },
            { url: 'https://essent.nl', x: 3000, y: 0 },
            { url: 'https://dividendstocks.cash/dividend-calendar', x: 4000, y: 0 }
        ];
    // --- FUNCTION to apply transformations ---
    const applyTransform = () => {
        canvas.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
    };

    // --- FUNCTION to create and add iframes to the canvas ---
    const createIframes = () => {
        console.log('🌐 Creating iframes for sites:', sites);
        
        sites.forEach((site, index) => {
            const container = document.createElement('div');
            container.className = 'iframe-container';
            container.style.left = `${site.x}px`;
            container.style.top = `${site.y}px`;
            container.id = `container-${index}`;

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
            loadingDiv.textContent = 'Loading...';
            
            container.appendChild(loadingDiv);

            const iframe = document.createElement('iframe');
            iframe.src = site.url;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.backgroundColor = '#ffffff';

            iframe.onload = () => {
                loadingDiv.textContent = '✓ Loaded';
                loadingDiv.style.backgroundColor = 'rgba(76,175,80,0.8)';
                setTimeout(() => {
                    loadingDiv.style.opacity = '0';
                    loadingDiv.style.transition = 'opacity 0.5s';
                    setTimeout(() => loadingDiv.remove(), 500);
                }, 2000);
            };

            iframe.onerror = () => {
                loadingDiv.textContent = '✗ Failed';
                loadingDiv.style.backgroundColor = 'rgba(244,67,54,0.8)';
            };

            container.appendChild(iframe);
            canvas.appendChild(container);
        });
    };
    
    // --- EVENT LISTENERS ---

    // Keyboard controls for pan and zoom
    document.addEventListener('keydown', (event) => {
        // Check if we're focused on an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return; // Don't interfere with typing
        }

        const zoomStep = 0.15; // Zoom increment
        const panStep = 50; // Pan distance in pixels
        let handled = false;

        switch (event.key) {
            case '+':
            case '=':
                // Zoom in toward center of viewport
                event.preventDefault();
                handled = true;
                smoothZoom(state.zoom * (1 + zoomStep));
                break;
            case '-':
                // Zoom out from center of viewport
                event.preventDefault();
                handled = true;
                smoothZoom(state.zoom * (1 - zoomStep));
                break;
            case 'ArrowUp':
                event.preventDefault();
                handled = true;
                smoothPan(0, panStep);
                break;
            case 'ArrowDown':
                event.preventDefault();
                handled = true;
                smoothPan(0, -panStep);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                handled = true;
                smoothPan(panStep, 0);
                break;
            case 'ArrowRight':
                event.preventDefault();
                handled = true;
                smoothPan(-panStep, 0);
                break;
        }

        if (handled) {
            console.log(`Keyboard: ${event.key} - Zoom: ${state.zoom.toFixed(2)}, Pan: ${state.pan.x.toFixed(0)}, ${state.pan.y.toFixed(0)}`);
        }
    });

    // Smooth pan function
    const smoothPan = (deltaX, deltaY) => {
        const startX = state.pan.x;
        const startY = state.pan.y;
        const targetX = startX + deltaX;
        const targetY = startY + deltaY;
        
        animateTransform(startX, startY, state.zoom, targetX, targetY, state.zoom, 200);
    };

    // Smooth zoom function (zooms toward viewport center)
    const smoothZoom = (targetZoom) => {
        // Clamp zoom level
        targetZoom = Math.max(0.1, Math.min(10, targetZoom));
        
        // Get viewport center
        const viewportCenterX = viewport.clientWidth / 2;
        const viewportCenterY = viewport.clientHeight / 2;
        
        // Calculate the point on the canvas that the center is pointing at
        const pointX = (viewportCenterX - state.pan.x) / state.zoom;
        const pointY = (viewportCenterY - state.pan.y) / state.zoom;
        
        // Calculate new pan position to keep the center point stationary
        const targetX = viewportCenterX - pointX * targetZoom;
        const targetY = viewportCenterY - pointY * targetZoom;
        
        animateTransform(state.pan.x, state.pan.y, state.zoom, targetX, targetY, targetZoom, 300);
    };

    // Smooth animation function
    const animateTransform = (startX, startY, startZoom, targetX, targetY, targetZoom, duration) => {
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            
            // Interpolate values
            state.pan.x = startX + (targetX - startX) * eased;
            state.pan.y = startY + (targetY - startY) * eased;
            state.zoom = startZoom + (targetZoom - startZoom) * eased;
            
            applyTransform();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    };

    // Mouse Down: Start panning
    viewport.addEventListener('mousedown', (event) => {
        // Only pan with the left mouse button
        if (event.button !== 0) return;
        
        state.isPanning = true;
        viewport.classList.add('panning');
        state.startPan.x = event.clientX - state.pan.x;
        state.startPan.y = event.clientY - state.pan.y;

        // Disable pointer events on ALL iframes during pan
        document.querySelectorAll('.iframe-container iframe').forEach(iframe => {
            iframe.style.pointerEvents = 'none';
        });
    });

    // Mouse Up: Stop panning
    viewport.addEventListener('mouseup', () => {
        state.isPanning = false;
        viewport.classList.remove('panning');
        
        // Re-enable pointer events on iframes so they can be interacted with
        document.querySelectorAll('.iframe-container iframe').forEach(iframe => {
            iframe.style.pointerEvents = 'auto';
        });
    });
    
    // Mouse Leave: Also stop panning if mouse leaves viewport
    viewport.addEventListener('mouseleave', () => {
        if (state.isPanning) {
            state.isPanning = false;
            viewport.classList.remove('panning');
            document.querySelectorAll('.iframe-container iframe').forEach(iframe => {
                iframe.style.pointerEvents = 'auto';
            });
        }
    });

    // Mouse Move: Pan the canvas
    viewport.addEventListener('mousemove', (event) => {
        if (!state.isPanning) return;
        
        state.pan.x = event.clientX - state.startPan.x;
        state.pan.y = event.clientY - state.startPan.y;
        applyTransform();
    });

    // Mouse Wheel: Zoom the canvas (towards the cursor) with smooth animation
    viewport.addEventListener('wheel', (event) => {
        event.preventDefault(); // Prevent default page scrolling

        const zoomIntensity = 0.1;
        const direction = event.deltaY > 0 ? -1 : 1;
        
        // Get mouse position relative to the viewport
        const mouseX = event.clientX - viewport.getBoundingClientRect().left;
        const mouseY = event.clientY - viewport.getBoundingClientRect().top;
        
        // Calculate the point on the canvas that the mouse is pointing at
        const pointX = (mouseX - state.pan.x) / state.zoom;
        const pointY = (mouseY - state.pan.y) / state.zoom;
        
        // Calculate new zoom level
        const targetZoom = Math.max(0.1, Math.min(10, state.zoom * (1 + direction * zoomIntensity)));
        
        // Calculate the new pan position to keep the pointed-at location stationary
        const targetX = mouseX - pointX * targetZoom;
        const targetY = mouseY - pointY * targetZoom;

        // Smooth animation to new position
        animateTransform(state.pan.x, state.pan.y, state.zoom, targetX, targetY, targetZoom, 150);
    });



    // --- INITIALIZATION ---
    console.log('🎯 Starting initialization...');
    createIframes();
    applyTransform();
    console.log('✅ Initialization complete');
}); 