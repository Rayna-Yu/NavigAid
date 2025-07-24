import { LatLng } from 'react-native-maps';
import { Feature, Geometry } from 'geojson';
import { point as turfPoint, lineString, booleanPointOnLine } from '@turf/turf';

type Flag = {
  index: number;
  coord: [number, number];
  issue: string;
};

const TOLERANCE_DEGREES = 0.0002;

export function flagRoute(routeCoords: LatLng[], sidewalkFeatures: Feature[]): Flag[] {
  const flags: Flag[] = [];

  routeCoords.forEach((coord, index) => {
    const pt = turfPoint([coord.longitude, coord.latitude]);

    for (const feature of sidewalkFeatures) {
      const geom = feature.geometry;

      if (geom.type === 'LineString' && feature.properties) {
        const sidewalk = lineString(geom.coordinates);

        const isNear = booleanPointOnLine(pt, sidewalk);


        if (isNear) {
          const condition = feature.properties.CONDITION;
          if (condition === 'Poor') {
            flags.push({
              index,
              coord: [coord.latitude, coord.longitude],
              issue: 'Poor sidewalk condition',
            });
            break;
          }
        }
      }
    }
  });

  return flags;
}
