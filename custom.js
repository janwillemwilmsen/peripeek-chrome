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
        { url: 'https://example.com', x: 0, y: 0 },
        { url: 'https://en.wikipedia.org/wiki/Main_Page', x: 1000, y: 0 },
        { url: 'https://snelste.nl', x: 0, y: 800 },
        { url: 'https://programmablebrowser.com', x: 1000, y: 800 },
        { url: 'https://www.energiedirect.nl', x: 2000, y: 0 },
        { url: 'https://essent.nl', x: 3000, y: 0 }
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
            iframe.setAttribute('credentialless', '');
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

    // Mouse Wheel: Zoom the canvas (towards the cursor)
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
        const newZoom = state.zoom * (1 + direction * zoomIntensity);

        // Clamp the zoom level to avoid zooming too far in or out
        state.zoom = Math.max(0.1, Math.min(10, newZoom));
        
        // Calculate the new pan position to keep the pointed-at location stationary
        state.pan.x = mouseX - pointX * state.zoom;
        state.pan.y = mouseY - pointY * state.zoom;

        applyTransform();
    });



    // --- INITIALIZATION ---
    console.log('🎯 Starting initialization...');
    createIframes();
    applyTransform();
    console.log('✅ Initialization complete');
}); 