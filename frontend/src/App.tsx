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
  | "Verblijf"
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
    case "mental_health":
    case "disabled_care":
    case "protected_living":
    case "hospice":
    case "rehabilitation":
    case "home_care":
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
    case "social_facility":
      return "Maatschappelijk";

    case "hotel":
    case "hostel":
    case "guest_house":
      return "Verblijf";

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

    case "mental_health":
      return "Geestelijke gezondheidszorg";

    case "disabled_care":
      return "Gehandicaptenzorg";

    case "protected_living":
      return "Beschermd wonen";

    case "hospice":
      return "Hospice";

    case "rehabilitation":
      return "Revalidatie";

    case "home_care":
      return "Thuiszorg";

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

    case "social_facility":
      return "Maatschappelijke voorziening";

    case "hotel":
      return "Hotel";

    case "hostel":
      return "Hostel";

    case "guest_house":
      return "Pension / gastenverblijf";

    default:
      return "Overig";
  }
}


/* =========================================================
   BAG GEBRUIKSDOEL
   ========================================================= */

function formatBAGUsePurpose(
  value?: string | null
): string {

  if (!value) {
    return "";
  }

  const labels: Record<string, string> = {

    woonfunctie:
      "Woonfunctie",

    gezondheidszorgfunctie:
      "Gezondheidszorgfunctie",

    bijeenkomstfunctie:
      "Bijeenkomstfunctie",

    kantoorfunctie:
      "Kantoorfunctie",

    logiesfunctie:
      "Logiesfunctie",

    onderwijsfunctie:
      "Onderwijsfunctie",

    sportfunctie:
      "Sportfunctie",

    winkelfunctie:
      "Winkelfunctie",

    industriefunctie:
      "Industriefunctie",

    overige_gebruiksfunctie:
      "Overige gebruiksfunctie",

    celfunctie:
      "Celfunctie",

  };

  return value
    .split(",")
    .map(
      (item) =>
        labels[item.trim()] ||
        item.trim()
    )
    .join(", ");
}


/* =========================================================
   TELEFOONNUMMER
   ========================================================= */

function getPhoneNumber(
  object: VulnerableObject
): string | null {

  const tags =
    object.tags;

  if (!tags) {
    return null;
  }

  const phone =
    tags["contact:phone"] ||
    tags.phone ||
    tags["contact:mobile"] ||
    tags.mobile;

  return typeof phone === "string"
    ? phone
    : null;
}


/* =========================================================
   WEBSITE
   ========================================================= */

function getWebsite(
  object: VulnerableObject
): string | null {

  const tags =
    object.tags;

  if (!tags) {
    return null;
  }

  const website =
    tags["contact:website"] ||
    tags.website;

  return typeof website === "string"
    ? website
    : null;
}


/* =========================================================
   ADRES
   ========================================================= */

function getObjectAddress(
  object: VulnerableObject
): string | null {

  const address =
    object.address;

  if (
    address &&
    (
      address.street ||
      address.housenumber ||
      address.postcode ||
      address.city
    )
  ) {

    const parts = [

      address.street,

      address.housenumber !== undefined
        ? String(address.housenumber)
        : undefined,

      address.houseletter,

      address.postcode,

      address.city,

    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }


  /* -------------------------------------------------------
     FALLBACK NAAR BAG
     ------------------------------------------------------- */

  const bag =
    object.bag;

  if (
    bag &&
    (
      bag.openbare_ruimte_naam ||
      bag.huisnummer ||
      bag.postcode ||
      bag.woonplaats_naam
    )
  ) {

    const parts = [

      bag.openbare_ruimte_naam,

      bag.huisnummer !== null &&
      bag.huisnummer !== undefined
        ? String(bag.huisnummer)
        : undefined,

      bag.huisletter,

      bag.postcode,

      bag.woonplaats_naam,

    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }


  return null;
}


/* =========================================================
   SVG ICOON VOOR OBJECT
   Zelfde stijl als op de kaart
   ========================================================= */

function iconForType(
  type: string
): string {

  switch (type) {

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


    case "healthcare":
    case "care":
    case "nursing_home":
    case "care_home":
    case "residential_care":
    case "mental_health":
    case "disabled_care":
    case "protected_living":
    case "hospice":
    case "rehabilitation":
    case "home_care":

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


    case "community":
    case "community_centre":
    case "social_facility":

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


    case "hotel":
    case "hostel":
    case "guest_house":

      return `
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <rect
            x="5"
            y="12"
            width="22"
            height="14"
            rx="2"
            fill="#8e24aa"
          />

          <rect
            x="8"
            y="15"
            width="7"
            height="5"
            fill="white"
          />

          <rect
            x="17"
            y="15"
            width="7"
            height="5"
            fill="white"
          />

          <rect
            x="13"
            y="21"
            width="6"
            height="5"
            fill="white"
          />
        </svg>
      `;


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

    case "Verblijf":
      return "🏨";

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
  "Verblijf",
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
    Verblijf: true,
    Overig: true,
  });


  /* =======================================================
     FILTER CATEGORIEËN

     true = zichtbaar
     false = verborgen

     Standaard staan alle categorieën aan.
     ======================================================= */

  const [
    enabledCategories,
    setEnabledCategories
  ] = useState<Record<Category, boolean>>({
    Zorg: true,
    Onderwijs: true,
    Religie: true,
    Winkels: true,
    Maatschappelijk: true,
    Verblijf: true,
    Overig: true,
  });


  /* =======================================================
     UITGEKLAPTE OBJECTEN
     ======================================================= */

  const [
    expandedObjects,
    setExpandedObjects
  ] = useState<Record<string, boolean>>({});


  /* =======================================================
     KOPIEERSTATUS OBJECTEN
     ======================================================= */

  const [
    objectsCopied,
    setObjectsCopied
  ] = useState(false);


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
     CATEGORIE ZICHTBAAR / ONZICHTBAAR
     ======================================================= */

  function toggleCategoryVisibility(
    category: Category
  ) {

    setEnabledCategories(
      (previous) => ({
        ...previous,
        [category]: !previous[category],
      })
    );
  }


  /* =======================================================
     OBJECT DETAILS OPEN / DICHT
     ======================================================= */

  function toggleObjectDetails(
    objectId: string
  ) {

    setExpandedObjects(
      (previous) => ({
        ...previous,
        [objectId]: !previous[objectId],
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

    setExpandedObjects({});

    setObjectsCopied(false);

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
     OBJECTEN FILTEREN OP 500 METER + GASZONE
     ========================================================= */

  const spatiallyVisibleObjects =
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
     CATEGORIE FILTER
     ========================================================= */

  const visibleObjects =
    spatiallyVisibleObjects.filter(
      (object) => {

        const category =
          categoryForType(
            object.type
          );

        return enabledCategories[category];
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
     OBJECTEN KOPIËREN
     ========================================================= */

  async function copyObjects() {

    if (
      visibleObjects.length === 0
    ) {
      return;
    }


    const lines: string[] = [];


    lines.push(
      "Kwetsbare objecten"
    );


    lines.push(
      `Incidentlocatie: ${location.address}`
    );


    lines.push(
      `Totaal: ${visibleObjects.length}`
    );


    lines.push("");


    for (
      const category of categoryOrder
    ) {

      const categoryObjects =
        groupedObjects[category];


      if (
        !categoryObjects ||
        categoryObjects.length === 0
      ) {
        continue;
      }


      lines.push(
        `${category} (${categoryObjects.length})`
      );


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


      for (
        const object of sortedObjects
      ) {

        const distance =
          distanceInMeters(
            location.latitude,
            location.longitude,
            object.latitude,
            object.longitude
          );


        const phone =
          getPhoneNumber(object);


        const website =
          getWebsite(object);


        const address =
          getObjectAddress(object);


        const bag =
          object.bag;


        const pand =
          object.pand;


        lines.push(
          `- ${object.name}`
        );


        lines.push(
          `  Type: ${objectTypeName(object.type)}`
        );


        lines.push(
          `  Afstand: ${
            distance < 1000
              ? `${Math.round(distance)} m`
              : `${(distance / 1000).toFixed(1)} km`
          }`
        );


        if (address) {

          lines.push(
            `  Adres: ${address}`
          );

        }


        if (phone) {

          lines.push(
            `  Telefoon: ${phone}`
          );

        }


        if (website) {

          lines.push(
            `  Website: ${website}`
          );

        }


        if (
          bag?.oppervlakte !== null &&
          bag?.oppervlakte !== undefined
        ) {

          lines.push(
            `  Oppervlakte: ${bag.oppervlakte} m²`
          );

        }


        if (
          pand?.bouwjaar !== null &&
          pand?.bouwjaar !== undefined
        ) {

          lines.push(
            `  Bouwjaar: ${pand.bouwjaar}`
          );

        }


        if (
          pand?.aantal_verblijfsobjecten !== null &&
          pand?.aantal_verblijfsobjecten !== undefined
        ) {

          lines.push(
            `  Verblijfsobjecten: ${pand.aantal_verblijfsobjecten}`
          );

        }


        if (
          pand?.gebruiksdoel
        ) {

          lines.push(
            `  Gebruiksdoel: ${formatBAGUsePurpose(
              pand.gebruiksdoel
            )}`
          );

        }


        if (
          bag?.status
        ) {

          lines.push(
            `  BAG-status: ${bag.status}`
          );

        }


        lines.push("");
      }


      lines.push("");
    }


    try {

      await navigator.clipboard.writeText(
        lines.join("\n")
      );


      setObjectsCopied(true);


      setTimeout(() => {
        setObjectsCopied(false);
      }, 1500);

    } catch (error) {

      console.error(
        "❌ Objecten kopiëren mislukt:",
        error
      );

    }
  }


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


        {/* =================================================
            CATEGORIEFILTER
            ================================================= */}

        <div
          className="category-filter-bar"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "14px",
            alignItems: "center",
          }}
        >

          {categoryOrder.map(
            (category) => {

              const enabled =
                enabledCategories[category];

              return (

                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    toggleCategoryVisibility(
                      category
                    )
                  }
                  aria-pressed={enabled}
                  title={
                    enabled
                      ? `${category} verbergen`
                      : `${category} tonen`
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "7px",
                    border: "1px solid #3f3f3f",
                    background: "#3f3f3f",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 400,
                  }}
                >

                  <span
                    style={{
                      fontSize: "16px",
                      lineHeight: 1,
                      color: enabled
                        ? "#4caf50"
                        : "#ffffff",
                    }}
                  >
                    {enabled ? "☑" : "☐"}
                  </span>

                  <span>
                    {category}
                  </span>

                </button>

              );
            }
          )}

        </div>

      </section>


      {/* ===================================================
          DASHBOARD
          =================================================== */}

      <main className="dashboard">


        {/* =================================================
            WEER
            ================================================= */}

        <section className="panel weather-panel">

          <div className="panel-title-row">

            <h2>
              Weersituatie
            </h2>


            <button
              type="button"
              onClick={() => {

                if (!weather) {
                  return;
                }


                const windSpeedKmh =
                  weather.windSpeed;


                const windSpeedMs =
                  windSpeedKmh / 3.6;


                const beaufort =
                  Math.floor(
                    windSpeedKmh === 0
                      ? 0
                      : 0
                  );


                const windDirection =
                  Number(
                    weather.windDirection
                  );


                const directions = [
                  "N",
                  "NO",
                  "O",
                  "ZO",
                  "Z",
                  "ZW",
                  "W",
                  "NW"
                ];


                const directionText =
                  `${directions[
                    Math.round(
                      windDirection / 45
                    ) % 8
                  ]} (${Math.round(
                    windDirection
                  )}°)`;


                const text = [
                  "Meteo",
                  "",
                  `Windkracht: ${beaufort} Beaufort`,
                  `Windsnelheid: ${windSpeedKmh.toFixed(1)} km/u (${windSpeedMs.toFixed(1)} m/s)`,
                  `Windrichting: ${directionText}`,
                  `Temperatuur: ${weather.temperature} °C`,
                  `Meting: ${weather.measurementTime}`,
                  "Bron: Open-Meteo",
                ].join("\n");


                navigator.clipboard
                  .writeText(text)
                  .catch((error) => {
                    console.error(
                      "❌ Meteo kopiëren mislukt:",
                      error
                    );
                  });

              }}
              disabled={!weather}
              style={{
                padding: "5px 9px",
                borderRadius: "6px",
                border: "1px solid #3f3f3f",
                background:
                  weather
                    ? "#3f3f3f"
                    : "#999999",
                color: "#ffffff",
                cursor:
                  weather
                    ? "pointer"
                    : "default",
                fontSize: "12px",
                fontWeight: 400,
              }}
            >
              📋 Kopiëren
            </button>

          </div>


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


            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >

              <button
                type="button"
                onClick={copyObjects}
                disabled={
                  objectsLoading ||
                  totalVisibleObjects === 0
                }
                style={{
                  padding: "5px 9px",
                  borderRadius: "6px",
                  border: "1px solid #3f3f3f",
                  background:
                    objectsCopied
                      ? "#2e7d32"
                      : objectsLoading ||
                        totalVisibleObjects === 0
                        ? "#999999"
                        : "#3f3f3f",
                  color: "#ffffff",
                  cursor:
                    objectsLoading ||
                    totalVisibleObjects === 0
                      ? "default"
                      : "pointer",
                  fontSize: "12px",
                  fontWeight: 400,
                }}
              >
                {objectsCopied
                  ? "✓ Gekopieerd"
                  : "📋 Kopiëren"
                }
              </button>


              <span className="object-total">

                {objectsLoading
                  ? "..."
                  : totalVisibleObjects
                }

              </span>

            </div>

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


                              const expanded =
                                expandedObjects[object.id] === true;


                              const phone =
                                getPhoneNumber(object);


                              const website =
                                getWebsite(object);


                              const address =
                                getObjectAddress(object);


                              const bag =
                                object.bag;


                              const pand =
                                object.pand;


                              const hasExtraInformation =
                                Boolean(
                                  address ||
                                  phone ||
                                  website ||
                                  bag?.oppervlakte !== null &&
                                  bag?.oppervlakte !== undefined ||
                                  pand?.bouwjaar !== null &&
                                  pand?.bouwjaar !== undefined ||
                                  pand?.aantal_verblijfsobjecten !== null &&
                                  pand?.aantal_verblijfsobjecten !== undefined ||
                                  pand?.gebruiksdoel
                                );


                              return (

                                <div
                                  className="object-row"
                                  key={object.id}
                                  style={{
                                    display: "block",
                                  }}
                                >

                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      width: "100%",
                                    }}
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

                                      {hasExtraInformation && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleObjectDetails(
                                              object.id
                                            )
                                          }
                                          aria-expanded={expanded}
                                          style={{
                                            marginTop: "5px",
                                            padding: "0",
                                            border: "none",
                                            background: "none",
                                            color: "#1976d2",
                                            cursor: "pointer",
                                            fontSize: "12px",
                                            fontWeight: 400,
                                          }}
                                        >
                                          {expanded
                                            ? "Minder informatie ▲"
                                            : "Meer informatie ▼"
                                          }
                                        </button>
                                      )}

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


                                  {expanded && hasExtraInformation && (

                                    <div
                                      style={{
                                        marginTop: "8px",
                                        marginLeft: "42px",
                                        marginRight: "8px",
                                        padding: "10px 12px",
                                        borderTop: "1px solid #e0e0e0",
                                        background: "#f7f7f7",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        lineHeight: 1.5,
                                        color: "#333",
                                      }}
                                    >

                                      {address && (
                                        <div
                                          style={{
                                            marginBottom: "4px",
                                          }}
                                        >
                                          <strong>
                                            Adres:
                                          </strong>{" "}
                                          {address}
                                        </div>
                                      )}


                                      {phone && (
                                        <div
                                          style={{
                                            marginBottom: "4px",
                                          }}
                                        >
                                          <strong>
                                            Telefoon:
                                          </strong>{" "}
                                          <a
                                            href={`tel:${phone}`}
                                            style={{
                                              color: "#1565c0",
                                              textDecoration: "none",
                                            }}
                                          >
                                            {phone}
                                          </a>
                                        </div>
                                      )}


                                      {website && (
                                        <div
                                          style={{
                                            marginBottom: "4px",
                                          }}
                                        >
                                          <strong>
                                            Website:
                                          </strong>{" "}
                                          <a
                                            href={
                                              website.startsWith("http")
                                                ? website
                                                : `https://${website}`
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                              color: "#1565c0",
                                              textDecoration: "none",
                                            }}
                                          >
                                            Website openen
                                          </a>
                                        </div>
                                      )}


                                      {bag?.oppervlakte !== null &&
                                        bag?.oppervlakte !== undefined && (
                                          <div
                                            style={{
                                              marginBottom: "4px",
                                            }}
                                          >
                                            <strong>
                                              Oppervlakte:
                                            </strong>{" "}
                                            {bag.oppervlakte} m²
                                          </div>
                                        )}


                                      {pand?.bouwjaar !== null &&
                                        pand?.bouwjaar !== undefined && (
                                          <div
                                            style={{
                                              marginBottom: "4px",
                                            }}
                                          >
                                            <strong>
                                              Bouwjaar:
                                            </strong>{" "}
                                            {pand.bouwjaar}
                                          </div>
                                        )}


                                      {pand?.aantal_verblijfsobjecten !== null &&
                                        pand?.aantal_verblijfsobjecten !== undefined && (
                                          <div
                                            style={{
                                              marginBottom: "4px",
                                            }}
                                          >
                                            <strong>
                                              Verblijfsobjecten:
                                            </strong>{" "}
                                            {pand.aantal_verblijfsobjecten}
                                          </div>
                                        )}


                                      {pand?.gebruiksdoel && (
                                        <div
                                          style={{
                                            marginBottom: "4px",
                                          }}
                                        >
                                          <strong>
                                            Gebruiksdoel:
                                          </strong>{" "}
                                          {formatBAGUsePurpose(
                                            pand.gebruiksdoel
                                          )}
                                        </div>
                                      )}


                                      {bag?.status && (
                                        <div
                                          style={{
                                            marginBottom: "4px",
                                          }}
                                        >
                                          <strong>
                                            BAG-status:
                                          </strong>{" "}
                                          {bag.status}
                                        </div>
                                      )}

                                    </div>

                                  )}

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