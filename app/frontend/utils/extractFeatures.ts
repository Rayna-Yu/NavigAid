import * as turf from '@turf/turf';
import { LatLng } from 'react-native-maps';
import { countNearbyFeaturesByDistance, readSpeedFromProps } from './geoutils';

const PROXIMITY_TOLERANCE_METERS = 10;
const allowedTypes = new Set(["CWALK-CL", "CWALK-CL-UM"]);

export interface RouteFeatures {
  speed_limit: number | null;
  ramp: number | null;
  tree: number | null;
  lighting: number | null;
  has_crosswalk: number | null;
  narrow_sidewalk: number | null;
  steep_slope: number | null;
  poor_condition: number | null;
  has_sidewalk_coverage: boolean | null;
}

export function extractFeaturesAtPoint(
  coord: LatLng,
  featureSets: {
    sidewalkFeatures: any[],
    lampFeatures: any[],
    treeFeatures: any[],
    rampFeatures: any[],
    speedFeatures: any[],
    centerlineFeatures: any[]
  },
): RouteFeatures {
  const pt = turf.point([coord.longitude, coord.latitude]);

  let narrow_sidewalk = null;
  let steep_slope = null;
  let poor_condition = null;
  let has_sidewalk_coverage = null;

  for (const sidewalk of featureSets.sidewalkFeatures) {
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

    has_sidewalk_coverage = true;

    const width = Number(props.SWK_WIDTH);
    if (!isNaN(width)) {
      narrow_sidewalk = width;
    }

    const slope = Number(props.SWK_SLOPE);
    if (!isNaN(slope)) {
      steep_slope = slope;
    }

    const damArea = Number(props.DAM_AREA);
    const swkArea = Number(props.SWK_AREA);
    if (!isNaN(damArea) && !isNaN(swkArea)) {
      poor_condition = damArea / swkArea;
    }

    break;
  }

  const lighting = countNearbyFeaturesByDistance(pt, featureSets.lampFeatures, PROXIMITY_TOLERANCE_METERS);

  const tree = countNearbyFeaturesByDistance(pt, featureSets.treeFeatures, PROXIMITY_TOLERANCE_METERS);
  const ramp = countNearbyFeaturesByDistance(pt, featureSets.rampFeatures, PROXIMITY_TOLERANCE_METERS);

  const crosswalks = featureSets.centerlineFeatures.filter(f => allowedTypes.has(f.properties?.TYPE));
  const has_crosswalk = countNearbyFeaturesByDistance(pt, crosswalks, PROXIMITY_TOLERANCE_METERS);

  let speed_limit = 0;
  for (const sf of featureSets.speedFeatures) {
    const props = sf.properties || {};
    const geom = sf.geometry;
    if (!geom) continue;

    const val = readSpeedFromProps(props);
    if (val == null) continue;

    const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
    for (const ln of lines) {
      const lineGeom = turf.lineString(ln);
      const dist = turf.pointToLineDistance(pt, lineGeom, { units: 'meters' });
      if (dist <= PROXIMITY_TOLERANCE_METERS) {
        speed_limit = val;
        break;
      }
    }
    if (speed_limit > 0) break;
  }

  return {
    speed_limit,
    ramp,
    tree,
    lighting,
    has_crosswalk,
    narrow_sidewalk,
    steep_slope,
    poor_condition,
    has_sidewalk_coverage,
  };
}
