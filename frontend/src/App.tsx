import { useState } from "react";
import "./App.css";

import MapView from "./components/MapView";
import SearchBar from "./components/SearchBar";
import WeatherPanel from "./components/WeatherPanel";

import { getWeather } from "./services/weatherService";
import type { WeatherResult } from "./services/weatherService";

function App() {
  const [location, setLocation] = useState({
    latitude: 52.1326,
    longitude: 5.2913,
    address: ""
  });

  const [weather, setWeather] = useState<WeatherResult | null>(null);

  async function handleLocationFound(locationData: {
    address: string;
    latitude: number;
    longitude: number;
  }) {
    setLocation(locationData);

    const weatherData = await getWeather(
      locationData.latitude,
      locationData.longitude
    );

    setWeather(weatherData);
  }

  return (
    <div className="app">

      {/* HEADER */}
      <header className="header">
        <div>
          <h1>Omgevingsscan Pro</h1>
          <p>
            Incidentondersteuning • Omgevingsanalyse • Veiligheidsbeeld
          </p>
        </div>
      </header>


      {/* ZOEKEN */}
      <section className="search-panel">
        <h2>Incidentlocatie</h2>

        <SearchBar
          onLocationFound={handleLocationFound}
        />
      </section>


      {/* DASHBOARD */}
      <main className="dashboard">

        {/* METEO */}
        <section className="panel weather-panel">
          <h2>Weersituatie</h2>

          <WeatherPanel
            weather={weather}
          />
        </section>


        {/* KWETSBARE OBJECTEN */}
        <section className="panel objects-panel">
          <h2>Kwetsbare objecten</h2>

          <div className="object-summary">

            <div className="object-count">
              <span className="object-count-number">
                —
              </span>

              <span className="object-count-label">
                binnen scan
              </span>
            </div>

            <div className="object-info">
              <p>
                Kwetsbare objecten worden op de kaart weergegeven.
              </p>

              <p>
                De scan kijkt binnen de 500 meter cirkel en de
                berekende gaszone.
              </p>
            </div>

          </div>
        </section>


        {/* KAART */}
        <section className="panel map-panel">
          <h2>Omgevingskaart</h2>

          <MapView
            latitude={location.latitude}
            longitude={location.longitude}
            windDirection={weather?.windDirection ?? 0}
            windSpeed={weather?.windSpeed ?? 0}
          />
        </section>

      </main>

    </div>
  );
}

export default App;
