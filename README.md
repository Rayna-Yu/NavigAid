## NavigAid

[insert tag line]

## To start
```bash
cd NavigAid
npm install
```

## Install dependencies
```bash
npx expo install react-native maps
npx expo install @expo/vector-icons
npm install react-native-autocomplete-input   
npm install @react-navigation/native
npx expo install react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated
npm install @react-navigation/native-stack
npm install polyline
```
You must have a .env file at the root with an open route service api key like this:

```bash
OPEN_ROUTE_SERVICE_API_KEY=your_key_here
```

## Try it out
```bash
npx expo start
```

Make sure you have expo go installed on your phone and scan the QR.
You should now see the app on your phone
