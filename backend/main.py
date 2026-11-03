"""
Choroid Analyzer API (FastAPI)

Run:  uvicorn main:app --reload --port 8000
"""
import base64
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

import processing as P
from reference import CONTROL_REFERENCE

DATA = Path(__file__).parent / "data"
DATA.mkdir(exist_ok=True)

app = FastAPI(title="Choroid Analyzer API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# small in-memory caches (images are 4000x4000, so keep only a few)
_img_cache: "OrderedDict[str, np.ndarray]" = OrderedDict()
_vessel_cache: "OrderedDict[str, tuple]" = OrderedDict()


def _cache_put(cache, key, val, limit=6):
    cache[key] = val
    cache.move_to_end(key)
    while len(cache) > limit:
        cache.popitem(last=False)


def load(image_id: str) -> np.ndarray:
    if image_id in _img_cache:
        _img_cache.move_to_end(image_id)
        return _img_cache[image_id]
    path = DATA / f"{image_id}.png"
    if not path.exists():
        raise HTTPException(404, f"Image {image_id} not found")
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    _cache_put(_img_cache, image_id, img)
    return img


def save(img: np.ndarray) -> str:
    image_id = uuid.uuid4().hex[:12]
    cv2.imwrite(str(DATA / f"{image_id}.png"), img)
    _cache_put(_img_cache, image_id, img)
    return image_id


def b64(img: np.ndarray, size: int = 1000) -> str:
    ok, buf = cv2.imencode(".jpg", P.thumbnail(img, size), [cv2.IMWRITE_JPEG_QUALITY, 88])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


# --------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/reference")
def reference():
    return CONTROL_REFERENCE


@app.post("/api/images")
async def upload_image(file: UploadFile = File(...), kind: str = Form("registered")):
    """Upload FFA / ICGA / already-registered image. Stored as 4000x4000 grayscale."""
    raw = np.frombuffer(await file.read(), np.uint8)
    img = cv2.imdecode(raw, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise HTTPException(400, "Could not decode image")
    img = P.resize_square(img)
    image_id = save(img)
    return {"id": image_id, "kind": kind, "name": file.filename, "size": P.SIZE}


@app.get("/api/images/{image_id}")
def get_image(image_id: str, size: int = 1000):
    img = load(image_id)
    ok, buf = cv2.imencode(".jpg", P.thumbnail(img, size), [cv2.IMWRITE_JPEG_QUALITY, 90])
    return Response(buf.tobytes(), media_type="image/jpeg")


class RegisterReq(BaseModel):
    icga_id: str
    ffa_id: str
    angle: float = 0
    tx: float = 0  # pixels in 4000px space
    ty: float = 0
    scale: float = 1.0
    preview: bool = True


@app.post("/api/register")
def register(req: RegisterReq):
    icga, ffa = load(req.icga_id), load(req.ffa_id)
    if req.preview:
        # fast 1000px preview; translation scaled accordingly
        f = 1000 / P.SIZE
        ic = cv2.resize(icga, (1000, 1000), interpolation=cv2.INTER_AREA)
        ff = cv2.resize(ffa, (1000, 1000), interpolation=cv2.INTER_AREA)
        h, w = ff.shape
        m = cv2.getRotationMatrix2D((w / 2, h / 2), req.angle, req.scale)
        m[0, 2] += req.tx * f
        m[1, 2] += req.ty * f
        al = cv2.warpAffine(ff, m, (w, h))
        sub = cv2.subtract(ic, al)
        overlay = np.dstack([ic, al, ic])
        return {"overlay": b64(overlay), "registered": b64(sub)}

    registered, _ = P.register(icga, ffa, req.angle, req.tx, req.ty, req.scale)
    image_id = save(registered)
    return {"id": image_id, "registered": b64(registered)}


class AnalyzeReq(BaseModel):
    image_id: str
    mm_per_px: float = P.DEFAULT_MM_PER_PX
    origin: Optional[List[float]] = None  # optic nerve [x, y] in 4000px space
    ampullae: Dict[int, Optional[List[float]]] = Field(default_factory=dict)
    vessel_picks: Dict[int, Optional[List[float]]] = Field(default_factory=dict)
    metrics: List[str] = Field(default_factory=lambda: ["outflow", "density", "diameter", "ampulla"])


@app.post("/api/analyze")
def analyze(req: AnalyzeReq):
    gray = load(req.image_id)
    out, images = {}, {}

    if "outflow" in req.metrics:
        r, vis = P.choroidal_outflow(gray)
        out["outflow"], images["outflow"] = r, b64(vis)

    if "density" in req.metrics:
        r, vis = P.densitometry(gray)
        out["density"], images["density"] = r, b64(vis)

    if "diameter" in req.metrics:
        if req.image_id not in _vessel_cache:
            _cache_put(_vessel_cache, req.image_id, P.vessel_maps(gray), limit=3)
        r, vis = P.vessel_diameter(gray, req.mm_per_px, req.vessel_picks, _vessel_cache[req.image_id])
        out["diameter"], images["diameter"] = r, b64(vis)

    if "ampulla" in req.metrics and req.origin and any(req.ampullae.values()):
        out["ampulla"] = P.ampulla_distance(req.origin, req.ampullae, req.mm_per_px)
        images["ampulla"] = b64(P.draw_ampulla(gray, req.origin, req.ampullae))

    return {"results": out, "images": images, "mm_per_px": req.mm_per_px}
