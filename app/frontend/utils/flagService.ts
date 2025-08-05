import { LatLng } from 'react-native-maps';
// import { Feature, Geometry } from 'geojson';
import * as turf from '@turf/turf';
import { Flag } from '../types';

const PROXIMITY_TOLERANCE_METERS = 15;

// Flag route features
export function flagRoute(
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

  const filteredSidewalks = sidewalkFeatures.filter(
    f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f))
  );
  const filteredLamps = lampFeatures.filter(
    f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f))
  );
  const filteredTrees = treeFeatures.filter(
    f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f))
  );
  const filteredRamps = rampFeatures.filter(
    f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f))
  );
  const filteredSpeed = speedFeatures.filter(
    f => f.geometry && bboxIntersects(bufferedBbox, turf.bbox(f))
  );

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
        const polygon =
          geom.type === 'Polygon'
            ? turf.polygon(geom.coordinates)
            : turf.multiPolygon(geom.coordinates);
        if (turf.booleanPointInPolygon(pt, polygon)) nearSidewalk = true;
      } else if (geom.type === 'LineString') {
        const lineGeom = turf.lineString(geom.coordinates);
        if (
          turf.pointToLineDistance(pt, lineGeom, { units: 'meters' }) <=
          PROXIMITY_TOLERANCE_METERS
        )
          nearSidewalk = true;
      }

      if (nearSidewalk) {
        const width = Number(props.SWK_WIDTH);
        if (!isNaN(width) && width < 5) {
          flags.push({
            index: i,
            coord,
            issue: `Narrow sidewalk (${width} ft)`,
          });
        }

        const slope = Number(props.SWK_SLOPE);
        if (!isNaN(slope) && slope > 5) {
          flags.push({
            index: i,
            coord,
            issue: `Steep slope (${slope}%)`,
          });
        }

        const damArea = Number(props.DAM_AREA);
        const swkArea = Number(props.SWK_AREA);
        if (!isNaN(damArea) && damArea / swkArea > 0.25) {
          flags.push({
            index: i,
            coord,
            issue: 'Poor sidewalk condition (significant damage)',
          });
        }
        break;
      }
    }

    const latLngPt = { latitude: coord.latitude, longitude: coord.longitude };

    // Lighting flags
    const nearbyLampsCount = countNearbyFeatures(
      latLngPt,
      filteredLamps,
      PROXIMITY_TOLERANCE_METERS
    );
    if (nearbyLampsCount === 0) {
      flags.push({
        index: i,
        coord,
        issue: 'Poor lighting (no street lamps nearby)',
      });
    }

    // Shade flags
    const nearbyTreesCount = countNearbyFeatures(
      latLngPt,
      filteredTrees,
      PROXIMITY_TOLERANCE_METERS
    );
    if (nearbyTreesCount >= 3) {
      flags.push({
        index: i,
        coord,
        issue: 'Good shade (tree canopy)',
      });
    }

    // Ramp flags
    const nearbyRampsCount = countNearbyFeatures(
      latLngPt,
      filteredRamps,
      PROXIMITY_TOLERANCE_METERS
    );
    if (nearbyRampsCount > 0) {
      flags.push({
        index: i,
        coord,
        issue: 'Near by pedestrian ramp',
      });
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
          const dist = turf.pointToLineDistance(pt, multiLineGeom, {
            units: 'meters',
          });
          if (dist <= PROXIMITY_TOLERANCE_METERS) {
            isNearSpeedSegment = true;
            break;
          }
        }
      }

      if (isNearSpeedSegment) {
        if (speed > 25) {
          flags.push({
            index: i,
            coord,
            issue: `High speed limit (${speed} mph)`,
          });
        }
        break;
      }
    }
  }

  return flags;
}

// Count nearby features helper
function countNearbyFeatures(
  point: LatLng,
  features: any[],
  maxDistanceMeters: number
) {
  return features.reduce((count, feature) => {
    if (!feature.geometry) return count;
    const pt = turf.point([point.longitude, point.latitude]);
    let isNear = false;

    if (feature.geometry.type === 'Point') {
      const featurePt = turf.point(feature.geometry.coordinates);
      const dist = turf.distance(pt, featurePt, { units: 'meters' });
      isNear = dist <= maxDistanceMeters;
    } else if (
      feature.geometry.type === 'Polygon' ||
      feature.geometry.type === 'MultiPolygon'
    ) {
      const poly =
        feature.geometry.type === 'Polygon'
          ? turf.polygon(feature.geometry.coordinates)
          : turf.multiPolygon(feature.geometry.coordinates);
      isNear = turf.booleanPointInPolygon(pt, poly);
    }

    return isNear ? count + 1 : count;
  }, 0);
}
