import { XMLParser } from 'fast-xml-parser';
import { Station, Arrival } from '../types/transport_types';


const IRISH_RAIL_ALL_STATIONS_URL = 'http://api.irishrail.ie/realtime/realtime.asmx/getAllStationsXML';
const IRISH_RAIL_STATION_DATA_URL = 'http://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML?StationCode=';
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
});


export const fetchAllIrishRailStations = async (): Promise<Station[]> => {
  try {
    const response = await fetch(IRISH_RAIL_ALL_STATIONS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Irish Rail stations: ${response.statusText}`);
    }
    const xmlData = await response.text();
    const result = xmlParser.parse(xmlData);
    const rawStations = result.ArrayOfObjStation.objStation;
    if (!rawStations) return [];
    const stationsData = Array.isArray(rawStations) ? rawStations : [rawStations];
    return stationsData.map((station: any): Station => ({
      id: station.StationCode,
      name: station.StationDesc,
      latitude: parseFloat(station.StationLatitude),
      longitude: parseFloat(station.StationLongitude),
      type: station.StationDesc.toLowerCase().includes('dart') ? 'DART' : 'Train',
      stationCode: station.StationCode,
    }));
  } catch (error) {
    console.error('Error fetching Irish Rail stations:', error);
    throw error;
  }
};


export const fetchIrishRailForecast = async (stationCode: string): Promise<Arrival[]> => {
  try {
    const response = await fetch(`${IRISH_RAIL_STATION_DATA_URL}${stationCode}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Irish Rail forecast: ${response.statusText}`);
    }
    const xmlData = await response.text();
    const result = xmlParser.parse(xmlData);
    const rawArrivals = result.ArrayOfobjStationData.objStationData;
    if (!rawArrivals) return [];
    const arrivalData = Array.isArray(rawArrivals) ? rawArrivals : [rawArrivals];
    return arrivalData.map((arrival: any): Arrival => ({
      stationId: stationCode,
      destination: arrival.Destination,
      origin: arrival.Origin,
      scheduledArrival: arrival.Scharrival,
      expectedArrival: arrival.Exparrival,
      minutesToDeparture: parseInt(arrival.Duein) || 0,
      status: arrival.Status,
      transportType: arrival.Traintype === 'DART' ? 'DART' : 'Train',
      direction: arrival.Direction === 'Northbound' ? 'Northbound' : 'Southbound',
    }));
  } catch (error) {
    console.error('Error fetching Irish Rail forecast:', error);
    throw error;
  }
};
