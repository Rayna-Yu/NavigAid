# NavigAid

**Safer walking routes in Boston.** A React Native (Expo) app that compares pedestrian routes and scores them for safety using city infrastructure data and a Random Forest trained on historical pedestrian crash data.

## How it works

1. Pick a start and destination; walking routes come from OpenRouteService.
2. For points along each route, the app pulls nearby sidewalks, street lamps, trees, curb ramps, crosswalks, and speed limits from Boston's open GIS services.
3. A FastAPI backend scores each point with a calibrated Random Forest (separate day and night models) and ranks the routes.
4. Hazards such as narrow sidewalks, steep slopes, poor lighting, and high speed limits are flagged on the map.

## Model results

Described in the paper *NavigAid: A Route Analysis and Navigation Model for Pedestrian Safety Using Random Forest Algorithm* (Yu, Wang, Wu).

- Trained on 300k sampled Boston points matched to Vision Zero pedestrian crash records and city infrastructure data (10 m tolerance), with separate day and night models.
- Hold-out results on class-balanced data: accuracy 0.965 (day) / 0.969 (night), ROC AUC 0.991 / 0.994.
- Speed limit is the strongest predictor in both models, consistent with prior crash research.

**Stack:** Expo / React Native, TypeScript, turf.js, FastAPI, scikit-learn

**Code map:** `app/frontend/utils/` (feature extraction, hazard flags, scoring client) and `app/backend/main.py` (prediction API). Model training, data, and evaluation are in [NavigAid-model](https://github.com/Rayna-Yu/NavigAid-model).

## Run it

```bash
npm install
```

Create `.env` in the repo root (use your computer's LAN IP if testing on a phone):

```bash
OPEN_ROUTE_SERVICE_API_KEY=your_key_here
BACKEND_URL=http://<your-ip>:8000
```

Start the backend. It needs `day_model.pkl` and `night_model.pkl` in `app/backend/models/`. They are about 1.3 GB, so they aren't in the repo; build them from the model repo.

```bash
cd app/backend && pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Then, from the repo root, run `npx expo start` and scan the QR code with Expo Go.

## Limitations

Scores reflect historical crash patterns, not live conditions. Reported metrics are on a class-balanced (undersampled) hold-out set, so they don't reflect real-world crash base rates. Coverage is Boston only. CORS is open for development.
