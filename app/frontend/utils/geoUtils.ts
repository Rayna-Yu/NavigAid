import * as turf from '@turf/turf';
import type { LatLng } from 'react-native-maps';

export function getRouteBoundingBox(routeCoords: LatLng[], bufferMeters = 20): number[] {
  const line = turf.lineString(routeCoords.map(c => [c.longitude, c.latitude]));
  const bbox = turf.bbox(line);
  const bufferDegrees = bufferMeters / 111000;
  return [
    bbox[0] - bufferDegrees,
    bbox[1] - bufferDegrees,
    bbox[2] + bufferDegrees,
    bbox[3] + bufferDegrees,
  ];
}

export function bboxIntersects(bbox1: number[], bbox2: number[]): boolean {
  return !(bbox2[0] > bbox1[2] ||
           bbox2[2] < bbox1[0] ||
           bbox2[1] > bbox1[3] ||
           bbox2[3] < bbox1[1]);
}

export function filterSidewalksByBBox(routeCoords: LatLng[], sidewalkFeatures: any[], bufferMeters = 20) {
  const routeBbox = getRouteBoundingBox(routeCoords, bufferMeters);
  return sidewalkFeatures.filter(feature => {
    const featureBbox = turf.bbox(feature);
    return bboxIntersects(routeBbox, featureBbox);
  });
}
