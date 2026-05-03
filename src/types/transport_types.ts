export type TransportType = 'DART' | 'Train' | 'Luas';


export type LuasLine = 'Red' | 'Green';


export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: TransportType;
  line?: LuasLine;
  stationCode?: string;
}


export interface Arrival {
  stationId: string;
  destination: string;
  origin: string;
  scheduledArrival: string;
  expectedArrival: string;
  minutesToDeparture: number;
  status: string;
  transportType: TransportType;
  line?: LuasLine;
  direction: 'Northbound' | 'Southbound' | 'Inbound' | 'Outbound';
}
