import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, Alert, SectionList } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Text, View } from '@/components/Themed';
import { fetchAllIrishRailStations, fetchIrishRailForecast } from '@/src/api/irish_rail_service';
import { fetchAllLuasStops, fetchLuasForecast } from '@/src/api/luas_forecast_service';
import { Station, Arrival } from '@/src/types/transport_types';


interface ArrivalSection {
  title: string;
  data: Arrival[];
}


export default function MapHomeScreen() {
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalSection[]>([]);
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
  const groupArrivalsByDirection = (fetchedArrivals: Arrival[]): ArrivalSection[] => {
    const grouped = fetchedArrivals.reduce((sections: { [key: string]: Arrival[] }, arrival) => {
      const directionLabel = arrival.direction === 'Inbound' ? 'Towards City Centre' : 
                             arrival.direction === 'Outbound' ? 'Away from City Centre' : 
                             arrival.direction;
      if (!sections[directionLabel]) {
        sections[directionLabel] = [];
      }
      sections[directionLabel].push(arrival);
      return sections;
    }, {});
    return Object.keys(grouped).map(title => ({
      title,
      data: grouped[title].sort((a, b) => a.minutesToDeparture - b.minutesToDeparture),
    }));
  };
  const handleMarkerPress = useCallback(async (station: Station) => {
    setSelectedStation(station);
    setArrivals([]);
    setIsFetchingArrivals(true);
    bottomSheetReference.current?.snapToIndex(1);
    try {
      const fetchedArrivals = station.type === 'Luas' 
        ? await fetchLuasForecast(station.id)
        : await fetchIrishRailForecast(station.id);
      setArrivals(groupArrivalsByDirection(fetchedArrivals));
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
                <SectionList
                  sections={arrivals}
                  keyExtractor={(item, index) => `${item.destination}-${index}`}
                  renderItem={({ item }) => (
                    <View style={styles.arrivalItem}>
                      <View style={styles.arrivalInfo}>
                        <Text style={styles.destinationText}>{item.destination}</Text>
                        {item.status === 'Disrupted' && (
                          <Text style={styles.disruptionText}>Service Disruption</Text>
                        )}
                      </View>
                      <View style={styles.timeInfo}>
                        <Text style={[styles.minutesText, item.status === 'Disrupted' && styles.disruptedTime]}>
                          {item.status === 'Disrupted' ? '-' : (item.minutesToDeparture === 0 ? 'Due' : `${item.minutesToDeparture} min`)}
                        </Text>
                      </View>
                    </View>
                  )}
                  renderSectionHeader={({ section: { title } }) => (
                    <Text style={styles.sectionHeader}>{title}</Text>
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
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: '#f8f8f8',
    padding: 8,
    marginTop: 10,
    borderRadius: 4,
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
    flex: 1,
  },
  destinationText: {
    fontSize: 18,
    fontWeight: '600',
  },
  disruptionText: {
    fontSize: 12,
    color: '#ff4444',
    fontWeight: 'bold',
  },
  timeInfo: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    marginLeft: 10,
  },
  minutesText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e78b7',
  },
  disruptedTime: {
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
  },
});
