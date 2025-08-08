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
import type { RootStackParamList } from '../../../App';
import Constants from 'expo-constants';
import polyline from 'polyline';
import SettingsSheet from './settingsSheet';
import { Flag } from '../types';
import { flagRoute } from '../utils/flagService';
import * as turf from '@turf/turf';


const ORS_API_KEY = Constants.expoConfig?.extra?.OPEN_ROUTE_SERVICE_API_KEY;
const ROUTE_COLORS = ['#007AFF', '#ADD8E6'];
const PROXIMITY_TOLERANCE_METERS = 10;

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

function iconForFlag(issue: string) {
  if (issue.includes('Poor sidewalk condition')) return { label: 'Damage', color: 'red' };
  if (issue.includes('Narrow sidewalk')) return { label: 'Narrow', color: 'purple' };
  if (issue.includes('Steep slope')) return { label: 'Steep', color: 'orange' };
  if (issue.includes('Poor lighting')) return { label: 'Lighting', color: 'gray' };
  if (issue.includes('High speed limit')) return {label: 'Speed', color: 'black' };
  if (issue.includes('Good shade')) return { label: 'Shade', color: 'green' }; 
  if (issue.includes('Near by pedestrian ramp')) return { label: 'Ramp', color: 'limegreen' };
  if (issue.includes('No sidewalk')) return { label: 'No sidewalk', color: 'yellow'};
  return { label: 'Issue', color: 'white' };
}

function computeScore(flags: Flag[]): number {
  let score = 0;
  flags.forEach(f => {
    if (f.issue.includes('No sidewalk')) score += 7;
    else if (f.issue.includes('Poor sidewalk condition')) score += 5;
    else if (f.issue.includes('High speed limit')) score += 5;
    else if (f.issue.includes('Steep slope')) score += 3;
    else if (f.issue.includes('Poor lighting')) score += 2;
    else if (f.issue.includes('Narrow sidewalk')) score += 2;
    else if (f.issue.includes('Good shade')) score -= 1;
    else if (f.issue.includes('Near by pedestrian ramp')) score -= 2;
  });
  return score;
}

function encodeGeometry(bbox: number[]) {
  const [xmin, ymin, xmax, ymax] = bbox;
  return encodeURIComponent(JSON.stringify({
    xmin, ymin, xmax, ymax,
    spatialReference: { wkid: 4326 }
  }));
}

async function fetchArcGISLayerWithinBbox(layerBaseUrl: string, bbox: number[]) {
  const geom = encodeGeometry(bbox);
  const url = `${layerBaseUrl}/query?where=1=1&geometry=${geom}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outFields=*&f=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ArcGIS fetch failed: ${res.status}`);
  return res.json();
}

// TODO : add the added datasets to summary
type RouteAccessibilitySummary = {
  totalFlags: number;
  damage: 'low' | 'moderate' | 'high';
  slope: 'ok' | 'steep';
  lighting: 'poor' | 'moderate' | 'good';
  treeCover: 'none' | 'moderate' | 'dense';
  ramp: 'missing' | 'present';
  speedLimit: 'low' | 'moderate' | 'high';
  width: 'narrow' | 'ok';
};

export default function Main() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
  const [toCoords, setToCoords] = useState<LatLng | null>(null);
  const [routes, setRoutes] = useState<LatLng[][]>([]);
  const [routeSummaries, setRouteSummaries] = useState<
    { distance: number; duration: number; score: number; accessibilitySummary: RouteAccessibilitySummary }[]
  >([]);
  const [routeAccessibilitySummaries, setRouteAccessibilitySummaries] = useState<RouteAccessibilitySummary[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid' | 'terrain'>('standard');
  const [hasRouted, setHasRouted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [allFlags, setAllFlags] = useState<Flag[][]>([]);
  const mapRef = useRef<MapView>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([
  'Good shade',
  'Near by pedestrian ramp',
  'Poor sidewalk condition',
  'High speed limit',
  'Narrow sidewalk',
  'Steep slope',
  'Poor lighting',
  'No sidewalk'
  ]);

  // Summarize flags for UI
  // TODO : edit the summaries to include breakdown of flags
  function summarizeRouteFlags(flags: Flag[]): RouteAccessibilitySummary {
    const totalFlags = flags.length;

    const damageCount = flags.filter(f => f.issue.includes('Poor sidewalk condition')).length;
    const narrowCount = flags.filter(f => f.issue.includes('Narrow sidewalk')).length;
    const slopeCount = flags.filter(f => f.issue.includes('Steep slope')).length;
    const poorLightingCount = flags.filter(f => f.issue.includes('Poor lighting')).length;
    const goodShadeCount = flags.filter(f => f.issue.includes('Good shade')).length;
    const missingRampCount = flags.filter(f => f.issue.includes('Missing pedestrian ramp')).length;
    const speedLimitCount = flags.filter(f => f.issue.includes('High speed limit')).length;

    const damage = damageCount > 5 ? 'high' : damageCount > 3 ? 'moderate' : 'low';
    const slope = slopeCount > 0 ? 'steep' : 'ok';
    const lighting = poorLightingCount > 2 ? 'poor' : poorLightingCount > 0 ? 'moderate' : 'good';
    const treeCover = goodShadeCount > 5 ? 'dense' : goodShadeCount > 1 ? 'moderate' : 'none';
    const ramp = missingRampCount > 3 ? 'missing' : 'present';
    const width = narrowCount > 2 ? 'narrow' : 'ok';
    const speedLimit = speedLimitCount > 5 ? 'high' : speedLimitCount > 3 ? 'moderate' : 'low';

    return { totalFlags, damage, slope, lighting, treeCover, ramp, speedLimit, width, };
  }

  // Fetch routes when coords change
  useEffect(() => {
    async function fetchRoute() {
      if (!fromCoords || !toCoords) {
        setRoutes([]);
        setRouteSummaries([]);
        setRouteAccessibilitySummaries([]);
        setSelectedRouteIndex(0);
        setFlags([]);
        setAllFlags([]);
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
            return decoded.map(([lat, lng]) => ({
              latitude: lat,
              longitude: lng,
            }));
          });

          function getUnionBufferedBbox(routes: LatLng[][], bufferMeters = PROXIMITY_TOLERANCE_METERS) {
            const allCoords = routes.flat();
            const line = turf.lineString(allCoords.map(c => [c.longitude, c.latitude]));
            const bbox = turf.bbox(line);
            const bufferDegrees = bufferMeters / 111000;        
            return [
              bbox[0] - bufferDegrees,
              bbox[1] - bufferDegrees,
              bbox[2] + bufferDegrees,
              bbox[3] + bufferDegrees
            ];
          }

          // get bbox of the three routes
          const unionBbox = getUnionBufferedBbox(decodedRoutes);
          const [
            sidewalks,
            streetLamps,
            trees,
            ramps,
            speedlimit,
            sdwCenterline
          ] = await Promise.all([
            fetchArcGISLayerWithinBbox(
              "https://gisportal.boston.gov/arcgis/rest/services/Infrastructure/OpenData/MapServer/0",
              unionBbox
            ),
            fetchArcGISLayerWithinBbox(
              "https://gisportal.boston.gov/arcgis/rest/services/Infrastructure/OpenData/MapServer/11",
              unionBbox
            ),
            fetchArcGISLayerWithinBbox(
              "https://services.arcgis.com/sFnw0xNflSi8J0uh/ArcGIS/rest/services/BPRD_Trees/FeatureServer/0",
              unionBbox
            ),
            fetchArcGISLayerWithinBbox(
              "https://gisportal.boston.gov/arcgis/rest/services/Infrastructure/OpenData/MapServer/3",
              unionBbox
            ),
            fetchArcGISLayerWithinBbox(
              "https://gisportal.boston.gov/arcgis/rest/services/SAM/Live_SAM_Address/FeatureServer/3",
              unionBbox
            ),
            fetchArcGISLayerWithinBbox(
              "https://gisportal.boston.gov/arcgis/rest/services/Infrastructure/OpenData/MapServer/5",
              unionBbox
            )
          ]);

          const flaggedRoutes = await Promise.all(decodedRoutes.map(async (coords: LatLng[], idx: number) => {
            const flagList = flagRoute(
              coords, 
              sidewalks.features, 
              streetLamps.features, 
              trees.features, 
              ramps.features, 
              speedlimit.features, 
              sdwCenterline.features);
            return {
              index: idx,
              coords,
              flags: flagList,
              score: computeScore(flagList),
            };
          }));

          // Sort by score (least to greatest)
          const bestThree = flaggedRoutes.sort((a, b) => a.score - b.score).slice(0, 3);

          const summaries = bestThree.map(r => {
            const origSummary = data.routes[r.index].summary;
            return {
              distance: origSummary?.distance ?? 0,
              duration: origSummary?.duration ?? 0,
              score: r.score,
              accessibilitySummary: summarizeRouteFlags(r.flags),
            };
          });

          setRoutes(bestThree.map(r => r.coords));
          setRouteSummaries(summaries);
          setRouteAccessibilitySummaries(summaries.map(s => s.accessibilitySummary));
          setAllFlags(bestThree.map(r => r.flags));
          setSelectedRouteIndex(0);
          setFlags(bestThree[0].flags);
          setHasRouted(true);

          if (mapRef.current) {
            const allCoords = bestThree.flatMap(r => r.coords);
            mapRef.current.fitToCoordinates(allCoords, {
              edgePadding: { top: 300, bottom: 150, left: 50, right: 50 },
              animated: true,
            });
          }
        } else {
          setRoutes([]);
          setRouteSummaries([]);
          setRouteAccessibilitySummaries([]);
          setSelectedRouteIndex(0);
          setFlags([]);
          setAllFlags([]);
        }
      } catch (e) {
        console.error('Route fetch error:', e);
        setRoutes([]);
        setRouteSummaries([]);
        setRouteAccessibilitySummaries([]);
        setSelectedRouteIndex(0);
        setFlags([]);
        setAllFlags([]);
      }
    }

    fetchRoute();
  }, [fromCoords, toCoords]);

  // Update flags when selected route changes
  useEffect(() => {
    if (allFlags.length > 0) {
      setFlags(allFlags[selectedRouteIndex] || []);
    } else {
      setFlags([]);
    }
  }, [selectedRouteIndex, allFlags]);

  // Animate map to start on load
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
      {/* SEARCH BOX */}
      <View style={styles.searchBox}>
        <Text style={styles.label}>From:</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('Search', {
              onSelect: (coords: LatLng, label: string) => {
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
              onSelect: (coords: LatLng, label: string) => {
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
          />
        )}

        {/* Markers for flagged points on selected route */}
        {flags
          .filter((flag) =>
            selectedAttributes.some((attr) => flag.issue.includes(attr))
          )
          .map((flag, idx) => {
            const { label, color } = iconForFlag(flag.issue);
            return (
              <Marker
                key={`flag-${idx}`}
                coordinate={flag.coord}
                pinColor={color}
                title={label}
                description={flag.issue}
              />
            );
          })}
      </MapView>

      <View style={styles.routeSummaryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {routeSummaries.map((summary, i) => (
            <TouchableOpacity
              key={`summary-${i}`}
              style={[
                styles.routeSummary,
                i === selectedRouteIndex && styles.selectedRouteSummary,
              ]}
              onPress={() => setSelectedRouteIndex(i)}
            >
              <Text style={styles.routeSummaryText}>
                Distance: {formatDistance(summary.distance)} {'\n'}
                Duration: {formatDuration(summary.duration)} {'\n'}
                Route Score: {summary.score}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity
        onPress={() => setShowSettings(true)}
        style={styles.settingsButton}
      >
        <AntDesign name="setting" size={24} color="black" />
      </TouchableOpacity>

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        mapType={mapType}
        setMapType={setMapType}
        selectedAttributes={selectedAttributes}
        setSelectedAttributes={setSelectedAttributes}
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
    zIndex: 1000,
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
    marginBottom: 12,
  },
  routeSummaryContainer: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
  },
  routeSummary: {
    backgroundColor: 'white',
    marginHorizontal: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedRouteSummary: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  routeSummaryText: {
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
  },
  settingsButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
});
