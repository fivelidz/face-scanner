# Face Scanner

Camera-based biomarker analyzer using facial analysis — estimates **heart rate, HRV, stress and wellness metrics** from ordinary webcam video via **remote photoplethysmography (rPPG)**.

## How it works

Tiny changes in skin colour caused by blood-volume pulses are extracted from face video, filtered and frequency-analysed to derive pulse rate and heart-rate variability. The full signal-processing pipeline and its limits are documented in [`HEART_RATE_HRV_METHODOLOGY.md`](HEART_RATE_HRV_METHODOLOGY.md).

## Run it

Static site — no build step:

```bash
python3 -m http.server 8080
# open http://localhost:8080/analyzer-full.html
```

Allow camera access when prompted. All processing stays on-device; no video leaves the browser.

## Contents

| File | Purpose |
|---|---|
| `analyzer-full.html` / `analyzer-full.js` | Main analyzer UI |
| `mobile-analyzer.html` | Phone-friendly version |
| `methodology.html` · `HEART_RATE_HRV_METHODOLOGY.md` | rPPG methodology deep-dive |
| `biomarker-guide.html` | What each metric means |
| `accuracy.html` | Measured accuracy + confidence labels |
| `OPEN_SOURCE_LICENSES.md` | Third-party licenses |

## Disclaimer

Wellness estimates only — **not a medical device**. rPPG accuracy degrades with poor lighting, motion and compression. See `accuracy.html` for honest confidence labels.

## License

MIT — see [LICENSE](LICENSE).
