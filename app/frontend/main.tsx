import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Keyboard } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import { AntDesign } from '@expo/vector-icons';
import { geocode } from './geocode';
import LocationAutocomplete from './locationAutocomplete';
import Constants from 'expo-constants';

const ORS_API_KEY = Constants.expoConfig?.extra?.OPEN_ROUTE_SERVICE_API_KEY;

type LatLng = {
  latitude: number;
  longitude: number;
};

export default function Main() {
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
  const [toCoords, setToCoords] = useState<LatLng | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);

  const fetchRoute = async () => {
    if (!fromCoords || !toCoords) return;

    try {
      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${ORS_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coordinates: [
              [fromCoords.longitude, fromCoords.latitude],
              [toCoords.longitude, toCoords.latitude],
            ],
          }),
        }
      );

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates.map((coord: [number, number]) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));
        setRouteCoords(coords);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  useEffect(() => {
    fetchRoute();
  }, [fromCoords, toCoords]);

  const onSubmit = async () => {
    Keyboard.dismiss();

    const fromLocation = await geocode(fromText);
    const toLocation = await geocode(toText);

    if (fromLocation && toLocation) {
      setFromCoords(fromLocation);
      setToCoords(toLocation);
    } else {
      alert('Could not geocode addresses');
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={
          fromCoords
            ? {
                latitude: fromCoords.latitude,
                longitude: fromCoords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }
            : {
                latitude: 42.3624,
                longitude: -71.0871,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
        }
      >
        {fromCoords && <Marker coordinate={fromCoords} title="From" />}
        {toCoords && <Marker coordinate={toCoords} title="To" />}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="blue" />
        )}
      </MapView>

      <View style={styles.searchBox}>
        <Text style={styles.label}>From:</Text>
        <LocationAutocomplete
          onSelect={({ latitude, longitude }) => {
            setFromCoords({ latitude, longitude });
          }}
        />

        <AntDesign name="arrowdown" size={24} color="black" style={styles.arrow} />

        <Text style={styles.label}>To:</Text>
        <LocationAutocomplete
          onSelect={({ latitude, longitude }) => {
            setToCoords({ latitude, longitude });
          }}
        />
      </View>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  searchBox: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  label: { fontWeight: '600', marginBottom: 4, fontSize: 18 },
  input: {
    backgroundColor: '#f2f2f2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  arrow: { 
    alignSelf: 'center' ,
    marginTop: 12,
  },
});
