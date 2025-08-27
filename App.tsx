import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Main from './app/frontend/components/main';
import SearchScreen from './app/frontend/components/searchScreen';

export type RootStackParamList = {
  Main: undefined;
  Search: {
    onSelect: (coords: { latitude: number; longitude: number }, label: string) => void;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Main" component={Main} options={{ title: 'NavigAid' }} />
        <Stack.Screen name="Search" component={SearchScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
