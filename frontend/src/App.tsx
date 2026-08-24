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
  // AFSTAND
  // ============================================

  function distanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {

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
  // CATEGORIE
  // ============================================

  function categoryForType(
    type: string
  ) {

    switch (type) {

      case "hospital":
        return "Zorg";

      case "school":
        return "Onderwijs";

      case "church":
        return "Religie";

      case "shop":
        return "Winkels";

      case "community":
        return "Maatschappelijk";

      default:
        return "Overig";

    }

  }


  // ============================================
  // CATEGORIE ICOON
  // ============================================

  function categoryIcon(
    category: string
  ) {

    switch (category) {

      case "Zorg":
        return "🏥";

      case "Onderwijs":
        return "🏫";

      case "Religie":
        return "⛪";

      case "Winkels":
        return "🏪";

      case "Maatschappelijk":
        return "🏢";

      default:
        return "📍";

    }

  }


  // ============================================
  // OBJECTEN CATEGORISEREN
  // ============================================

  const groupedObjects =
    objects.reduce(
      (
        groups,
        object
      ) => {

        const category =
          categoryForType(
            object.type
          );

        if (!groups[category]) {

          groups[category] = [];

        }

        groups[category].push(
          object
        );

        return groups;

      },
      {} as Record<
        string,
        VulnerableObject[]
      >
    );


  // ============================================
  // CATEGORIE VOLGORDE
  // ============================================

  const categoryOrder = [
    "Zorg",
    "Onderwijs",
    "Religie",
    "Winkels",
    "Maatschappelijk",
    "Overig"
  ];


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

              {categoryOrder.map(
                (category) => {

                  const categoryObjects =
                    groupedObjects[category];

                  if (
                    !categoryObjects ||
                    categoryObjects.length === 0
                  ) {

                    return null;

                  }


                  const sortedObjects =
                    [...categoryObjects].sort(
                      (a, b) => {

                        const distanceA =
                          distanceInMeters(
                            location.latitude,
                            location.longitude,
                            a.latitude,
                            a.longitude
                          );

                        const distanceB =
                          distanceInMeters(
                            location.latitude,
                            location.longitude,
                            b.latitude,
                            b.longitude
                          );

                        return (
                          distanceA -
                          distanceB
                        );

                      }
                    );


                  return (

                    <div
                      className="object-category"
                      key={category}
                    >


                      {/* CATEGORIE HEADER */}

                      <div className="object-category-title">

                        <span className="object-category-icon">

                          {categoryIcon(
                            category
                          )}

                        </span>

                        <span className="object-category-name">

                          {category}

                        </span>

                        <span className="object-category-count">

                          {sortedObjects.length}

                        </span>

                      </div>


                      {/* OBJECTEN */}

                      <div className="object-category-list">

                        {sortedObjects.map(
                          (obj) => {

                            const distance =
                              distanceInMeters(
                                location.latitude,
                                location.longitude,
                                obj.latitude,
                                obj.longitude
                              );


                            return (

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


                                <div className="object-distance">

                                  {Math.round(
                                    distance
                                  )} m

                                </div>


                              </div>

                            );

                          }
                        )}

                      </div>

                    </div>

                  );

                }
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