import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';

import { store, persistor } from './src/store/store';
import AuthNavigator from './src/navigation/AuthNavigator';

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate 
        loading={
          <View style={styles.loadingContainer}>
            <Text>Loading BlockEngage...</Text>
          </View>
        } 
        persistor={persistor}
      >
        <NavigationContainer>
          <AuthNavigator />
          <StatusBar style="auto" />
          <Toast />
        </NavigationContainer>
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
});
