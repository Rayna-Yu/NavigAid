import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../../../App';
import Constants from 'expo-constants';

const ORS_API_KEY = Constants.expoConfig?.extra?.OPEN_ROUTE_SERVICE_API_KEY;
type SearchScreenRouteProp = RouteProp<RootStackParamList, 'Search'>;

type Suggestion = {
  properties: { label: string };
  geometry: { coordinates: [number, number] };
};

export default function SearchScreen() {
  const navigation = useNavigation();
  const route = useRoute<SearchScreenRouteProp>();
  const { onSelect } = route.params;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const response = await fetch(
          `https://api.openrouteservice.org/geocode/autocomplete?api_key=${ORS_API_KEY}&text=${encodeURIComponent(query)}&size=5`
        );
        const data = await response.json();
        setSuggestions(data.features || []);
      } catch (e) {
        console.error('Fetch autocomplete error', e);
      }
    };

    fetchSuggestions();
  }, [query]);

  const handleSelect = async (item: Suggestion) => {
    const [lng, lat] = item.geometry.coordinates;
    const coords = { latitude: lat, longitude: lng };
    onSelect(coords, item.properties.label);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search location"
        style={styles.input}
        autoFocus
      />
      <FlatList
        data={suggestions}
        keyExtractor={(item, i) => item.properties.label + i}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
            <Text>{item.properties.label}</Text>
          </TouchableOpacity>
        )}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  input: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ccc',
    marginBottom: 10,
  },
  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
});
