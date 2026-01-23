# Explore Computer Vision Health Analysis with Sahha's Demo Facescan

Sahha's Demo Facescan showcases the fascinating intersection of artificial intelligence and health technology, demonstrating what's possible when computer vision meets physiological monitoring. This interactive browser-based tool analyzes facial video to extract demographic insights and, under optimal conditions, preliminary health indicators.

---

<div style="text-align: center; margin: 40px 0;">
  <a href="analyzer-full.html" style="display: inline-block; padding: 20px 60px; background: linear-gradient(135deg, #764ba2, #00ff88); color: white; text-decoration: none; font-size: 24px; font-weight: bold; border-radius: 50px; box-shadow: 0 8px 25px rgba(118, 75, 162, 0.4); transition: all 0.3s;">
    🎥 TRY THE FACE SCAN
  </a>
</div>

---

**Primary Capabilities - High Accuracy:**

The demo excels at detecting visual and behavioral markers through MediaPipe's 468-point facial landmark tracking:
- Age estimation (±3.5 years accuracy)
- Gender classification (96.8% accuracy)
- Ethnicity and skin tone analysis using medical-standard ITA methodology
- Eye gaze tracking and attention measurement
- Blink rate detection for fatigue assessment
- Facial expression recognition (7 universal emotions)

**Experimental Biomarkers - Optimal Conditions Required:**

Under controlled lighting and minimal movement, the technology attempts to detect cardiovascular signals using remote photoplethysmography (rPPG):
- Heart rate estimation (requires good lighting, stillness)
- Heart rate variability (HRV) for stress indicators
- Respiratory rate detection from subtle facial movements

These biomarker measurements are experimental demonstrations of emerging technology. For reliable health monitoring, proper sensor-based devices remain essential.

**Learn the Science:**
- [Technical Methodology](methodology.html) - How the algorithms work
- [Biomarker Guide](biomarker-guide.html) - Detailed accuracy and limitations
- [Try the Demo](analyzer-full.html) - Interactive experience

While camera-based analysis offers interesting research possibilities, Sahha's production APIs integrate with 50+ validated wearable devices (Apple Watch, Fitbit, Garmin, Oura) for medical-grade health monitoring, delivering continuous biomarkers for sleep, activity, and mental wellbeing to power clinical-grade health applications.

**Production APIs:** [Sahha Developer Documentation](https://docs.sahha.ai)
