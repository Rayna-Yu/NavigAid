import React from 'react';
import { View, Text, StyleSheet, TextInput} from 'react-native';
import MapView from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import { AntDesign } from '@expo/vector-icons';

export default function Main() {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 42.3624,
          longitude: -71.0871,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
          // TODO : set to user's initial location not hard code it
        }}
      />
      <View style={styles.searchBox}>
        <Text style={styles.label}>From:</Text>
        <TextInput style={styles.input} placeholder="Starting point" />
        <AntDesign name="arrowdown" size={24} color="black" style={styles.arrow} />
        <Text style={styles.label}>To:</Text>
        <TextInput style={styles.input} placeholder="Destination" />
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  searchBox: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  label: {
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 18,
  },
  input: {
    backgroundColor: '#f2f2f2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  arrow: {
    alignSelf: 'center',
  },
});
