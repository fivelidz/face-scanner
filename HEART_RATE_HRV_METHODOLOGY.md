# Heart Rate & HRV Detection Methodology

## Overview
This document explains how we extract heart rate and heart rate variability (HRV) from facial video using remote photoplethysmography (rPPG).

---

## 1. The Basic Principle: Blood Volume Changes

### What We're Measuring
- When your heart beats, it pumps blood through your body
- This causes tiny color changes in your skin as blood volume fluctuates
- These changes are most visible in the **green light spectrum** (around 550nm wavelength)
- Hemoglobin in blood absorbs green light strongly, making it ideal for detection

### Why Green Channel?
```
Red Channel:   Less sensitive to blood volume (more affected by lighting)
Green Channel: Most sensitive to blood volume changes ✓
Blue Channel:  Too noisy, affected by shadows
```

---

## 2. Signal Extraction Process

### Step 1: Define Regions of Interest (ROI)
We extract signals from three facial regions:
```javascript
ROI_REGIONS = {
    forehead: {
        indices: [9, 10, 151, 337, 299, 333, 298, 301],
        weight: 0.5  // Most reliable region
    },
    leftCheek: {
        indices: [116, 117, 118, 123, 205, 206, 207, 213],
        weight: 0.25
    },
    rightCheek: {
        indices: [345, 346, 347, 352, 425, 426, 427, 436],
        weight: 0.25
    }
}
```

### Step 2: Extract RGB Values
For each frame:
1. Extract pixels within each ROI polygon
2. Calculate mean RGB values for each region
3. Focus on the **green channel** for PPG signal
4. Weight and combine signals from all ROIs

### Step 3: Build PPG Buffer
```javascript
// Store green channel values over time
ppgBuffer = [g1, g2, g3, g4, ... gn]  // n frames
// Typical: 150 frames (5 seconds at 30 FPS)
```

---

## 3. Signal Processing

### Step 3a: Detrending
Remove slow drift in the signal caused by lighting changes or movement:
```javascript
// Remove linear trend
signal = signal - linearRegression(signal)
```

### Step 3b: Bandpass Filtering
Apply Butterworth filter to isolate heart rate frequencies:
- **Passband**: 0.5 Hz to 3.0 Hz
- **Why**: Human heart rate is typically 30-180 BPM (0.5-3 Hz)
- Removes high-frequency noise and low-frequency drift

### Step 3c: Signal Normalization
```javascript
// Zero-mean and unit variance
mean = average(signal)
std = standardDeviation(signal)
normalizedSignal = (signal - mean) / std
```

---

## 4. Heart Rate Detection

### Method 1: Fast Fourier Transform (FFT)
Convert time-domain signal to frequency domain:

```javascript
// Perform FFT on the processed signal
fftResult = FFT(normalizedSignal)

// Calculate power spectrum
powerSpectrum = |fftResult|²

// Find dominant frequency in HR range (0.5-3.0 Hz)
peakFrequency = findPeakInRange(powerSpectrum, 0.5, 3.0)

// Convert to BPM
heartRate = peakFrequency * 60
```

### Method 2: Peak Detection (for HRV)
Find individual heartbeats in the time-domain signal:

```javascript
// Find peaks (heartbeats) in the signal
threshold = mean + 0.5 * standardDeviation
minDistance = 0.5 seconds  // Max HR = 120 BPM
peaks = findPeaks(signal, threshold, minDistance)
```

---

## 5. Heart Rate Variability (HRV) Calculation

### What is HRV?
HRV measures the variation in time between heartbeats. Higher HRV generally indicates:
- Better cardiovascular fitness
- Lower stress
- Better autonomic nervous system balance

### RMSSD Calculation
Root Mean Square of Successive Differences (most common HRV metric):

```javascript
// 1. Calculate R-R intervals (time between peaks)
rrIntervals = []
for (i = 1; i < peaks.length; i++) {
    interval = peaks[i].time - peaks[i-1].time
    rrIntervals.push(interval * 1000)  // Convert to milliseconds
}

// 2. Filter outliers (physiologically invalid intervals)
validIntervals = rrIntervals.filter(rr =>
    rr > 300 && rr < 2000  // 30-200 BPM range
)

// 3. Calculate successive differences
differences = []
for (i = 1; i < validIntervals.length; i++) {
    diff = validIntervals[i] - validIntervals[i-1]
    differences.push(diff)
}

// 4. Calculate RMSSD
squaredDiffs = differences.map(d => d * d)
meanSquaredDiff = average(squaredDiffs)
RMSSD = Math.sqrt(meanSquaredDiff)

// 5. Clamp to reasonable range
HRV = clamp(RMSSD, 15, 100)  // milliseconds
```

### Normal HRV Ranges (RMSSD):
- **Healthy adults**: 20-80 ms
- **Athletes**: 50-100 ms
- **Stressed/Unfit**: 10-30 ms
- **Age factor**: Decreases ~3-5% per decade

---

## 6. Quality Metrics

### Signal-to-Noise Ratio (SNR)
```javascript
signalPower = powerAtPeakFrequency
noisePower = averagePowerOutsidePeak
SNR = 10 * log10(signalPower / noisePower)  // in dB
```

### Confidence Calculation
```javascript
confidence = 0
confidence += SNR > 3 ? 25 : 0           // Good SNR
confidence += peakProminence > 0.5 ? 25 : 0  // Clear peak
confidence += validRRCount > 10 ? 25 : 0     // Enough beats
confidence += motionScore < 0.3 ? 25 : 0     // Low motion
```

---

## 7. Visual Flow Diagram

```
Camera Frame
    ↓
Extract Face Landmarks (468 points)
    ↓
Define ROI Polygons (forehead, cheeks)
    ↓
Extract Green Channel from ROIs
    ↓
Build Time Series (PPG Buffer)
    ↓
    ├─→ Detrend Signal
    ↓
    ├─→ Bandpass Filter (0.5-3 Hz)
    ↓
    ├─→ Normalize Signal
    ↓
    ├─────────────────┬────────────────┐
    ↓                 ↓                ↓
  FFT Analysis    Peak Detection    Quality Check
    ↓                 ↓                ↓
Heart Rate        RR Intervals      Confidence
 (BPM)               ↓
                Calculate HRV
                  (RMSSD)
```

---

## 8. Challenges & Solutions

### Challenge: Motion Artifacts
**Solution**:
- Use face tracking to compensate for movement
- Weight regions based on stability
- Reject frames with excessive motion

### Challenge: Lighting Changes
**Solution**:
- Detrending removes slow variations
- Bandpass filtering removes DC component
- Normalize by local statistics

### Challenge: Low Signal Quality
**Solution**:
- Use multiple ROIs and weight by quality
- Require minimum SNR before displaying results
- Show confidence levels to user

---

## 9. Actual Code Implementation

Here's the simplified version from our analyzer:

```javascript
// Extract PPG signal
extractPPGSignal(landmarks, videoFrame) {
    let weightedSum = 0;
    let totalWeight = 0;

    // Process each ROI
    for (const [region, config] of Object.entries(this.ROI_REGIONS)) {
        const pixels = this.extractROIPixels(videoFrame, landmarks, config.indices);
        const greenMean = pixels.reduce((sum, p) => sum + p.g, 0) / pixels.length;

        weightedSum += greenMean * config.weight;
        totalWeight += config.weight;
    }

    return weightedSum / totalWeight;
}

// Calculate heart rate from buffer
calculateHeartRate(ppgBuffer) {
    // 1. Detrend
    const detrended = this.detrendSignal(ppgBuffer);

    // 2. Filter
    const filtered = this.butterworthFilter(detrended, 0.5, 3.0);

    // 3. FFT
    const fft = this.performFFT(filtered);

    // 4. Find peak frequency
    const peakFreq = this.findPeakFrequency(fft, 0.5, 3.0);

    // 5. Convert to BPM
    return Math.round(peakFreq * 60);
}

// Calculate HRV
calculateHRV(ppgBuffer) {
    // 1. Find peaks
    const peaks = this.findPeaks(ppgBuffer);

    // 2. Calculate RR intervals
    const rrIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
        const interval = (peaks[i].index - peaks[i-1].index) / this.SAMPLE_RATE * 1000;
        if (interval > 300 && interval < 2000) {  // Valid range
            rrIntervals.push(interval);
        }
    }

    // 3. Calculate RMSSD
    const diffs = [];
    for (let i = 1; i < rrIntervals.length; i++) {
        diffs.push(rrIntervals[i] - rrIntervals[i-1]);
    }

    const squaredDiffs = diffs.map(d => d * d);
    const meanSquared = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const rmssd = Math.sqrt(meanSquared);

    // 4. Clamp to reasonable range
    return Math.max(15, Math.min(100, rmssd));
}
```

---

## 10. Validation & Accuracy

### Typical Accuracy (compared to medical devices):
- **Heart Rate**: ±2-3 BPM under good conditions
- **HRV**: ±5-10 ms RMSSD
- **Requirements**:
  - Good lighting
  - Minimal movement
  - 5+ seconds of data

### Factors Affecting Accuracy:
1. **Lighting**: Consistent, bright lighting improves signal
2. **Motion**: Head movement adds noise
3. **Skin Tone**: Works across all skin tones but may need adjustment
4. **Camera Quality**: Higher FPS and resolution help
5. **Distance**: 30-100cm from camera is optimal

---

## References

### Classic Foundations:
1. **PPG Principle**: Verkruysse et al. (2008) - "Remote plethysmographic imaging using ambient light"
2. **Green Channel**: de Haan & Jeanne (2013) - "Robust pulse rate from chrominance-based rPPG"
3. **HRV Standards**: Task Force (1996) - "Heart rate variability: Standards of measurement"
4. **Signal Processing**: Wang et al. (2016) - "Algorithmic Principles of Remote PPG"

### Recent Research (2023-2024):
1. **Deep Learning Review** (2024): "Deep learning and remote photoplethysmography powered advancements in contactless physiological measurement"
   - Frontiers in Bioengineering: https://www.frontiersin.org/journals/bioengineering-and-biotechnology/articles/10.3389/fbioe.2024.1420100/full

2. **Comprehensive Review** (2024): "A comprehensive review of heart rate measurement using remote photoplethysmography and deep learning"
   - PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC12181896/

3. **Face Regions Study** (2025): "The role of face regions in remote photoplethysmography for contactless heart rate monitoring"
   - Nature npj Digital Medicine: https://www.nature.com/articles/s41746-025-01814-9
   - Key Finding: Forehead and cheeks provide best accuracy (MAE < 1.0 BPM with ML)

4. **Phase-Shifted Method** (2024): "Phase-shifted remote photoplethysmography for estimating heart rate and blood pressure from facial video"
   - ArXiv: https://arxiv.org/html/2401.04560v1

5. **HRV from Facial Video** (2023): "Robust Heart Rate Variability Measurement from Facial Videos"
   - MDPI Bioengineering: https://www.mdpi.com/2306-5354/10/7/851

6. **Transformer Architecture** (2024): "Remote physiological signal recovery with efficient spatio-temporal modeling"
   - Frontiers: https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2024.1428351/full

### State-of-the-Art Performance (2024):
- **Accuracy**: ±1-2 BPM under controlled conditions
- **Best ROIs**: Forehead (24.5% of studies), Full face (36.8%), Cheeks (21.7%)
- **ML vs Traditional**: Machine learning approaches achieve MAE < 1.0 BPM on some datasets
- **Challenges**: Motion artifacts and poor lighting remain key challenges

---

## Disclaimer

This is for educational and wellness purposes only. Not for medical diagnosis.
Actual medical-grade devices use specialized hardware (ECG, PPG sensors) for higher accuracy.

---

Last Updated: October 31, 2024