import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Keyboard } from 'react-native';
import MapView, { Marker, Polyline, LatLng } from 'react-native-maps';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import Constants from 'expo-constants';
import polyline from 'polyline';

const ORS_API_KEY = Constants.expoConfig?.extra?.OPEN_ROUTE_SERVICE_API_KEY;

export default function Main() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
  const [toCoords, setToCoords] = useState<LatLng | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);

  const mapRef = useRef<MapView>(null);

  // Fetch walking route when both coordinates are set
  useEffect(() => {
    async function fetchRoute() {
      if (!fromCoords || !toCoords) {
        setRouteCoords([]);
        return;
      }

      try {
        const url = `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${ORS_API_KEY}`;
        const body = {
          coordinates: [
            [fromCoords.longitude, fromCoords.latitude],
            [toCoords.longitude, toCoords.latitude],
          ],
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          // Decode the encoded polyline string
          const encoded = data.routes[0].geometry;
          const decoded = polyline.decode(encoded);

          // Map decoded points to LatLng objects
          const coords = decoded.map(([lat, lng]) => ({
            latitude: lat,
            longitude: lng,
          }));

          setRouteCoords(coords);

          if (mapRef.current) {
            mapRef.current.fitToCoordinates(coords, {
              edgePadding: { top: 300, bottom: 50, left: 50, right: 50 },
              animated: true,
            });
          }
        } else {
          setRouteCoords([]);
        }
      } catch (e) {
        console.error('Route fetch error:', e);
        setRouteCoords([]);
      }
    }

    fetchRoute();
  }, [fromCoords, toCoords]);

  // Adjust map view when locations change (for single points)
  useEffect(() => {
    if (!mapRef.current) return;

    if (fromCoords && toCoords) {
      // Map view is fitted already in fetchRoute after route loads
      return;
    } else if (fromCoords) {
      mapRef.current.animateToRegion(
        {
          ...fromCoords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    } else if (toCoords) {
      mapRef.current.animateToRegion(
        {
          ...toCoords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  }, [fromCoords, toCoords]);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {fromCoords && <Marker coordinate={fromCoords} title="From" />}
        {toCoords && <Marker coordinate={toCoords} title="To" />}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#007AFF" strokeWidth={6} />
        )}
      </MapView>

      <View style={styles.searchBox}>
        <Text style={styles.label}>From:</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('Search', {
              onSelect: (coords, label) => {
                setFromCoords(coords);
                setFromText(label);
              },
            })
          }
          style={styles.inputBox}
        >
          <Text style={fromText ? styles.inputText : styles.placeholderText}>
            {fromText || 'Start location'}
          </Text>
        </TouchableOpacity>

        <AntDesign name="arrowdown" size={24} color="black" style={styles.arrow} />

        <Text style={styles.label}>To:</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('Search', {
              onSelect: (coords, label) => {
                setToCoords(coords);
                setToText(label);
              },
            })
          }
          style={styles.inputBox}
        >
          <Text style={toText ? styles.inputText : styles.placeholderText}>
            {toText || 'Destination'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  label: {
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 18,
  },
  inputBox: {
    backgroundColor: '#f2f2f2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  inputText: {
    fontSize: 16,
    color: 'black',
  },
  placeholderText: {
    fontSize: 16,
    color: '#aaa',
  },
  arrow: {
    alignSelf: 'center',
  },
});
