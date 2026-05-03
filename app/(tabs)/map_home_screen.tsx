import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, Alert, FlatList } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Text, View } from '@/components/Themed';
import { fetchAllIrishRailStations, fetchIrishRailForecast } from '@/src/api/irish_rail_service';
import { fetchAllLuasStops, fetchLuasForecast } from '@/src/api/luas_forecast_service';
import { Station, Arrival } from '@/src/types/transport_types';


export default function MapHomeScreen() {
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [isFetchingArrivals, setIsFetchingArrivals] = useState<boolean>(false);
  const bottomSheetReference = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['10%', '50%', '90%'], []);
  useEffect(() => {
    const initialiseMapData = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location access is required.');
        } else {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation(location);
        }
        const [irishRailStations, luasStops] = await Promise.all([
          fetchAllIrishRailStations(),
          fetchAllLuasStops(),
        ]);
        setStations([...irishRailStations, ...luasStops]);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    initialiseMapData();
  }, []);
  const handleMarkerPress = useCallback(async (station: Station) => {
    setSelectedStation(station);
    setArrivals([]);
    setIsFetchingArrivals(true);
    bottomSheetReference.current?.snapToIndex(1);
    try {
      const fetchedArrivals = station.type === 'Luas' 
        ? await fetchLuasForecast(station.id)
        : await fetchIrishRailForecast(station.id);
      setArrivals(fetchedArrivals.sort((a, b) => a.minutesToDeparture - b.minutesToDeparture));
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingArrivals(false);
    }
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
            pinColor={station.type === 'Luas' ? '#800080' : '#008000'}
            onPress={() => handleMarkerPress(station)}
          />
        ))}
      </MapView>
      <BottomSheet
        ref={bottomSheetReference}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {selectedStation && (
            <>
              <Text style={styles.stationName}>{selectedStation.name}</Text>
              <Text style={styles.stationType}>{selectedStation.type} Station</Text>
              {isFetchingArrivals ? (
                <ActivityIndicator style={styles.loader} color="#2e78b7" />
              ) : (
                <FlatList
                  data={arrivals}
                  keyExtractor={(item, index) => `${item.destination}-${index}`}
                  renderItem={({ item }) => (
                    <View style={styles.arrivalItem}>
                      <View style={styles.arrivalInfo}>
                        <Text style={styles.destinationText}>{item.destination}</Text>
                        <Text style={styles.directionText}>{item.direction}</Text>
                      </View>
                      <View style={styles.timeInfo}>
                        <Text style={styles.minutesText}>
                          {item.minutesToDeparture === 0 ? 'Due' : `${item.minutesToDeparture} min`}
                        </Text>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={<Text style={styles.emptyText}>No upcoming arrivals found.</Text>}
                  style={styles.arrivalsList}
                />
              )}
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
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
  bottomSheetContent: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
  },
  stationName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stationType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  loader: {
    marginTop: 40,
  },
  arrivalsList: {
    flex: 1,
  },
  arrivalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: 'transparent',
  },
  arrivalInfo: {
    backgroundColor: 'transparent',
  },
  destinationText: {
    fontSize: 18,
    fontWeight: '600',
  },
  directionText: {
    fontSize: 14,
    color: '#888',
  },
  timeInfo: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  minutesText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e78b7',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
  },
});
