import { fetchAllIrishRailStations } from '../irish_rail_service';


const MOCK_XML_RESPONSE = `
<ArrayOfObjStation xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <objStation>
    <StationDesc>Bayside DART Station</StationDesc>
    <StationLatitude>53.3911</StationLatitude>
    <StationLongitude>-6.13814</StationLongitude>
    <StationCode>BYSDE</StationCode>
    <StationId>43</StationId>
  </objStation>
  <objStation>
    <StationDesc>Dublin Heuston</StationDesc>
    <StationLatitude>53.3464</StationLatitude>
    <StationLongitude>-6.29461</StationLongitude>
    <StationCode>HSTON</StationCode>
    <StationId>2</StationId>
  </objStation>
</ArrayOfObjStation>
`;


describe('irish_rail_service', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  it('should fetch and parse stations correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_XML_RESPONSE),
    });
    const stations = await fetchAllIrishRailStations();
    expect(stations).toHaveLength(2);
    expect(stations[0].name).toBe('Bayside DART Station');
    expect(stations[0].type).toBe('DART');
    expect(stations[1].name).toBe('Dublin Heuston');
    expect(stations[1].type).toBe('Train');
  });
  it('should throw an error if the network request fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });
    await expect(fetchAllIrishRailStations()).rejects.toThrow('Failed to fetch Irish Rail stations: Not Found');
  });
});
