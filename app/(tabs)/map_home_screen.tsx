import { useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { View } from '@/components/Themed';
import { fetchAllIrishRailStations } from '@/src/api/irish_rail_service';
import { fetchAllLuasStops } from '@/src/api/luas_forecast_service';
import { Station } from '@/src/types/transport_types';


export default function MapHomeScreen() {
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  useEffect(() => {
    const initialiseMapData = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location access is required to find the closest stations.');
        } else {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation(location);
        }
        const [irishRailStations, luasStops] = await Promise.all([
          fetchAllIrishRailStations(),
          fetchAllLuasStops(),
        ]);
        setStations([...irishRailStations, ...luasStops]);
      } catch (initialisationError) {
        console.error(initialisationError);
        Alert.alert('Error', 'Failed to load transport data.');
      } finally {
        setIsLoading(false);
      }
    };
    initialiseMapData();
  }, []);
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2e78b7" />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: userLocation?.coords.latitude ?? 53.3498,
          longitude: userLocation?.coords.longitude ?? -6.2603,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
      >
        {stations.map((station: Station) => (
          <Marker
            key={`${station.type}-${station.id}`}
            coordinate={{
              latitude: station.latitude,
              longitude: station.longitude,
            }}
            title={station.name}
            description={station.type}
            pinColor={station.type === 'Luas' ? '#800080' : '#008000'}
          />
        ))}
      </MapView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
