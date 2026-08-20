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

      <header className="header">
        <div>
          <h1>Omgevingsscan Pro</h1>

          <p>
            Incidentondersteuning • Omgevingsanalyse • Veiligheidsbeeld
          </p>

        </div>
      </header>



      <main className="dashboard">


        <section className="panel">

          <h2>Incidentlocatie</h2>

          <SearchBar
            onLocationFound={handleLocationFound}
          />

        </section>



        <section className="panel">

          <h2>Weersituatie</h2>

          <WeatherPanel
            weather={weather}
          />

        </section>



        <section className="panel">

          <h2>Kaart</h2>

          <MapView
  latitude={location.latitude}
  longitude={location.longitude}
  windDirection={weather?.windDirection ?? 0}
  windSpeed={weather?.windSpeed ?? 0}
/>

        </section>



        <section className="panel">

          <h2>Kwetsbare objecten</h2>

          <table>

            <thead>
              <tr>
                <th>Naam</th>
                <th>Type</th>
                <th>Afstand</th>
                <th>Status</th>
              </tr>
            </thead>


            <tbody>

              <tr>
                <td>Voorbeeld locatie</td>
                <td>School</td>
                <td>350 m</td>
                <td>Normaal</td>
              </tr>

            </tbody>

          </table>

        </section>


      </main>

    </div>
  );
}


export default App;