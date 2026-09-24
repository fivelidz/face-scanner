# MODELS.md — every model this system uses, where each one lives, and why

Two face systems share this repo's family tree. They get confused with each other,
so this document accounts for **every neural network involved**, its location, its
license lineage, and its publication status.

---

## 1 · Models used by THIS repo (biomarker analyzer — works today)

The analyzer ships **no model binaries**; both are industry-standard models loaded
from CDN at runtime (Apache-2.0 / MIT, vendored by their npm packages):

| Model | Role | Source | License |
|---|---|---|---|
| **MediaPipe FaceMesh** (468-landmark) | face region tracking + ROI stabilization for rPPG signal extraction | `@mediapipe/face_mesh` via jsDelivr | Apache-2.0 |
| **face-api (vladmandic build)** ssd_mobilenetv1 / face_landmark_68 / age_gender_net | detection, alignment, auxiliary age/gender readout | `@vladmandic/face-api` 1.7.12 via jsDelivr (weights: `/model`) | MIT |

No video frame, model input, or result ever leaves the browser — inference is
fully client-side (see README privacy section).

## 2 · The Volkus demographic-scan models (the ones people ask about)

> **"Where is the volkus face scanning image model?"** — Here. These are the
> production ONNX weights of [volkus.net](https://volkus.net)'s on-device
> demographic-badge system (age band, gender, anti-spoofing). They are **not in
> this repository** — see §3 for why.

**Location:** private repo `volkus.net` → `assets/models/` (fp32 production set) and
`face-engine` → `models/` (int8 quantized variants), both on the Qalarc build hosts.

| File | Size | SHA-256 (first 16) | Role | Lineage |
|---|---|---|---|---|
| `age_regr_fp32.onnx` | 8.5M | `8fa46ccb639e98ed` | age regression head | uniface AgeGender family |
| `ageband_fp32.onnx` | 8.6M | `12dedb859f1e823f` | age-band classifier (badge buckets) | uniface demographics family |
| `age_fused_fp32.onnx` | 9.8M | `7bfd87fd9443ba20` | fused age (regr + band ensemble) | Qalarc ensemble of the two above |
| `gender_fp32.onnx` | 8.5M | `2ab4df2f46edf295` | gender classifier | uniface AgeGender family |
| `minifasnet_v2.onnx` | 1.7M | `b32929adc2d9c34b` | **liveness / anti-spoofing** (presentation-attack rejection — runs before any badge is issued) | MiniFASNet V2 (silent-face-anti-spoofing lineage, Apache-2.0 architecture) |
| `race_fp32.onnx` | 8.5M | `4cabb6fd49f250c8` | ethnicity readout (analysis-side only — **never published to badges or ads**) | FairFace family (research license) |
| `ageband_int8.onnx` (face-engine) | 2.4M | `ca43ddf00130ecff` | int8-quantized age band for low-end devices | quantized variant of above |
| `minifasnet_v2.onnx` (face-engine) | 1.7M | `b32929adc2d9c34b` | same liveness model, second deployment | identical binary (hash matches) |

Provenance note: the weights were provisioned via the
[uniface](https://github.com/yakhyo/uniface) model-store pattern
(SHA-256-verified lazy downloads). Volkus runs all inference **on-device** —
the models ship inside the app bundle; no face image or embedding is ever
uploaded (that is the product's core privacy claim, enforced by architecture).

## 3 · Why the binaries aren't on GitHub

The wrapper/tooling code is MIT, but **upstream weight licenses differ**: several
of these models derive from research-only or non-commercial releases (FairFace
lineage explicitly so). Until each binary's license is individually cleared —
or retrained replacements are produced — the weights stay in the private
deployment repos. The hashes above let anyone with repo access verify they have
the genuine production set.

## 4 · If you want to run the demographic pipeline yourself

The architecture is documented and reproducible with openly-downloadable weights:
detector (SCRFD/RetinaFace) → landmarks → `minifasnet_v2` liveness gate →
age/gender heads. The biomarker analyzer in this repo demonstrates the identical
browser-side ONNX/WebGL inference pattern (MediaPipe + face-api) you would use.
