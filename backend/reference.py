"""
Reference cohort values, computed from the project's result spreadsheets:
  - results(control).xlsx           -> healthy control eyes (n=14)
  - Results(final 8 patients).xlsx  -> posterior uveitis patients
Used by the frontend to show where a new eye falls.
"""
CONTROL_REFERENCE = {
    "control": {
        "density": {"mean": 0.4351, "std": 0.0461, "n": 14},
        "asymmetry": {"mean": 19.58, "std": 6.92, "n": 14},
        "ampulla_mm": {"mean": 8.11, "std": 0.51, "n": 14},
        "diameter_mm": {"mean": 0.346, "std": 0.047, "n": 14},
        "brightness": {"1": 29.77, "2": 31.45, "3": 45.42, "4": 40.23},
    },
    "uveitis": {
        "density": {"mean": 0.3649, "std": 0.0360, "n": 8},
        "asymmetry": {"mean": 18.50, "std": 12.57, "n": 8},
        "ampulla_mm": {"mean": 8.28, "std": 0.59, "n": 9},
        "diameter_mm": {"mean": 0.399, "std": 0.043, "n": 8},
    },
    "source": "results(control).xlsx, Results(final 8 patients).xlsx",
}
