# Open Source Licenses & Documentation

## Camera Biomarker Analyzer - Open Source Components

This project uses the following open-source libraries and technologies. Below are the official documentation and license links:

---

## 1. MediaPipe Face Mesh
**Purpose:** Real-time face detection and 478 3D face landmarks (including iris tracking)
- **Official Documentation:** https://google.github.io/mediapipe/solutions/face_mesh.html
- **GitHub Repository:** https://github.com/google/mediapipe
- **License:** Apache License 2.0
- **License URL:** https://github.com/google/mediapipe/blob/master/LICENSE
- **NPM Package:** https://www.npmjs.com/package/@mediapipe/face_mesh
- **Research Paper:** https://arxiv.org/abs/1907.06724

### Key Features Used:
- Face detection and tracking
- 468 face landmarks + 10 iris landmarks (with refineLandmarks)
- Real-time performance on device

---

## 2. Face-API.js (Vladimir Mandic Fork)
**Purpose:** Age, gender, emotion, and expression detection
- **GitHub Repository:** https://github.com/vladmandic/human
- **NPM Package:** https://www.npmjs.com/package/@vladmandic/face-api
- **License:** MIT License
- **Original Project:** https://github.com/justadudewhohacks/face-api.js
- **Documentation:** https://vladmandic.github.io/face-api/

### Key Features Used:
- Age and gender prediction
- Facial expression recognition
- TinyFaceDetector model

---

## 3. Chart.js
**Purpose:** Data visualization for PPG signals, frequency spectrum, and heart rate trends
- **Official Documentation:** https://www.chartjs.org/docs/latest/
- **GitHub Repository:** https://github.com/chartjs/Chart.js
- **License:** MIT License
- **License URL:** https://github.com/chartjs/Chart.js/blob/master/LICENSE.md
- **NPM Package:** https://www.npmjs.com/package/chart.js

### Key Features Used:
- Line charts for signal visualization
- Real-time data updates
- Responsive canvas rendering

---

## 4. MediaPipe Camera Utils
**Purpose:** Camera access and frame processing utilities
- **Documentation:** https://google.github.io/mediapipe/solutions/hands#javascript-solution-api
- **NPM Package:** https://www.npmjs.com/package/@mediapipe/camera_utils
- **License:** Apache License 2.0
- **Part of MediaPipe:** https://github.com/google/mediapipe

---

## 5. MediaPipe Drawing Utils
**Purpose:** Drawing landmarks and connections on canvas
- **NPM Package:** https://www.npmjs.com/package/@mediapipe/drawing_utils
- **License:** Apache License 2.0
- **Part of MediaPipe:** https://github.com/google/mediapipe

---

## 6. Material Icons (Google Fonts)
**Purpose:** UI icons throughout the application
- **Official Site:** https://fonts.google.com/icons
- **Documentation:** https://developers.google.com/fonts/docs/material_icons
- **GitHub:** https://github.com/google/material-design-icons
- **License:** Apache License 2.0
- **License URL:** https://github.com/google/material-design-icons/blob/master/LICENSE

---

## Research & Scientific References

### PPG (Photoplethysmography) for Heart Rate Detection
- **Principle:** Remote PPG using facial video
- **Key Paper:** "Remote heart rate measurement using low-cost RGB face video: a technical literature review" (2016)
- **Link:** https://link.springer.com/article/10.1007/s11704-016-6243-6
- **Alternative:** https://www.researchgate.net/publication/306285292_Remote_heart_rate_measurement_using_low-cost_RGB_face_video_A_technical_literature_review
- **Method:** Green channel extraction from facial ROIs

### Eye Aspect Ratio (EAR) for Blink Detection
- **Original Paper:** "Real-Time Eye Blink Detection using Facial Landmarks" by Soukupová & Čech (2016)
- **Paper Link:** https://www.semanticscholar.org/paper/Real-Time-Eye-Blink-Detection-using-Facial-Soukupov%C3%A1-Cech/4fa1ba3531219ca8c39d8749160faf1a877f2ced
- **Formula:** EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
- **Implementation:** https://github.com/pathak-ashutosh/Eye-blink-detection

### Heart Rate Variability (HRV) Calculation
- **Standard:** RMSSD (Root Mean Square of Successive Differences)
- **Reference:** "Heart Rate Variability: Standards of Measurement, Physiological Interpretation and Clinical Use" (1996)
- **Link:** https://www.ahajournals.org/doi/10.1161/01.CIR.93.5.1043
- **Full Text:** https://www.ahajournals.org/doi/pdf/10.1161/01.CIR.93.5.1043

### Iris Tracking for Gaze Detection
- **MediaPipe Iris Documentation:** https://github.com/google/mediapipe/blob/master/docs/solutions/iris.md
- **Alternative Documentation:** https://chuoling.github.io/mediapipe/solutions/iris.html
- **TensorFlow Blog:** https://blog.tensorflow.org/2020/11/iris-landmark-tracking-in-browser-with-MediaPipe-and-TensorFlowJS.html
- **Google Developers:** https://developers.google.com/mediapipe/solutions/vision/face_landmarker
- **Research Paper:** "Attention Mesh: High-fidelity Face Mesh Prediction in Real-time" - https://arxiv.org/abs/2006.10962

---

## Privacy & Data Protection

### GDPR Compliance
- **Principle:** All processing happens locally in the browser
- **No data collection:** No server uploads, no cookies (except session storage)
- **Reference:** https://gdpr.eu/

### CCPA Compliance
- **California Consumer Privacy Act:** https://oag.ca.gov/privacy/ccpa
- **Compliance:** No personal information collected or sold

### BIPA Compliance
- **Biometric Information Privacy Act (Illinois):** https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004
- **Compliance:** Explicit consent required, no biometric data stored

---

## Algorithm Implementation References

### Butterworth Filter (Signal Processing)
- **Purpose:** Noise reduction in PPG signal
- **Reference:** Digital Signal Processing by Oppenheim & Schafer
- **Implementation:** 2nd order, 0.5-3 Hz bandpass

### Fast Fourier Transform (FFT)
- **Purpose:** Frequency domain analysis for heart rate
- **Algorithm:** Cooley-Tukey FFT
- **Reference:** https://en.wikipedia.org/wiki/Fast_Fourier_transform

### Respiratory Rate Detection
- **Method:** Low-frequency component analysis of PPG
- **Range:** 0.15-0.4 Hz (9-24 breaths/min)
- **Reference:** "Respiratory rate extraction from pulse oximeter and electrocardiographic recordings" - https://pubmed.ncbi.nlm.nih.gov/22084049/

---

## Browser APIs Used

### getUserMedia API
- **Documentation:** https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- **Specification:** https://www.w3.org/TR/mediacapture-streams/

### Canvas API
- **Documentation:** https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **Used for:** Drawing overlays, image processing

### RequestAnimationFrame
- **Documentation:** https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
- **Used for:** Smooth animation and frame processing

---

## License Summary

| Component | License | Commercial Use | Attribution Required |
|-----------|---------|---------------|---------------------|
| MediaPipe | Apache 2.0 | ✅ Yes | ✅ Yes |
| Face-API.js | MIT | ✅ Yes | ✅ Yes |
| Chart.js | MIT | ✅ Yes | ✅ Yes |
| Material Icons | Apache 2.0 | ✅ Yes | ❌ No |

---

## Attribution Notice

When using this application or its source code, please include:

```
This application uses:
- MediaPipe by Google (Apache 2.0)
- Face-API.js by Vladimir Mandic (MIT)
- Chart.js (MIT)
- Material Icons by Google (Apache 2.0)
```

---

## Source Code

The complete source code for this implementation is available at:
- **HTML:** analyzer-full.html
- **JavaScript:** analyzer-full.js
- **No backend required** - fully client-side implementation

---

## Contact & Support

For questions about the implementation:
- **Developer:** Alexei - DevEx at Sahha
- **Organization:** https://sahha.ai
- **Implementation Site:** https://fivelidz.com/projects/camera-biomarkers/

---

Last Updated: October 31, 2024