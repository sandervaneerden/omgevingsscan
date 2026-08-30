import { useState } from "react";

import "./App.css";

import SearchBar from "./components/SearchBar";
import WeatherPanel from "./components/WeatherPanel";
import MapView from "./components/MapView";

import { getWeather } from "./services/weatherService";

import type { WeatherResult } from "./services/weatherService";

import { getVulnerableObjects } from "./services/vulnerableObjectService";

import type {
  VulnerableObject,
} from "./services/vulnerableObjectService";


function App() {

  // ==================================================
  // LOCATIE
  // ==================================================

  const [location, setLocation] = useState({
    latitude: 52.1326,
    longitude: 5.2913,
    address: "",
  });


  // ==================================================
  // WEER
  // ==================================================

  const [weather, setWeather] =
    useState<WeatherResult | null>(null);


  // ==================================================
  // KWETSBARE OBJECTEN
  // ==================================================

  const [objects, setObjects] =
    useState<VulnerableObject[]>([]);

  const [objectsLoading, setObjectsLoading] =
    useState(false);


  // ==================================================
  // OBJECTEN OPHALEN
  // ==================================================

  async function loadObjects(
    latitude: number,
    longitude: number
  ) {

    console.log("🔎 Kwetsbare objecten ophalen...");
    console.log("📍 Locatie:", latitude, longitude);
    console.log("📏 Zoekradius: 1000 meter");

    setObjectsLoading(true);

    try {

      const result =
        await getVulnerableObjects(
          latitude,
          longitude,
          1000
        );

      console.log(
        "✅ Kwetsbare objecten ontvangen:",
        result.length
      );

      console.log(
        "📍 Objecten:",
        result
      );

      setObjects(result);

    } catch (error) {

      console.error(
        "❌ Fout bij ophalen kwetsbare objecten:",
        error
      );

      setObjects([]);

    } finally {

      setObjectsLoading(false);

    }

  }


  // ==================================================
  // NIEUWE INCIDENTLOCATIE
  // ==================================================

  async function handleLocationFound(
    locationData: {
      address: string;
      latitude: number;
      longitude: number;
    }
  ) {

    console.log(
      "📍 Nieuwe incidentlocatie:",
      locationData
    );

    setLocation(locationData);


    // ==================================================
    // WEER OPHALEN
    // ==================================================

    try {

      const weatherData =
        await getWeather(
          locationData.latitude,
          locationData.longitude
        );

      console.log(
        "🌤️ Weer ontvangen:",
        weatherData
      );

      setWeather(weatherData);

    } catch (error) {

      console.error(
        "❌ Fout bij ophalen weer:",
        error
      );

      setWeather(null);

    }


    // ==================================================
    // OBJECTEN OPHALEN
    // ==================================================

    await loadObjects(
      locationData.latitude,
      locationData.longitude
    );

  }


  // ==================================================
  // AFSTAND BEREKENEN
  // ==================================================

  function distanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {

    const R = 6371000;

    const dLat =
      (lat2 - lat1) *
      Math.PI /
      180;

    const dLon =
      (lon2 - lon1) *
      Math.PI /
      180;

    const a =
      Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +

      Math.cos(
        lat1 * Math.PI / 180
      ) *

      Math.cos(
        lat2 * Math.PI / 180
      ) *

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


  // ==================================================
  // ICOON PER OBJECTTYPE
  // ==================================================

  function iconForType(type: string) {

    switch (type) {

      case "hospital":
        return "🏥";

      case "clinic":
        return "⚕️";

      case "healthcare":
        return "⚕️";

      case "nursing_home":
        return "👵";

      case "care":
        return "♿";

      case "school":
        return "🏫";

      case "kindergarten":
        return "👶";

      case "church":
        return "⛪";

      case "supermarket":
        return "🛒";

      case "department_store":
        return "🏬";

      case "mall":
        return "🏬";

      case "hardware_store":
        return "🔨";

      case "community":
        return "🏢";

      default:
        return "📍";

    }

  }


  // ==================================================
  // NEDERLANDSE NAAM OBJECTTYPE
  // ==================================================

  function objectTypeName(type: string) {

    switch (type) {

      case "hospital":
        return "Ziekenhuis";

      case "clinic":
        return "Kliniek";

      case "healthcare":
        return "Gezondheidszorg";

      case "nursing_home":
        return "Verpleeghuis";

      case "care":
        return "Zorginstelling";

      case "school":
        return "School";

      case "kindergarten":
        return "Kinderopvang";

      case "church":
        return "Kerk";

      case "supermarket":
        return "Supermarkt";

      case "department_store":
        return "Groot warenhuis";

      case "mall":
        return "Winkelcentrum";

      case "hardware_store":
        return "Bouwmarkt";

      case "community":
        return "Maatschappelijke instelling";

      default:
        return "Overige locatie";

    }

  }


  // ==================================================
  // CATEGORIE BEPALEN
  // ==================================================

  function categoryForType(type: string) {

    switch (type) {

      case "hospital":
      case "clinic":
      case "healthcare":
      case "nursing_home":
      case "care":

        return "Zorg";


      case "school":
      case "kindergarten":

        return "Onderwijs";


      case "church":

        return "Religie";


      case "supermarket":
      case "department_store":
      case "mall":
      case "hardware_store":

        return "Grote winkels";


      case "community":

        return "Maatschappelijk";


      default:

        return "Overig";

    }

  }


  // ==================================================
  // CATEGORIE ICOON
  // ==================================================

  function categoryIcon(category: string) {

    switch (category) {

      case "Zorg":
        return "🏥";

      case "Onderwijs":
        return "🏫";

      case "Religie":
        return "⛪";

      case "Grote winkels":
        return "🛒";

      case "Maatschappelijk":
        return "🏢";

      default:
        return "📍";

    }

  }


  // ==================================================
  // OBJECTEN GROEPEREN
  // ==================================================

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

        groups[category].push(object);

        return groups;

      },
      {} as Record<
        string,
        VulnerableObject[]
      >
    );


  // ==================================================
  // VOLGORDE CATEGORIEËN
  // ==================================================

  const categoryOrder = [
    "Zorg",
    "Onderwijs",
    "Religie",
    "Grote winkels",
    "Maatschappelijk",
    "Overig",
  ];


  // ==================================================
  // RENDER
  // ==================================================

  return (

    <div className="app">


      {/* ==================================================
          HEADER
      ================================================== */}

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


      {/* ==================================================
          ZOEKEN
      ================================================== */}

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


      {/* ==================================================
          DASHBOARD
      ================================================== */}

      <main className="dashboard">


        {/* ==================================================
            WEER
        ================================================== */}

        <section className="panel weather-panel">

          <h2>
            Weersituatie
          </h2>

          <WeatherPanel
            weather={weather}
          />

        </section>


        {/* ==================================================
            KWETSBARE OBJECTEN
        ================================================== */}

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


          {/* ==================================================
              LADEN
          ================================================== */}

          {objectsLoading ? (

            <div className="objects-loading">

              <div className="loading-spinner">
                ⟳
              </div>

              Objecten worden opgehaald...

            </div>


          ) : objects.length === 0 ? (

            /* ==================================================
               GEEN OBJECTEN
            ================================================== */

            <div className="objects-empty">

              <div className="empty-icon">
                ✓
              </div>

              <div>
                Geen kwetsbare objecten gevonden.
              </div>

            </div>


          ) : (

            /* ==================================================
               OBJECTEN
            ================================================== */

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


                  // ------------------------------------------
                  // SORTEREN OP AFSTAND
                  // ------------------------------------------

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


                      {/* ==================================================
                          CATEGORIE HEADER
                      ================================================== */}

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


                      {/* ==================================================
                          OBJECTLIJST
                      ================================================== */}

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
                                key={`${obj.id}-${obj.type}`}
                              >


                                {/* OBJECT ICOON */}

                                <div className="object-icon">

                                  {iconForType(
                                    obj.type
                                  )}

                                </div>


                                {/* OBJECT INFORMATIE */}

                                <div className="object-details">

                                  <div className="object-name">

                                    {obj.name}

                                  </div>

                                  <div className="object-type">

                                    {objectTypeName(
                                      obj.type
                                    )}

                                  </div>

                                </div>


                                {/* AFSTAND */}

                                <div className="object-distance">

                                  {distance < 1000
                                    ? `${Math.round(distance)} m`
                                    : `${(
                                        distance / 1000
                                      ).toFixed(1)} km`
                                  }

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


        {/* ==================================================
            KAART
        ================================================== */}

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