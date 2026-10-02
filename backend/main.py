"""Backend LokerSus: melayani model dari notebook FakeJobDetector lewat FastAPI.

Jalankan lokal:  uvicorn main:app --reload
Dokumentasi API: http://127.0.0.1:8000/docs
"""
import os
import re
import string
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from scipy.sparse import csr_matrix, hstack
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

# ---------------------------------------------------------------
# Pengaturan (bisa diubah lewat environment variable)
# ---------------------------------------------------------------
MODEL_DIR = Path(os.getenv("MODEL_DIR", Path(__file__).parent / "models"))

# Threshold final dari notebook (FINAL_THRESHOLD). Di notebook tertulis 0.2698.
# Kalau mau presisi penuh, jalankan print(FINAL_THRESHOLD) di Colab lalu isi di sini.
THRESHOLD = float(os.getenv("THRESHOLD", "0.2698"))

# Asal frontend yang boleh akses. Saat deploy, ganti "*" dengan domain frontend kamu.
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# Di notebook, 7 fitur biner ini diisi 0 saat inference (lihat predict_job_posting).
# Ubah angka ini kalau kamu mau default lain, atau kirim nilainya dari frontend.
DEFAULT_BINARY = 0

# ---------------------------------------------------------------
# Preprocessing: HARUS sama persis dengan notebook
# ---------------------------------------------------------------
CUSTOM_STOPWORDS = {
    "experience", "work", "working", "team", "job", "jobs", "skills", "skill",
    "candidate", "company", "looking", "ability", "new", "year", "years",
    "business", "employee", "employees", "position", "role", "opportunity",
    "great", "good", "time", "need", "provide", "including", "required", "will", "must",
}
ALL_STOPWORDS = ENGLISH_STOP_WORDS.union(CUSTOM_STOPWORDS)


def clean_text(text: str) -> str:
    text = str(text).lower()
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"http\S+|www\.\S+", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\d+", "", text)
    text = text.translate(str.maketrans("", "", string.punctuation))
    text = re.sub(r"\s+", " ", text).strip()
    return " ".join(w for w in text.split() if w not in ALL_STOPWORDS)


def engineered_value(name: str, raw: str, cleaned: str, meta: dict) -> float:
    words = cleaned.split()
    if name == "uppercase_count":
        return sum(c.isupper() for c in raw)
    if name == "exclamation_count":
        return raw.count("!")
    if name == "question_count":
        return raw.count("?")
    if name == "word_count":
        return len(words)
    if name == "avg_word_length":
        return float(np.mean([len(w) for w in words])) if words else 0.0
    if name == "raw_word_count":
        return len(raw.split())
    value = meta.get(name)  # fitur biner (has_company_logo, dst.)
    return DEFAULT_BINARY if value is None else int(value)


# ---------------------------------------------------------------
# Load model sekali saat server start
# ---------------------------------------------------------------
state = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    state["model"] = joblib.load(MODEL_DIR / "trained_model.pkl")
    state["tfidf"] = joblib.load(MODEL_DIR / "tfidf_vectorizer.pkl")
    state["features"] = list(joblib.load(MODEL_DIR / "engineered_features.pkl"))
    yield


app = FastAPI(title="LokerSus API", version="1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class PredictIn(BaseModel):
    text: str = Field(min_length=20, max_length=20000, description="Teks lowongan kerja")
    # Opsional: info tambahan yang dipakai model saat training
    has_company_profile: Optional[bool] = None
    has_requirements: Optional[bool] = None
    has_benefits: Optional[bool] = None
    has_salary_range: Optional[bool] = None
    has_company_logo: Optional[bool] = None
    telecommuting: Optional[bool] = None
    has_questions: Optional[bool] = None


class PredictOut(BaseModel):
    label: str
    probability: float  # peluang lowongan palsu, 0 sampai 1
    real_probability: float
    risk_tier: str
    threshold: float
    assumed_defaults: List[str]  # fitur biner yang tidak dikirim dan diisi default
    reasons: List[str] = []


@app.get("/health")
def health():
    return {"status": "ok", "threshold": THRESHOLD}


@app.post("/predict", response_model=PredictOut)
def predict(body: PredictIn):
    raw = body.text
    cleaned = clean_text(raw)
    if not cleaned:
        raise HTTPException(422, "Teks tidak berisi kata yang bisa dianalisis (model hanya mengerti bahasa Inggris).")

    meta = body.model_dump()
    features = state["features"]
    values = [engineered_value(f, raw, cleaned, meta) for f in features]
    assumed = [f for f in features if f in meta and meta[f] is None]

    X = hstack([state["tfidf"].transform([cleaned]), csr_matrix([values])])
    model = state["model"]
    if hasattr(model, "predict_proba"):
        prob = float(model.predict_proba(X)[0][1])
    elif hasattr(model, "decision_function"):
        prob = float(1 / (1 + np.exp(-model.decision_function(X)[0])))
    else:
        prob = float(model.predict(X)[0])

    return PredictOut(
        label="FAKE" if prob >= THRESHOLD else "REAL",
        probability=round(prob, 4),
        real_probability=round(1 - prob, 4),
        risk_tier="Low Risk" if prob < 0.3 else "Medium Risk" if prob < 0.6 else "High Risk",
        threshold=THRESHOLD,
        assumed_defaults=assumed,
    )


# Opsional: kalau folder ../frontend ada, backend ikut menyajikan webnya di "/".
# Dengan begini cukup 1 deploy, dan di frontend isi API_URL dengan "/predict".
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
