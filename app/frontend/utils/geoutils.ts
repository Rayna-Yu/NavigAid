import * as turf from '@turf/turf';
import { Feature, Point as GeoJSONPoint } from 'geojson';

// Helper to count nearby features from a given point and a given threshold
export function countNearbyFeaturesByDistance(pt: Feature<GeoJSONPoint>, features: any[], maxDistanceMeters: number) {
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
export function readSpeedFromProps(props: any): number | null {
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