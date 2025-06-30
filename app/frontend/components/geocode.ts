import Constants from 'expo-constants';
const ORS_API_KEY = Constants.expoConfig?.extra?.OPEN_ROUTE_SERVICE_API_KEY;

export async function geocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}&size=1`
    );
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const coords = data.features[0].geometry.coordinates;
      return {
        latitude: coords[1],
        longitude: coords[0],
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Geocode error:', error);
    return null;
  }
}

