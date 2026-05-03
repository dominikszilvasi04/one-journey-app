import { XMLParser } from 'fast-xml-parser';
import { Station, Arrival } from '../types/transport_types';


const LUAS_STOPS_URL = 'https://luasforecasts.rpa.ie/xml/get.ashx?action=stops&encrypt=false';
const LUAS_FORECAST_URL = 'https://luasforecasts.rpa.ie/xml/get.ashx?action=forecast&encrypt=false&stop=';
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
});


export const fetchAllLuasStops = async (): Promise<Station[]> => {
  try {
    const response = await fetch(LUAS_STOPS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Luas stops: ${response.statusText}`);
    }
    const xmlData = await response.text();
    const result = xmlParser.parse(xmlData);
    const stopsData = result.stops.stop;
    return stopsData.map((stop: any): Station => ({
      id: stop.abbreviation,
      name: stop.display_name,
      latitude: parseFloat(stop.latitude),
      longitude: parseFloat(stop.longitude),
      type: 'Luas',
      line: stop.line === 'Red' ? 'Red' : 'Green',
    }));
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
    const directionData = Array.isArray(result.stopInfo.direction) 
      ? result.stopInfo.direction 
      : [result.stopInfo.direction];
    const arrivals: Arrival[] = [];
    directionData.forEach((direction: any) => {
      const trams = Array.isArray(direction.tram) ? direction.tram : [direction.tram];
      trams.forEach((tram: any) => {
        if (tram && tram.destination) {
          arrivals.push({
            stationId: stopAbbreviation,
            destination: tram.destination,
            origin: 'Unknown',
            scheduledArrival: new Date().toISOString(),
            expectedArrival: new Date().toISOString(),
            minutesToDeparture: tram.dueMins === 'DUE' ? 0 : parseInt(tram.dueMins),
            status: tram.dueMins === 'DUE' ? 'Due' : 'On Time',
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
