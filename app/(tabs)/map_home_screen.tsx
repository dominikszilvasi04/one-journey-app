import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, Alert, SectionList } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Polyline } from 'react-native-maps';
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


interface TransportRoute {
  id: string;
  color: string;
  coordinates: { latitude: number; longitude: number }[];
}


export default function MapHomeScreen() {
  const [stations, setStations] = useState<Station[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalSection[]>([]);
  const [isFetchingArrivals, setIsFetchingArrivals] = useState<boolean>(false);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const bottomSheetReference = useRef<BottomSheet>(null);
  const mapReference = useRef<MapView>(null);
  const snapPoints = useMemo(() => ['10%', '50%', '90%'], []);
  useEffect(() => {
    const initialiseMapData = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation(location);
        }
        const [irishRailStations, luasStops] = await Promise.all([
          fetchAllIrishRailStations(),
          fetchAllLuasStops(),
        ]);
        const allStations = [...irishRailStations, ...luasStops];
        setStations(allStations);
        const redLineStops = luasStops.filter(station => station.line === 'Red');
        const greenLineStops = luasStops.filter(station => station.line === 'Green');
        const transportRoutes: TransportRoute[] = [
          {
            id: 'Luas-Red',
            color: '#800080',
            coordinates: redLineStops.map(station => ({ latitude: station.latitude, longitude: station.longitude })),
          },
          {
            id: 'Luas-Green',
            color: '#008000',
            coordinates: greenLineStops.map(station => ({ latitude: station.latitude, longitude: station.longitude })),
          },
        ];
        setRoutes(transportRoutes);
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
    if (station.type === 'Luas') {
      setActiveRouteId(`Luas-${station.line}`);
    } else {
      setActiveRouteId(null);
    }
    bottomSheetReference.current?.snapToIndex(1);
    try {
      const fetchedArrivals = station.type === 'Luas' 
        ? await fetchLuasForecast(station.id)
        : await fetchIrishRailForecast(station.id);
      const grouped = fetchedArrivals.reduce((sections: { [key: string]: Arrival[] }, arrival) => {
        const title = `To ${arrival.destination}`;
        if (!sections[title]) sections[title] = [];
        sections[title].push(arrival);
        return sections;
      }, {});
      setArrivals(Object.keys(grouped).map(title => ({
        title,
        data: grouped[title].sort((a, b) => a.minutesToDeparture - b.minutesToDeparture),
      })));
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
        ref={mapReference}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: userLocation?.coords.latitude ?? 53.3498,
          longitude: userLocation?.coords.longitude ?? -6.2603,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={true}
      >
        {routes.map(route => (
          <Polyline
            key={route.id}
            coordinates={route.coordinates}
            strokeColor={route.color}
            strokeWidth={activeRouteId === route.id ? 5 : 2}
            lineDashPattern={activeRouteId === route.id ? undefined : [5, 5]}
          />
        ))}
        {stations.map((station: Station) => (
          <Marker
            key={`${station.type}-${station.id}`}
            coordinate={{
              latitude: station.latitude,
              longitude: station.longitude,
            }}
            title={station.name}
            pinColor={station.type === 'Luas' ? (station.line === 'Red' ? '#e60000' : '#00b300') : '#0000ff'}
            onPress={() => handleMarkerPress(station)}
          />
        ))}
      </MapView>
      <BottomSheet
        ref={bottomSheetReference}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={() => setActiveRouteId(null)}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {selectedStation && (
            <>
              <Text style={styles.stationName}>{selectedStation.name}</Text>
              <Text style={styles.stationType}>{selectedStation.type} {selectedStation.line ? `${selectedStation.line} Line` : ''}</Text>
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
                        {item.status === 'Disrupted' && <Text style={styles.disruptionText}>Service Disrupted</Text>}
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
