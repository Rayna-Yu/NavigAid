import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

type SettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
  mapType: 'standard' | 'satellite' | 'hybrid' | 'terrain';
  setMapType: (type: 'standard' | 'satellite' | 'hybrid' | 'terrain') => void;
  selectedAttributes: string[];
  setSelectedAttributes: (attributes: string[]) => void;
};

const mapTypes = ['standard', 'satellite', 'hybrid', 'terrain'] as const;

const attributeOptions = [
  'Good shade',
  'Near by pedestrian ramp',
  'Poor sidewalk condition',
  'High speed limit',
  'Narrow sidewalk',
  'Steep slope',
  'Poor lighting',
];

export default function SettingsSheet({
  visible,
  onClose,
  mapType,
  setMapType,
  selectedAttributes,
  setSelectedAttributes,
}: SettingsSheetProps) {
  if (!visible) return null;

  const allSelected = selectedAttributes.length === attributeOptions.length;

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>Map Type</Text>
          {mapTypes.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => {
                setMapType(type);
                onClose();
              }}
              style={[
                styles.option,
                mapType === type && styles.selectedOption,
              ]}
            >
              <Text style={mapType === type ? styles.selectedText : styles.optionText}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.title}>Filter Flags</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => setSelectedAttributes([...attributeOptions])}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedAttributes([])}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {attributeOptions.map((attribute) => {
            const isSelected = selectedAttributes.includes(attribute);
            return (
              <TouchableOpacity
                key={attribute}
                onPress={() => {
                  const updated = isSelected
                    ? selectedAttributes.filter((a) => a !== attribute)
                    : [...selectedAttributes, attribute];
                  setSelectedAttributes(updated);
                }}
                style={[styles.option, isSelected && styles.selectedOption]}
              >
                <Text style={isSelected ? styles.selectedText : styles.optionText}>
                  {attribute}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  panel: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 120,
    marginHorizontal: 20,
    borderRadius: 20,
    elevation: 5,
  },
  title: {
    fontWeight: '700',
    fontSize: 20,
    marginBottom: 12,
  },
  option: {
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 16,
    color: '#555',
    paddingHorizontal: 16,
  },
  selectedOption: {
    backgroundColor: '#e6f0ff',
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  selectedText: {
    fontWeight: '600',
    color: '#007AFF',
  },
  closeButton: {
    marginTop: 20,
    alignSelf: 'flex-end',
  },
  closeText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  smallButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  smallButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});
