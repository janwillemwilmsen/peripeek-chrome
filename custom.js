document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Peripeek custom page loaded - Starting initialization');
    
    const viewport = document.getElementById('viewport');
    const canvas = document.getElementById('canvas');

    console.log('📋 Elements found:', { viewport: !!viewport, canvas: !!canvas });

    // --- STATE MANAGEMENT ---
    // Removed manual state as Panzoom will handle it

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
    // Removed manual applyTransform as Panzoom will handle it

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
    // Removed manual event listeners as Panzoom will handle mouse events

    // --- INITIALIZATION ---
    console.log('🎯 Starting initialization...');
    createIframes();

    // Check if Panzoom is available
    console.log('Panzoom available:', typeof Panzoom);
    if (typeof Panzoom === 'undefined') {
        console.error('❌ Panzoom is not defined! Check if panzoom.min.js is loaded correctly.');
        return;
    }

    // Initialize Panzoom on the canvas
    const panzoom = Panzoom(canvas, {
        canvas: true,          // Enable canvas mode
        minZoom: 0.1,          // Minimum zoom level
        maxZoom: 10,           // Maximum zoom level
        zoomSpeed: 0.065,      // Adjust zoom speed if needed
        panOnlyWhenZoomed: false, // Allow panning at any zoom level
        smoothScroll: true // Enables smoother wheel zooming (if supported)
    });

    console.log('Panzoom instance created:', panzoom);
    console.log('Available methods:', Object.keys(panzoom));

    // Attach Panzoom to the viewport for mouse events
    viewport.addEventListener('wheel', panzoom.zoomWithWheel);
    viewport.addEventListener('mousedown', (event) => {
        if (event.button === 0) {
            // Focus the viewport when clicking to enable keyboard controls
            viewport.focus();
            // Disable pointer events on iframes during pan
            document.querySelectorAll('.iframe-container iframe').forEach(iframe => {
                iframe.style.pointerEvents = 'none';
            });
            panzoom.handleDown(event);
        }
    });
    viewport.addEventListener('mousemove', panzoom.handleMove);
    viewport.addEventListener('mouseup', (event) => {
        panzoom.handleUp(event);
        // Re-enable pointer events on iframes
        document.querySelectorAll('.iframe-container iframe').forEach(iframe => {
            iframe.style.pointerEvents = 'auto';
        });
    });
    viewport.addEventListener('mouseleave', panzoom.handleUp);

    // Focus the viewport initially so keyboard controls work immediately
    viewport.focus();

    // Function to handle keyboard controls
    const handleKeyboard = (event) => {
        console.log('Key pressed:', event.key, 'on', event.target.tagName);
        
        const controlKeys = ['+', '=', '-', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (!controlKeys.includes(event.key)) return;
        
        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();
        
        const currentZoom = panzoom.getScale();
        const panStep = 50 / currentZoom;
        
        console.log('Processing key:', event.key, 'Current zoom:', currentZoom, 'Pan step:', panStep);

        // Visual feedback - briefly highlight the viewport
        // viewport.style.border = '3px solid #00ff00';
        setTimeout(() => {
            // viewport.style.border = 'none';
        }, 200);

        switch (event.key) {
            case '+':
            case '=':
                console.log('Executing zoom in...');
                panzoom.zoomIn();
                break;
            case '-':
                console.log('Executing zoom out...');
                panzoom.zoomOut();
                break;
            case 'ArrowUp':
                console.log('Executing pan up...');
                panzoom.pan(0, panStep, { relative: true });
                break;
            case 'ArrowDown':
                console.log('Executing pan down...');
                panzoom.pan(0, -panStep, { relative: true });
                break;
            case 'ArrowLeft':
                console.log('Executing pan left...');
                panzoom.pan(panStep, 0, { relative: true });
                break;
            case 'ArrowRight':
                console.log('Executing pan right...');
                panzoom.pan(-panStep, 0, { relative: true });
                break;
        }
    };

    // Add keyboard listeners to both viewport and document for maximum coverage
    viewport.addEventListener('keydown', handleKeyboard);
    document.addEventListener('keydown', handleKeyboard);
    window.addEventListener('keydown', handleKeyboard);

    // Also add a click handler to ensure focus
    viewport.addEventListener('click', (event) => {
        console.log('Viewport clicked, focusing...');
        viewport.focus();
        event.stopPropagation();
    });

    // Test if keyboard is working by adding a simple test
    console.log('Keyboard test: Press any key now...');
    const testHandler = (e) => {
        console.log('TEST: Key detected:', e.key);
        document.removeEventListener('keydown', testHandler);
    };
    document.addEventListener('keydown', testHandler);

    // Set initial zoom and pan
    panzoom.zoom(0.5);
    panzoom.pan(200, 150);

    // Listen for messages from background for key presses
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Message received:', message);
        if (message.type === 'PANZOOM_KEY') {
            const zoomStep = 0.1;
            const currentZoom = panzoom.getScale();
            const panStep = 50 / currentZoom;
            let handled = true;
            
            console.log('Processing key from iframe:', message.key);
            
            switch (message.key) {
                case '+':
                case '=':
                    console.log('Zooming in via message...');
                    panzoom.zoomIn();
                    break;
                case '-':
                    console.log('Zooming out via message...');
                    panzoom.zoomOut();
                    break;
                case 'ArrowUp':
                    console.log('Panning up via message...');
                    panzoom.pan(0, panStep, { relative: true });
                    break;
                case 'ArrowDown':
                    console.log('Panning down via message...');
                    panzoom.pan(0, -panStep, { relative: true });
                    break;
                case 'ArrowLeft':
                    console.log('Panning left via message...');
                    panzoom.pan(panStep, 0, { relative: true });
                    break;
                case 'ArrowRight':
                    console.log('Panning right via message...');
                    panzoom.pan(-panStep, 0, { relative: true });
                    break;
                default:
                    handled = false;
            }
            if (handled) {
                // Optionally blur the active element to prevent further input
                if (document.activeElement) document.activeElement.blur();
            }
        }
    });

    console.log('✅ Initialization complete');
}); 