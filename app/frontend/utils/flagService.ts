import { LatLng } from 'react-native-maps';
import * as turf from '@turf/turf';
import { Flag } from '../types';
import { Feature, Point as GeoJSONPoint } from 'geojson';

const PROXIMITY_TOLERANCE_METERS = 10;

export function flagRoute(
  routeCoords: LatLng[],
  sidewalkFeatures: any[] = [],
  lampFeatures: any[] = [],
  treeFeatures: any[] = [],
  rampFeatures: any[] = [],
  speedFeatures: any[] = [],
  centerlineFeatures: any[] = []
): Flag[] {
  const flags: Flag[] = [];

  const routePoints = routeCoords.map(c => ({
    coord: c,
    pt: turf.point([c.longitude, c.latitude]),
  }));

  for (let i = 0; i < routePoints.length; i++) {
    const { coord, pt } = routePoints[i];

    for (const sidewalk of sidewalkFeatures) {
      const geom = sidewalk.geometry;
      const props = sidewalk.properties || {};
      if (!geom) continue;

      let nearSidewalk = false;
      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        const poly = geom.type === 'Polygon' ? turf.polygon(geom.coordinates) : turf.multiPolygon(geom.coordinates);
        if (turf.booleanPointInPolygon(pt, poly)) nearSidewalk = true;
      } else if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
        const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
        for (const ln of lines) {
          const lineGeom = turf.lineString(ln);
          const dist = turf.pointToLineDistance(pt, lineGeom, { units: 'meters' });
          if (dist <= PROXIMITY_TOLERANCE_METERS) {
            nearSidewalk = true;
            break;
          }
        }
      }

      if (!nearSidewalk) continue;

      // width
      const width = Number(props.SWK_WIDTH);
      if (!isNaN(width) && width > 0 && width < 5) {
        flags.push({ index: i, coord, issue: `Narrow sidewalk (${width} ft)` });
      }

      // slope
      const slope = Number(props.SWK_SLOPE);
      if (!isNaN(slope) && slope > 5) {
        flags.push({ index: i, coord, issue: `Steep slope (${slope}%)` });
      }

      // damgage
      const damArea = Number(props.DAM_AREA);
      const swkArea = Number(props.SWK_AREA);
      if (!isNaN(damArea) && !isNaN(swkArea) && swkArea > 0 && damArea / swkArea > 0.25) {
        flags.push({ index: i, coord, issue: 'Poor sidewalk condition (significant damage)' });
      }

      break;
    }

    // lighting
    const nearbyLampsCount = countNearbyFeaturesByDistance(pt, lampFeatures, PROXIMITY_TOLERANCE_METERS);
    if (nearbyLampsCount === 0) {
      flags.push({ index: i, coord, issue: 'Poor lighting (no street lamps nearby)' });
    }

    // shade
    const nearbyTreesCount = countNearbyFeaturesByDistance(pt, treeFeatures, PROXIMITY_TOLERANCE_METERS);
    if (nearbyTreesCount >= 3) {
      flags.push({ index: i, coord, issue: 'Good shade (tree canopy)' });
    }

    // ramps
    const nearbyRampsCount = countNearbyFeaturesByDistance(pt, rampFeatures, PROXIMITY_TOLERANCE_METERS);
    if (nearbyRampsCount > 0) {
      flags.push({ index: i, coord, issue: 'Near by pedestrian ramp' });
    }

    // speed limit
    for (const sf of speedFeatures) {
      const props = sf.properties || {};
      const geom = sf.geometry;
      if (!geom) continue;

      const speedVal = readSpeedFromProps(props);
      if (speedVal == null) continue;

      let isNear = false;
      if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
        const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
        for (const ln of lines) {
          const lineGeom = turf.lineString(ln);
          const dist = turf.pointToLineDistance(pt, lineGeom, { units: 'meters' });
          if (dist <= PROXIMITY_TOLERANCE_METERS) {
            isNear = true;
            break;
          }
        }
      }
      if (isNear && speedVal > 25) {
        flags.push({ index: i, coord, issue: `High speed limit (${speedVal} mph)` });
        break;
      }
    }

    // Sidewalk coverage
    let hasSidewalkCoverage = false;

    // Check sidewalk polygons/lines
    for (const sw of sidewalkFeatures) {
      if (!sw.geometry) continue;
      const geom = sw.geometry;

      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        const poly = geom.type === 'Polygon' ? turf.polygon(geom.coordinates) : turf.multiPolygon(geom.coordinates);
        if (turf.booleanPointInPolygon(pt, poly)) {
          hasSidewalkCoverage = true;
          break;
        }
      } else if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
        const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
        for (const ln of lines) {
          const lineGeom = turf.lineString(ln);
          const dist = turf.pointToLineDistance(pt, lineGeom, { units: 'meters' });
          if (dist <= PROXIMITY_TOLERANCE_METERS) {
            hasSidewalkCoverage = true;
            break;
          }
        }
        if (hasSidewalkCoverage) break;
      }
    }

    // If no coverage from sidewalks, check centerlines
    if (!hasSidewalkCoverage) {
      for (const cl of centerlineFeatures) {
        if (!cl.geometry) continue;
        const geom = cl.geometry;
        if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
          const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
          for (const ln of lines) {
            const lineGeom = turf.lineString(ln);
            const dist = turf.pointToLineDistance(pt, lineGeom, { units: 'meters' });
            if (dist <= PROXIMITY_TOLERANCE_METERS) {
              hasSidewalkCoverage = true;
              break;
            }
          }
          if (hasSidewalkCoverage) break;
        }
      }
    }

    // If no coverage at all, flag it
    if (!hasSidewalkCoverage) {
      flags.push({
        index: i,
        coord,
        issue: 'No sidewalk coverage',
      });
    }

  }

  return flags;
}

/** Helper: count nearby features (points or polygons) using turf distance/booleanPointInPolygon */
function countNearbyFeaturesByDistance(pt: Feature<GeoJSONPoint>, features: any[], maxDistanceMeters: number) {
  let count = 0;
  for (const feature of features) {
    if (!feature.geometry) continue;
    const geom = feature.geometry;
    if (geom.type === 'Point') {
      const featurePt = turf.point(geom.coordinates);
      const dist = turf.distance(pt, featurePt, { units: 'meters' });
      if (dist <= maxDistanceMeters) count++;
    } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      const poly = geom.type === 'Polygon' ? turf.polygon(geom.coordinates) : turf.multiPolygon(geom.coordinates);
      if (turf.booleanPointInPolygon(pt, poly)) count++;
    } else if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
      // treat lines as near if distance <= threshold
      const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
      for (const ln of lines) {
        const lineGeom = turf.lineString(ln);
        const d = turf.pointToLineDistance(pt, lineGeom, { units: 'meters' });
        if (d <= maxDistanceMeters) {
          count++;
          break;
        }
      }
    }
  }
  return count;
}

// Helper to read speed from various possible field names
function readSpeedFromProps(props: any): number | null {
  if (!props) return null;
  const candidates = ['SPEEDLIMIT', 'SPEED_LIM', 'speed', 'maxspeed', 'Speed', 'Speed_Limit'];
  for (const k of candidates) {
    const v = props[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : parseInt(String(v).match(/\d+/)?.[0] ?? '', 10);
    if (!isNaN(n)) return n;
  }
  return null;
}
