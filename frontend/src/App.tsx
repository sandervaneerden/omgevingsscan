import { useState } from "react";

import "./App.css";

import SearchBar from "./components/SearchBar";
import WeatherPanel from "./components/WeatherPanel";
import MapView from "./components/MapView";

import {
  getWeather
} from "./services/weatherService";

import type {
  WeatherResult
} from "./services/weatherService";

import {
  getVulnerableObjects
} from "./services/vulnerableObjectService";

import type {
  VulnerableObject
} from "./services/vulnerableObjectService";


function App() {

  // ============================================
  // LOCATIE
  // ============================================

  const [
    location,
    setLocation
  ] = useState({

    latitude: 52.1326,

    longitude: 5.2913,

    address: ""

  });


  // ============================================
  // WEER
  // ============================================

  const [
    weather,
    setWeather
  ] = useState<WeatherResult | null>(
    null
  );


  // ============================================
  // OBJECTEN
  // ============================================

  const [
    objects,
    setObjects
  ] = useState<VulnerableObject[]>([]);


  const [
    objectsLoading,
    setObjectsLoading
  ] = useState(false);


  // ============================================
  // OBJECTEN OPHALEN
  // ============================================

  async function loadObjects(
    latitude: number,
    longitude: number
  ) {

    console.log(
      "🔎 Objecten ophalen..."
    );

    setObjectsLoading(true);

    try {

      const result =
        await getVulnerableObjects(
          latitude,
          longitude,
          1000
        );

      console.log(
        "✅ Objecten ontvangen:",
        result.length
      );

      setObjects(result);

    } catch (error) {

      console.error(
        "❌ Fout bij objecten:",
        error
      );

      setObjects([]);

    } finally {

      setObjectsLoading(false);

    }

  }


  // ============================================
  // LOCATIE GEVONDEN
  // ============================================

  async function handleLocationFound(
    locationData: {
      address: string;
      latitude: number;
      longitude: number;
    }
  ) {

    console.log(
      "📍 Nieuwe locatie:",
      locationData
    );


    setLocation(
      locationData
    );


    // -----------------------------
    // WEER
    // -----------------------------

    try {

      const weatherData =
        await getWeather(
          locationData.latitude,
          locationData.longitude
        );

      setWeather(
        weatherData
      );

    } catch (error) {

      console.error(
        "❌ Fout bij weer:",
        error
      );

      setWeather(null);

    }


    // -----------------------------
    // OBJECTEN
    // -----------------------------

    await loadObjects(
      locationData.latitude,
      locationData.longitude
    );

  }


  // ============================================
  // ICOON
  // ============================================

  function iconForType(
    type: string
  ) {

    switch (type) {

      case "school":
        return "🏫";

      case "hospital":
        return "🏥";

      case "church":
        return "⛪";

      case "shop":
        return "🏪";

      case "community":
        return "🏢";

      default:
        return "📍";

    }

  }


  // ============================================
  // RENDER
  // ============================================

  return (

    <div className="app">


      {/* HEADER */}

      <header className="header">

        <div>

          <h1>
            Omgevingsscan
          </h1>

          <p>
            Incidentondersteuning • Omgevingsanalyse • Veiligheidsbeeld
          </p>

        </div>

      </header>


      {/* ZOEKEN */}

      <section className="search-panel">

        <h2>
          Incidentlocatie
        </h2>

        <SearchBar
          onLocationFound={
            handleLocationFound
          }
        />

      </section>


      {/* DASHBOARD */}

      <main className="dashboard">


        {/* WEER */}

        <section className="panel weather-panel">

          <h2>
            Weersituatie
          </h2>

          <WeatherPanel
            weather={weather}
          />

        </section>


        {/* OBJECTEN */}

        <section className="panel objects-panel">

          <div className="panel-title-row">

            <h2>
              Kwetsbare objecten
            </h2>

            <span className="object-total">

              {objectsLoading
                ? "..."
                : objects.length
              }

            </span>

          </div>


          {objectsLoading ? (

            <div className="objects-loading">

              Objecten worden opgehaald...

            </div>

          ) : objects.length === 0 ? (

            <div className="objects-empty">

              <div className="empty-icon">
                ✓
              </div>

              <div>
                Geen kwetsbare objecten gevonden.
              </div>

            </div>

          ) : (

            <div className="objects-list">

              {objects.map(
                (obj) => (

                  <div
                    className="object-row"
                    key={obj.id}
                  >

                    <div className="object-icon">

                      {iconForType(
                        obj.type
                      )}

                    </div>


                    <div className="object-details">

                      <div className="object-name">
                        {obj.name}
                      </div>

                      <div className="object-type">
                        {obj.type}
                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>


        {/* KAART */}

        <section className="panel map-panel">

          <h2>
            Omgevingskaart
          </h2>

          <MapView

            latitude={
              location.latitude
            }

            longitude={
              location.longitude
            }

            windDirection={
              weather?.windDirection ?? 0
            }

            windSpeed={
              weather?.windSpeed ?? 0
            }

          />

        </section>


      </main>

    </div>

  );

}


export default App;
