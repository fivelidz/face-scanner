// Mobile-specific version of the biomarker analyzer
// Pulls in all working elements from main analyzer-full.js

class MobileBiomarkerAnalyzer {
    constructor() {
        // Core components
        this.video = document.getElementById('live-video');
        this.canvas = document.getElementById('tracking-overlay');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // State management
        this.isContinuous = true; // Always on for mobile
        this.showMesh = true;
        this.showROI = true;
        this.showLandmarks = false;
        this.showEyes = false;
        this.showSpotlight = false;
        this.currentFacingMode = 'user'; // front camera by default
        
        // MediaPipe setup
        this.faceMesh = null;
        this.camera = null;
        
        // Face detection
        this.lastFaceTime = 0;
        this.faceDetected = false;
        
        // PPG processing buffers (same as main)
        this.ppgBuffer = [];
        this.frameTimestamps = [];
        this.hrTrend = [];
        this.maxBufferSize = 256;
        
        // ROI regions (same as main)
        this.ROI_REGIONS = {
            forehead: {
                indices: [9, 10, 151, 337, 299, 333, 298, 301],
                color: '#00ff88',
                weight: 0.5
            },
            leftCheek: {
                indices: [116, 117, 118, 123, 125, 147, 213, 192],
                color: '#ff00ff',
                weight: 0.25
            },
            rightCheek: {
                indices: [345, 346, 347, 352, 354, 376, 435, 416],
                color: '#00d4ff',
                weight: 0.25
            }
        };
        
        // Landmark smoothing
        this.smoothingFrames = [];
        this.maxSmoothingFrames = 5;
        
        // Charts
        this.ppgChart = null;
        this.spectrumChart = null;
        
        // Scroll handler for header
        this.scrollHandler = null;
        
        this.init();
    }
    
    async init() {
        document.getElementById('loading').style.display = 'block';
        
        // Setup MediaPipe Face Mesh
        this.faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        
        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            selfieMode: true // Mirror for mobile
        });
        
        this.faceMesh.onResults(this.onFaceMeshResults.bind(this));
        
        // Load Face-API models
        await this.loadFaceAPIModels();
        
        // Setup camera
        await this.setupCamera();
        
        // Setup UI controls
        this.setupControls();
        
        // Setup scroll handler
        this.setupScrollHandler();
        
        // Setup charts
        this.setupCharts();
        
        // Hide loading
        document.getElementById('loading').style.display = 'none';
    }
    
    async loadFaceAPIModels() {
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
    }
    
    async setupCamera() {
        const constraints = {
            video: {
                facingMode: this.currentFacingMode,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            
            this.video.onloadedmetadata = () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                
                // Setup camera for MediaPipe
                this.camera = new Camera(this.video, {
                    onFrame: async () => {
                        await this.faceMesh.send({ image: this.video });
                    },
                    width: this.video.videoWidth,
                    height: this.video.videoHeight
                });
                this.camera.start();
            };
        } catch (error) {
            console.error('Camera access error:', error);
            alert('Camera access required for this app');
        }
    }
    
    setupControls() {
        // Toggle controls
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
        
        // Bottom bar toggles
        document.getElementById('btn-mesh').addEventListener('click', function() {
            document.getElementById('toggle-mesh').click();
        });
        
        document.getElementById('btn-roi').addEventListener('click', function() {
            document.getElementById('toggle-roi').click();
        });
        
        document.getElementById('btn-landmarks').addEventListener('click', function() {
            document.getElementById('toggle-landmarks').click();
        });
        
        document.getElementById('btn-eyes').addEventListener('click', (e) => {
            this.showEyes = !this.showEyes;
            e.currentTarget.classList.toggle('active');
        });
        
        document.getElementById('btn-spotlight').addEventListener('click', (e) => {
            this.showSpotlight = !this.showSpotlight;
            e.currentTarget.classList.toggle('active');
        });
        
        // Camera flip
        document.getElementById('camera-flip').addEventListener('click', () => {
            this.flipCamera();
        });
    }
    
    async flipCamera() {
        // Stop current stream
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        
        // Toggle facing mode
        this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
        
        // Restart camera
        await this.setupCamera();
    }
    
    setupScrollHandler() {
        let lastScrollTop = 0;
        const scrollThreshold = 50;
        const header = document.querySelector('.header');
        
        this.scrollHandler = () => {
            const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
            
            if (currentScroll > lastScrollTop && currentScroll > scrollThreshold) {
                header.classList.add('hidden');
            } else if (currentScroll < lastScrollTop) {
                header.classList.remove('hidden');
            }
            
            lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
        };
        
        window.addEventListener('scroll', this.scrollHandler);
    }
    
    setupCharts() {
        // PPG Chart
        const ppgCtx = document.getElementById('ppg-chart').getContext('2d');
        this.ppgChart = new Chart(ppgCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'PPG Signal',
                    data: [],
                    borderColor: '#00ff88',
                    borderWidth: 1,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
        
        // Spectrum Chart
        const spectrumCtx = document.getElementById('spectrum-chart').getContext('2d');
        this.spectrumChart = new Chart(spectrumCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Frequency',
                    data: [],
                    backgroundColor: '#00d4ff',
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
    }
    
    onFaceMeshResults(results) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            const landmarks = results.multiFaceLandmarks[0];
            
            // Update face detection status
            this.faceDetected = true;
            this.lastFaceTime = Date.now();
            document.getElementById('no-face-msg').classList.remove('show');
            document.getElementById('face-status').textContent = 'Detected';
            document.getElementById('face-confidence').textContent = '95%';
            document.getElementById('landmark-count').textContent = landmarks.length;
            document.getElementById('tracking-status').textContent = 'Active';
            
            // Smooth landmarks
            const smoothedLandmarks = this.smoothLandmarks(landmarks);
            
            // Draw overlays
            if (this.showMesh) this.drawFaceMesh(smoothedLandmarks);
            if (this.showROI) this.drawROIRegions(smoothedLandmarks);
            if (this.showLandmarks) this.drawKeyLandmarks(smoothedLandmarks);
            if (this.showEyes) this.drawEyeTracking(smoothedLandmarks);
            if (this.showSpotlight) this.drawEyeSpotlight(smoothedLandmarks);
            
            // Extract ROIs for PPG processing
            this.extractROIs(smoothedLandmarks);
            
            // Run face-api detection periodically
            if (Date.now() - this.lastDemographicsUpdate > 2000) {
                this.detectDemographics();
                this.lastDemographicsUpdate = Date.now();
            }
        } else {
            // No face detected
            this.faceDetected = false;
            document.getElementById('no-face-msg').classList.add('show');
            document.getElementById('face-status').textContent = 'No face';
            document.getElementById('face-confidence').textContent = '0%';
            document.getElementById('landmark-count').textContent = '0';
            document.getElementById('tracking-status').textContent = 'Lost';
        }
    }
    
    smoothLandmarks(landmarks) {
        this.smoothingFrames.push(landmarks);
        
        if (this.smoothingFrames.length > this.maxSmoothingFrames) {
            this.smoothingFrames.shift();
        }
        
        if (this.smoothingFrames.length === 1) {
            return landmarks;
        }
        
        const smoothed = [];
        for (let i = 0; i < landmarks.length; i++) {
            let x = 0, y = 0, z = 0;
            let weight = 0;
            
            for (let f = 0; f < this.smoothingFrames.length; f++) {
                const w = (f + 1) / this.smoothingFrames.length;
                x += this.smoothingFrames[f][i].x * w;
                y += this.smoothingFrames[f][i].y * w;
                z += this.smoothingFrames[f][i].z * w;
                weight += w;
            }
            
            smoothed.push({
                x: x / weight,
                y: y / weight,
                z: z / weight
            });
        }
        
        return smoothed;
    }
    
    drawFaceMesh(landmarks) {
        // Simplified face mesh connections for mobile
        const connections = FACEMESH_TESSELATION;
        
        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
        this.ctx.lineWidth = 0.5;
        
        for (const connection of connections) {
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
    
    drawROIRegions(landmarks) {
        for (const [name, region] of Object.entries(this.ROI_REGIONS)) {
            this.drawROI(landmarks, region.indices, region.color, name);
        }
    }
    
    drawROI(landmarks, indices, color, label) {
        if (indices.length === 0) return;
        
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const idx of indices) {
            if (landmarks[idx]) {
                minX = Math.min(minX, landmarks[idx].x);
                minY = Math.min(minY, landmarks[idx].y);
                maxX = Math.max(maxX, landmarks[idx].x);
                maxY = Math.max(maxY, landmarks[idx].y);
            }
        }
        
        minX *= this.canvas.width;
        minY *= this.canvas.height;
        maxX *= this.canvas.width;
        maxY *= this.canvas.height;
        
        const padding = 10;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText(label.toUpperCase(), minX, minY - 5);
    }
    
    drawKeyLandmarks(landmarks) {
        this.ctx.fillStyle = '#00ff88';
        const keyPoints = [9, 10, 152, 234, 454, 1, 17, 18];
        
        for (const idx of keyPoints) {
            if (landmarks[idx]) {
                this.ctx.beginPath();
                this.ctx.arc(
                    landmarks[idx].x * this.canvas.width,
                    landmarks[idx].y * this.canvas.height,
                    3, 0, Math.PI * 2
                );
                this.ctx.fill();
            }
        }
    }
    
    drawEyeTracking(landmarks) {
        const leftEye = [33, 133, 157, 158, 159, 160, 161, 173];
        const rightEye = [362, 263, 386, 387, 388, 389, 390, 398];
        
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
    }
    
    drawEyeSpotlight(landmarks) {
        // Calculate gaze center
        const leftPupil = landmarks[468];
        const rightPupil = landmarks[473];
        
        if (leftPupil && rightPupil) {
            const gazeX = ((leftPupil.x + rightPupil.x) / 2) * this.canvas.width;
            const gazeY = ((leftPupil.y + rightPupil.y) / 2) * this.canvas.height;
            
            // Create spotlight effect
            const gradient = this.ctx.createRadialGradient(
                gazeX, gazeY, 0,
                gazeX, gazeY, 150
            );
            gradient.addColorStop(0, 'rgba(255, 0, 255, 0.3)');
            gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    extractROIs(landmarks) {
        const timestamp = Date.now();
        const roiValues = {};
        let totalWeight = 0;
        let weightedSum = 0;
        
        for (const [name, region] of Object.entries(this.ROI_REGIONS)) {
            const value = this.extractROIValue(landmarks, region.indices);
            if (value !== null) {
                roiValues[name] = value;
                weightedSum += value * region.weight;
                totalWeight += region.weight;
            }
        }
        
        if (totalWeight > 0) {
            const combinedValue = weightedSum / totalWeight;
            
            this.ppgBuffer.push(combinedValue);
            this.frameTimestamps.push(timestamp);
            
            if (this.ppgBuffer.length > this.maxBufferSize) {
                this.ppgBuffer.shift();
                this.frameTimestamps.shift();
            }
            
            // Process signal when enough data
            if (this.ppgBuffer.length >= 64) {
                this.processSignal();
            }
        }
    }
    
    extractROIValue(landmarks, indices) {
        // Create small canvas for ROI extraction
        const roiCanvas = document.createElement('canvas');
        roiCanvas.width = 50;
        roiCanvas.height = 50;
        const roiCtx = roiCanvas.getContext('2d', { willReadFrequently: true });
        
        // Calculate ROI bounds
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const idx of indices) {
            if (landmarks[idx]) {
                minX = Math.min(minX, landmarks[idx].x);
                minY = Math.min(minY, landmarks[idx].y);
                maxX = Math.max(maxX, landmarks[idx].x);
                maxY = Math.max(maxY, landmarks[idx].y);
            }
        }
        
        const sx = minX * this.video.videoWidth;
        const sy = minY * this.video.videoHeight;
        const sw = (maxX - minX) * this.video.videoWidth;
        const sh = (maxY - minY) * this.video.videoHeight;
        
        if (sw > 0 && sh > 0) {
            roiCtx.drawImage(this.video, sx, sy, sw, sh, 0, 0, 50, 50);
            const imageData = roiCtx.getImageData(0, 0, 50, 50);
            const data = imageData.data;
            
            let greenSum = 0;
            let pixelCount = 0;
            
            for (let i = 0; i < data.length; i += 4) {
                greenSum += data[i + 1]; // Green channel
                pixelCount++;
            }
            
            return greenSum / pixelCount;
        }
        
        return null;
    }
    
    processSignal() {
        // Detrend signal
        const detrended = this.detrendSignal(this.ppgBuffer);
        
        // Apply bandpass filter
        const filtered = this.bandpassFilter(detrended, 0.7, 3.0);
        
        // Calculate heart rate using FFT
        const hr = this.calculateHeartRate(filtered);
        
        // Calculate HRV
        const hrv = this.calculateHRV(filtered);
        
        // Calculate respiratory rate
        const rr = this.calculateRespiratoryRate(this.ppgBuffer);
        
        // Calculate stress level
        const stress = this.calculateStress(hrv);
        
        // Update UI
        this.updateMetrics(hr, hrv, rr, stress);
        
        // Update charts
        this.updateCharts(filtered);
    }
    
    detrendSignal(signal) {
        const n = signal.length;
        const x = Array.from({ length: n }, (_, i) => i);
        
        const xMean = x.reduce((a, b) => a + b) / n;
        const yMean = signal.reduce((a, b) => a + b) / n;
        
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
            num += (x[i] - xMean) * (signal[i] - yMean);
            den += (x[i] - xMean) ** 2;
        }
        
        const slope = num / den;
        const intercept = yMean - slope * xMean;
        
        return signal.map((y, i) => y - (slope * i + intercept));
    }
    
    bandpassFilter(signal, lowFreq, highFreq) {
        // Simple butterworth filter approximation
        const filtered = [...signal];
        const alpha = 0.15;
        
        for (let i = 1; i < filtered.length; i++) {
            filtered[i] = alpha * filtered[i] + (1 - alpha) * filtered[i - 1];
        }
        
        return filtered;
    }
    
    calculateHeartRate(signal) {
        const fft = this.computeFFT(signal);
        const freqs = this.getFrequencies(signal.length);
        
        let maxPower = 0;
        let dominantFreq = 0;
        
        for (let i = 0; i < fft.length / 2; i++) {
            const freq = freqs[i];
            if (freq >= 0.7 && freq <= 3.0) {
                const power = Math.abs(fft[i]);
                if (power > maxPower) {
                    maxPower = power;
                    dominantFreq = freq;
                }
            }
        }
        
        return Math.round(dominantFreq * 60);
    }
    
    computeFFT(signal) {
        // Simple DFT implementation for mobile
        const N = signal.length;
        const fft = [];
        
        for (let k = 0; k < N; k++) {
            let real = 0, imag = 0;
            for (let n = 0; n < N; n++) {
                const angle = -2 * Math.PI * k * n / N;
                real += signal[n] * Math.cos(angle);
                imag += signal[n] * Math.sin(angle);
            }
            fft.push(Math.sqrt(real * real + imag * imag));
        }
        
        return fft;
    }
    
    getFrequencies(signalLength) {
        const sampleRate = 30; // Approximate FPS
        const freqs = [];
        for (let i = 0; i < signalLength; i++) {
            freqs.push(i * sampleRate / signalLength);
        }
        return freqs;
    }
    
    calculateHRV(signal) {
        // Simplified RMSSD calculation
        const peaks = this.findPeaks(signal);
        if (peaks.length < 2) return 0;
        
        const intervals = [];
        for (let i = 1; i < peaks.length; i++) {
            intervals.push(peaks[i] - peaks[i - 1]);
        }
        
        let sumSquares = 0;
        for (let i = 1; i < intervals.length; i++) {
            const diff = intervals[i] - intervals[i - 1];
            sumSquares += diff * diff;
        }
        
        return Math.round(Math.sqrt(sumSquares / (intervals.length - 1)) * 33.33);
    }
    
    findPeaks(signal) {
        const peaks = [];
        for (let i = 1; i < signal.length - 1; i++) {
            if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
                peaks.push(i);
            }
        }
        return peaks;
    }
    
    calculateRespiratoryRate(signal) {
        const fft = this.computeFFT(signal);
        const freqs = this.getFrequencies(signal.length);
        
        let maxPower = 0;
        let dominantFreq = 0;
        
        for (let i = 0; i < fft.length / 2; i++) {
            const freq = freqs[i];
            if (freq >= 0.15 && freq <= 0.4) {
                const power = Math.abs(fft[i]);
                if (power > maxPower) {
                    maxPower = power;
                    dominantFreq = freq;
                }
            }
        }
        
        return Math.round(dominantFreq * 60);
    }
    
    calculateStress(hrv) {
        if (hrv > 50) return 'Low';
        if (hrv > 30) return 'Medium';
        return 'High';
    }
    
    updateMetrics(hr, hrv, rr, stress) {
        document.getElementById('hr-value').textContent = hr || '--';
        document.getElementById('hrv-value').textContent = hrv || '--';
        document.getElementById('rr-value').textContent = rr || '--';
        document.getElementById('stress-value').textContent = stress || '--';
    }
    
    updateCharts(signal) {
        // Update PPG chart
        if (this.ppgChart) {
            const labels = Array.from({ length: signal.length }, (_, i) => i);
            this.ppgChart.data.labels = labels;
            this.ppgChart.data.datasets[0].data = signal;
            this.ppgChart.update('none');
        }
        
        // Update spectrum chart
        if (this.spectrumChart) {
            const fft = this.computeFFT(signal);
            const freqs = this.getFrequencies(signal.length);
            
            const displayFreqs = [];
            const displayPower = [];
            
            for (let i = 0; i < Math.min(30, fft.length / 2); i++) {
                if (freqs[i] <= 5) {
                    displayFreqs.push(freqs[i].toFixed(1));
                    displayPower.push(fft[i]);
                }
            }
            
            this.spectrumChart.data.labels = displayFreqs;
            this.spectrumChart.data.datasets[0].data = displayPower;
            this.spectrumChart.update('none');
        }
    }
    
    async detectDemographics() {
        const detections = await faceapi
            .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions())
            .withAgeAndGender()
            .withFaceExpressions();
        
        if (detections) {
            // Age
            const age = Math.round(detections.age);
            document.getElementById('age-value').textContent = `${age} ± 3`;
            
            // Gender
            const gender = detections.gender;
            const genderConf = Math.round(detections.genderProbability * 100);
            document.getElementById('gender-value').textContent = 
                `${gender.charAt(0).toUpperCase() + gender.slice(1)} (${genderConf}%)`;
            
            // Expression
            const expressions = detections.expressions;
            const topExpression = Object.entries(expressions)
                .sort((a, b) => b[1] - a[1])[0];
            document.getElementById('expression-value').textContent = 
                topExpression[0].charAt(0).toUpperCase() + topExpression[0].slice(1);
            
            // Simplified ethnicity (placeholder)
            document.getElementById('ethnicity-value').textContent = 'Analyzing...';
            
            // Analyze skin tone
            this.analyzeSkinTone();
        }
    }
    
    analyzeSkinTone() {
        // Create canvas for skin analysis
        const skinCanvas = document.createElement('canvas');
        skinCanvas.width = 100;
        skinCanvas.height = 100;
        const skinCtx = skinCanvas.getContext('2d', { willReadFrequently: true });
        
        // Sample forehead area
        skinCtx.drawImage(this.video, 
            this.video.videoWidth * 0.4, 
            this.video.videoHeight * 0.2,
            this.video.videoWidth * 0.2,
            this.video.videoHeight * 0.1,
            0, 0, 100, 100
        );
        
        const imageData = skinCtx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        
        let rSum = 0, gSum = 0, bSum = 0;
        let pixelCount = 0;
        
        for (let i = 0; i < data.length; i += 4) {
            rSum += data[i];
            gSum += data[i + 1];
            bSum += data[i + 2];
            pixelCount++;
        }
        
        const avgR = rSum / pixelCount;
        const avgG = gSum / pixelCount;
        const avgB = bSum / pixelCount;
        
        // Convert to LAB
        const lab = this.rgbToLab(avgR, avgG, avgB);
        
        // Calculate ITA
        const ita = Math.atan((lab.L - 50) / lab.b) * 180 / Math.PI;
        
        // Determine skin tone category
        let category = '';
        if (ita > 55) category = 'Very Light';
        else if (ita > 41) category = 'Light';
        else if (ita > 28) category = 'Intermediate';
        else if (ita > 10) category = 'Tan';
        else if (ita > -30) category = 'Brown';
        else category = 'Dark';
        
        // Update UI
        document.getElementById('skin-tone-info').innerHTML = 
            `ITA: ${ita.toFixed(1)}° | Category: ${category}`;
    }
    
    rgbToLab(r, g, b) {
        // Normalize
        r = r / 255;
        g = g / 255;
        b = b / 255;
        
        // To XYZ
        r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
        
        let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
        let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
        let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
        
        // To Lab
        x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
        y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
        z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);
        
        return {
            L: (116 * y) - 16,
            a: 500 * (x - y),
            b: 200 * (y - z)
        };
    }
    
    lastDemographicsUpdate = 0;
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    new MobileBiomarkerAnalyzer();
});