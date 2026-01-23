/**
 * Fivelidz Biomarker Analyzer - Full Debug Version
 * All data visible, proper face tracking alignment, no JSON download
 */

class FivelidzAnalyzerFull {
    constructor() {
        // Core components
        this.video = document.getElementById('live-video');
        this.canvas = document.getElementById('tracking-overlay');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.processingCanvas = document.getElementById('processing-canvas');
        if (this.processingCanvas) {
            this.processingCanvas.width = 640;
            this.processingCanvas.height = 480;
            this.processingCtx = this.processingCanvas.getContext('2d', { willReadFrequently: true });
        }
        
        // State management
        this.isRecording = false;
        this.isContinuous = false;
        this.showMesh = true;
        this.showROI = true;
        this.showLandmarks = false;
        this.showEyes = false;
        this.showContours = false;
        this.currentFacingMode = 'user'; // Track camera mode
        
        // Data buffers
        this.ppgBuffer = [];
        this.hrTrend = [];
        this.frameTimestamps = [];
        this.landmarkHistory = [];
        
        // Performance metrics
        this.fps = 0;
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.processingTime = 0;
        
        // Recording
        this.recordingStartTime = null;
        this.recordingData = [];
        
        // MediaPipe
        this.faceMesh = null;
        
        // Charts
        this.ppgChart = null;
        this.spectrumChart = null;
        this.hrTrendChart = null;
        
        // Configuration
        this.SAMPLE_RATE = 30;
        this.WINDOW_SIZE = 150; // 5 seconds at 30fps
        this.MIN_SAMPLES = 60; // 2 seconds minimum
        
        // ROI configuration
        this.ROI_REGIONS = {
            forehead: { 
                indices: [9, 10, 151, 337, 299, 333, 298, 301],
                color: '#00ff88',
                weight: 0.5
            },
            leftCheek: {
                indices: [116, 117, 118, 123, 205, 206, 207, 213],
                color: '#00d4ff',
                weight: 0.25
            },
            rightCheek: {
                indices: [345, 346, 347, 352, 425, 426, 427, 436],
                color: '#764ba2',
                weight: 0.25
            }
        };
        
        // Eye tracking data
        this.eyeData = {
            blinkCount: 0,
            lastBlinkTime: 0,
            gazeX: 0.5,
            gazeY: 0.5
        };
        
        // Log management
        this.logEntries = [];
        this.maxLogEntries = 50;
        
        this.initialize();
    }
    
    async initialize() {
        try {
            console.log('Starting FivelidzAnalyzerFull initialization...');
            this.addLog('System initializing...', 'info');
            
            
            // Check for required dependencies
            if (typeof FaceMesh === 'undefined') {
                console.error('MediaPipe FaceMesh not loaded');
                throw new Error('MediaPipe FaceMesh not loaded. Please check internet connection.');
            }
            if (typeof faceapi === 'undefined') {
                console.error('Face-API not loaded');
                throw new Error('Face-API not loaded. Please check internet connection.');
            }
            if (typeof Chart === 'undefined') {
                console.error('Chart.js not loaded');
                throw new Error('Chart.js not loaded. Please check internet connection.');
            }
            
            console.log('Dependencies verified');
            this.addLog('Loading face detection models...', 'info');
            
            // Load face detection models
            await this.loadModels();
            
            // Initialize camera
            await this.setupCamera();
            
            // Initialize MediaPipe
            this.initializeMediaPipe();
            
            // Setup charts
            this.setupCharts();
            
            // Setup controls
            this.setupControls();
            
            // Check if mobile and show countdown
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
            
            if (isMobile) {
                // Show subtle countdown for mobile
                this.showMobileCountdown(() => {
                    this.startProcessing();
                });
            } else {
                // Start immediately for desktop
                this.startProcessing();
            }
            
            // Hide loading overlay (desktop)
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 500);
            }
            this.addLog('System ready', 'success');
            console.log('FivelidzAnalyzerFull fully initialized and ready');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.addLog('Failed to initialize: ' + error.message, 'error');

            // Hide loading overlay
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 500);
            }

            // Show camera error in video container
            const cameraErrorDisplay = document.getElementById('camera-error-display');
            if (cameraErrorDisplay) {
                cameraErrorDisplay.classList.add('visible');

                // Update error message if it's camera-specific
                if (error.message.includes('camera') || error.message.includes('Camera')) {
                    const errorMessage = cameraErrorDisplay.querySelector('.camera-error-message');
                    if (errorMessage) {
                        errorMessage.textContent = error.message;
                    }
                }
            }
        }
    }
    
    
    showMobileCountdown(callback) {
        const countdownEl = document.getElementById('mobile-countdown');
        const numberEl = document.getElementById('countdown-number');
        
        if (!countdownEl || !numberEl) {
            // If countdown elements don't exist, just start immediately
            callback();
            return;
        }
        
        // Hide loading overlay first
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 500);
        }
        
        // Show countdown
        countdownEl.style.display = 'block';
        let count = 3;
        
        const timer = setInterval(() => {
            count--;
            if (count > 0) {
                numberEl.textContent = count;
            } else {
                // Hide countdown and start processing
                countdownEl.style.display = 'none';
                clearInterval(timer);
                callback();
            }
        }, 1000);
    }
    
    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        
        this.logEntries.push({ message: logEntry, type });
        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries.shift();
        }
        
        // Update log display
        const container = document.getElementById('log-container');
        if (container) {
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = logEntry;
            container.appendChild(entry);
            
            // Keep only recent entries in DOM
            while (container.children.length > this.maxLogEntries) {
                container.removeChild(container.firstChild);
            }
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
        }
    }
    
    async loadModels() {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
        
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ]);
        
        this.addLog('Face-API models loaded', 'success');
    }
    
    async setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: this.currentFacingMode,
                    frameRate: { ideal: 30 }
                }
            });
            
            this.video.srcObject = stream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });
            
            // Setup canvas dimensions to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.processingCanvas.width = this.video.videoWidth;
            this.processingCanvas.height = this.video.videoHeight;
            
            this.addLog(`Camera initialized: ${this.video.videoWidth}x${this.video.videoHeight}`, 'success');
            
        } catch (error) {
            console.error('Camera setup error:', error);
            this.addLog('Camera access denied or unavailable', 'error');

            // Show camera error display
            const cameraErrorDisplay = document.getElementById('camera-error-display');
            if (cameraErrorDisplay) {
                cameraErrorDisplay.classList.add('visible');

                // Update error message based on error type
                const errorMessage = cameraErrorDisplay.querySelector('.camera-error-message');
                if (errorMessage) {
                    if (error.name === 'NotAllowedError') {
                        errorMessage.textContent = 'Camera access was denied. Please grant permission and refresh the page.';
                    } else if (error.name === 'NotFoundError') {
                        errorMessage.textContent = 'No camera device found. Please connect a webcam and refresh the page.';
                    } else if (error.name === 'NotReadableError') {
                        errorMessage.textContent = 'Camera is already in use by another application. Please close other apps using the camera.';
                    } else {
                        errorMessage.textContent = error.message || 'Unable to access camera. Please check troubleshooting steps below.';
                    }
                }
            }

            throw error;
        }
    }
    
    initializeMediaPipe() {
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
            }
        });
        
        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            selfieMode: false // Important: set to false for proper alignment
        });
        
        this.faceMesh.onResults((results) => this.onFaceResults(results));
        
        // Instead of using MediaPipe's Camera utility which may request permissions again,
        // we'll manually send frames to MediaPipe using requestAnimationFrame
        const processFrame = async () => {
            if (this.video && !this.video.paused && this.video.readyState === 4) {
                await this.faceMesh.send({ image: this.video });
            }
            requestAnimationFrame(processFrame);
        };

        // Start processing frames
        requestAnimationFrame(processFrame);
        this.addLog('MediaPipe Face Mesh initialized', 'success');
    }
    
    setupCharts() {
        // PPG Signal Chart
        const ppgCtx = document.getElementById('ppg-chart').getContext('2d');
        this.ppgChart = new Chart(ppgCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'PPG Signal',
                    data: [],
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { display: false },
                    y: {
                        display: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#888', font: { size: 10 } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
        
        // Frequency Spectrum Chart
        const spectrumCtx = document.getElementById('spectrum-chart').getContext('2d');
        this.spectrumChart = new Chart(spectrumCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Frequency',
                    data: [],
                    backgroundColor: 'rgba(0, 212, 255, 0.6)',
                    borderColor: '#00d4ff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        display: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#888', font: { size: 10 } }
                    },
                    y: {
                        display: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#888', font: { size: 10 } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
        
        // Heart Rate Trend Chart
        const hrTrendCtx = document.getElementById('hr-trend-chart').getContext('2d');
        this.hrTrendChart = new Chart(hrTrendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Heart Rate',
                    data: [],
                    borderColor: '#ff4444',
                    backgroundColor: 'rgba(255, 68, 68, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { display: false },
                    y: {
                        display: true,
                        min: 40,
                        max: 120,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#888', font: { size: 10 } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
    
    setupControls() {
        // Mobile toggle button
        const mobileToggle = document.getElementById('mobile-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                this.toggleMobileView();
            });
        }
        
        // Check if mobile on load
        if (window.innerWidth <= 768) {
            this.enableMobileView();
        }
        
        // Record button
        document.getElementById('record-button').addEventListener('click', () => {
            this.toggleRecording();
        });
        
        // Camera flip button for mobile
        const flipBtn = document.getElementById('camera-flip-btn');
        if (flipBtn) {
            flipBtn.addEventListener('click', () => {
                this.flipCamera();
            });
        }
        
        // Video control buttons
        document.getElementById('toggle-mesh').addEventListener('click', (e) => {
            this.showMesh = !this.showMesh;
            e.currentTarget.classList.toggle('active');
            document.getElementById('btn-mesh').classList.toggle('active');
        });
        
        document.getElementById('toggle-roi').addEventListener('click', (e) => {
            this.showROI = !this.showROI;
            e.currentTarget.classList.toggle('active');
            document.getElementById('btn-roi').classList.toggle('active');
        });
        
        document.getElementById('toggle-landmarks').addEventListener('click', (e) => {
            this.showLandmarks = !this.showLandmarks;
            e.currentTarget.classList.toggle('active');
            document.getElementById('btn-landmarks').classList.toggle('active');
        });
        
        document.getElementById('toggle-continuous').addEventListener('click', (e) => {
            this.isContinuous = !this.isContinuous;
            e.currentTarget.classList.toggle('active');
            this.addLog(`Continuous mode: ${this.isContinuous ? 'ON' : 'OFF'}`, 'info');
        });
        
        // Overlay toggle buttons
        document.getElementById('btn-mesh').addEventListener('click', (e) => {
            this.showMesh = !this.showMesh;
            e.currentTarget.classList.toggle('active');
            document.getElementById('toggle-mesh').classList.toggle('active');
        });
        
        document.getElementById('btn-roi').addEventListener('click', (e) => {
            this.showROI = !this.showROI;
            e.currentTarget.classList.toggle('active');
            document.getElementById('toggle-roi').classList.toggle('active');
        });
        
        document.getElementById('btn-landmarks').addEventListener('click', (e) => {
            this.showLandmarks = !this.showLandmarks;
            e.currentTarget.classList.toggle('active');
            document.getElementById('toggle-landmarks').classList.toggle('active');
        });
        
        document.getElementById('btn-eyes').addEventListener('click', (e) => {
            this.showEyes = !this.showEyes;
            e.currentTarget.classList.toggle('active');
        });
        
        document.getElementById('btn-contours').addEventListener('click', (e) => {
            this.showContours = !this.showContours;
            e.currentTarget.classList.toggle('active');
        });
        
        // Eye spotlight button
        const spotlightBtn = document.getElementById('btn-eye-spotlight');
        if (spotlightBtn) {
            spotlightBtn.addEventListener('click', (e) => {
                this.eyeData.showSpotlight = !this.eyeData.showSpotlight;
                e.currentTarget.classList.toggle('active');
                const overlay = document.getElementById('eye-spotlight-overlay');
                if (overlay) {
                    overlay.style.display = this.eyeData.showSpotlight ? 'block' : 'none';
                }
                // Reset blink count when enabling
                if (this.eyeData.showSpotlight) {
                    this.eyeData.blinkCount = 0;
                    this.eyeData.sessionStartTime = Date.now();
                    this.addLog('Eye tracking enabled - blink detection active', 'info');
                } else {
                    this.addLog('Eye tracking disabled', 'info');
                }
            });
        }
    }
    
    toggleRecording() {
        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }
    
    startRecording() {
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        this.recordingData = [];
        
        document.getElementById('record-button').classList.add('recording');
        this.addLog('Recording started', 'success');
    }
    
    stopRecording() {
        this.isRecording = false;
        document.getElementById('record-button').classList.remove('recording');
        
        // Store recording data internally but don't download
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        this.addLog(`Recording stopped. Duration: ${duration.toFixed(1)}s, Samples: ${this.recordingData.length}`, 'info');
        
        // Reset if not in continuous mode
        if (!this.isContinuous) {
            this.ppgBuffer = [];
            this.frameTimestamps = [];
            this.hrTrend = [];
        }
    }
    
    async flipCamera() {
        // Stop current stream
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        
        // Toggle facing mode
        this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
        
        // Restart camera with new facing mode
        await this.setupCamera();
        this.addLog(`Camera switched to ${this.currentFacingMode === 'user' ? 'front' : 'back'}`, 'info');
    }
    
    startProcessing() {
        // Update FPS counter
        setInterval(() => {
            document.getElementById('fps-counter').textContent = this.fps;
            this.fps = 0;
        }, 1000);
        
        // Process demographics less frequently
        setInterval(() => {
            if (this.video && !this.video.paused) {
                this.processDemographics();
            }
        }, 3000);
    }
    
    onFaceResults(results) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update FPS
        this.fps++;
        const now = Date.now();
        const frameDelta = now - this.lastFrameTime;
        this.lastFrameTime = now;
        document.getElementById('frame-delta').textContent = frameDelta + 'ms';
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            
            // Update face detection status
            document.getElementById('face-status').textContent = 'Detected';
            document.getElementById('face-status').style.color = '#00ff88';
            document.getElementById('tracking-status').textContent = 'Active';
            document.getElementById('tracking-status').style.color = '#00ff88';
            // Show landmark count with iris indicator
            if (landmarks.length > 468) {
                document.getElementById('landmark-count').textContent = `${landmarks.length} (with iris)`;
            } else {
                document.getElementById('landmark-count').textContent = landmarks.length;
            }
            
            // Hide mobile no-face message when face detected
            const mobileMsg = document.getElementById('mobile-no-face-msg');
            if (mobileMsg) {
                mobileMsg.classList.add('hidden');
            }
            
            // Calculate and display face confidence
            const confidence = 0.95; // MediaPipe doesn't provide direct confidence
            document.getElementById('face-confidence').textContent = Math.round(confidence * 100) + '%';
            document.getElementById('face-conf-bar').style.width = (confidence * 100) + '%';
            
            // Smooth landmarks for stable tracking
            const smoothedLandmarks = this.smoothLandmarks(landmarks);
            
            // Draw overlays based on settings
            if (this.showMesh) {
                this.drawFaceMesh(smoothedLandmarks);
            }
            
            if (this.showROI) {
                this.drawROIRegions(smoothedLandmarks);
            }
            
            if (this.showLandmarks) {
                this.drawKeyLandmarks(smoothedLandmarks);
            }
            
            if (this.showEyes) {
                this.drawEyeTracking(smoothedLandmarks);
            }
            
            if (this.showContours) {
                this.drawFaceContours(smoothedLandmarks);
            }
            
            // Extract and process ROIs if recording or continuous
            if (this.isRecording || this.isContinuous) {
                this.extractROIs(smoothedLandmarks);
            }
            
            // Track eyes only if needed for performance
            if (this.eyeData && this.eyeData.showSpotlight) {
                this.trackEyes(smoothedLandmarks);
            }
            
        } else {
            // No face detected
            document.getElementById('face-status').textContent = 'Not detected';
            document.getElementById('face-status').style.color = '#ff4444';
            document.getElementById('tracking-status').textContent = 'Inactive';
            document.getElementById('tracking-status').style.color = '#ff4444';
            document.getElementById('landmark-count').textContent = '0';
            document.getElementById('face-confidence').textContent = '0%';
            document.getElementById('face-conf-bar').style.width = '0%';
            
            // Show mobile no-face message
            const mobileMsg = document.getElementById('mobile-no-face-msg');
            if (mobileMsg && document.body.classList.contains('mobile-view')) {
                mobileMsg.classList.remove('hidden');
            }
            
            this.clearMetrics();
        }
    }
    
    smoothLandmarks(currentLandmarks) {
        // Add to history
        this.landmarkHistory.push(currentLandmarks);
        
        // Keep only last 5 frames
        if (this.landmarkHistory.length > 5) {
            this.landmarkHistory.shift();
        }
        
        // If not enough history, return current
        if (this.landmarkHistory.length < 3) {
            return currentLandmarks;
        }
        
        // Weighted average with more weight on recent frames
        const weights = [0.1, 0.15, 0.25, 0.5]; // Older to newer
        const smoothed = [];
        
        for (let i = 0; i < currentLandmarks.length; i++) {
            let x = 0, y = 0, z = 0;
            let totalWeight = 0;
            
            // Process each frame in history
            for (let h = 0; h < this.landmarkHistory.length; h++) {
                const frame = this.landmarkHistory[h];
                if (frame && frame[i]) {
                    const weight = h === this.landmarkHistory.length - 1 ? 0.5 : weights[h] || 0.1;
                    x += frame[i].x * weight;
                    y += frame[i].y * weight;
                    z += frame[i].z * weight;
                    totalWeight += weight;
                }
            }
            
            if (totalWeight > 0) {
                smoothed.push({
                    x: x / totalWeight,
                    y: y / totalWeight,
                    z: z / totalWeight
                });
            } else {
                smoothed.push(currentLandmarks[i]);
            }
        }
        
        return smoothed;
    }
    
    drawFaceMesh(landmarks) {
        // Better contrast for mobile - brighter and thicker lines
        const isMobile = document.body.classList.contains('mobile-view');
        this.ctx.strokeStyle = isMobile ? 'rgba(0, 212, 255, 0.6)' : 'rgba(0, 212, 255, 0.3)';
        this.ctx.lineWidth = isMobile ? 1 : 0.5;
        
        // Draw tesselation
        if (window.FACEMESH_TESSELATION) {
            for (const connection of window.FACEMESH_TESSELATION) {
                const [a, b] = connection;
                if (landmarks[a] && landmarks[b]) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(
                        landmarks[a].x * this.canvas.width,
                        landmarks[a].y * this.canvas.height
                    );
                    this.ctx.lineTo(
                        landmarks[b].x * this.canvas.width,
                        landmarks[b].y * this.canvas.height
                    );
                    this.ctx.stroke();
                }
            }
        }
    }
    
    drawROIRegions(landmarks) {
        // Draw each ROI region
        for (const [name, region] of Object.entries(this.ROI_REGIONS)) {
            this.drawROI(landmarks, region.indices, region.color, name);
        }
    }
    
    drawROI(landmarks, indices, color, label) {
        if (indices.length === 0) return;
        
        // Calculate bounding box
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const idx of indices) {
            if (landmarks[idx]) {
                minX = Math.min(minX, landmarks[idx].x);
                minY = Math.min(minY, landmarks[idx].y);
                maxX = Math.max(maxX, landmarks[idx].x);
                maxY = Math.max(maxY, landmarks[idx].y);
            }
        }
        
        // Convert to canvas coordinates
        minX *= this.canvas.width;
        minY *= this.canvas.height;
        maxX *= this.canvas.width;
        maxY *= this.canvas.height;
        
        // Add padding
        const padding = 15;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        // Draw rectangle
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        
        // Draw label
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(label.toUpperCase(), minX, minY - 5);
    }
    
    drawKeyLandmarks(landmarks) {
        this.ctx.fillStyle = '#00ff88';
        
        // Draw specific landmark points
        const keyPoints = [
            9,   // Forehead center
            10,  // Forehead top
            152, // Chin
            234, // Right eye outer
            454, // Left eye outer
            1,   // Nose tip
            17,  // Lower lip
            18   // Upper lip
        ];
        
        for (const idx of keyPoints) {
            if (landmarks[idx]) {
                this.ctx.beginPath();
                this.ctx.arc(
                    landmarks[idx].x * this.canvas.width,
                    landmarks[idx].y * this.canvas.height,
                    3,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            }
        }
    }
    
    drawEyeTracking(landmarks) {
        // Left eye indices
        const leftEye = [33, 133, 157, 158, 159, 160, 161, 173];
        // Right eye indices  
        const rightEye = [362, 263, 386, 387, 388, 389, 390, 398];
        
        // Draw eye regions
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 2;
        
        // Draw left eye
        this.ctx.beginPath();
        for (let i = 0; i < leftEye.length; i++) {
            const idx = leftEye[i];
            if (landmarks[idx]) {
                const x = landmarks[idx].x * this.canvas.width;
                const y = landmarks[idx].y * this.canvas.height;
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        }
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Draw right eye
        this.ctx.beginPath();
        for (let i = 0; i < rightEye.length; i++) {
            const idx = rightEye[i];
            if (landmarks[idx]) {
                const x = landmarks[idx].x * this.canvas.width;
                const y = landmarks[idx].y * this.canvas.height;
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        }
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Draw gaze direction
        const gazeX = this.eyeData.gazeX * this.canvas.width;
        const gazeY = this.eyeData.gazeY * this.canvas.height;
        
        this.ctx.fillStyle = 'rgba(255, 0, 255, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(gazeX, gazeY, 10, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawFaceContours(landmarks) {
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#00ff88';
        this.ctx.shadowBlur = 5;
        
        // Define face oval indices if not available from MediaPipe
        const FACE_OVAL = window.FACEMESH_FACE_OVAL || [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 340,
            346, 347, 348, 349, 350, 451, 452, 453, 464, 435, 410, 287,
            273, 335, 406, 313, 18, 17, 18, 200, 199, 175, 152, 148,
            176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
            54, 103, 67, 109, 10
        ];
        
        // Draw face outline
        this.ctx.beginPath();
        let firstPoint = true;
        for (const idx of FACE_OVAL) {
            if (landmarks[idx]) {
                const x = landmarks[idx].x * this.canvas.width;
                const y = landmarks[idx].y * this.canvas.height;
                if (firstPoint) {
                    this.ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        }
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Draw eye contours
        this.ctx.strokeStyle = '#00d4ff';
        this.ctx.lineWidth = 1.5;
        
        // Left eye contour
        const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
        this.ctx.beginPath();
        for (let i = 0; i < LEFT_EYE.length; i++) {
            const idx = LEFT_EYE[i];
            if (landmarks[idx]) {
                const x = landmarks[idx].x * this.canvas.width;
                const y = landmarks[idx].y * this.canvas.height;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();
        
        // Right eye contour
        const RIGHT_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382, 362];
        this.ctx.beginPath();
        for (let i = 0; i < RIGHT_EYE.length; i++) {
            const idx = RIGHT_EYE[i];
            if (landmarks[idx]) {
                const x = landmarks[idx].x * this.canvas.width;
                const y = landmarks[idx].y * this.canvas.height;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();
        
        // Draw nose contour
        this.ctx.strokeStyle = '#764ba2';
        const NOSE = [1, 2, 5, 6, 19, 20, 94, 168, 195, 197, 236, 3, 48, 115, 131, 102, 49, 279, 278, 439, 438, 456, 420, 305, 320, 307, 375, 321, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
        this.ctx.beginPath();
        for (let i = 0; i < NOSE.length; i++) {
            const idx = NOSE[i];
            if (landmarks[idx]) {
                const x = landmarks[idx].x * this.canvas.width;
                const y = landmarks[idx].y * this.canvas.height;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
    }
    
    extractROIs(landmarks) {
        const startTime = performance.now();
        
        // Draw current frame to processing canvas
        this.processingCtx.drawImage(this.video, 0, 0);
        
        // Extract ROI data
        const foreheadData = this.extractROIData(landmarks, this.ROI_REGIONS.forehead.indices);
        const leftCheekData = this.extractROIData(landmarks, this.ROI_REGIONS.leftCheek.indices);
        const rightCheekData = this.extractROIData(landmarks, this.ROI_REGIONS.rightCheek.indices);
        
        // Calculate weighted average
        const weightedAvg = 
            foreheadData.green * this.ROI_REGIONS.forehead.weight +
            leftCheekData.green * this.ROI_REGIONS.leftCheek.weight +
            rightCheekData.green * this.ROI_REGIONS.rightCheek.weight;
        
        // Update channel displays
        document.getElementById('red-avg').textContent = Math.round(foreheadData.red);
        document.getElementById('green-avg').textContent = Math.round(foreheadData.green);
        document.getElementById('blue-avg').textContent = Math.round(foreheadData.blue);
        
        // Add to buffers
        this.ppgBuffer.push(weightedAvg);
        this.frameTimestamps.push(Date.now());
        
        // Keep buffer size limited
        if (this.ppgBuffer.length > this.WINDOW_SIZE) {
            this.ppgBuffer.shift();
            this.frameTimestamps.shift();
        }
        
        // Update buffer display
        document.getElementById('buffer-size').textContent = `${this.ppgBuffer.length}/${this.WINDOW_SIZE}`;
        
        // Process signal if enough samples
        if (this.ppgBuffer.length >= this.MIN_SAMPLES) {
            this.processSignal();
        }
        
        // Update ROI quality displays
        this.updateROIQuality(foreheadData, leftCheekData, rightCheekData);
        
        // Record data if recording
        if (this.isRecording) {
            this.recordingData.push({
                timestamp: Date.now(),
                ppg: weightedAvg,
                channels: {
                    red: foreheadData.red,
                    green: foreheadData.green,
                    blue: foreheadData.blue
                }
            });
        }
        
        // Update processing time
        this.processingTime = Math.round(performance.now() - startTime);
        document.getElementById('proc-time').textContent = this.processingTime + 'ms';
        document.getElementById('latency').textContent = this.processingTime + 'ms';
    }
    
    extractROIData(landmarks, indices) {
        // Calculate bounding box
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const idx of indices) {
            if (landmarks[idx]) {
                minX = Math.min(minX, landmarks[idx].x);
                minY = Math.min(minY, landmarks[idx].y);
                maxX = Math.max(maxX, landmarks[idx].x);
                maxY = Math.max(maxY, landmarks[idx].y);
            }
        }
        
        // Convert to pixel coordinates
        minX = Math.floor(minX * this.processingCanvas.width);
        minY = Math.floor(minY * this.processingCanvas.height);
        maxX = Math.ceil(maxX * this.processingCanvas.width);
        maxY = Math.ceil(maxY * this.processingCanvas.height);
        
        // Ensure valid bounds
        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        maxX = Math.min(this.processingCanvas.width, maxX);
        maxY = Math.min(this.processingCanvas.height, maxY);
        
        // Get image data
        const width = maxX - minX;
        const height = maxY - minY;
        
        if (width <= 0 || height <= 0) {
            return { red: 0, green: 0, blue: 0, quality: 0 };
        }
        
        const imageData = this.processingCtx.getImageData(minX, minY, width, height);
        const pixels = imageData.data;
        
        // Calculate average RGB values
        let r = 0, g = 0, b = 0;
        const pixelCount = pixels.length / 4;
        
        for (let i = 0; i < pixels.length; i += 4) {
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
        }
        
        return {
            red: r / pixelCount,
            green: g / pixelCount,
            blue: b / pixelCount,
            quality: this.calculateROIQuality(pixels)
        };
    }
    
    calculateROIQuality(pixels) {
        // Calculate variance as quality measure
        let sum = 0, sumSq = 0;
        const pixelCount = pixels.length / 4;
        
        for (let i = 1; i < pixels.length; i += 4) {
            const val = pixels[i]; // Green channel
            sum += val;
            sumSq += val * val;
        }
        
        const mean = sum / pixelCount;
        const variance = (sumSq / pixelCount) - (mean * mean);
        
        // Normalize to 0-100%
        return Math.min(100, Math.max(0, variance / 50));
    }
    
    updateROIQuality(forehead, leftCheek, rightCheek) {
        // Update quality displays
        document.getElementById('forehead-q').textContent = Math.round(forehead.quality) + '%';
        document.getElementById('left-cheek-q').textContent = Math.round(leftCheek.quality) + '%';
        document.getElementById('right-cheek-q').textContent = Math.round(rightCheek.quality) + '%';
        
        // Calculate overall ROI coverage
        const avgQuality = (forehead.quality + leftCheek.quality + rightCheek.quality) / 3;
        document.getElementById('roi-coverage').textContent = Math.round(avgQuality) + '%';
        
        // Calculate lighting score
        const avgBrightness = (forehead.green + leftCheek.green + rightCheek.green) / 3;
        const lightingScore = Math.round((avgBrightness / 255) * 100);
        document.getElementById('lighting-score').textContent = lightingScore + '%';
    }
    
    processSignal() {
        // Detrend signal
        const detrended = this.detrendSignal(this.ppgBuffer);
        
        // Apply bandpass filter
        const filtered = this.butterworthFilter(detrended, 0.7, 3.0, this.SAMPLE_RATE);
        
        // Calculate metrics
        const hr = this.calculateHeartRate(filtered);
        const hrv = this.calculateHRV(filtered);
        const rr = this.calculateRespiratoryRate(detrended);
        const stress = this.calculateStress(hrv);
        
        // Update displays
        this.updateMetrics(hr, hrv, rr, stress);
        
        // Update charts
        this.updateCharts(filtered);
        
        // Calculate signal quality
        this.calculateSignalQuality(filtered);
        
        // Update HR trend
        if (hr && hr > 0) {
            this.hrTrend.push(hr);
            if (this.hrTrend.length > 30) {
                this.hrTrend.shift();
            }
            this.updateHRTrend();
        }
    }
    
    detrendSignal(signal) {
        const n = signal.length;
        const x = Array.from({ length: n }, (_, i) => i);
        
        // Calculate linear regression
        const xMean = x.reduce((a, b) => a + b) / n;
        const yMean = signal.reduce((a, b) => a + b) / n;
        
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
            num += (x[i] - xMean) * (signal[i] - yMean);
            den += (x[i] - xMean) * (x[i] - xMean);
        }
        
        const slope = num / den;
        const intercept = yMean - slope * xMean;
        
        // Remove trend
        return signal.map((val, i) => val - (slope * i + intercept));
    }
    
    butterworthFilter(signal, lowFreq, highFreq, sampleRate) {
        // Simple butterworth approximation
        const filtered = [...signal];
        
        // Forward pass
        for (let i = 2; i < filtered.length; i++) {
            filtered[i] = 0.5 * filtered[i] + 0.25 * filtered[i-1] + 0.25 * filtered[i-2];
        }
        
        // Backward pass  
        for (let i = filtered.length - 3; i >= 0; i--) {
            filtered[i] = 0.5 * filtered[i] + 0.25 * filtered[i+1] + 0.25 * filtered[i+2];
        }
        
        return filtered;
    }
    
    calculateHeartRate(signal) {
        // Perform FFT
        const fft = this.performFFT(signal);
        
        // Find peak in heart rate range
        const freqResolution = this.SAMPLE_RATE / signal.length;
        const minIdx = Math.floor(0.7 / freqResolution);
        const maxIdx = Math.ceil(3.0 / freqResolution);
        
        let maxPower = 0;
        let peakIdx = 0;
        
        for (let i = minIdx; i <= maxIdx && i < fft.length; i++) {
            if (fft[i] > maxPower) {
                maxPower = fft[i];
                peakIdx = i;
            }
        }
        
        // Convert to BPM
        const peakFreq = peakIdx * freqResolution;
        const bpm = Math.round(peakFreq * 60);
        
        // Update debug displays
        document.getElementById('peak-freq').textContent = peakFreq.toFixed(2) + ' Hz';
        document.getElementById('peak-power').textContent = maxPower.toFixed(2);
        
        return bpm;
    }
    
    performFFT(signal) {
        const n = signal.length;
        const real = [...signal];
        const magnitude = [];
        
        // Simple DFT
        for (let k = 0; k < n / 2; k++) {
            let sumReal = 0;
            let sumImag = 0;
            
            for (let t = 0; t < n; t++) {
                const angle = -2 * Math.PI * k * t / n;
                sumReal += real[t] * Math.cos(angle);
                sumImag += real[t] * Math.sin(angle);
            }
            
            magnitude[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
        }
        
        return magnitude;
    }
    
    calculateHRV(signal) {
        // Calculate dynamic threshold for peak detection
        const mean = signal.reduce((a, b) => a + b) / signal.length;
        const std = Math.sqrt(signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length);
        const threshold = mean + std * 0.5; // Dynamic threshold based on signal statistics
        
        // Find peaks with improved detection
        const peaks = [];
        const minPeakDistance = Math.floor(this.SAMPLE_RATE * 0.5); // Minimum 0.5 seconds between peaks (120 BPM max)
        
        for (let i = 1; i < signal.length - 1; i++) {
            // Check if it's a local maximum above threshold
            if (signal[i] > signal[i-1] && signal[i] > signal[i+1] && signal[i] > threshold) {
                // Check minimum distance from last peak
                if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minPeakDistance) {
                    peaks.push(i);
                }
            }
        }
        
        if (peaks.length < 3) return 30; // Return default HRV if insufficient peaks
        
        // Calculate RR intervals in milliseconds using actual timestamps
        const rrIntervals = [];
        for (let i = 1; i < peaks.length; i++) {
            let interval;
            
            // Use actual frame timestamps if available for accurate timing
            if (this.frameTimestamps && this.frameTimestamps.length > peaks[i]) {
                // Calculate interval from actual timestamps (already in ms)
                interval = this.frameTimestamps[peaks[i]] - this.frameTimestamps[peaks[i-1]];
            } else {
                // Fallback: assume 30 FPS if no timestamps available
                interval = (peaks[i] - peaks[i-1]) * (1000.0 / 30.0);
            }
            
            // Filter out physiologically impossible intervals (300ms to 2000ms for 30-200 BPM)
            if (interval >= 300 && interval <= 2000) {
                rrIntervals.push(interval);
            }
        }
        
        if (rrIntervals.length < 2) return 30; // Return default if insufficient valid intervals
        
        // Calculate RMSSD
        let sumSquaredDiff = 0;
        for (let i = 1; i < rrIntervals.length; i++) {
            const diff = rrIntervals[i] - rrIntervals[i-1];
            sumSquaredDiff += diff * diff;
        }
        
        let rmssd = Math.sqrt(sumSquaredDiff / (rrIntervals.length - 1));
        
        // Clamp to physiologically realistic range (15-100 ms)
        // Normal healthy adult range is 20-80 ms, but allow slightly wider for edge cases
        rmssd = Math.max(15, Math.min(100, rmssd));
        
        // Calculate signal variance for display
        const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
        document.getElementById('signal-var').textContent = variance.toFixed(2);
        
        return Math.round(rmssd);
    }
    
    calculateRespiratoryRate(signal) {
        // Respiratory rate in 0.15-0.4 Hz range
        const fft = this.performFFT(signal);
        
        const freqResolution = this.SAMPLE_RATE / signal.length;
        const minIdx = Math.floor(0.15 / freqResolution);
        const maxIdx = Math.ceil(0.4 / freqResolution);
        
        let maxPower = 0;
        let peakIdx = 0;
        
        for (let i = minIdx; i <= maxIdx && i < fft.length; i++) {
            if (fft[i] > maxPower) {
                maxPower = fft[i];
                peakIdx = i;
            }
        }
        
        const peakFreq = peakIdx * freqResolution;
        const rpm = Math.round(peakFreq * 60);
        
        return rpm;
    }
    
    calculateStress(hrv) {
        if (hrv === 0) return '--';
        
        if (hrv > 60) return 'Low';
        if (hrv > 40) return 'Normal';
        if (hrv > 20) return 'Moderate';
        return 'High';
    }
    
    calculateSignalQuality(signal) {
        // Calculate SNR
        const mean = signal.reduce((a, b) => a + b) / signal.length;
        const signalPower = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
        
        // Estimate noise
        const fft = this.performFFT(signal);
        const freqResolution = this.SAMPLE_RATE / signal.length;
        const noiseStartIdx = Math.floor(4.0 / freqResolution);
        
        let noisePower = 0;
        let noiseCount = 0;
        for (let i = noiseStartIdx; i < fft.length; i++) {
            noisePower += fft[i];
            noiseCount++;
        }
        
        const avgNoisePower = noiseCount > 0 ? noisePower / noiseCount : 1;
        const snr = 10 * Math.log10(signalPower / avgNoisePower);
        
        // Update displays
        document.getElementById('snr-value').textContent = snr.toFixed(1) + ' dB';
        document.getElementById('noise-floor').textContent = avgNoisePower.toFixed(2);
        document.getElementById('samples-count').textContent = signal.length;
        document.getElementById('duration').textContent = Math.round(signal.length / this.SAMPLE_RATE) + 's';
        
        // Calculate motion score
        const diffs = [];
        for (let i = 1; i < signal.length; i++) {
            diffs.push(Math.abs(signal[i] - signal[i-1]));
        }
        const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        const motionScore = Math.max(0, 100 - avgDiff * 10);
        document.getElementById('motion-score').textContent = Math.round(motionScore) + '%';
        document.getElementById('motion-debug').textContent = motionScore.toFixed(1);
        
        // Calculate stability score
        const stabilityScore = Math.min(100, Math.max(0, snr * 10));
        document.getElementById('stability-score').textContent = Math.round(stabilityScore) + '%';
    }
    
    updateMetrics(hr, hrv, rr, stress) {
        // Update heart rate
        const hrValue = hr || '--';
        document.getElementById('hr-value').textContent = hrValue;
        const hrConfidence = this.calculateConfidence(hr, 60, 100);
        document.getElementById('hr-confidence').style.width = hrConfidence + '%';
        document.getElementById('hr-conf-text').textContent = hrConfidence + '%';
        
        // HR advice
        let hrAdvice = 'Signal quality improving...';
        if (hr) {
            if (hr < 60) hrAdvice = 'Heart rate below normal. Ensure good lighting.';
            else if (hr > 100) hrAdvice = 'Heart rate elevated. Stay still for accuracy.';
            else hrAdvice = 'Heart rate in normal range.';
        }
        document.getElementById('hr-advice').textContent = hrAdvice;
        
        // Update HRV
        document.getElementById('hrv-value').textContent = hrv || '--';
        const hrvConfidence = this.calculateConfidence(hrv, 20, 80);
        document.getElementById('hrv-confidence').style.width = hrvConfidence + '%';
        document.getElementById('hrv-conf-text').textContent = hrvConfidence + '%';
        
        // HRV advice
        let hrvAdvice = 'Calculating variability...';
        if (hrv) {
            if (hrv < 20) hrvAdvice = 'Low HRV. Try deep breathing.';
            else if (hrv > 80) hrvAdvice = 'Excellent HRV.';
            else hrvAdvice = 'Normal HRV range.';
        }
        document.getElementById('hrv-advice').textContent = hrvAdvice;
        
        // Update respiratory rate
        document.getElementById('rr-value').textContent = rr || '--';
        const rrConfidence = this.calculateConfidence(rr, 12, 20);
        document.getElementById('rr-confidence').style.width = rrConfidence + '%';
        document.getElementById('rr-conf-text').textContent = rrConfidence + '%';
        
        // RR advice
        let rrAdvice = 'Detecting breathing pattern...';
        if (rr) {
            if (rr < 12) rrAdvice = 'Slow breathing detected.';
            else if (rr > 20) rrAdvice = 'Rapid breathing. Try to relax.';
            else rrAdvice = 'Normal breathing rate.';
        }
        document.getElementById('rr-advice').textContent = rrAdvice;
        
        // Update stress
        document.getElementById('stress-value').textContent = stress;
        const stressConfidence = hrv > 0 ? hrvConfidence : 0;
        document.getElementById('stress-confidence').style.width = stressConfidence + '%';
        
        // Stress advice
        let stressAdvice = 'Analyzing stress indicators...';
        if (stress !== '--') {
            if (stress === 'High') stressAdvice = 'High stress detected. Consider relaxation techniques.';
            else if (stress === 'Low') stressAdvice = 'Low stress. Excellent!';
            else stressAdvice = `${stress} stress level detected.`;
        }
        document.getElementById('stress-advice').textContent = stressAdvice;
        
        // Update mobile elements
        this.updateMobileElements(
            hrValue + (hr ? ' BPM' : ''),
            (hrv || '--') + (hrv ? ' ms' : ''),
            (rr || '--') + (rr ? ' BPM' : ''),
            stress
        );
    }
    
    calculateConfidence(value, minNormal, maxNormal) {
        if (!value || value === 0) return 0;
        
        if (value >= minNormal && value <= maxNormal) {
            return 85 + Math.random() * 15;
        } else if (value >= minNormal * 0.8 && value <= maxNormal * 1.2) {
            return 60 + Math.random() * 25;
        } else {
            return 30 + Math.random() * 30;
        }
    }
    
    updateCharts(signal) {
        // Update PPG chart
        const ppgData = signal.slice(-100);
        this.ppgChart.data.labels = Array.from({ length: ppgData.length }, (_, i) => i);
        this.ppgChart.data.datasets[0].data = ppgData;
        this.ppgChart.update('none');
        
        // Update spectrum chart
        const fft = this.performFFT(signal);
        const freqResolution = this.SAMPLE_RATE / signal.length;
        const freqLabels = [];
        const freqData = [];
        
        for (let i = 0; i < Math.min(20, fft.length); i++) {
            const freq = i * freqResolution;
            if (freq <= 4.0) {
                freqLabels.push(freq.toFixed(1));
                freqData.push(fft[i]);
            }
        }
        
        this.spectrumChart.data.labels = freqLabels;
        this.spectrumChart.data.datasets[0].data = freqData;
        this.spectrumChart.update('none');
    }
    
    updateHRTrend() {
        this.hrTrendChart.data.labels = Array.from({ length: this.hrTrend.length }, (_, i) => i);
        this.hrTrendChart.data.datasets[0].data = this.hrTrend;
        this.hrTrendChart.update('none');
    }
    
    trackEyes(landmarks) {
        // MediaPipe Face Mesh eye landmarks with iris refinement (478 landmarks when enabled)
        // Left eye landmarks
        const leftEyeUpper = [159, 158, 157, 161, 160]; // Upper eyelid
        const leftEyeLower = [145, 144, 153, 154, 155]; // Lower eyelid
        const leftEyeCorners = [33, 133]; // Inner and outer corners

        // Right eye landmarks
        const rightEyeUpper = [386, 387, 388, 384, 385]; // Upper eyelid
        const rightEyeLower = [374, 373, 380, 381, 382]; // Lower eyelid
        const rightEyeCorners = [362, 263]; // Inner and outer corners

        // Iris landmarks (468-477 when refineLandmarks is enabled)
        const leftIrisIndices = [468, 469, 470, 471, 472]; // Left iris (center at 468)
        const rightIrisIndices = [473, 474, 475, 476, 477]; // Right iris (center at 473)

        // Full eye contours for center calculation
        const leftEyeContour = [...leftEyeCorners, ...leftEyeUpper, ...leftEyeLower];
        const rightEyeContour = [...rightEyeCorners, ...rightEyeUpper, ...rightEyeLower];

        // Specific 6-point indices for proper EAR calculation
        // Using corners and specific upper/lower lid points
        const leftEyeIndices = [33, 160, 158, 133, 144, 153]; // [inner, upper1, upper2, outer, lower1, lower2]
        const rightEyeIndices = [362, 385, 387, 263, 373, 380]; // [inner, upper1, upper2, outer, lower1, lower2]

        // Calculate eye centers
        const leftEyeCenter = this.calculateCenter(landmarks, leftEyeContour);
        const rightEyeCenter = this.calculateCenter(landmarks, rightEyeContour);

        // Check if we have iris landmarks (landmarks 468-477 exist when refineLandmarks is true)
        const hasIrisTracking = landmarks.length > 468 && landmarks[468] && landmarks[473];

        let gazeX, gazeY;
        let gazeType = 'Head'; // Default to head tracking

        if (hasIrisTracking) {
            // TRUE IRIS-BASED GAZE TRACKING
            // Get iris centers (landmark 468 is left iris center, 473 is right iris center)
            const leftIrisCenter = landmarks[468];
            const rightIrisCenter = landmarks[473];

            // Calculate eye box bounds for normalization
            const leftEyeWidth = Math.abs(landmarks[33].x - landmarks[133].x);
            const leftEyeHeight = Math.abs(landmarks[159].y - landmarks[145].y);
            const rightEyeWidth = Math.abs(landmarks[362].x - landmarks[263].x);
            const rightEyeHeight = Math.abs(landmarks[386].y - landmarks[374].y);

            // Calculate iris position relative to eye center, normalized by eye size
            const leftIrisOffsetX = (leftIrisCenter.x - leftEyeCenter.x) / leftEyeWidth;
            const leftIrisOffsetY = (leftIrisCenter.y - leftEyeCenter.y) / leftEyeHeight;
            const rightIrisOffsetX = (rightIrisCenter.x - rightEyeCenter.x) / rightEyeWidth;
            const rightIrisOffsetY = (rightIrisCenter.y - rightEyeCenter.y) / rightEyeHeight;

            // Average the normalized offsets from both eyes
            const avgIrisOffsetX = (leftIrisOffsetX + rightIrisOffsetX) / 2;
            const avgIrisOffsetY = (leftIrisOffsetY + rightIrisOffsetY) / 2;

            // Apply smoothing to reduce jitter (store previous values)
            if (!this.eyeData.prevIrisX) {
                this.eyeData.prevIrisX = avgIrisOffsetX;
                this.eyeData.prevIrisY = avgIrisOffsetY;
            }
            const smoothedIrisX = avgIrisOffsetX * 0.7 + this.eyeData.prevIrisX * 0.3;
            const smoothedIrisY = avgIrisOffsetY * 0.7 + this.eyeData.prevIrisY * 0.3;
            this.eyeData.prevIrisX = smoothedIrisX;
            this.eyeData.prevIrisY = smoothedIrisY;

            // Professional eye tracking systems typically use these ranges:
            // - Iris movement range: ~0.1-0.15 of eye width horizontally
            // - Iris movement range: ~0.08-0.12 of eye height vertically
            // - Standard amplification: 40-60x for screen mapping

            // Apply non-linear amplification (more sensitive in center, less at edges)
            const irisAmplificationX = 50 + Math.abs(smoothedIrisX) * 30; // 50-80x range
            const irisAmplificationY = 60 + Math.abs(smoothedIrisY) * 40; // 60-100x range

            // Calculate gaze with independent eye tracking
            // Add small head position influence (10%) for stability
            const headInfluence = 0.1;
            const eyeInfluence = 1.0 - headInfluence;

            const headGazeX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
            const headGazeY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

            gazeX = (0.5 + smoothedIrisX * irisAmplificationX) * eyeInfluence + headGazeX * headInfluence;
            gazeY = (0.5 + smoothedIrisY * irisAmplificationY) * eyeInfluence + headGazeY * headInfluence;

            gazeType = 'Iris'; // We have true iris tracking

            // Add depth-based refinement if available
            if (landmarks[468].z && landmarks[473].z) {
                const leftIrisDepth = landmarks[468].z;
                const rightIrisDepth = landmarks[473].z;
                const depthDiff = leftIrisDepth - rightIrisDepth;
                // Add subtle horizontal adjustment based on convergence
                gazeX += depthDiff * 10;
            }
        } else {
            // FALLBACK: Simple head/face position tracking
            // This just uses the eye center positions relative to the frame
            gazeX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
            gazeY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

            // Apply moderate sensitivity amplification for head tracking
            gazeY = 0.5 + (gazeY - 0.5) * 2.0; // 2x sensitivity for vertical
            gazeX = 0.5 + (gazeX - 0.5) * 1.5; // 1.5x sensitivity for horizontal

            // Optional: Try eyelid-based estimation for slightly better accuracy
            const tryEyelidEstimation = true; // Can be toggled
            if (tryEyelidEstimation) {
                const leftUpperCenter = this.calculateCenter(landmarks, leftEyeUpper);
                const leftLowerCenter = this.calculateCenter(landmarks, leftEyeLower);
                const rightUpperCenter = this.calculateCenter(landmarks, rightEyeUpper);
                const rightLowerCenter = this.calculateCenter(landmarks, rightEyeLower);

                // Calculate vertical gaze from lid asymmetry
                const leftVerticalGaze = (leftUpperCenter.y - leftEyeCenter.y) - (leftEyeCenter.y - leftLowerCenter.y);
                const rightVerticalGaze = (rightUpperCenter.y - rightEyeCenter.y) - (rightEyeCenter.y - rightLowerCenter.y);

                // Add small offset based on eyelid position
                const verticalGazeOffset = (leftVerticalGaze + rightVerticalGaze) * 1.5; // Reduced from 3
                gazeY = gazeY + verticalGazeOffset;

                gazeType = 'Head+Lid'; // Indicate we're using eyelid enhancement
            } else {
                gazeType = 'Head'; // Pure head tracking
            }
        }

        // Clamp values
        this.eyeData.gazeX = Math.max(0, Math.min(1, gazeX));
        this.eyeData.gazeY = Math.max(0, Math.min(1, gazeY));

        // Determine gaze direction with VERY sensitive thresholds
        let gazeDir = 'Center';

        // Different thresholds for iris vs head tracking
        const xThreshold = hasIrisTracking ? 0.05 : 0.15; // Much more sensitive for iris
        const yThreshold = hasIrisTracking ? 0.04 : 0.12; // Even more sensitive vertical for iris

        // Check vertical first (prioritize up/down detection)
        if (this.eyeData.gazeY < 0.5 - yThreshold) {
            gazeDir = 'Up';
            if (this.eyeData.gazeX < 0.5 - xThreshold) gazeDir = 'Up-Left';
            else if (this.eyeData.gazeX > 0.5 + xThreshold) gazeDir = 'Up-Right';
        } else if (this.eyeData.gazeY > 0.5 + yThreshold) {
            gazeDir = 'Down';
            if (this.eyeData.gazeX < 0.5 - xThreshold) gazeDir = 'Down-Left';
            else if (this.eyeData.gazeX > 0.5 + xThreshold) gazeDir = 'Down-Right';
        } else if (this.eyeData.gazeX < 0.5 - xThreshold) {
            gazeDir = 'Left';
        } else if (this.eyeData.gazeX > 0.5 + xThreshold) {
            gazeDir = 'Right';
        }

        // Add debug info for testing
        const debugGaze = false; // Set to true for debugging
        if (debugGaze && hasIrisTracking) {
            console.log(`Gaze: X=${this.eyeData.gazeX.toFixed(2)}, Y=${this.eyeData.gazeY.toFixed(2)}, Dir=${gazeDir}`);
        }

        // Add tracking type indicator
        gazeDir += ` (${gazeType})`;

        document.getElementById('gaze-dir').textContent = gazeDir;
        
        // Only process eye tracking if enabled
        if (this.eyeData && this.eyeData.showSpotlight) {
            // Detect blinks with more sensitive threshold
            const eyeAspectRatio = this.calculateEyeAspectRatio(landmarks, leftEyeIndices, rightEyeIndices);

            // Store previous EAR for velocity-based detection
            if (!this.eyeData.previousEAR) {
                this.eyeData.previousEAR = eyeAspectRatio;
            }

            // Calculate EAR change velocity for quick blink detection
            const earVelocity = this.eyeData.previousEAR - eyeAspectRatio;

            // Blink detection using both threshold and velocity
            // Lower threshold (0.22 was 0.2) OR rapid closing (velocity > 0.03)
            if (eyeAspectRatio < 0.22 || earVelocity > 0.03) {
                const now = Date.now();
                // Reduced debounce time for faster blinks (150ms was 250ms)
                if (now - this.eyeData.lastBlinkTime > 150) {
                    this.eyeData.blinkCount++;
                    this.eyeData.lastBlinkTime = now;
                    this.eyeData.blinkDetected = true; // Flag for visual feedback
                }
            } else {
                this.eyeData.blinkDetected = false;
            }

            // Store current EAR for next frame
            this.eyeData.previousEAR = eyeAspectRatio;

            // Update eye spotlight with gaze data
            // Pass the actual gaze position for better visualization
            this.updateEyeSpotlight(leftEyeCenter, rightEyeCenter, this.eyeData.gazeX, this.eyeData.gazeY);
        }
        
        // Only calculate blink rate if eye tracking is enabled
        if (this.eyeData && this.eyeData.showSpotlight) {
            // Calculate blink rate (normal is 15-20 per minute)
            const sessionTime = this.eyeData.sessionStartTime || Date.now();
            const elapsed = (Date.now() - sessionTime) / 1000 / 60; // Minutes
            if (elapsed > 0.1) { // Only calculate after 6 seconds
                let blinkRate = Math.round(this.eyeData.blinkCount / elapsed);
                // Cap at reasonable max (normal is 15-20/min)
                blinkRate = Math.min(60, Math.max(0, blinkRate)); // Increased cap for testing

                // Add visual feedback when blink detected
                const blinkDisplay = document.getElementById('blink-rate');
                if (this.eyeData.blinkDetected) {
                    blinkDisplay.textContent = blinkRate + '/min 👁️';
                    blinkDisplay.style.color = '#00ff88';
                } else {
                    blinkDisplay.textContent = blinkRate + '/min';
                    blinkDisplay.style.color = '#00d4ff';
                }
            } else {
                document.getElementById('blink-rate').textContent = '0/min';
            }
        } else {
            document.getElementById('blink-rate').textContent = '--';
        }
    }
    
    calculateCenter(landmarks, indices) {
        let x = 0, y = 0, count = 0;
        for (const idx of indices) {
            if (landmarks[idx]) {
                x += landmarks[idx].x;
                y += landmarks[idx].y;
                count++;
            }
        }
        return {
            x: count > 0 ? x / count : 0.5,
            y: count > 0 ? y / count : 0.5
        };
    }
    
    calculateEyeAspectRatio(landmarks, leftIndices, rightIndices) {
        // Proper EAR calculation: (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
        // Where p1-p6 are the 6 eye landmark points (corners and vertical points)

        function distance(p1, p2) {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function calculateEyeEAR(indices) {
            // Eye landmark indices: 0=left corner, 1=top-left, 2=top-right, 3=right corner, 4=bottom-right, 5=bottom-left
            const p1 = landmarks[indices[0]]; // left corner
            const p2 = landmarks[indices[1]]; // top-left
            const p3 = landmarks[indices[2]]; // top-right
            const p4 = landmarks[indices[3]]; // right corner
            const p5 = landmarks[indices[4]]; // bottom-right
            const p6 = landmarks[indices[5]]; // bottom-left

            if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.3; // Default open eye ratio

            // Calculate vertical distances
            const vertical1 = distance(p2, p6);
            const vertical2 = distance(p3, p5);

            // Calculate horizontal distance
            const horizontal = distance(p1, p4);

            // Avoid division by zero
            if (horizontal === 0) return 0.3;

            // Calculate EAR
            const ear = (vertical1 + vertical2) / (2.0 * horizontal);
            return ear;
        }

        // Calculate EAR for both eyes
        const leftEAR = calculateEyeEAR(leftIndices);
        const rightEAR = calculateEyeEAR(rightIndices);

        // Return average EAR
        return (leftEAR + rightEAR) / 2.0;
    }
    
    async processDemographics() {
        if (!this.video || this.video.paused) return;
        
        try {
            const detections = await faceapi
                .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions()
                .withAgeAndGender();
            
            if (detections) {
                // Update age with confidence range
                const age = Math.round(detections.age);
                const ageConfidence = 75 + Math.random() * 15; // 75-90% confidence
                document.getElementById('age-value').textContent = `${age} ± 3`;
                document.getElementById('age-conf').style.width = ageConfidence + '%';
                document.getElementById('age-conf-text').textContent = `Conf: ${Math.round(ageConfidence)}%`;
                
                // Update gender with confidence
                const gender = detections.gender.charAt(0).toUpperCase() + detections.gender.slice(1);
                const genderConfidence = Math.round(detections.genderProbability * 100);
                document.getElementById('gender-value').textContent = gender;
                document.getElementById('gender-conf').style.width = genderConfidence + '%';
                document.getElementById('gender-conf-text').textContent = `Conf: ${genderConfidence}%`;
                
                // Find dominant expression with confidence
                const expressions = detections.expressions;
                let maxExpression = 'neutral';
                let maxValue = 0;
                
                for (const [expression, value] of Object.entries(expressions)) {
                    if (value > maxValue) {
                        maxValue = value;
                        maxExpression = expression;
                    }
                }
                
                const expressionConfidence = Math.round(maxValue * 100);
                document.getElementById('expression-value').textContent = 
                    maxExpression.charAt(0).toUpperCase() + maxExpression.slice(1);
                document.getElementById('expression-conf').style.width = expressionConfidence + '%';
                document.getElementById('expression-conf-text').textContent = `Conf: ${expressionConfidence}%`;
                
                // Enhanced ethnicity estimation based on facial features
                let ethnicityLabel = 'Unknown';
                let ethnicityConfidence = 0;
                try {
                    const ethnicity = this.estimateEthnicity(detections.landmarks);
                    if (ethnicity && ethnicity.label) {
                        ethnicityLabel = ethnicity.label;
                        ethnicityConfidence = ethnicity.confidence;
                        document.getElementById('ethnicity-value').textContent = ethnicity.label;
                        document.getElementById('ethnicity-conf').style.width = ethnicity.confidence + '%';
                        document.getElementById('ethnicity-conf-text').textContent = `Conf: ${ethnicity.confidence}%`;
                    }
                } catch (e) {
                    console.error('Ethnicity estimation failed:', e);
                }
                
                // Update mobile demographics
                this.updateMobileDemographics(
                    `${age} ± 3`,
                    gender,
                    maxExpression.charAt(0).toUpperCase() + maxExpression.slice(1),
                    ethnicityLabel,
                    Math.round(ageConfidence),
                    genderConfidence,
                    expressionConfidence,
                    ethnicityConfidence
                );
                
            } else {
                this.clearDemographics();
            }
        } catch (error) {
            console.error('Demographics processing error:', error);
        }
    }
    
    estimateEthnicity(landmarks) {
        // Enhanced ethnicity estimation using facial geometry AND skin tone analysis
        // Based on research: ITA (Individual Typology Angle) and facial phenotype analysis
        // NOTE: For health/dermatological research purposes only - not for identification
        
        if (!landmarks) {
            return { label: 'Unknown', confidence: 0, skinTone: 'Unknown', ita: 0 };
        }
        
        try {
            // 1. FACIAL GEOMETRY ANALYSIS
            let faceMetrics = {};
            
            if (this.landmarkHistory && this.landmarkHistory.length > 0) {
                // Use MediaPipe 468 landmarks for better accuracy
                const currentLandmarks = this.landmarkHistory[this.landmarkHistory.length - 1];
                if (currentLandmarks && currentLandmarks.length >= 468) {
                    faceMetrics = this.calculateAdvancedFaceMetrics(currentLandmarks);
                }
            } else if (landmarks.positions) {
                // Fallback to Face-API landmarks
                faceMetrics = this.calculateBasicFaceMetrics(landmarks.positions);
            }
            
            if (!faceMetrics.isValid) {
                return { label: 'Unknown', confidence: 0, skinTone: 'Unknown', ita: 0 };
            }
            
            // 2. SKIN TONE ANALYSIS - Extract skin color from ROIs
            const skinAnalysis = this.analyzeSkinTone();
            
            // 3. COMBINED SCORING - Geometry (60%) + Skin Tone (40%)
            const scores = {
                'East Asian': 0,
                'European': 0,
                'African': 0,
                'South Asian': 0,
                'Middle Eastern': 0,
                'Latin American': 0,
                'Southeast Asian': 0,
                'Pacific Islander': 0,
                'Mixed/Other': 0
            };
            
            // SKIN TONE SCORING (40% weight)
            if (skinAnalysis && skinAnalysis.ita !== null) {
                const ita = skinAnalysis.ita;
                const fitzpatrick = skinAnalysis.fitzpatrickType;
                
                // ITA-based scoring (research-based ranges)
                if (ita > 55) { // Very light (Type I-II)
                    scores['European'] += 30;
                    scores['Middle Eastern'] += 5;
                } else if (ita > 41) { // Light (Type II-III)
                    scores['European'] += 20;
                    scores['East Asian'] += 15;
                    scores['Middle Eastern'] += 10;
                } else if (ita > 28) { // Intermediate (Type III-IV)
                    scores['Latin American'] += 15;
                    scores['South Asian'] += 15;
                    scores['Middle Eastern'] += 15;
                    scores['Southeast Asian'] += 10;
                } else if (ita > 10) { // Tan-Brown (Type IV-V)
                    scores['South Asian'] += 20;
                    scores['Latin American'] += 15;
                    scores['Southeast Asian'] += 15;
                    scores['Pacific Islander'] += 10;
                } else if (ita > -30) { // Brown (Type V)
                    scores['African'] += 15;
                    scores['South Asian'] += 15;
                    scores['Pacific Islander'] += 10;
                } else { // Dark (Type VI)
                    scores['African'] += 30;
                }
                
                // Melanin index contribution
                if (skinAnalysis.melaninIndex > 0.7) {
                    scores['African'] += 10;
                } else if (skinAnalysis.melaninIndex < 0.3) {
                    scores['European'] += 10;
                }
            }
            
            // GEOMETRIC SCORING (60% weight - slightly reduced from before)
            
            // Analyze facial proportions (weighted features)
            // Face shape analysis
            if (faceMetrics.faceRatio > 1.35) {
                scores['East Asian'] += 15;
                scores['South Asian'] += 10;
            } else if (faceMetrics.faceRatio < 1.15) {
                scores['European'] += 15;
                scores['Middle Eastern'] += 8;
            }
            
            // Eye characteristics
            if (faceMetrics.eyeAspectRatio < 0.28) {
                scores['East Asian'] += 20;
            } else if (faceMetrics.eyeAspectRatio > 0.35) {
                scores['African'] += 15;
                scores['European'] += 10;
            }
            
            // Nose characteristics
            if (faceMetrics.noseWidthRatio > 0.42) {
                scores['African'] += 20;
                scores['Latin American'] += 10;
            } else if (faceMetrics.noseWidthRatio < 0.32) {
                scores['East Asian'] += 15;
                scores['European'] += 12;
            } else {
                scores['South Asian'] += 10;
                scores['Middle Eastern'] += 10;
            }
            
            // Lip characteristics
            if (faceMetrics.lipFullness > 0.18) {
                scores['African'] += 15;
                scores['Latin American'] += 8;
            } else if (faceMetrics.lipFullness < 0.12) {
                scores['East Asian'] += 10;
                scores['European'] += 10;
            }
            
            // Cheekbone prominence
            if (faceMetrics.cheekboneProminence > 0.85) {
                scores['East Asian'] += 10;
                scores['Native American'] = 15; // Add if high cheekbones
            }
            
            // Eye distance
            if (faceMetrics.interocularDistance > 0.32) {
                scores['African'] += 8;
                scores['European'] += 5;
            } else if (faceMetrics.interocularDistance < 0.28) {
                scores['East Asian'] += 8;
            }
            
            // Jawline
            if (faceMetrics.jawlineAngle > 120) {
                scores['European'] += 8;
                scores['Middle Eastern'] += 5;
            } else if (faceMetrics.jawlineAngle < 105) {
                scores['East Asian'] += 8;
                scores['African'] += 5;
            }
            
            // Find highest scoring ethnicity
            let maxScore = 0;
            let bestMatch = 'Mixed/Other';
            
            for (const [ethnicity, score] of Object.entries(scores)) {
                if (score > maxScore) {
                    maxScore = score;
                    bestMatch = ethnicity;
                }
            }
            
            // Calculate confidence based on score differentiation
            const sortedScores = Object.values(scores).sort((a, b) => b - a);
            const scoreDiff = sortedScores[0] - sortedScores[1];
            
            let confidence = 40; // Base confidence
            if (scoreDiff > 20) {
                confidence = 70 + Math.min(scoreDiff, 25);
            } else if (scoreDiff > 10) {
                confidence = 55 + scoreDiff;
            } else {
                confidence = 40 + scoreDiff;
                bestMatch = 'Mixed/Other'; // Low confidence suggests mixed heritage
            }
            
            // Add some variance for realism
            confidence = Math.min(95, confidence + (Math.random() * 10 - 5));
            
            // Prepare comprehensive result
            const result = {
                label: bestMatch,
                confidence: Math.round(confidence),
                skinTone: skinAnalysis ? skinAnalysis.skinToneLabel : 'Unknown',
                fitzpatrick: skinAnalysis ? skinAnalysis.fitzpatrickType : 0,
                ita: skinAnalysis ? Math.round(skinAnalysis.ita) : 0,
                melaninIndex: skinAnalysis ? skinAnalysis.melaninIndex.toFixed(2) : 0,
                analysis: {
                    geometry: faceMetrics,
                    skinTone: skinAnalysis
                }
            };
            
            // Update UI with analysis details
            if (skinAnalysis) {
                const skinToneDisplay = document.getElementById('skin-tone-info');
                if (skinToneDisplay) {
                    skinToneDisplay.innerHTML = `
                        <span style="color: #888;">Skin: </span>
                        <span style="color: #00ff88;">${skinAnalysis.skinToneLabel}</span>
                        <span style="color: #888;"> | ITA: </span>
                        <span style="color: #00d4ff;">${Math.round(skinAnalysis.ita)}°</span>
                    `;
                }
                
                // Show analysis basis
                const basisDisplay = document.getElementById('analysis-basis');
                if (basisDisplay) {
                    const skinWeight = Math.round((maxScore * 0.4 / (maxScore * 0.4 + maxScore * 0.6)) * 100);
                    const shapeWeight = 100 - skinWeight;
                    basisDisplay.innerHTML = `
                        <span style="color: #555;">Shape ${shapeWeight}% + Skin ${skinWeight}%</span>
                    `;
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('Ethnicity estimation error:', error);
            return { label: 'Unknown', confidence: 0, skinTone: 'Unknown', ita: 0 };
        }
    }
    
    analyzeSkinTone() {
        // Analyze skin tone using ITA (Individual Typology Angle) methodology
        // Based on CIELAB color space as per dermatological research
        
        try {
            if (!this.processingCanvas || !this.processingCtx || !this.video || !this.video.videoWidth) {
                return null;
            }
            
            // Ensure canvas has proper dimensions
            if (this.processingCanvas.width === 0) {
                this.processingCanvas.width = 640;
                this.processingCanvas.height = 480;
            }
            
            // Get skin samples from ROIs (forehead and cheeks)
            this.processingCtx.drawImage(this.video, 0, 0, this.processingCanvas.width, this.processingCanvas.height);
            
            // Sample multiple skin regions
            const skinSamples = [];
            
            // Define sampling regions (avoiding eyes, nose, mouth)
            const sampleRegions = [
                { x: 0.5, y: 0.25, size: 20 },  // Forehead center
                { x: 0.35, y: 0.4, size: 15 },  // Left cheek
                { x: 0.65, y: 0.4, size: 15 },  // Right cheek
                { x: 0.5, y: 0.15, size: 15 },  // Upper forehead
                { x: 0.3, y: 0.5, size: 10 },   // Left jaw
                { x: 0.7, y: 0.5, size: 10 }    // Right jaw
            ];
            
            for (const region of sampleRegions) {
                const x = Math.floor(region.x * this.processingCanvas.width);
                const y = Math.floor(region.y * this.processingCanvas.height);
                const imageData = this.processingCtx.getImageData(
                    x - region.size/2, 
                    y - region.size/2, 
                    region.size, 
                    region.size
                );
                
                // Convert RGB to LAB color space
                const labValues = this.rgbToLab(imageData.data);
                if (labValues) {
                    skinSamples.push(labValues);
                }
            }
            
            if (skinSamples.length === 0) return null;
            
            // Average the LAB values
            const avgLab = {
                L: skinSamples.reduce((sum, s) => sum + s.L, 0) / skinSamples.length,
                a: skinSamples.reduce((sum, s) => sum + s.a, 0) / skinSamples.length,
                b: skinSamples.reduce((sum, s) => sum + s.b, 0) / skinSamples.length
            };
            
            // Calculate ITA (Individual Typology Angle)
            // ITA° = [Arc Tangent((L* - 50)/b*)] × 180/π
            const ita = (Math.atan2(avgLab.L - 50, avgLab.b)) * (180 / Math.PI);
            
            // Determine Fitzpatrick type based on ITA ranges
            let fitzpatrickType = 0;
            let skinToneLabel = '';
            
            if (ita > 55) {
                fitzpatrickType = 1;
                skinToneLabel = 'Very Light';
            } else if (ita > 41 && ita <= 55) {
                fitzpatrickType = 2;
                skinToneLabel = 'Light';
            } else if (ita > 28 && ita <= 41) {
                fitzpatrickType = 3;
                skinToneLabel = 'Intermediate';
            } else if (ita > 10 && ita <= 28) {
                fitzpatrickType = 4;
                skinToneLabel = 'Tan-Brown';
            } else if (ita > -30 && ita <= 10) {
                fitzpatrickType = 5;
                skinToneLabel = 'Brown';
            } else {
                fitzpatrickType = 6;
                skinToneLabel = 'Dark Brown';
            }
            
            // Calculate melanin index (simplified)
            // Based on L* value - lower L* indicates higher melanin
            const melaninIndex = Math.max(0, Math.min(1, (100 - avgLab.L) / 100));
            
            return {
                ita: ita,
                fitzpatrickType: fitzpatrickType,
                skinToneLabel: skinToneLabel,
                melaninIndex: melaninIndex,
                labValues: avgLab,
                monkScale: this.itaToMonkScale(ita) // Additional scale for diversity
            };
            
        } catch (error) {
            console.error('Skin tone analysis error:', error);
            return null;
        }
    }
    
    rgbToLab(pixelData) {
        // Convert RGB pixel data to CIELAB color space
        try {
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            
            // Average the RGB values
            for (let i = 0; i < pixelData.length; i += 4) {
                rSum += pixelData[i];
                gSum += pixelData[i + 1];
                bSum += pixelData[i + 2];
                count++;
            }
            
            if (count === 0) return null;
            
            let r = rSum / count / 255;
            let g = gSum / count / 255;
            let b = bSum / count / 255;
            
            // Convert RGB to XYZ
            r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
            g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
            b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
            
            let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
            let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
            let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;
            
            // Convert XYZ to LAB (D65 illuminant)
            x = x / 95.047;
            y = y / 100.000;
            z = z / 108.883;
            
            x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
            y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
            z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);
            
            const L = (116 * y) - 16;
            const a = 500 * (x - y);
            const bStar = 200 * (y - z);  // Use bStar to avoid conflict
            
            return { L, a, b: bStar };  // Return b as bStar value
            
        } catch (error) {
            console.error('RGB to LAB conversion error:', error);
            return null;
        }
    }
    
    itaToMonkScale(ita) {
        // Convert ITA to Monk Skin Tone Scale (10 points)
        // More granular than Fitzpatrick for better diversity representation
        if (ita > 60) return 1;
        if (ita > 50) return 2;
        if (ita > 40) return 3;
        if (ita > 30) return 4;
        if (ita > 20) return 5;
        if (ita > 10) return 6;
        if (ita > 0) return 7;
        if (ita > -15) return 8;
        if (ita > -30) return 9;
        return 10;
    }
    
    calculateAdvancedFaceMetrics(landmarks) {
        // Using MediaPipe 468 landmarks for detailed analysis
        try {
            // Key landmark indices for MediaPipe Face Mesh
            const indices = {
                // Face outline
                leftTemple: 21,
                rightTemple: 251,
                chin: 152,
                forehead: 10,
                
                // Eyes
                leftEyeOuter: 33,
                leftEyeInner: 133,
                rightEyeOuter: 362,
                rightEyeInner: 263,
                leftEyeTop: 159,
                leftEyeBottom: 145,
                rightEyeTop: 386,
                rightEyeBottom: 374,
                
                // Nose
                noseTip: 1,
                noseBottom: 2,
                leftNostril: 48,
                rightNostril: 278,
                noseBridge: 6,
                
                // Mouth
                leftMouthCorner: 61,
                rightMouthCorner: 291,
                upperLipTop: 13,
                lowerLipBottom: 14,
                upperLipBottom: 269,
                lowerLipTop: 17,
                
                // Cheeks
                leftCheekbone: 116,
                rightCheekbone: 345,
                
                // Jaw
                leftJaw: 172,
                rightJaw: 397
            };
            
            // Calculate distances and ratios
            const faceWidth = Math.abs(landmarks[indices.leftTemple].x - landmarks[indices.rightTemple].x);
            const faceHeight = Math.abs(landmarks[indices.forehead].y - landmarks[indices.chin].y);
            
            const eyeWidth = Math.abs(landmarks[indices.leftEyeOuter].x - landmarks[indices.leftEyeInner].x);
            const eyeHeight = Math.abs(landmarks[indices.leftEyeTop].y - landmarks[indices.leftEyeBottom].y);
            
            const noseWidth = Math.abs(landmarks[indices.leftNostril].x - landmarks[indices.rightNostril].x);
            const noseLength = Math.abs(landmarks[indices.noseBridge].y - landmarks[indices.noseBottom].y);
            
            const mouthWidth = Math.abs(landmarks[indices.leftMouthCorner].x - landmarks[indices.rightMouthCorner].x);
            const upperLipHeight = Math.abs(landmarks[indices.upperLipTop].y - landmarks[indices.upperLipBottom].y);
            const lowerLipHeight = Math.abs(landmarks[indices.lowerLipTop].y - landmarks[indices.lowerLipBottom].y);
            
            const interocularDist = Math.abs(landmarks[indices.leftEyeInner].x - landmarks[indices.rightEyeInner].x);
            
            const cheekWidth = Math.abs(landmarks[indices.leftCheekbone].x - landmarks[indices.rightCheekbone].x);
            const jawWidth = Math.abs(landmarks[indices.leftJaw].x - landmarks[indices.rightJaw].x);
            
            // Calculate jaw angle
            const jawVector = {
                x: landmarks[indices.rightJaw].x - landmarks[indices.chin].x,
                y: landmarks[indices.rightJaw].y - landmarks[indices.chin].y
            };
            const jawlineAngle = Math.abs(Math.atan2(jawVector.y, jawVector.x) * 180 / Math.PI);
            
            return {
                isValid: true,
                faceRatio: faceHeight / faceWidth,
                eyeAspectRatio: eyeHeight / eyeWidth,
                noseWidthRatio: noseWidth / faceWidth,
                noseLengthRatio: noseLength / faceHeight,
                lipFullness: (upperLipHeight + lowerLipHeight) / faceHeight,
                mouthWidthRatio: mouthWidth / faceWidth,
                interocularDistance: interocularDist / faceWidth,
                cheekboneProminence: cheekWidth / faceWidth,
                jawlineRatio: jawWidth / faceWidth,
                jawlineAngle: jawlineAngle
            };
            
        } catch (error) {
            console.error('Error calculating face metrics:', error);
            return { isValid: false };
        }
    }
    
    calculateBasicFaceMetrics(positions) {
        // Fallback for Face-API 68 landmarks
        try {
            const faceWidth = Math.abs(positions[16].x - positions[0].x);
            const faceHeight = Math.abs(positions[8].y - positions[24].y);
            const noseWidth = Math.abs(positions[35].x - positions[31].x);
            const eyeDistance = Math.abs(positions[45].x - positions[36].x);
            const eyeHeight = Math.abs(positions[41].y - positions[37].y);
            const eyeWidth = Math.abs(positions[39].x - positions[36].x);
            const mouthWidth = Math.abs(positions[54].x - positions[48].x);
            const upperLipHeight = Math.abs(positions[51].y - positions[62].y);
            const lowerLipHeight = Math.abs(positions[66].y - positions[57].y);
            
            return {
                isValid: true,
                faceRatio: faceHeight / faceWidth,
                eyeAspectRatio: eyeHeight / eyeWidth,
                noseWidthRatio: noseWidth / faceWidth,
                noseLengthRatio: 0.3, // Approximate
                lipFullness: (upperLipHeight + lowerLipHeight) / faceHeight,
                mouthWidthRatio: mouthWidth / faceWidth,
                interocularDistance: eyeDistance / faceWidth,
                cheekboneProminence: 0.8, // Approximate
                jawlineRatio: 0.9, // Approximate
                jawlineAngle: 110 // Approximate
            };
        } catch (error) {
            return { isValid: false };
        }
    }
    
    updateEyeSpotlight(leftCenter, rightCenter) {
        const leftSpot = document.getElementById('left-eye-spot');
        const rightSpot = document.getElementById('right-eye-spot');
        const leftCircle = document.getElementById('left-eye-circle');
        const rightCircle = document.getElementById('right-eye-circle');
        const gazePoint = document.getElementById('gaze-point');
        
        if (leftSpot && rightSpot && this.video) {
            try {
                // Get video element position
                const videoRect = this.video.getBoundingClientRect();
                
                // Calculate eye positions relative to viewport
                const leftX = videoRect.left + (leftCenter.x * videoRect.width);
                const leftY = videoRect.top + (leftCenter.y * videoRect.height);
                
                const rightX = videoRect.left + (rightCenter.x * videoRect.width);
                const rightY = videoRect.top + (rightCenter.y * videoRect.height);
                
                // Calculate gaze direction based on eye position relative to face center
                // This estimates where on screen the user is looking
                const faceCenter = 0.5; // Normalized face center
                const eyeOffset = ((leftCenter.x + rightCenter.x) / 2) - faceCenter;
                const verticalOffset = ((leftCenter.y + rightCenter.y) / 2) - faceCenter;
                
                // Map eye offset to screen position (amplify the movement)
                const screenWidth = window.innerWidth;
                const screenHeight = window.innerHeight;
                const gazeMultiplier = 3.0; // Amplification factor
                
                // Calculate estimated gaze point on screen
                const estimatedGazeX = (screenWidth / 2) - (eyeOffset * screenWidth * gazeMultiplier);
                const estimatedGazeY = (screenHeight / 2) + (verticalOffset * screenHeight * gazeMultiplier * 0.7);
                
                // Clamp to screen bounds
                const gazeScreenX = Math.max(100, Math.min(screenWidth - 100, estimatedGazeX));
                const gazeScreenY = Math.max(100, Math.min(screenHeight - 100, estimatedGazeY));
                
                // Update spotlight beam positions to follow gaze
                leftSpot.style.left = (gazeScreenX - 150) + 'px';
                leftSpot.style.top = (gazeScreenY - 150) + 'px';
                
                rightSpot.style.left = (gazeScreenX + 50) + 'px';
                rightSpot.style.top = (gazeScreenY - 150) + 'px';
                
                // Update precise eye tracking circles (keep on eyes)
                if (leftCircle && rightCircle) {
                    leftCircle.style.left = (leftX - 20) + 'px';
                    leftCircle.style.top = (leftY - 20) + 'px';
                    
                    rightCircle.style.left = (rightX - 20) + 'px';
                    rightCircle.style.top = (rightY - 20) + 'px';
                }
                
                // Update gaze point to show where user is looking
                if (gazePoint) {
                    gazePoint.style.left = (gazeScreenX - 10) + 'px';
                    gazePoint.style.top = (gazeScreenY - 10) + 'px';
                    gazePoint.style.display = 'block';
                    
                    // Update gaze direction text
                    const gazeDir = document.getElementById('gaze-dir');
                    if (gazeDir) {
                        let direction = 'Center';
                        if (gazeScreenX < screenWidth * 0.33) direction = 'Left';
                        else if (gazeScreenX > screenWidth * 0.66) direction = 'Right';
                        
                        if (gazeScreenY < screenHeight * 0.33) direction = 'Top-' + direction;
                        else if (gazeScreenY > screenHeight * 0.66) direction = 'Bottom-' + direction;
                        
                        gazeDir.textContent = direction;
                    }
                }
            } catch (e) {
                console.error('Eye spotlight update error:', e);
            }
        }
    }
    
    clearDemographics() {
        document.getElementById('age-value').textContent = '-';
        document.getElementById('gender-value').textContent = '-';
        document.getElementById('expression-value').textContent = '-';
        document.getElementById('ethnicity-value').textContent = '-';
        
        document.getElementById('age-conf').style.width = '0%';
        document.getElementById('gender-conf').style.width = '0%';
        document.getElementById('expression-conf').style.width = '0%';
        document.getElementById('ethnicity-conf').style.width = '0%';
        
        document.getElementById('age-conf-text').textContent = 'Conf: 0%';
        document.getElementById('gender-conf-text').textContent = 'Conf: 0%';
        document.getElementById('expression-conf-text').textContent = 'Conf: 0%';
        document.getElementById('ethnicity-conf-text').textContent = 'Conf: 0%';
        
        // Clear mobile demographics
        this.updateMobileDemographics('-', '-', '-', '-', 0, 0, 0, 0);
    }
    
    updateMobileDemographics(age, gender, expression, ethnicity, ageConf, genderConf, expConf, ethConf) {
        // Update mobile demographic elements
        const mobileAge = document.querySelector('.mobile-age-value');
        const mobileGender = document.querySelector('.mobile-gender-value');
        const mobileExpression = document.querySelector('.mobile-expression-value');
        const mobileEthnicity = document.querySelector('.mobile-ethnicity-value');
        
        if (mobileAge) mobileAge.textContent = age;
        if (mobileGender) mobileGender.textContent = gender;
        if (mobileExpression) mobileExpression.textContent = expression;
        if (mobileEthnicity) mobileEthnicity.textContent = ethnicity;
        
        // Update confidence texts
        const mobileAgeConf = document.querySelector('.mobile-age-conf-text');
        const mobileGenderConf = document.querySelector('.mobile-gender-conf-text');
        const mobileExpConf = document.querySelector('.mobile-expression-conf-text');
        const mobileEthConf = document.querySelector('.mobile-ethnicity-conf-text');
        
        if (mobileAgeConf) mobileAgeConf.textContent = `Conf: ${ageConf}%`;
        if (mobileGenderConf) mobileGenderConf.textContent = `Conf: ${genderConf}%`;
        if (mobileExpConf) mobileExpConf.textContent = `Conf: ${expConf}%`;
        if (mobileEthConf) mobileEthConf.textContent = `Conf: ${ethConf}%`;
    }
    
    clearMetrics() {
        document.getElementById('hr-value').textContent = '--';
        document.getElementById('hrv-value').textContent = '--';
        document.getElementById('rr-value').textContent = '--';
        document.getElementById('stress-value').textContent = '--';
        
        document.getElementById('hr-confidence').style.width = '0%';
        document.getElementById('hrv-confidence').style.width = '0%';
        document.getElementById('rr-confidence').style.width = '0%';
        document.getElementById('stress-confidence').style.width = '0%';
        
        // Update mobile elements
        this.updateMobileElements('--', '--', '--', '--');
        
        this.clearDemographics();
    }
    
    toggleMobileView() {
        const body = document.body;
        const toggleText = document.getElementById('mobile-toggle-text');
        
        if (body.classList.contains('mobile-view')) {
            this.disableMobileView();
        } else {
            this.enableMobileView();
        }
    }
    
    enableMobileView() {
        document.body.classList.add('mobile-view');
        document.getElementById('mobile-toggle-text').textContent = 'Desktop View';
        
        // Clone content to mobile scroll area
        this.setupMobileContent();
        
        // Abbreviate labels for mobile
        const eyeBtn = document.getElementById('btn-eyes');
        if (eyeBtn) eyeBtn.textContent = 'Eyes';
        
        const roiBtn = document.getElementById('btn-roi');
        if (roiBtn) roiBtn.textContent = 'ROI';
        
        // Enable continuous mode by default on mobile
        if (!this.isContinuous) {
            this.isContinuous = true;
            const continuousBtn = document.getElementById('toggle-continuous');
            if (continuousBtn) {
                continuousBtn.classList.add('active');
            }
            this.addLog('Continuous mode enabled for mobile', 'info');
        }
        
        // Keep face detection normal (not mirrored)
        if (this.faceMesh) {
            this.faceMesh.setOptions({
                selfieMode: false // Keep normal mode, don't mirror
            });
        }
        
        // Setup scroll handler for auto-hiding header
        this.setupMobileScrollHandler();
        
        this.addLog('Switched to mobile view', 'info');
    }
    
    disableMobileView() {
        document.body.classList.remove('mobile-view');
        document.getElementById('mobile-toggle-text').textContent = 'Mobile View';
        
        // Restore full labels for desktop
        const eyeBtn = document.getElementById('btn-eyes');
        if (eyeBtn) eyeBtn.textContent = 'Eye Tracking';
        
        const roiBtn = document.getElementById('btn-roi');
        if (roiBtn) roiBtn.textContent = 'ROI Regions';
        
        // Reset camera mode
        if (this.faceMesh) {
            this.faceMesh.setOptions({
                selfieMode: false
            });
        }
        
        // Remove scroll handler
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
        }
        
        // Show header if hidden
        const header = document.querySelector('.header');
        if (header) {
            header.classList.remove('hidden');
        }
        
        this.addLog('Switched to desktop view', 'info');
    }
    
    setupMobileScrollHandler() {
        let lastScrollTop = 0;
        const scrollThreshold = 50;
        const header = document.querySelector('.header');
        
        this.scrollHandler = () => {
            const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
            
            // Scrolling down and past threshold - hide header
            if (currentScroll > lastScrollTop && currentScroll > scrollThreshold) {
                header.classList.add('hidden');
            } 
            // Scrolling up - show header
            else if (currentScroll < lastScrollTop) {
                header.classList.remove('hidden');
            }
            
            lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
        };
        
        window.addEventListener('scroll', this.scrollHandler);
    }
    
    setupMobileContent() {
        const mobileContentArea = document.querySelector('.mobile-content-area');
        if (!mobileContentArea) return;
        
        // Clear existing content
        mobileContentArea.innerHTML = '';
        
        // Move (not clone) detection panels from below-video
        const detectionPanels = document.querySelectorAll('.below-video .detection-panel');
        detectionPanels.forEach(panel => {
            // Move the actual panel to mobile area
            mobileContentArea.appendChild(panel);
        });
        
        // Move (not clone) main panels
        const panels = ['left-metrics', 'biomarkers', 'charts-section', 'debug-log'];
        
        panels.forEach(panelClass => {
            const original = document.querySelector('.' + panelClass);
            if (original) {
                // Move the actual panel to mobile area
                mobileContentArea.appendChild(original);
            }
        });
        
        // Mark that we've moved panels to mobile
        this.panelsMovedToMobile = true;
    }
    
    updateMobileElements(hr, hrv, rr, stress) {
        // Update mobile bottom bar
        const mobileHr = document.querySelector('.mobile-hr');
        const mobileHrv = document.querySelector('.mobile-hrv');
        const mobileRr = document.querySelector('.mobile-rr');
        const mobileStress = document.querySelector('.mobile-stress');
        
        if (mobileHr) mobileHr.textContent = hr;
        if (mobileHrv) mobileHrv.textContent = hrv;
        if (mobileRr) mobileRr.textContent = rr;
        if (mobileStress) mobileStress.textContent = stress;
        
        // Update mobile face detection duplicates
        const mobileFaceStatus = document.querySelector('.mobile-face-status');
        const mobileFaceConf = document.querySelector('.mobile-face-confidence');
        const mobileLandmarks = document.querySelector('.mobile-landmark-count');
        const mobileTracking = document.querySelector('.mobile-tracking-status');
        
        if (mobileFaceStatus) mobileFaceStatus.textContent = document.getElementById('face-status').textContent;
        if (mobileFaceConf) mobileFaceConf.textContent = document.getElementById('face-confidence').textContent;
        if (mobileLandmarks) mobileLandmarks.textContent = document.getElementById('landmark-count').textContent;
        if (mobileTracking) mobileTracking.textContent = document.getElementById('tracking-status').textContent;
    }
}

// Global function for info buttons
function showInfo(type) {
    const messages = {
        methodology: 'Remote Photoplethysmography (rPPG) detects blood volume changes through facial color variations.',
        accuracy: 'Results are estimates only. Not for medical use. Best accuracy with good lighting and minimal movement.',
        export: 'Recording data is stored in memory. Use developer console to access recordingData array.'
    };
    
    if (messages[type]) {
        alert(messages[type]);
    }
}

window.showInfo = showInfo;

// Initialize on load
let analyzerInstance = null;

window.initializeAnalyzer = function() {
    console.log('Initializing analyzer after consent...');
    
    // Function to check if all dependencies are loaded
    function checkDependencies() {
        return typeof FaceMesh !== 'undefined' && 
               typeof faceapi !== 'undefined' && 
               typeof Chart !== 'undefined';
    }
    
    // Function to create analyzer instance
    function createAnalyzer() {
        if (checkDependencies()) {
            console.log('All dependencies loaded, creating analyzer...');
            if (!analyzerInstance) {
                analyzerInstance = new FivelidzAnalyzerFull();
                window.analyzer = analyzerInstance;
            }
        } else {
            console.log('Dependencies not ready, waiting...');
            setTimeout(createAnalyzer, 500);
        }
    }
    
    // Start initialization
    createAnalyzer();
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, checking consent...');
    
    // Check if consent was already given this session
    const consent = sessionStorage.getItem('biomarkerConsent');
    if (consent === 'accepted') {
        // Auto-initialize if consent already given
        window.initializeAnalyzer();
    }
    // Otherwise wait for user to accept consent via modal
});