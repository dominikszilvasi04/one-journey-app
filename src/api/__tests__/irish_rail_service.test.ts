import { fetchAllIrishRailStations, fetchIrishRailForecast } from '../irish_rail_service';


const MOCK_STATIONS_XML = `
<ArrayOfObjStation xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <objStation>
    <StationDesc>Bayside DART Station</StationDesc>
    <StationLatitude>53.3911</StationLatitude>
    <StationLongitude>-6.13814</StationLongitude>
    <StationCode>BYSDE</StationCode>
    <StationId>43</StationId>
  </objStation>
</ArrayOfObjStation>
`;


const MOCK_FORECAST_XML = `
<ArrayOfObjStationData xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <objStationData>
    <Origin>Howth</Origin>
    <Destination>Bray</Destination>
    <Scharrival>14:00</Scharrival>
    <Exparrival>14:05</Exparrival>
    <Duein>5</Duein>
    <Status>En Route</Status>
    <Traintype>DART</Traintype>
    <Direction>Southbound</Direction>
  </objStationData>
</ArrayOfObjStationData>
`;


describe('irish_rail_service', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  it('should fetch and parse stations correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_STATIONS_XML),
    });
    const stations = await fetchAllIrishRailStations();
    expect(stations).toHaveLength(1);
    expect(stations[0].name).toBe('Bayside DART Station');
  });
  it('should fetch and parse forecast correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_FORECAST_XML),
    });
    const forecast = await fetchIrishRailForecast('BYSDE');
    expect(forecast).toHaveLength(1);
    expect(forecast[0].destination).toBe('Bray');
    expect(forecast[0].minutesToDeparture).toBe(5);
    expect(forecast[0].direction).toBe('Southbound');
  });
});
