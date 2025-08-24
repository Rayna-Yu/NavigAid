from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
import pandas as pd


# Load your trained models
day_model = joblib.load("models/day_model.pkl")
night_model = joblib.load("models/night_model.pkl")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Replace with frontend URL in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Features(BaseModel):
    data: list
    is_night: bool = None

@app.post("/predict_route_safety")
def predict_route_safety(features: Features):
    X = np.array(features.data)
    model = night_model if features.is_night else day_model

    probs = model.predict_proba(X)[:, 1]
    print(probs)
    route_score = float(np.mean(probs))
    sum_probability = np.sum(probs)
    max_probability = np.max(probs)

    return {
        "route_safety_score": 1 - route_score, 
        "average_crash_probability": route_score,
        "sum_probability": sum_probability,
        "max_prob": max_probability,
    }
