## NavigAid

A Route Analysis and Navigation Application for Pedestrian Safety in Boston.

NavigAid helps users find safe walking routes by analyzing route data, accessibility features, and potential hazards. The app is built with Expo for the frontend and FastAPI for the backend, with a Random Forest model powering route safety predictions.

## To start
```bash
cd NavigAid
npm install
```

## Add API key
You must have a .env file at the root with an open route service api key like this:

```bash
OPEN_ROUTE_SERVICE_API_KEY=your_key_here
BACKEND_URL=http://localhost:8000
```
## Running the backend
```bash
cd app/backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Try it out
```bash
cd ../../
npx expo start
```

Make sure you have Expo Go installed on your phone and scan the QR.
You should now see the app on your phone

## Model
The random forest model for the backend, data, and code can be found in this repo: https://github.com/Rayna-Yu/NavigAid-model
