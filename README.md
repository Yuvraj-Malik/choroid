# Choroid Analyzer

A web app for measuring choroidal biomarkers on ultra-widefield angiography in
posterior uveitis. It registers an ICGA and FFA pair, lets you mark anatomical
landmarks, and reports four measurements per eye against healthy-control and
uveitis reference ranges.

It turns the image-processing notebooks from our posterior uveitis study into a
tool that anyone on the team can run without editing code cells or clicking in
OpenCV windows.

## What it measures

| Biomarker | How | Input needed |
|---|---|---|
| **Choroidal outflow asymmetry** | ICGA × adaptive threshold × global threshold; mean brightness per quadrant inside the region of interest; asymmetry = brightest − dimmest quadrant | None |
| **Choroidal vessel density** | Adaptive-mean binarisation; density = white / (black in ROI + white) | None |
| **Prominent vessel diameter** | CLAHE, background subtraction, distance transform, Zhang–Suen centreline | Optional vessel pick per quadrant |
| **Vortex vein ampulla distance** | Euclidean distance from the optic nerve head to each quadrant's ampulla | Optic nerve head + 4 ampullae |

Quadrants follow the study convention: Q1 superotemporal (top right), then
anticlockwise to Q4 (bottom right), split at the optic nerve head (ampulla) or
the image centre (other metrics).

## Workflow

1. **Images**: upload an ICGA + FFA pair, or a registered image directly.
2. **Registration**: rotate, shift and scale the FFA onto the ICGA with a live
   overlay; the app saves ICGA − FFA at 4000 × 4000 px.
3. **Landmarks**: click the optic nerve head, the ampullae and optional vessels
   (undo / redo with Ctrl+Z / Ctrl+Y).
4. **Results**: per-quadrant table, overlays for each measurement, comparison
   with the study cohorts, CSV / JSON export.

## Tech stack

- **Backend:** Python, FastAPI, OpenCV (contrib), NumPy
- **Frontend:** React 18, JavaScript, Tailwind CSS, Vite

```
.
├── backend/
│   ├── main.py          # REST API
│   ├── processing.py    # image-processing pipeline (ported from the notebooks)
│   ├── reference.py     # control / uveitis cohort reference values
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       └── components/  # Upload, Register, Landmark, Results steps
├── start-backend.bat
└── start-frontend.bat
```

## Getting started

Requirements: Python 3.10+ and Node.js 18+.

**Windows:** run `start-backend.bat`, then `start-frontend.bat`, and open
<http://localhost:5173>.

**Manual setup:**

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS / Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

```bash
# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

The frontend proxies `/api` to `localhost:8000`. Interactive API docs are at
<http://localhost:8000/docs>.

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/images` | Upload an image (`file`, `kind`); stored as 4000 × 4000 grayscale |
| `GET` | `/api/images/{id}` | JPEG preview (`?size=1000`) |
| `POST` | `/api/register` | Align FFA to ICGA (`angle`, `tx`, `ty`, `scale`); preview or save |
| `POST` | `/api/analyze` | Run measurements with optional landmarks and calibration |
| `GET` | `/api/reference` | Control and uveitis cohort reference values |

## Validation

Measurements were checked against the study's recorded results:

- **Outflow brightness** agrees closely (e.g. one control eye: 33.3 / 21.8 /
  52.1 / 37.5 vs. recorded 35.8 / 24.8 / 49.3 / 38.9). The original
  region-of-interest masks were tuned by hand per image, so exact matches are
  not expected.
- **Density** uses the notebook formula (0.423 vs. recorded 0.461 for the same
  eye). A strict ROI-only density is also reported.
- **Vessel diameter** in the study used manual vessel selection; the app gives
  an automatic 99th-percentile centreline width and the width at picked vessels.
- **Ampulla distance** is reported in pixels. The study's millimetre values were
  measured on a downscaled view, so set a calibrated mm / px before comparing
  millimetres.

## Data and privacy

No patient images or results are included in this repository. Uploaded images
are stored locally in `backend/data/`, which is git-ignored, and image and
spreadsheet files are ignored repo-wide. Use study IDs, not patient names, as
case IDs.

## Disclaimer

Research software. Not a medical device and not intended for clinical diagnosis.
