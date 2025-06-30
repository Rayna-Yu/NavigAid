import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, LatLng } from 'react-native-maps';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import Constants from 'expo-constants';
import polyline from 'polyline';
import SettingsSheet from './components/settingsSheet';

const ORS_API_KEY = Constants.expoConfig?.extra?.OPEN_ROUTE_SERVICE_API_KEY;
const ROUTE_COLORS = ['#007AFF', '#ADD8E6'];

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}min`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function Main() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
  const [toCoords, setToCoords] = useState<LatLng | null>(null);
  const [routes, setRoutes] = useState<LatLng[][]>([]);
  const [routeSummaries, setRouteSummaries] = useState<{ distance: number; duration: number }[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid' | 'terrain'>('standard');
  const [hasRouted, setHasRouted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    async function fetchRoute() {
      if (!fromCoords || !toCoords) {
        setRoutes([]);
        setRouteSummaries([]);
        setSelectedRouteIndex(0);
        return;
      }

      try {
        const url = `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${ORS_API_KEY}`;
        const body = {
          coordinates: [
            [fromCoords.longitude, fromCoords.latitude],
            [toCoords.longitude, toCoords.latitude],
          ],
          alternative_routes: {
            target_count: 3,
            share_factor: 0.5,
            weight_factor: 2,
          },
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const decodedRoutes = data.routes.map((route: any) => {
            const encoded = route.geometry;
            const decoded = polyline.decode(encoded) as [number, number][];
            return decoded.map(([lat, lng]: [number, number]) => ({
              latitude: lat,
              longitude: lng,
            }));
          });

          const summaries = data.routes.map((route: any) => ({
            distance: route.summary.distance,
            duration: route.summary.duration,
          }));

          setRoutes(decodedRoutes);
          setRouteSummaries(summaries);
          setSelectedRouteIndex(0);
          setHasRouted(true);

          if (mapRef.current) {
            const allCoords = decodedRoutes.flat();
            mapRef.current.fitToCoordinates(allCoords, {
              edgePadding: { top: 300, bottom: 150, left: 50, right: 50 },
              animated: true,
            });
          }
        } else {
          setRoutes([]);
          setRouteSummaries([]);
          setSelectedRouteIndex(0);
        }
      } catch (e) {
        console.error('Route fetch error:', e);
        setRoutes([]);
        setRouteSummaries([]);
        setSelectedRouteIndex(0);
      }
    }

    fetchRoute();
  }, [fromCoords, toCoords]);

  useEffect(() => {
    if (!mapRef.current || hasRouted) return;

    const target = fromCoords || toCoords;
    if (target) {
      mapRef.current.animateToRegion(
        {
          ...target,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  }, [fromCoords, toCoords, hasRouted]);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType={mapType}
        initialRegion={{
          latitude: 42.3555,
          longitude: -71.0565,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {fromCoords && <Marker coordinate={fromCoords} title="From" />}
        {toCoords && <Marker coordinate={toCoords} title="To" />}

        {routes.map((routeCoords, i) => {
          if (i === selectedRouteIndex) return null;
          return (
            <Polyline
              key={`route-alt-${i}`}
              coordinates={routeCoords}
              strokeColor={ROUTE_COLORS[1]}
              strokeWidth={3}
              tappable
              onPress={() => setSelectedRouteIndex(i)}
            />
          );
        })}

        {routes[selectedRouteIndex] && (
          <Polyline
            key={`route-selected-${selectedRouteIndex}`}
            coordinates={routes[selectedRouteIndex]}
            strokeColor={ROUTE_COLORS[0]}
            strokeWidth={5}
            tappable
            onPress={() => setSelectedRouteIndex(selectedRouteIndex)}
          />
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
                setHasRouted(false);
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
                setHasRouted(false);
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

      <View style={styles.gearContainer}>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.gearButton}>
          <AntDesign name="setting" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {routeSummaries.length > 0 && (
        <ScrollView
          horizontal
          style={styles.routeSummaryContainer}
          contentContainerStyle={{ paddingHorizontal: 10 }}
          showsHorizontalScrollIndicator={false}
        >
          {routeSummaries.map((summary, i) => (
            <TouchableOpacity
              key={`summary-${i}`}
              style={[
                styles.routeSummary,
                {
                  borderColor: i === selectedRouteIndex ? ROUTE_COLORS[0] : '#ccc',
                  backgroundColor: i === selectedRouteIndex ? '#e6f0ff' : 'white',
                },
              ]}
              onPress={() => setSelectedRouteIndex(i)}
            >
              <Text style={styles.routeSummaryTitle}>
                {i === 0 ? 'Primary Route' : `Alt Route ${i}`}
              </Text>
              <Text>Distance: {formatDistance(summary.distance)}</Text>
              <Text>Time: {formatDuration(summary.duration)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        mapType={mapType}
        setMapType={setMapType}
      />
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
    zIndex: 10,
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
  routeSummaryContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    maxHeight: 130,
    zIndex: 11,
  },
  routeSummary: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderRadius: 15,
    padding: 10,
    marginHorizontal: 8,
    minWidth: 160,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  routeSummaryTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  gearContainer: {
    position: 'absolute',
    top: 260,
    right: 30,
    zIndex: 15,
  },
  gearButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 20,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
