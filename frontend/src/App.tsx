import { useRef, useState } from "react";
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
   CONSTANTEN
   ========================================================= */

const OBJECT_SEARCH_RADIUS = 3000;
const OBJECT_CIRCLE_RADIUS = 500;


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
   PUNT IN POLYGON
   ========================================================= */

function pointInPolygon(
  latitude: number,
  longitude: number,
  polygon: [number, number][]
): boolean {

  if (polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {

    const latitudeI = polygon[i][0];
    const longitudeI = polygon[i][1];

    const latitudeJ = polygon[j][0];
    const longitudeJ = polygon[j][1];

    const intersects =
      (
        (latitudeI > latitude) !==
        (latitudeJ > latitude)
      ) &&
      (
        longitude <
        (
          (longitudeJ - longitudeI) *
            (latitude - latitudeI) /
            (latitudeJ - latitudeI) +
          longitudeI
        )
      );

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
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
   SVG ICOON VOOR OBJECT
   Zelfde stijl als op de kaart
   ========================================================= */

function iconForType(
  type: string
): string {

  switch (type) {

    /* =====================================================
       ZIEKENHUIS / KLINIEK
       ===================================================== */

    case "hospital":
    case "clinic":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <rect
            x="5"
            y="4"
            width="22"
            height="24"
            rx="2"
            fill="#d32f2f"
          />

          <rect
            x="13"
            y="8"
            width="6"
            height="16"
            fill="white"
          />

          <rect
            x="8"
            y="13"
            width="16"
            height="6"
            fill="white"
          />
        </svg>
      `;


    /* =====================================================
       ZORG
       ===================================================== */

    case "healthcare":
    case "care":
    case "nursing_home":
    case "care_home":
    case "residential_care":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="#1976d2"
          />

          <path
            d="M16 8V24"
            stroke="white"
            stroke-width="3"
            stroke-linecap="round"
          />

          <path
            d="M8 16H24"
            stroke="white"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg>
      `;


    /* =====================================================
       HUISARTS / TANDARTS / APOTHEEK
       ===================================================== */

    case "doctors":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="#1976d2"
          />

          <path
            d="M11 10V17C11 20 13 22 16 22C19 22 21 20 21 17V10"
            fill="none"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
          />

          <path
            d="M11 10H15"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
          />

          <path
            d="M17 10H21"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
          />
        </svg>
      `;


    case "dentist":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="#1976d2"
          />

          <path
            d="M10 10C12 8 14 10 16 10C18 10 20 8 22 10C23 12 21 15 21 18C21 21 19 24 18 24C17 24 17 20 16 20C15 20 15 24 14 24C13 24 11 21 11 18C11 15 9 12 10 10Z"
            fill="white"
          />
        </svg>
      `;


    case "pharmacy":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="#1976d2"
          />

          <rect
            x="10"
            y="13"
            width="12"
            height="6"
            rx="2"
            fill="white"
          />

          <rect
            x="13"
            y="10"
            width="6"
            height="12"
            rx="2"
            fill="white"
          />
        </svg>
      `;


    /* =====================================================
       ONDERWIJS
       ===================================================== */

    case "school":
    case "kindergarten":
    case "childcare":
    case "college":
    case "university":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <path
            d="M3 13L16 4L29 13L16 22L3 13Z"
            fill="#f9a825"
          />

          <path
            d="M8 16V27H24V16"
            fill="#f9a825"
          />

          <rect
            x="13"
            y="20"
            width="6"
            height="7"
            fill="white"
          />
        </svg>
      `;


    /* =====================================================
       RELIGIE
       ===================================================== */

    case "church":
    case "place_of_worship":
    case "mosque":
    case "synagogue":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <path
            d="M6 27H26"
            stroke="#7b1fa2"
            stroke-width="2"
          />

          <path
            d="M9 27V15H23V27"
            fill="#7b1fa2"
          />

          <path
            d="M7 15H25L16 7L7 15Z"
            fill="#7b1fa2"
          />

          <path
            d="M16 3V10"
            stroke="#7b1fa2"
            stroke-width="2"
          />

          <path
            d="M13 6H19"
            stroke="#7b1fa2"
            stroke-width="2"
          />
        </svg>
      `;


    /* =====================================================
       WINKEL
       ===================================================== */

    case "shop":
    case "supermarket":
    case "department_store":
    case "shopping_centre":
    case "mall":
    case "hardware_store":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <path
            d="M5 12L7 5H25L27 12Z"
            fill="#ef6c00"
          />

          <rect
            x="6"
            y="12"
            width="20"
            height="15"
            fill="#fb8c00"
          />

          <rect
            x="11"
            y="18"
            width="10"
            height="9"
            fill="white"
          />
        </svg>
      `;


    /* =====================================================
       MAATSCHAPPELIJK
       ===================================================== */

    case "community":
    case "community_centre":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <path
            d="M4 14L16 5L28 14V27H4V14Z"
            fill="#388e3c"
          />

          <rect
            x="9"
            y="17"
            width="5"
            height="6"
            fill="white"
          />

          <rect
            x="18"
            y="17"
            width="5"
            height="6"
            fill="white"
          />
        </svg>
      `;


    /* =====================================================
       OVERIG
       ===================================================== */

    default:

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <circle
            cx="16"
            cy="16"
            r="11"
            fill="#607d8b"
          />

          <circle
            cx="16"
            cy="16"
            r="4"
            fill="white"
          />
        </svg>
      `;
  }
}


/* =========================================================
   CATEGORIE ICOON
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
     GASZONE
     ======================================================= */

  const [
    gasZone,
    setGasZone
  ] = useState<[number, number][]>([]);


  /* =======================================================
     INGEKLAPTE CATEGORIEËN
     
     true = ingeklapt
     false = open
     
     Standaard staan alle categorieën ingeklapt.
     ======================================================= */

  const [
    collapsedCategories,
    setCollapsedCategories
  ] = useState<Record<Category, boolean>>({
    Zorg: true,
    Onderwijs: true,
    Religie: true,
    Winkels: true,
    Maatschappelijk: true,
    Overig: true,
  });


  /* =======================================================
     CATEGORIE OPEN / DICHT
     ======================================================= */

  function toggleCategory(
    category: Category
  ) {

    setCollapsedCategories(
      (previous) => ({
        ...previous,
        [category]: !previous[category],
      })
    );
  }


  /* =======================================================
     AANVRAAG-ID
     ======================================================= */

  const requestIdRef =
    useRef(0);


  /* =======================================================
     OBJECTEN OPHALEN
     ======================================================= */

  async function loadObjects(
    latitude: number,
    longitude: number,
    requestId: number
  ) {

    console.log(
      "🔎 Objecten ophalen binnen:",
      OBJECT_SEARCH_RADIUS,
      "meter"
    );

    try {

      const result =
        await getVulnerableObjects(
          latitude,
          longitude,
          OBJECT_SEARCH_RADIUS
        );


      if (
        requestId !== requestIdRef.current
      ) {

        console.log(
          "⚠️ Oude objectaanvraag genegeerd."
        );

        return;
      }


      console.log(
        "✅ Objecten ontvangen:",
        result.length
      );

      setObjects(result);

    } catch (error) {

      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      console.error(
        "❌ Fout bij objecten:",
        error
      );

      setObjects([]);

    } finally {

      if (
        requestId === requestIdRef.current
      ) {

        setObjectsLoading(false);

      }
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

    requestIdRef.current += 1;

    const requestId =
      requestIdRef.current;


    console.log(
      "📍 Nieuwe locatie:",
      locationData,
      "request:",
      requestId
    );


    setLocation(locationData);


    /* -----------------------------------------------------
       OUDE DATA WISSEN
       ----------------------------------------------------- */

    setWeather(null);

    setObjects([]);

    setGasZone([]);

    setObjectsLoading(true);


    /* -----------------------------------------------------
       WEER
       ----------------------------------------------------- */

    try {

      const weatherData =
        await getWeather(
          locationData.latitude,
          locationData.longitude
        );


      if (
        requestId !== requestIdRef.current
      ) {

        return;
      }


      setWeather(weatherData);

    } catch (error) {

      if (
        requestId !== requestIdRef.current
      ) {

        return;
      }

      console.error(
        "❌ Fout bij weer:",
        error
      );

      setWeather(null);
    }


    /* -----------------------------------------------------
       OBJECTEN
       ----------------------------------------------------- */

    await loadObjects(
      locationData.latitude,
      locationData.longitude,
      requestId
    );
  }


  /* =========================================================
     OBJECTEN FILTEREN
     ========================================================= */

  const visibleObjects =
    objects.filter(
      (object) => {

        const name =
          object.name
            .trim()
            .toLowerCase();


        /* ---------------------------------------------------
           NAAMLOZE WINKELCENTRA UITSLUITEN
           --------------------------------------------------- */

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


        /* ---------------------------------------------------
           AFSTAND
           --------------------------------------------------- */

        const distance =
          distanceInMeters(
            location.latitude,
            location.longitude,
            object.latitude,
            object.longitude
          );


        /* ---------------------------------------------------
           500 METER
           --------------------------------------------------- */

        if (
          distance <= OBJECT_CIRCLE_RADIUS
        ) {

          return true;
        }


        /* ---------------------------------------------------
           GASZONE NOG NIET BESCHIKBAAR
           --------------------------------------------------- */

        if (
          gasZone.length < 3
        ) {

          return false;
        }


        /* ---------------------------------------------------
           GASZONE
           --------------------------------------------------- */

        return pointInPolygon(
          object.latitude,
          object.longitude,
          gasZone
        );
      }
    );


  /* =========================================================
     OBJECTEN GROEPEREN
     ========================================================= */

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


  /* =========================================================
     TOTAAL
     ========================================================= */

  const totalVisibleObjects =
    visibleObjects.length;


  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="app">

      {/* ===================================================
          HEADER
          =================================================== */}

      <header className="header">

        <div className="header-inner">

          <div className="header-title">

            <h1>
              Omgevingsscan
            </h1>

            <p>
              Incidentondersteuning • Omgevingsanalyse • Veiligheidsbeeld
            </p>

          </div>


          <div className="header-status">

            <span className="header-status-indicator" />

            <div className="header-status-text">

              <span className="header-status-label">
                SYSTEEMSTATUS
              </span>

              <span className="header-status-value">
                Operationeel
              </span>

            </div>

          </div>

        </div>


        <div className="header-accent" />

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


                  const isCollapsed =
                    collapsedCategories[category];


                  return (

                    <div
                      className={`object-category ${
                        isCollapsed
                          ? "object-category-collapsed"
                          : "object-category-open"
                      }`}
                      key={category}
                    >

                      {/* =================================
                          CATEGORIEBALK
                          ================================= */}

                      <button
                        type="button"
                        className="object-category-title"
                        onClick={() =>
                          toggleCategory(category)
                        }
                        aria-expanded={!isCollapsed}
                      >

                        <span className="object-category-icon">
                          {categoryIcon(category)}
                        </span>

                        <span className="object-category-name">
                          {category}
                        </span>

                        <span className="object-category-count">
                          {sortedObjects.length}
                        </span>

                        <span
                          className={`category-chevron ${
                            isCollapsed
                              ? "collapsed"
                              : "expanded"
                          }`}
                        >
                          ›
                        </span>

                      </button>


                      {/* =================================
                          OBJECTEN
                          ================================= */}

                      {!isCollapsed && (

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

                                  <div
                                    className="object-icon"
                                    dangerouslySetInnerHTML={{
                                      __html:
                                        iconForType(
                                          object.type
                                        )
                                    }}
                                  />


                                  <div className="object-details">

                                    <div className="object-name">
                                      {object.name}
                                    </div>

                                    <div className="object-type">
                                      {objectTypeName(
                                        object.type
                                      )}
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

                      )}

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
            windDirection={
              weather?.windDirection ?? 0
            }
            windSpeed={
              weather?.windSpeed ?? 0
            }
            weatherLoaded={
              weather !== null
            }
            objects={visibleObjects}
            onGasZoneCreated={
              setGasZone
            }
          />

        </section>

      </main>

    </div>
  );
}


export default App;