import { useEffect, useState } from "react";
import "./App.css";

import MapView from "./components/MapView";
import SearchBar from "./components/SearchBar";
import WeatherPanel from "./components/WeatherPanel";

import { getWeather } from "./services/weatherService";
import type { WeatherResult } from "./services/weatherService";

import { getVulnerableObjects } from "./services/vulnerableObjectService";
import type { VulnerableObject } from "./services/vulnerableObjectService";


function App() {

  const [location, setLocation] = useState({
    latitude: 52.1326,
    longitude: 5.2913,
    address: ""
  });

  const [weather, setWeather] =
    useState<WeatherResult | null>(null);

  const [objects, setObjects] =
    useState<VulnerableObject[]>([]);

  const [objectsLoading, setObjectsLoading] =
    useState(false);


  async function handleLocationFound(locationData: {
    address: string;
    latitude: number;
    longitude: number;
  }) {

    setLocation(locationData);

    // Meteo ophalen
    try {

      const weatherData = await getWeather(
        locationData.latitude,
        locationData.longitude
      );

      setWeather(weatherData);

    } catch (error) {

      console.error(
        "Fout bij ophalen weer:",
        error
      );

      setWeather(null);
    }


    // Kwetsbare objecten ophalen
    setObjectsLoading(true);

    try {

      const objectData =
        await getVulnerableObjects(
          locationData.latitude,
          locationData.longitude,
          3000
        );

      setObjects(objectData);

    } catch (error) {

      console.error(
        "Fout bij ophalen kwetsbare objecten:",
        error
      );

      setObjects([]);

    } finally {

      setObjectsLoading(false);

    }
  }


  // Objecten ophalen voor de standaardlocatie
  useEffect(() => {

    async function loadInitialObjects() {

      setObjectsLoading(true);

      try {

        const result =
          await getVulnerableObjects(
            location.latitude,
            location.longitude,
            3000
          );

        setObjects(result);

      } catch (error) {

        console.error(
          "Fout bij laden objecten:",
          error
        );

        setObjects([]);

      } finally {

        setObjectsLoading(false);

      }
    }

    loadInitialObjects();

  }, []);


  // Afstand berekenen
  function distanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {

    const R = 6371000;

    const dLat =
      (lat2 - lat1) * Math.PI / 180;

    const dLon =
      (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *

      Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  }


  // Alleen objecten binnen 500 meter
  const visibleObjects =
    objects
      .map((obj) => {

        const distance =
          distanceInMeters(
            location.latitude,
            location.longitude,
            obj.latitude,
            obj.longitude
          );

        return {
          ...obj,
          distance
        };

      })
      .filter(
        (obj) => obj.distance <= 500
      )
      .sort(
        (a, b) =>
          a.distance - b.distance
      );


  // Icoon bepalen
  function iconForType(type: string) {

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


  return (

    <div className="app">


      {/* =========================
          HEADER
      ========================= */}

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


      {/* =========================
          ZOEKEN
      ========================= */}

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


      {/* =========================
          DASHBOARD
      ========================= */}

      <main className="dashboard">


        {/* =========================
            METEO
        ========================= */}

        <section className="panel weather-panel">

          <h2>
            Weersituatie
          </h2>

          <WeatherPanel
            weather={weather}
          />

        </section>


        {/* =========================
            KWETSBARE OBJECTEN
        ========================= */}

        <section className="panel objects-panel">

          <div className="panel-title-row">

            <h2>
              Kwetsbare objecten
            </h2>

            <span className="object-total">
              {objectsLoading
                ? "..."
                : visibleObjects.length
              }
            </span>

          </div>


          {objectsLoading ? (

            <div className="objects-loading">
              Objecten worden opgehaald...
            </div>

          ) : visibleObjects.length === 0 ? (

            <div className="objects-empty">

              <div className="empty-icon">
                ✓
              </div>

              <div>
                Geen kwetsbare objecten binnen 500 meter gevonden.
              </div>

            </div>

          ) : (

            <div className="objects-list">

              {visibleObjects.map((obj) => (

                <div
                  className="object-row"
                  key={obj.id}
                >

                  <div className="object-icon">

                    {iconForType(obj.type)}

                  </div>


                  <div className="object-details">

                    <div className="object-name">
                      {obj.name}
                    </div>

                    <div className="object-type">
                      {obj.type}
                    </div>

                  </div>


                  <div className="object-distance">

                    {obj.distance < 1000
                      ? `${Math.round(obj.distance)} m`
                      : `${(
                          obj.distance / 1000
                        ).toFixed(1)} km`
                    }

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>


        {/* =========================
            KAART
        ========================= */}

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
