import { useEffect, useState } from "react";
import "./App.css";

import MapView from "./components/MapView";
import SearchBar from "./components/SearchBar";
import WeatherPanel from "./components/WeatherPanel";

import { getWeather } from "./services/weatherService";
import type { WeatherResult } from "./services/weatherService";

import { getVulnerableObjects } from "./services/vulnerableObjectService";
import type { VulnerableObject } from "./services/vulnerableObjectService";


// ======================================================
// AFSTAND BEREKENEN
// ======================================================

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


// ======================================================
// CONTROLEREN OF OBJECT IN GASZONE LIGT
// ======================================================

function pointInGasZone(
  latitude: number,
  longitude: number,
  zone: [number, number][]
): boolean {

  if (zone.length < 3) {
    return false;
  }

  let inside = false;

  for (
    let i = 0, j = zone.length - 1;
    i < zone.length;
    j = i++
  ) {

    const lat1 = zone[i][0];
    const lon1 = zone[i][1];

    const lat2 = zone[j][0];
    const lon2 = zone[j][1];

    const intersect =
      (lon1 > longitude) !== (lon2 > longitude) &&
      latitude <
        ((lat2 - lat1) *
          (longitude - lon1)) /
          (lon2 - lon1) +
          lat1;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}


// ======================================================
// ICOON PER TYPE
// ======================================================

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


// ======================================================
// APP
// ======================================================

function App() {


  // ====================================================
  // INCIDENTLOCATIE
  // ====================================================

  const [location, setLocation] = useState({

    latitude: 52.1326,

    longitude: 5.2913,

    address: ""

  });


  // ====================================================
  // METEO
  // ====================================================

  const [weather, setWeather] =
    useState<WeatherResult | null>(null);


  // ====================================================
  // KWETSBARE OBJECTEN
  //
  // Deze lijst wordt slechts één keer opgehaald.
  // Zoekgebied = 1000 meter.
  // ====================================================

  const [objects, setObjects] =
    useState<VulnerableObject[]>([]);


  // ====================================================
  // LAADSTATUS OBJECTEN
  // ====================================================

  const [objectsLoading, setObjectsLoading] =
    useState(false);


  // ====================================================
  // GASZONE
  // ====================================================

  const [gasZone, setGasZone] =
    useState<[number, number][]>([]);


  // ====================================================
  // ALLE GEGEVENS LADEN
  // ====================================================

  async function loadData(
    latitude: number,
    longitude: number
  ) {

    setObjectsLoading(true);

    console.log(
      "🔎 Gegevens laden voor:",
      latitude,
      longitude
    );


    try {

      // Meteo en objecten tegelijkertijd ophalen.
      //
      // Objecten worden gezocht binnen 1000 meter.

      const [
        weatherData,
        objectData
      ] = await Promise.all([

        getWeather(
          latitude,
          longitude
        ),

        getVulnerableObjects(
          latitude,
          longitude,
          1000
        )

      ]);


      // Meteo

      setWeather(
        weatherData
      );


      // Objecten

      setObjects(
        objectData
      );


      console.log(
        "✅ Meteo geladen"
      );

      console.log(
        "✅ Kwetsbare objecten geladen:",
        objectData.length
      );


    } catch (error) {

      console.error(
        "❌ Fout bij laden gegevens:",
        error
      );


      setWeather(null);

      setObjects([]);


    } finally {

      setObjectsLoading(false);

    }

  }


  // ====================================================
  // NIEUWE LOCATIE
  // ====================================================

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


    // Nieuwe locatie instellen

    setLocation(
      locationData
    );


    // Oude gaszone verwijderen

    setGasZone([]);


    // Nieuwe gegevens laden

    await loadData(

      locationData.latitude,

      locationData.longitude

    );

  }


  // ====================================================
  // STANDAARDLOCATIE
  //
  // Alleen bij het openen van de applicatie.
  // ====================================================

  useEffect(() => {

    loadData(

      location.latitude,

      location.longitude

    );

    // Bewust alleen één keer uitvoeren.

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);


  // ====================================================
  // OBJECTEN VOOR DE LIJST
  //
  // Een object komt in de lijst wanneer:
  //
  // 1. het binnen 500 meter ligt
  // OF
  // 2. het binnen de gaszone ligt.
  //
  // De objecten zelf zijn al opgehaald binnen 1 km.
  // ====================================================

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


        const insideCircle =
          distance <= 500;


        const insideGasZone =
          pointInGasZone(

            obj.latitude,

            obj.longitude,

            gasZone

          );


        return {

          ...obj,

          distance,

          insideCircle,

          insideGasZone

        };

      })


      .filter((obj) =>

        obj.insideCircle ||

        obj.insideGasZone

      )


      .sort((a, b) =>

        a.distance -
        b.distance

      );


  console.log(
    "📋 Objecten in lijst:",
    visibleObjects.length
  );


  // ====================================================
  // RENDER
  // ====================================================

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


        {/* =================================================
            METEO
            ================================================= */}

        <section className="panel weather-panel">

          <h2>
            Weersituatie
          </h2>

          <WeatherPanel

            weather={
              weather
            }

          />

        </section>


        {/* =================================================
            KWETSBARE OBJECTEN
            ================================================= */}

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


          {/* -----------------------------------------------
              LADEN
              ----------------------------------------------- */}

          {objectsLoading ? (

            <div className="objects-loading">

              Objecten worden opgehaald...

            </div>


          ) : visibleObjects.length === 0 ? (


            /* ---------------------------------------------
               GEEN OBJECTEN
               --------------------------------------------- */

            <div className="objects-empty">

              <div className="empty-icon">
                ✓
              </div>

              <div>

                Geen kwetsbare objecten
                binnen het huidige
                zoekgebied gevonden.

              </div>

            </div>


          ) : (


            /* ---------------------------------------------
               OBJECTENLIJST
               --------------------------------------------- */

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

                      {obj.distance < 1000

                        ? `${Math.round(
                            obj.distance
                          )} m`

                        : `${(
                            obj.distance /
                            1000
                          ).toFixed(1)} km`

                      }

                    </div>


                  </div>

                )

              )}

            </div>

          )}

        </section>


        {/* =================================================
            KAART
            ================================================= */}

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

            objects={
              objects
            }

            onGasZoneChange={
              setGasZone
            }

          />

        </section>


      </main>

    </div>

  );

}


export default App;
