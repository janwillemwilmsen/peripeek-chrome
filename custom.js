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
    const createIframes = () => {
        console.log('🌐 Creating iframes for sites:', sites);
        
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
            loadingDiv.textContent = 'Loading...';
            container.appendChild(loadingDiv);

            // Create iframe
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
            dragHandle.style.justifyContent = 'center';
            dragHandle.style.fontSize = '10px';
            dragHandle.style.color = 'rgba(0,0,0,0.6)';
            dragHandle.style.userSelect = 'none';
            dragHandle.style.zIndex = '1001';
            dragHandle.textContent = '⋮⋮ Drag to move ⋮⋮';
            dragHandle.className = 'drag-handle';

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
                    dragState = null;
                    
                    dragHandle.style.cursor = 'grab';
                    container.style.zIndex = '1000';
                    container.style.opacity = '1';
                    iframe.style.pointerEvents = 'auto';
                    
                    console.log(`Finished dragging iframe ${index}`);
                }
                
                if (resizeState && isResizing) {
                    isResizing = false;
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

    // --- INITIALIZATION ---
    console.log('🎯 Starting initialization...');
    createIframes();
    
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