import {
  useCallback,
  useState
} from "react";

import "./App.css";

import MapView from "./components/MapView";
import SearchBar from "./components/SearchBar";
import WeatherPanel from "./components/WeatherPanel";

import {
  getWeather
} from "./services/weatherService";

import type {
  WeatherResult
} from "./services/weatherService";

import type {
  VulnerableObject
} from "./services/vulnerableObjectService";


function App() {


  // ===================================================
  // LOCATIE
  // ===================================================

  const [
    location,
    setLocation
  ] = useState({

    latitude: 52.1326,

    longitude: 5.2913,

    address: ""

  });


  // ===================================================
  // WEER
  // ===================================================

  const [
    weather,
    setWeather
  ] = useState<WeatherResult | null>(
    null
  );


  // ===================================================
  // ZICHTBARE OBJECTEN
  // ===================================================

  const [
    visibleObjects,
    setVisibleObjects
  ] = useState<VulnerableObject[]>([]);


  // ===================================================
  // OBJECTEN LADEN
  // ===================================================

  const [
    objectsLoading,
    setObjectsLoading
  ] = useState(true);


  // ===================================================
  // LOCATIE GEVONDEN
  // ===================================================

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


    setLocation(
      locationData
    );


    // Oude lijst leegmaken
    setVisibleObjects([]);


    // ===============================================
    // METEO
    // ===============================================

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
        "❌ Fout bij ophalen weer:",
        error
      );


      setWeather(null);

    }

  }


  // ===================================================
  // OBJECTEN UIT MAPVIEW
  // ===================================================

  const handleVisibleObjectsChange =
    useCallback(
      (objects: VulnerableObject[]) => {

        console.log(
          "📋 Objecten voor lijst:",
          objects.length
        );

        setVisibleObjects(
          objects
        );

      },
      []
    );


  // ===================================================
  // LOADING UIT MAPVIEW
  // ===================================================

  const handleObjectsLoadingChange =
    useCallback(
      (loading: boolean) => {

        console.log(
          loading
            ? "⏳ Objecten laden..."
            : "✅ Objecten geladen"
        );

        setObjectsLoading(
          loading
        );

      },
      []
    );


  // ===================================================
  // ICOON
  // ===================================================

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


  // ===================================================
  // RENDER
  // ===================================================

  return (

    <div className="app">


      {/* =============================================
          HEADER
      ============================================= */}

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


      {/* =============================================
          ZOEKEN
      ============================================= */}

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


      {/* =============================================
          DASHBOARD
      ============================================= */}

      <main className="dashboard">


        {/* ===========================================
            METEO
        =========================================== */}

        <section className="panel weather-panel">

          <h2>
            Weersituatie
          </h2>

          <WeatherPanel
            weather={weather}
          />

        </section>


        {/* ===========================================
            KWETSBARE OBJECTEN
        =========================================== */}

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


          {/* =========================================
              LADEN
          ========================================= */}

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

                Geen kwetsbare objecten
                binnen het huidige
                risicogebied gevonden.

              </div>

            </div>

          ) : (

            <div className="objects-list">

              {visibleObjects.map(
                (obj) => (

                  <div
                    className="object-row"
                    key={obj.id}
                  >


                    {/* ICOON */}

                    <div className="object-icon">

                      {iconForType(
                        obj.type
                      )}

                    </div>


                    {/* INFORMATIE */}

                    <div className="object-details">

                      <div className="object-name">

                        {obj.name}

                      </div>

                      <div className="object-type">

                        {obj.type}

                      </div>

                    </div>


                    {/* AFSTAND */}

                    <div className="object-distance">

                      {/* Afstand wordt hier niet opnieuw
                          berekend. De kaart bepaalt welke
                          objecten zichtbaar zijn. */}

                      Binnen risicogebied

                    </div>


                  </div>

                )
              )}

            </div>

          )}

        </section>


        {/* ===========================================
            KAART
        =========================================== */}

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

            onVisibleObjectsChange={
              handleVisibleObjectsChange
            }

            onObjectsLoadingChange={
              handleObjectsLoadingChange
            }

          />

        </section>


      </main>

    </div>

  );

}


export default App;
