import { useState } from "react";
import "./App.css";

import SearchBar from "./components/SearchBar";
import WeatherPanel from "./components/WeatherPanel";
import MapView from "./components/MapView";

import {
  getWeather,
} from "./services/weatherService";

import type {
  WeatherResult,
} from "./services/weatherService";

import {
  getVulnerableObjects,
} from "./services/vulnerableObjectService";

import type {
  VulnerableObject,
} from "./services/vulnerableObjectService";


/* =========================================================
   CATEGORIEËN
   ========================================================= */

type Category =
  | "Zorg"
  | "Onderwijs"
  | "Religie"
  | "Winkels"
  | "Maatschappelijk"
  | "Overig";


/* =========================================================
   AFSTAND BEREKENEN
   ========================================================= */

function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadius = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}


/* =========================================================
   TYPE → CATEGORIE
   ========================================================= */

function categoryForType(
  type: string
): Category {

  switch (type) {

    case "hospital":
    case "healthcare":
    case "nursing_home":
    case "care_home":
    case "residential_care":
    case "care":
    case "clinic":
    case "doctors":
    case "dentist":
    case "pharmacy":
    case "physiotherapist":
    case "psychologist":
      return "Zorg";

    case "school":
    case "kindergarten":
    case "college":
    case "university":
    case "childcare":
      return "Onderwijs";

    case "church":
    case "place_of_worship":
    case "mosque":
    case "synagogue":
      return "Religie";

    case "shop":
    case "supermarket":
    case "department_store":
    case "shopping_centre":
    case "mall":
    case "hardware_store":
      return "Winkels";

    case "community":
    case "community_centre":
      return "Maatschappelijk";

    default:
      return "Overig";
  }
}


/* =========================================================
   TYPE → NEDERLANDSE NAAM
   ========================================================= */

function objectTypeName(
  type: string
): string {

  switch (type) {

    case "hospital":
      return "Ziekenhuis";

    case "healthcare":
      return "Gezondheidszorg";

    case "nursing_home":
      return "Verpleeghuis";

    case "care_home":
      return "Verzorgingshuis";

    case "residential_care":
      return "Woonzorgcentrum";

    case "care":
      return "Zorginstelling";

    case "clinic":
      return "Kliniek";

    case "doctors":
      return "Huisarts";

    case "dentist":
      return "Tandarts";

    case "pharmacy":
      return "Apotheek";

    case "physiotherapist":
      return "Fysiotherapeut";

    case "psychologist":
      return "Psycholoog";

    case "school":
      return "School";

    case "kindergarten":
      return "Kinderopvang";

    case "childcare":
      return "Kinderopvang";

    case "college":
      return "College";

    case "university":
      return "Universiteit";

    case "church":
      return "Kerk";

    case "place_of_worship":
      return "Gebedshuis";

    case "mosque":
      return "Moskee";

    case "synagogue":
      return "Synagoge";

    case "supermarket":
      return "Supermarkt";

    case "department_store":
      return "Warenhuis";

    case "shopping_centre":
      return "Winkelcentrum";

    case "mall":
      return "Winkelcentrum";

    case "hardware_store":
      return "Bouwmarkt";

    case "shop":
      return "Winkel";

    case "community":
      return "Maatschappelijke instelling";

    case "community_centre":
      return "Buurt- / wijkcentrum";

    default:
      return "Overig";
  }
}


/* =========================================================
   TYPE → ICOON
   ========================================================= */

function iconForType(
  type: string
): string {

  switch (type) {

    case "hospital":
      return "🏥";

    case "healthcare":
      return "⚕️";

    case "nursing_home":
      return "👵";

    case "care_home":
      return "🏠";

    case "residential_care":
      return "🏠";

    case "care":
      return "♿";

    case "clinic":
      return "🏥";

    case "doctors":
      return "🩺";

    case "dentist":
      return "🦷";

    case "pharmacy":
      return "💊";

    case "physiotherapist":
      return "🦵";

    case "psychologist":
      return "🧠";

    case "school":
      return "🏫";

    case "kindergarten":
      return "👶";

    case "childcare":
      return "👶";

    case "college":
      return "🎓";

    case "university":
      return "🎓";

    case "church":
      return "⛪";

    case "place_of_worship":
      return "🛐";

    case "mosque":
      return "🕌";

    case "synagogue":
      return "✡️";

    case "supermarket":
      return "🛒";

    case "department_store":
      return "🏬";

    case "shopping_centre":
      return "🏬";

    case "mall":
      return "🏬";

    case "hardware_store":
      return "🔨";

    case "shop":
      return "🏪";

    case "community":
      return "🏢";

    case "community_centre":
      return "🏢";

    default:
      return "📍";
  }
}


/* =========================================================
   CATEGORIE → ICOON
   ========================================================= */

function categoryIcon(
  category: Category
): string {

  switch (category) {

    case "Zorg":
      return "🏥";

    case "Onderwijs":
      return "🏫";

    case "Religie":
      return "⛪";

    case "Winkels":
      return "🛒";

    case "Maatschappelijk":
      return "🏢";

    case "Overig":
      return "📍";
  }
}


/* =========================================================
   CATEGORIE VOLGORDE
   ========================================================= */

const categoryOrder: Category[] = [
  "Zorg",
  "Onderwijs",
  "Religie",
  "Winkels",
  "Maatschappelijk",
  "Overig",
];


/* =========================================================
   APP
   ========================================================= */

function App() {

  /* =======================================================
     LOCATIE
     ======================================================= */

  const [
    location,
    setLocation
  ] = useState({
    // Standaardlocatie: Noorderend 4, Drachten
    latitude: 53.11148951,
    longitude: 6.13380985,
    address: "Noorderend 4, Drachten",
  });


  /* =======================================================
     WEER
     ======================================================= */

  const [
    weather,
    setWeather
  ] = useState<WeatherResult | null>(null);


  /* =======================================================
     OBJECTEN
     ======================================================= */

  const [
    objects,
    setObjects
  ] = useState<VulnerableObject[]>([]);

  const [
    objectsLoading,
    setObjectsLoading
  ] = useState(false);


  /* =======================================================
     OBJECTEN OPHALEN
     ======================================================= */

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
          3000
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


  /* =======================================================
     LOCATIE GEVONDEN
     ======================================================= */

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


    /* -------------------------------------------------------
       NIEUWE LOCATIE INSTELLEN
       ------------------------------------------------------- */

    setLocation(locationData);


    /* -------------------------------------------------------
       OUDE METEO DIRECT WISSEN
       
       Hierdoor blijft de oude gasmal niet zichtbaar.
       ------------------------------------------------------- */

    setWeather(null);


    /* -------------------------------------------------------
       OUDE OBJECTEN WISSEN
       
       Hiermee voorkomen we dat objecten van de vorige
       locatie tijdelijk bij de nieuwe locatie blijven staan.
       ------------------------------------------------------- */

    setObjects([]);


    /* -------------------------------------------------------
       WEER OPHALEN
       ------------------------------------------------------- */

    try {

      const weatherData =
        await getWeather(
          locationData.latitude,
          locationData.longitude
        );

      setWeather(weatherData);

    } catch (error) {

      console.error(
        "❌ Fout bij weer:",
        error
      );

      setWeather(null);
    }


    /* -------------------------------------------------------
       OBJECTEN OPHALEN
       ------------------------------------------------------- */

    await loadObjects(
      locationData.latitude,
      locationData.longitude
    );
  }


  /* =======================================================
     FILTER ONBETROUWBARE OBJECTEN
     ======================================================= */

  const visibleObjects =
    objects.filter(
      (object) => {

        const name =
          object.name
            .trim()
            .toLowerCase();

        /*
         * Naamloze winkelcentrum-ways zijn geen
         * afzonderlijke operationele objecten.
         */

        if (
          (
            name === "onbekend object" ||
            name === "" ||
            name === "unknown"
          ) &&
          (
            object.type === "shopping_centre" ||
            object.type === "mall"
          )
        ) {
          return false;
        }

        return true;
      }
    );


  /* =======================================================
     OBJECTEN GROEPEREN
     ======================================================= */

  const groupedObjects =
    visibleObjects.reduce(
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
        Category,
        VulnerableObject[]
      >
    );


  /* =======================================================
     TOTAAL
     ======================================================= */

  const totalVisibleObjects =
    visibleObjects.length;


  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="app">

      {/* ===================================================
          HEADER
          =================================================== */}

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


      {/* ===================================================
          ZOEKPANEEL
          =================================================== */}

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


      {/* ===================================================
          DASHBOARD
          =================================================== */}

      <main className="dashboard">


        {/* =================================================
            WEER
            ================================================= */}

        <section className="panel weather-panel">

          <h2>
            Weersituatie
          </h2>

          <WeatherPanel
            weather={weather}
          />

        </section>


        {/* =================================================
            OBJECTEN
            ================================================= */}

        <section className="panel objects-panel">

          <div className="panel-title-row">

            <h2>
              Kwetsbare objecten
            </h2>

            <span className="object-total">

              {objectsLoading
                ? "..."
                : totalVisibleObjects
              }

            </span>

          </div>


          {/* ------------------------------------------------
              STATUS
              ------------------------------------------------ */}

          {objectsLoading ? (

            <div className="objects-loading">

              <div className="loading-icon">
                ⟳
              </div>

              <div>
                Objecten worden opgehaald...
              </div>

            </div>

          ) : totalVisibleObjects === 0 ? (

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


                  /* -----------------------------------------
                     SORTEREN OP AFSTAND
                     ----------------------------------------- */

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

                        return distanceA - distanceB;
                      }
                    );


                  return (

                    <div
                      className={`object-category category-${category
                        .toLowerCase()
                        .replace(
                          /[^a-z0-9]+/g,
                          "-"
                        )}`}
                      key={category}
                    >

                      {/* -----------------------------------
                          CATEGORIE HEADER
                          ----------------------------------- */}

                      <div className="object-category-title">

                        <span className="object-category-icon">
                          {categoryIcon(category)}
                        </span>

                        <span className="object-category-name">
                          {category}
                        </span>

                        <span className="object-category-count">
                          {sortedObjects.length}
                        </span>

                      </div>


                      {/* -----------------------------------
                          OBJECTEN
                          ----------------------------------- */}

                      <div className="object-category-list">

                        {sortedObjects.map(
                          (object) => {

                            const distance =
                              distanceInMeters(
                                location.latitude,
                                location.longitude,
                                object.latitude,
                                object.longitude
                              );

                            return (

                              <div
                                className="object-row"
                                key={object.id}
                              >

                                <div className="object-icon">
                                  {iconForType(object.type)}
                                </div>


                                <div className="object-details">

                                  <div className="object-name">
                                    {object.name}
                                  </div>

                                  <div className="object-type">
                                    {objectTypeName(object.type)}
                                  </div>

                                </div>


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


        {/* =================================================
            KAART
            ================================================= */}

        <section className="panel map-panel">

          <h2>
            Omgevingskaart
          </h2>

          <MapView
            latitude={location.latitude}
            longitude={location.longitude}
            windDirection={weather?.windDirection ?? 0}
            windSpeed={weather?.windSpeed ?? 0}
            weatherLoaded={weather !== null}
            objects={visibleObjects}
          />

        </section>

      </main>

    </div>
  );
}


export default App;