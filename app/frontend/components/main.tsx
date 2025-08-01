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
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import type { FeatureCollection } from 'geojson';

import * as turf from '@turf/turf';

const ORS_API_KEY = Constants.expoConfig?.extra?.OPEN_ROUTE_SERVICE_API_KEY;
const ROUTE_COLORS = ['#007AFF', '#ADD8E6'];
const PROXIMITY_TOLERANCE_METERS = 15;

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
  if (issue.includes('Damage')) return { label: 'Damage', color: 'red' };
  if (issue.includes('Narrow sidewalk')) return { label: 'Narrow', color: 'purple' };
  if (issue.includes('Steep slope')) return { label: 'Steep', color: 'orange' };
  if (issue.includes('Poor lighting')) return { label: 'Lighting', color: 'gray' };
  if (issue.includes('High speed limit')) return {label: 'Speed', color: 'black'};
  if (issue.includes('Good shade')) return { label: 'Shade', color: 'green' }; 
  if (issue.includes('Near by pedestrian ramp')) return { label: 'Ramp', color: 'limegreen' };
  return { label: 'Issue', color: 'white' };
}

function computeScore(flags: Flag[]): number {
  let score = 0;
  flags.forEach(f => {
    if (f.issue.includes('Damage')) score += 5;
    else if (f.issue.includes('Speed')) score += 5;
    else if (f.issue.includes('Steep slope')) score += 3;
    else if (f.issue.includes('Poor lighting')) score += 2;
    else if (f.issue.includes('Narrow sidewalk')) score += 2;
    else if (f.issue.includes('Good shade')) score -= 1; // reduce score (good)
    else if (f.issue.includes('Ramp')) score -= 1;
  });
  return score;
}


type Flag = {
  index: number;
  coord: LatLng;
  issue: string;
};

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

  const [sidewalks, setSidewalks] = useState<FeatureCollection | null>(null);
  const [streetLamps, setStreetLamps] = useState<FeatureCollection | null>(null);
  const [trees, setTrees] = useState<FeatureCollection | null>(null);
  const [ramps, setRamps] = useState<FeatureCollection | null>(null);
  const [speedlimit, setSpeedLimits] = useState<FeatureCollection | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([
  'Good shade',
  'Near by pedestrian ramp',
  'Damage',
  'High speed limit',
  'Narrow sidewalk',
  'Steep slope',
  'Poor lighting',
  ]);


  // Load datasets on mount
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        // Sidewalks
        const sidewalksAsset = Asset.fromModule(require('../../../assets/datasets/sidewalks.geojson'));
        await sidewalksAsset.downloadAsync();
        const sidewalksStr = await FileSystem.readAsStringAsync(sidewalksAsset.localUri!);
        setSidewalks(JSON.parse(sidewalksStr));

        // Street lamps
        const lampsAsset = Asset.fromModule(require('../../../assets/datasets/streetlight_locations.geojson'));
        await lampsAsset.downloadAsync();
        const lampsStr = await FileSystem.readAsStringAsync(lampsAsset.localUri!);
        setStreetLamps(JSON.parse(lampsStr));

        // Trees
        const treesAsset = Asset.fromModule(require('../../../assets/datasets/trees_data.geojson'));
        await treesAsset.downloadAsync();
        const treesStr = await FileSystem.readAsStringAsync(treesAsset.localUri!);
        setTrees(JSON.parse(treesStr));

        // Pedestrian ramps
        const rampsAsset = Asset.fromModule(require('../../../assets/datasets/pedestrian_ramp_inventory.geojson'));
        await rampsAsset.downloadAsync();
        const rampsStr = await FileSystem.readAsStringAsync(rampsAsset.localUri!);
        setRamps(JSON.parse(rampsStr));

        // Speed limits
        const speedAsset = Asset.fromModule(require('../../../assets/datasets/boston_speedlimit.geojson'));
        await speedAsset.downloadAsync();
        const speedStr = await FileSystem.readAsStringAsync(speedAsset.localUri!);
        setSpeedLimits(JSON.parse(speedStr));
      } catch (err) {
        console.error('Failed to load datasets:', err);
      }
    };
    loadDatasets();
  }, []);

  // Count nearby features helper
  function countNearbyFeatures(point: LatLng, features: any[], maxDistanceMeters: number) {
    return features.reduce((count, feature) => {
      if (!feature.geometry) return count;
      const pt = turf.point([point.longitude, point.latitude]);
      let isNear = false;

      if (feature.geometry.type === 'Point') {
        const featurePt = turf.point(feature.geometry.coordinates);
        const dist = turf.distance(pt, featurePt, { units: 'meters' });
        isNear = dist <= maxDistanceMeters;
      } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const poly = feature.geometry.type === 'Polygon'
          ? turf.polygon(feature.geometry.coordinates)
          : turf.multiPolygon(feature.geometry.coordinates);
        isNear = turf.booleanPointInPolygon(pt, poly);
      }

      return isNear ? count + 1 : count;
    }, 0);
  }

  // Flag route features
  function flagRoute(
    routeCoords: LatLng[],
    sidewalkFeatures: any[],
    lampFeatures: any[],
    treeFeatures: any[],
    rampFeatures: any[],
    speedFeatures: any[]
  ): Flag[] {
    const flags: Flag[] = [];
    const bufferDegrees = PROXIMITY_TOLERANCE_METERS / 111000;
    const line = turf.lineString(routeCoords.map(c => [c.longitude, c.latitude]));
    const routeBbox = turf.bbox(line);
    const bufferedBbox = [
      routeBbox[0] - bufferDegrees,
      routeBbox[1] - bufferDegrees,
      routeBbox[2] + bufferDegrees,
      routeBbox[3] + bufferDegrees,
    ];

    function bboxIntersects(b1: number[], b2: number[]) {
      return !(b2[0] > b1[2] || b2[2] < b1[0] || b2[1] > b1[3] || b2[3] < b1[1]);
    }

    const filteredSidewalks = sidewalkFeatures.filter(f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f)));
    const filteredLamps = lampFeatures.filter(f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f)));
    const filteredTrees = treeFeatures.filter(f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f)));
    const filteredRamps = rampFeatures.filter(f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f)));
    const filteredSpeed = speedFeatures.filter(f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f)));

    for (let i = 0; i < routeCoords.length; i++) {
      const coord = routeCoords[i];
      const pt = turf.point([coord.longitude, coord.latitude]);

      // Sidewalk flags
      for (const sidewalk of filteredSidewalks) {
        const geom = sidewalk.geometry;
        const props = sidewalk.properties || {};
        if (!geom) continue;

        let nearSidewalk = false;
        if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
          const polygon = geom.type === 'Polygon' ? turf.polygon(geom.coordinates) : turf.multiPolygon(geom.coordinates);
          if (turf.booleanPointInPolygon(pt, polygon)) nearSidewalk = true;
        } else if (geom.type === 'LineString') {
          const lineGeom = turf.lineString(geom.coordinates);
          if (turf.pointToLineDistance(pt, lineGeom, { units: 'meters' }) <= PROXIMITY_TOLERANCE_METERS) nearSidewalk = true;
        }

        if (nearSidewalk) {
          const width = Number(props.SWK_WIDTH);
          if (!isNaN(width) && width < 5) {
            flags.push({ index: i, coord, issue: `Narrow sidewalk (${width} ft)` });
          }

          const slope = Number(props.SWK_SLOPE);
          if (!isNaN(slope) && slope > 8) {
            flags.push({ index: i, coord, issue: `Steep slope (${slope}%)` });
          }

          const damArea = Number(props.DAM_AREA);
          const damLength = Number(props.DAM_LENGTH);
          if ((!isNaN(damArea) && damArea > 1000) || (!isNaN(damLength) && damLength > 1000)) {
            flags.push({ index: i, coord, issue: 'Poor sidewalk condition (damage detected)' });
          }
          break;
        }
      }

      const latLngPt = { latitude: coord.latitude, longitude: coord.longitude };

      // Lighting flags
      const nearbyLampsCount = countNearbyFeatures(latLngPt, filteredLamps, PROXIMITY_TOLERANCE_METERS);
      if (nearbyLampsCount === 0) {
        flags.push({ index: i, coord, issue: 'Poor lighting (no street lamps nearby)' });
      }

      // Shade flags
      const nearbyTreesCount = countNearbyFeatures(latLngPt, filteredTrees, PROXIMITY_TOLERANCE_METERS);
      if (nearbyTreesCount >= 3) {
        flags.push({ index: i, coord, issue: 'Good shade (tree canopy)' });
      }

      // Ramp flags
      const nearbyRampsCount = countNearbyFeatures(latLngPt, filteredRamps, PROXIMITY_TOLERANCE_METERS);
      if (nearbyRampsCount > 0) {
        flags.push({ index: i, coord, issue: 'Near by pedestrian ramp' });
      }

      // Speed flags
      for (const speedFeature of filteredSpeed) {
        const speedStr = speedFeature.properties?.maxspeed;
        if (!speedStr) continue;

        const speedMatch = speedStr.match(/\d+/);
        if (!speedMatch) continue;

        const speed = parseInt(speedMatch[0], 10);
        if (isNaN(speed)) continue;

        const geom = speedFeature.geometry;
        if (!geom) continue;

        let isNearSpeedSegment = false;

        if (geom.type === 'LineString') {
          const lineGeom = turf.lineString(geom.coordinates);
          const dist = turf.pointToLineDistance(pt, lineGeom, { units: 'meters' });
          if (dist <= PROXIMITY_TOLERANCE_METERS) isNearSpeedSegment = true;
        } else if (geom.type === 'MultiLineString') {
          for (const coords of geom.coordinates) {
            const multiLineGeom = turf.lineString(coords);
            const dist = turf.pointToLineDistance(pt, multiLineGeom, { units: 'meters' });
            if (dist <= PROXIMITY_TOLERANCE_METERS) {
              isNearSpeedSegment = true;
              break;
            }
          }
        }

        if (isNearSpeedSegment) {
          if (speed > 25) { // adjust the max speed limit accordingly
            flags.push({ index: i, coord, issue: `High speed limit (${speed} mph)` });
          }
          break;
        }
      }
    }

    return flags;
  }

  // Summarize flags for UI
  // TODO : edit the summary because this doesn't make sense right now
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
      if (!fromCoords || !toCoords || !sidewalks?.features || !streetLamps?.features || !trees?.features || !ramps?.features || !speedlimit?.features) {
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

          const flaggedRoutes = decodedRoutes.map((coords: LatLng[], idx: number) => {
            const flagList = flagRoute(coords, sidewalks.features, streetLamps.features, trees.features, ramps.features, speedlimit.features);
            return {
              index: idx,
              coords,
              flags: flagList,
              score: computeScore(flagList),
            };
          });

          // Sort by least issues
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
  }, [fromCoords, toCoords, sidewalks, streetLamps, trees, ramps, speedlimit]);

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
