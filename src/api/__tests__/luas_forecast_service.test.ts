import { fetchAllLuasStops, fetchLuasForecast } from '../luas_forecast_service';


const MOCK_STOPS_XML = `
<stops>
  <stop abbreviation="STP" display_name="St. Stephen's Green" latitude="53.339" longitude="-6.261" line="Green" />
  <stop abbreviation="TUL" display_name="Tallaght" latitude="53.287" longitude="-6.371" line="Red" />
</stops>
`;


const MOCK_FORECAST_XML = `
<stopInfo stop="St. Stephen's Green" abbreviation="STP">
  <direction name="Inbound">
    <tram destination="Broombridge" dueMins="DUE" />
    <tram destination="Broombridge" dueMins="5" />
  </direction>
  <direction name="Outbound">
    <tram destination="Brides Glen" dueMins="2" />
  </direction>
</stopInfo>
`;


describe('luas_forecast_service', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  it('should fetch and parse stops correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_STOPS_XML),
    });
    const stops = await fetchAllLuasStops();
    expect(stops).toHaveLength(2);
    expect(stops[0].name).toBe("St. Stephen's Green");
    expect(stops[0].line).toBe('Green');
    expect(stops[1].name).toBe('Tallaght');
    expect(stops[1].line).toBe('Red');
  });
  it('should fetch and parse forecast correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_FORECAST_XML),
    });
    const forecast = await fetchLuasForecast('STP');
    expect(forecast).toHaveLength(3);
    expect(forecast[0].destination).toBe('Broombridge');
    expect(forecast[0].minutesToDeparture).toBe(0);
    expect(forecast[0].status).toBe('Due');
    expect(forecast[2].destination).toBe('Brides Glen');
    expect(forecast[2].minutesToDeparture).toBe(2);
  });
});
