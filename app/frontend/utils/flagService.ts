import { LatLng } from 'react-native-maps';
import { Flag } from '../types';
import { extractFeaturesAtPoint } from './extractFeatures';

export function analyzeRoute(
  routeCoords: LatLng[],
  featureSets: {
    sidewalkFeatures: any[],
    lampFeatures: any[],
    treeFeatures: any[],
    rampFeatures: any[],
    speedFeatures: any[],
    centerlineFeatures: any[]
  }
): { flags: Flag[], featureMatrix: number[][], isNight: boolean } {
  const flags: Flag[] = [];
  const rawMatrix: any[][] = [];
  const hour = new Date().getHours();
  const isNight = hour > 18 || hour < 6;

  for (let i = 0; i < routeCoords.length; i++) {
    const coord = routeCoords[i];
    const features = extractFeaturesAtPoint(coord, featureSets);

    const row = isNight
      ? [
          features.speed_limit,
          features.ramp,
          features.tree,
          features.lighting,
          features.has_crosswalk,
          features.narrow_sidewalk,
          features.steep_slope,
          features.poor_condition
        ]
      : [
          features.speed_limit,
          features.ramp,
          features.tree,
          features.has_crosswalk,
          features.narrow_sidewalk,
          features.steep_slope,
          features.poor_condition
        ];

    rawMatrix.push(row);

    const width = features.narrow_sidewalk;
    if (width != null && width > 0 && width < 10) {
      flags.push({ index: i, coord, issue: `Narrow sidewalk (${width} ft)`, value: width });
    }

    const slope = features.steep_slope;
    if (slope != null && slope > 5) {
      flags.push({ index: i, coord, issue: `Steep slope (${slope}%)`, value: slope });
    }

    const condition = features.poor_condition;
    if (condition != null && condition > 0.25) {
      flags.push({ index: i, coord, issue: 'Poor sidewalk condition', value: condition });
    }

    if (features.lighting === 0 && isNight) {
      flags.push({ index: i, coord, issue: 'Poor lighting (no street lamps nearby)', value: 0 });
    }

    const tree = features.tree;
    if (tree != null && tree >= 0) {
      flags.push({ index: i, coord, issue: 'Good shade (tree canopy)', value: tree });
    }

    const ramp = features.ramp;
    if (ramp != null && ramp > 0) {
      flags.push({ index: i, coord, issue: 'Nearby pedestrian ramp', value: ramp });
    }

    const crosswalk = features.has_crosswalk;
    if (crosswalk != null && crosswalk > 0) {
      flags.push({ index: i, coord, issue: 'Nearby crosswalk', value: crosswalk });
    }

    const speed = features.speed_limit;
    if (speed != null && speed > 25) {
      flags.push({ index: i, coord, issue: `High speed limit (${speed} mph)`, value: speed });
    }

    // if (!features.has_sidewalk_coverage) {
    //   flags.push({ index: i, coord, issue: 'No sidewalk coverage', value: 1 });
    // }
  }

  const featureMatrix = rawMatrix.filter(row =>
    row.every(val => val !== null && val !== undefined && !Number.isNaN(val))
  );

  return { flags, featureMatrix, isNight };
}
