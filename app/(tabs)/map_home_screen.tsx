import { useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { fetchAllIrishRailStations } from '@/src/api/irish_rail_service';
import { Station } from '@/src/types/transport_types';


export default function MapHomeScreen() {
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const loadStations = async () => {
      try {
        const fetchedStations = await fetchAllIrishRailStations();
        setStations(fetchedStations);
      } catch (failedToFetchError) {
        setError('Failed to load stations');
        console.error(failedToFetchError);
      } finally {
        setIsLoading(false);
      }
    };
    loadStations();
  }, []);
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2e78b7" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map Home</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <Text style={styles.countText}>
        Found {stations.length} Irish Rail Stations
      </Text>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  countText: {
    fontSize: 16,
    color: '#2e78b7',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
});
