import { XMLParser } from 'fast-xml-parser';
import { Station, Arrival } from '../types/transport_types';


const LUAS_STOPS_URL = 'https://luasforecasts.rpa.ie/xml/get.ashx?action=stops&encrypt=false';
const LUAS_FORECAST_URL = 'https://luasforecasts.rpa.ie/xml/get.ashx?action=forecast&encrypt=false&stop=';
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'name',
});


export const fetchAllLuasStops = async (): Promise<Station[]> => {
  try {
    const response = await fetch(LUAS_STOPS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Luas stops: ${response.statusText}`);
    }
    const xmlData = await response.text();
    const result = xmlParser.parse(xmlData);
    const lines = Array.isArray(result.stops.line) ? result.stops.line : [result.stops.line];
    const stations: Station[] = [];
    lines.forEach((line: any) => {
      const stops = Array.isArray(line.stop) ? line.stop : [line.stop];
      stops.forEach((stop: any) => {
        stations.push({
          id: stop.abrev,
          name: stop.name,
          latitude: parseFloat(stop.lat),
          longitude: parseFloat(stop.long),
          type: 'Luas',
          line: line.name.includes('Red') ? 'Red' : 'Green',
        });
      });
    });
    return stations;
  } catch (error) {
    console.error('Error fetching Luas stops:', error);
    throw error;
  }
};


export const fetchLuasForecast = async (stopAbbreviation: string): Promise<Arrival[]> => {
  try {
    const response = await fetch(`${LUAS_FORECAST_URL}${stopAbbreviation}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Luas forecast: ${response.statusText}`);
    }
    const xmlData = await response.text();
    const result = xmlParser.parse(xmlData);
    if (!result.stopInfo || !result.stopInfo.direction) {
      return [];
    }
    const directionData = Array.isArray(result.stopInfo.direction) 
      ? result.stopInfo.direction 
      : [result.stopInfo.direction];
    const arrivals: Arrival[] = [];
    directionData.forEach((direction: any) => {
      if (!direction.tram) return;
      const trams = Array.isArray(direction.tram) ? direction.tram : [direction.tram];
      trams.forEach((tram: any) => {
        if (tram && tram.destination) {
          const isServiceDisrupted = tram.destination.toLowerCase().includes('see news');
          const minutes = (tram.dueMins === 'DUE' || isServiceDisrupted) ? 0 : parseInt(tram.dueMins);
          arrivals.push({
            stationId: stopAbbreviation,
            destination: tram.destination,
            origin: 'Unknown',
            scheduledArrival: new Date().toISOString(),
            expectedArrival: new Date().toISOString(),
            minutesToDeparture: isNaN(minutes) ? 0 : minutes,
            status: isServiceDisrupted ? 'Disrupted' : (tram.dueMins === 'DUE' ? 'Due' : 'On Time'),
            transportType: 'Luas',
            direction: direction.name === 'Inbound' ? 'Inbound' : 'Outbound',
          });
        }
      });
    });
    return arrivals;
  } catch (error) {
    console.error('Error fetching Luas forecast:', error);
    throw error;
  }
};
