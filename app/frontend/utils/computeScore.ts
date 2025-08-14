import Constants from 'expo-constants';
const BACKEND_URL = Constants.expoConfig?.extra?.BACKEND_URL;

export async function computeScore(
  featureMatrix: number[][],
  isNight: boolean
): Promise<number> {
  try {
    const response = await fetch(`${BACKEND_URL}/predict_route_safety`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: featureMatrix,
        is_night: isNight,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();

    if (typeof result.route_safety_score !== 'number') {
      throw new Error('Invalid response format');
    }

    return result.average_crash_probability;
  } catch (err) {
    console.error('Error computing score:', err);
    return 0;
  }
}
