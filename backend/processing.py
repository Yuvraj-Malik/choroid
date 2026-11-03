"""
Image-processing pipeline ported from the Eye Project notebooks:
  Final_Registration.ipynb, Choroidal_Outflow.ipynb, Densitometry1.ipynb,
  diameter.ipynb, ampulla distance.ipynb

All analysis runs on a 4000x4000 grayscale "registered image"
(ICGA minus aligned FFA), exactly as in the original notebooks.
"""
import math

import cv2
import numpy as np

SIZE = 4000
# Pixel -> mm factor used in diameter.ipynb: (px * 2.54) / 96
DEFAULT_MM_PER_PX = 2.54 / 96


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def to_gray(img: np.ndarray) -> np.ndarray:
    if img.ndim == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img


def resize_square(img: np.ndarray, size: int = SIZE) -> np.ndarray:
    """Scale to fit and centre-crop/pad to size x size (Final_Registration.ipynb)."""
    h, w = img.shape[:2]
    if (h, w) == (size, size):
        return img
    scale = size / max(h, w)
    resized = cv2.resize(img, (int(round(w * scale)), int(round(h * scale))), interpolation=cv2.INTER_AREA)
    out = np.zeros((size, size) + img.shape[2:], dtype=img.dtype)
    rh, rw = resized.shape[:2]
    y0, x0 = (size - rh) // 2, (size - rw) // 2
    out[y0:y0 + rh, x0:x0 + rw] = resized
    return out


def quadrants(img: np.ndarray, origin=None):
    """Split around origin (x, y). Q1 top-right, Q2 top-left, Q3 bottom-left, Q4 bottom-right."""
    h, w = img.shape[:2]
    ox, oy = origin if origin is not None else (w // 2, h // 2)
    ox, oy = int(ox), int(oy)
    return {
        1: img[:oy, ox:],
        2: img[:oy, :ox],
        3: img[oy:, :ox],
        4: img[oy:, ox:],
    }


def thumbnail(img: np.ndarray, size: int = 1000) -> np.ndarray:
    h, w = img.shape[:2]
    s = size / max(h, w)
    return cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)


# --------------------------------------------------------------------------
# 1. Registration
# --------------------------------------------------------------------------
def register(icga: np.ndarray, ffa: np.ndarray, angle: float = 0.0, tx: float = 0.0, ty: float = 0.0,
             scale: float = 1.0):
    """Rotate/translate/scale the FFA onto the ICGA and subtract (ICGA - FFA)."""
    icga = resize_square(to_gray(icga))
    ffa = resize_square(to_gray(ffa))
    h, w = ffa.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, scale)
    m[0, 2] += tx
    m[1, 2] += ty
    aligned = cv2.warpAffine(ffa, m, (w, h))
    registered = cv2.subtract(icga, aligned)
    # Colour overlay for visual alignment: ICGA magenta, FFA green
    overlay = np.dstack([icga, aligned, icga])
    return registered, overlay


# --------------------------------------------------------------------------
# 2. Choroidal outflow asymmetry
# --------------------------------------------------------------------------
def choroidal_outflow(gray: np.ndarray):
    """
    Img_final = Img * Img_local * Img_global, quadrant mean brightness,
    asymmetry = max - min.  (In the notebook the uint8 multiply of two 0/255
    masks wraps to 0/1, so it acts as a logical AND mask; reproduced here.)
    """
    img = cv2.medianBlur(gray, 5)
    _, th_global = cv2.threshold(img, 30, 255, cv2.THRESH_BINARY)
    th_local = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 55, 5)
    keep = (th_global > 0) & (th_local > 0)
    final = (gray * keep).astype(np.uint8)
    roi = roi_mask(gray)

    # brightness = sum(quadrant pixels) / ROI pixels in that quadrant (as in notebook)
    brightness = {}
    for (q, fq), mq in zip(quadrants(final).items(), quadrants(roi).values()):
        brightness[q] = float(fq.sum(dtype=np.int64)) / max(1, int(np.count_nonzero(mq)))
    asym = max(brightness.values()) - min(brightness.values())

    vis = cv2.applyColorMap(final, cv2.COLORMAP_INFERNO)
    cnts, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(vis, cnts, -1, (210, 210, 210), 6)
    h, w = gray.shape
    cv2.line(vis, (w // 2, 0), (w // 2, h), (255, 255, 255), 4)
    cv2.line(vis, (0, h // 2), (w, h // 2), (255, 255, 255), 4)
    return {
        "brightness": brightness,
        "asymmetry": asym,
        "max_quadrant": max(brightness, key=brightness.get),
        "min_quadrant": min(brightness, key=brightness.get),
    }, vis


# --------------------------------------------------------------------------
# 3. Densitometry
# --------------------------------------------------------------------------
def roi_mask(gray: np.ndarray, factor: int = 4) -> np.ndarray:
    """Region-of-interest mask, same recipe as the notebooks: inverted adaptive
    gaussian threshold -> Otsu -> long chain of closings/openings.
    Run at 1/factor resolution (iterations scaled) for speed, then upscaled."""
    img = cv2.medianBlur(gray, 5)
    th = cv2.bitwise_not(cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                               cv2.THRESH_BINARY, 55, 5))
    h, w = gray.shape
    s = cv2.resize(th, (w // factor, h // factor), interpolation=cv2.INTER_AREA)
    _, m = cv2.threshold(cv2.GaussianBlur(s, (5, 5), 0), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    E = lambda k: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    R = lambda k: cv2.getStructuringElement(cv2.MORPH_RECT, (k, k))
    C, O = cv2.MORPH_CLOSE, cv2.MORPH_OPEN
    for op, se, it in [(C, E(9), 40), (C, E(9), 15), (C, R(7), 20), (O, E(5), 25),
                       (O, R(5), 15), (O, E(5), 25), (O, R(5), 15), (O, E(5), 20)]:
        m = cv2.morphologyEx(m, op, se, iterations=max(1, it // factor))
    return cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)


def densitometry(gray: np.ndarray):
    """Density = W / (B_ROI + W), reproducing Densitometry1.ipynb:
    binarised = inverted adaptive-mean threshold (block 71, C 3);
    B_ROI = black pixels in image - black pixels outside ROI mask;
    W = white pixels (notebook counts them over the whole image).
    `density_strict_roi` counts only pixels inside the ROI."""
    img = cv2.medianBlur(gray, 5)
    binar = cv2.bitwise_not(
        cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 71, 3))
    mask = roi_mask(gray)
    inside = mask > 0

    total = binar.size
    black_all = int(np.sum(binar == 0))
    black_outside = int(np.sum(~inside))  # notebook: np.sum(mask == 0)
    black_roi = black_all - black_outside
    white = int(np.count_nonzero(binar))
    density = white / max(1, black_roi + white)
    white_roi = int(np.sum((binar > 0) & inside))
    density_strict = white_roi / max(1, int(inside.sum()))

    per_q = {}
    for q, (b, m) in enumerate(zip(quadrants(binar).values(), quadrants(mask).values()), start=1):
        ins = m > 0
        per_q[q] = float(np.sum((b > 0) & ins) / max(1, np.sum(ins)))

    vis = cv2.cvtColor(binar, cv2.COLOR_GRAY2BGR)
    vis[~inside] = (vis[~inside] * 0.25).astype(np.uint8)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(vis, cnts, -1, (210, 210, 210), 6)

    return {
        "density": density,
        "density_strict_roi": density_strict,
        "per_quadrant": per_q,
        "pixels": {"total": total, "black_roi": black_roi, "white": white, "white_roi": white_roi,
                   "black_outside": black_outside},
    }, vis


# --------------------------------------------------------------------------
# 4. Choroidal vessel diameter
# --------------------------------------------------------------------------
def _segment_vessels(q: np.ndarray):
    _, fov = cv2.threshold(q, 0, 255, cv2.THRESH_BINARY)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fov = cv2.morphologyEx(fov, cv2.MORPH_CLOSE, k, iterations=11)
    fov = cv2.morphologyEx(fov, cv2.MORPH_OPEN, k, iterations=7)

    clahe = cv2.createCLAHE(clipLimit=3, tileGridSize=(9, 9))
    g_cl = cv2.medianBlur(clahe.apply(cv2.bitwise_not(q)), 5)
    bg = cv2.GaussianBlur(g_cl, (55, 55), 0)
    norm = np.float32(bg) - np.float32(g_cl)
    norm[norm < 0] = 0
    _, t = cv2.threshold(norm, 18, 255, cv2.THRESH_BINARY)
    t = np.uint8(t)

    th = t.copy()
    cnts, _ = cv2.findContours(t, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    for c in cnts:
        if cv2.contourArea(c) < 400:
            cv2.drawContours(th, [c], 0, 0, -1)
    th = np.uint8(th * (fov / 255))
    return th


def vessel_maps(gray: np.ndarray):
    """Full-image segmentation, distance map and centreline (computed per quadrant
    like diameter.ipynb, then stitched back together)."""
    h, w = gray.shape
    oy, ox = h // 2, w // 2
    offsets = {1: (0, ox), 2: (0, 0), 3: (oy, 0), 4: (oy, ox)}
    seg = np.zeros_like(gray)
    for qn, q in quadrants(gray).items():
        y0, x0 = offsets[qn]
        seg[y0:y0 + q.shape[0], x0:x0 + q.shape[1]] = _segment_vessels(q)
    dist = cv2.distanceTransform(seg, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    skel = cv2.ximgproc.thinning(seg)
    return seg, dist, skel


def vessel_diameter(gray: np.ndarray, mm_per_px: float = DEFAULT_MM_PER_PX, picks: dict | None = None,
                    maps=None):
    """
    Per quadrant:
      prominent_mm  - automatic estimate: 99th percentile of 2*distance along the
                      centreline (the widest vessels, ignoring blob outliers)
      max_mm        - absolute maximum, as printed by diameter.ipynb
      mean_mm       - mean vessel width along the centreline
      picked_mm     - width at the vessel the user clicked (the notebook's manual
                      'select the vessel' step), if a point was given
    """
    seg, dist, skel = maps if maps is not None else vessel_maps(gray)
    h, w = gray.shape
    oy, ox = h // 2, w // 2
    results = {}
    for qn, (dq, sq) in enumerate(zip(quadrants(dist).values(), quadrants(skel).values()), start=1):
        along = dq[sq > 0] * 2 * mm_per_px
        results[qn] = {
            "prominent_mm": float(np.percentile(along, 99)) if along.size else 0.0,
            "max_mm": float(dq.max() * 2 * mm_per_px),
            "mean_mm": float(along.mean()) if along.size else 0.0,
            "picked_mm": None,
            "picked_point": None,
        }

    for q, pt in (picks or {}).items():
        if pt is None:
            continue
        x, y = int(pt[0]), int(pt[1])
        r = 40  # search window (px) around the click for the vessel centre
        win = dist[max(0, y - r):y + r, max(0, x - r):x + r]
        if win.size and win.max() > 0:
            _, mv, _, mp = cv2.minMaxLoc(win)
            results[int(q)]["picked_mm"] = float(2 * mv * mm_per_px)
            results[int(q)]["picked_point"] = [max(0, x - r) + mp[0], max(0, y - r) + mp[1]]

    vis = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR) // 2
    vis[seg > 0] = (60, 220, 120)
    vis[cv2.dilate(skel, np.ones((3, 3), np.uint8)) > 0] = (40, 120, 255)
    for r in results.values():
        if r["picked_point"]:
            cv2.circle(vis, tuple(r["picked_point"]), 45, (0, 230, 255), 10)
    cv2.line(vis, (ox, 0), (ox, h), (255, 255, 255), 4)
    cv2.line(vis, (0, oy), (w, oy), (255, 255, 255), 4)

    def avg(key):
        vals = [r[key] for r in results.values() if r[key] is not None]
        return float(np.mean(vals)) if vals else None

    return {
        "per_quadrant": results,
        "average_prominent_mm": avg("prominent_mm"),
        "average_picked_mm": avg("picked_mm"),
    }, vis


# --------------------------------------------------------------------------
# 5. Vortex vein ampulla distance (user-picked points)
# --------------------------------------------------------------------------
def ampulla_distance(origin, ampullae: dict, mm_per_px: float = DEFAULT_MM_PER_PX):
    """Euclidean distance from optic nerve (origin) to each quadrant's ampulla."""
    ox, oy = origin
    out = {}
    for q, pt in ampullae.items():
        if pt is None:
            continue
        d_px = math.hypot(pt[0] - ox, pt[1] - oy)
        out[int(q)] = {"px": d_px, "mm": d_px * mm_per_px}
    vals = [v["mm"] for v in out.values()]
    return {
        "per_quadrant": out,
        "average_mm": float(np.mean(vals)) if vals else None,
        "std_mm": float(np.std(vals, ddof=1)) if len(vals) > 1 else None,
    }


def draw_ampulla(gray, origin, ampullae):
    vis = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    ox, oy = map(int, origin)
    h, w = gray.shape
    cv2.line(vis, (ox, 0), (ox, h), (255, 255, 255), 4)
    cv2.line(vis, (0, oy), (w, oy), (255, 255, 255), 4)
    for q, pt in ampullae.items():
        if pt is None:
            continue
        p = (int(pt[0]), int(pt[1]))
        cv2.line(vis, (ox, oy), p, (0, 200, 255), 10)
        cv2.circle(vis, p, 35, (0, 200, 255), -1)
        cv2.putText(vis, f"Q{q}", (p[0] + 50, p[1]), cv2.FONT_HERSHEY_SIMPLEX, 5, (0, 200, 255), 10)
    cv2.circle(vis, (ox, oy), 45, (80, 80, 255), -1)
    return vis
