import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Autocomplete from 'react-native-autocomplete-input';
import Constants from 'expo-constants';

const ORS_API_KEY = Constants.expoConfig?.extra?.OPEN_ROUTE_SERVICE_API_KEY;

type Suggestion = {
  properties: {
    label: string;
  };
  geometry: {
    coordinates: [number, number];
  };
};

export default function LocationAutocomplete({
  onSelect,
}: {
  onSelect: (coords: { latitude: number; longitude: number }) => void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      console.log('ORS API Key:', ORS_API_KEY); // TODO : delete this log at some poitn
      try {
        const response = await fetch(
          `https://api.openrouteservice.org/geocode/autocomplete?api_key=${ORS_API_KEY}&text=${encodeURIComponent(
            query
          )}&size=5`
        );
        const data = await response.json();
        setSuggestions(data.features || []);
      } catch (error) {
        console.error('Autocomplete fetch error:', error);
      }
    };

    fetchSuggestions();
  }, [query]);

  const handleSelect = (item: Suggestion) => {
    const [lng, lat] = item.geometry.coordinates;
    onSelect({ latitude: lat, longitude: lng });
    setQuery(item.properties.label);
    setSuggestions([]); // hide suggestions on select
  };

  return (
    <View style={{ flex: 1 }}>
      <Autocomplete
        data={suggestions}
        value={query}
        onChangeText={text => setQuery(text)}
        flatListProps={{
          keyExtractor: (_, i) => String(i),
          renderItem: ({ item }) => (
            <TouchableOpacity onPress={() => handleSelect(item)} style={styles.item}>
              <Text>{item.properties.label}</Text>
            </TouchableOpacity>
          ),
          keyboardShouldPersistTaps: 'handled',
        }}
        containerStyle={styles.autocompleteContainer}
        inputContainerStyle={styles.inputContainer}
        listContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  autocompleteContainer: {
    flex: 1,
  },
  inputContainer: {
    borderWidth: 0,
  },
  listContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    maxHeight: 150,
  },
  item: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
});
