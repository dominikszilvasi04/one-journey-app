import { XMLParser } from 'fast-xml-parser';
import { Station } from '../types/transport_types';


const IRISH_RAIL_ALL_STATIONS_URL = 'http://api.irishrail.ie/realtime/realtime.asmx/getAllStationsXML';
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
    const stationsData = result.ArrayOfObjStation.objStation;
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
