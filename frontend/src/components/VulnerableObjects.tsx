import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

export interface VulnerableObject {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
}

interface Props {
  latitude: number;
  longitude: number;
  gasZone?: [number, number][];
  objects: VulnerableObject[];
}


/* =========================================================
   AFSTAND BEREKENEN
   ========================================================= */

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


/* =========================================================
   CONTROLEREN OF OBJECT IN GASZONE ZIT
   ========================================================= */

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
      (lon1 > longitude) !==
        (lon2 > longitude) &&
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


/* =========================================================
   VASTE SVG ICONEN
   =========================================================
   
   De kleuren zijn gelijkgetrokken met de iconen
   die in de lijst worden gebruikt.
   ========================================================= */

function iconForType(type: string) {

  let icon = `
    <svg
      viewBox="0 0 32 32"
      width="30"
      height="30"
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


  switch (type) {


    /* =====================================================
       ZIEKENHUIS / KLINIEK
       ROOD
       ===================================================== */

    case "hospital":
    case "clinic":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;


    /* =====================================================
       ZORG
       BLAUW
       ===================================================== */

    case "healthcare":
    case "care":
    case "nursing_home":
    case "care_home":
    case "residential_care":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;


    /* =====================================================
       HUISARTS
       BLAUW
       ===================================================== */

    case "doctors":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;


    /* =====================================================
       TANDARTS
       BLAUW
       ===================================================== */

    case "dentist":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;


    /* =====================================================
       APOTHEEK
       BLAUW
       ===================================================== */

    case "pharmacy":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;


    /* =====================================================
       ONDERWIJS
       GEEL
       ===================================================== */

    case "school":
    case "kindergarten":
    case "childcare":
    case "college":
    case "university":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;


    /* =====================================================
       RELIGIE
       PAARS
       ===================================================== */

    case "church":
    case "place_of_worship":
    case "mosque":
    case "synagogue":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;


    /* =====================================================
       WINKEL
       ORANJE
       ===================================================== */

    case "shop":
    case "supermarket":
    case "department_store":
    case "shopping_centre":
    case "mall":
    case "hardware_store":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;


    /* =====================================================
       MAATSCHAPPELIJK
       GROEN
       ===================================================== */

    case "community":
    case "community_centre":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;


    /* =====================================================
       HOTEL / VERBLIJF
       TURQUOISE
       ===================================================== */

    case "hotel":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
        >

          <!-- hotelgebouw -->

          <rect
            x="5"
            y="6"
            width="22"
            height="21"
            rx="2"
            fill="#00897b"
          />

          <!-- ramen -->

          <rect
            x="8"
            y="9"
            width="5"
            height="5"
            rx="1"
            fill="white"
          />

          <rect
            x="19"
            y="9"
            width="5"
            height="5"
            rx="1"
            fill="white"
          />

          <!-- bed -->

          <rect
            x="8"
            y="18"
            width="16"
            height="7"
            rx="1"
            fill="white"
          />

          <rect
            x="9"
            y="17"
            width="6"
            height="4"
            rx="1"
            fill="white"
          />

          <!-- deur -->

          <rect
            x="14"
            y="22"
            width="4"
            height="5"
            fill="#00897b"
          />

        </svg>
      `;

      break;


    /* =====================================================
       OVERIG
       GRIJS
       ===================================================== */

    default:

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
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

      break;
  }


  return L.divIcon({

    html: `
      <div
        style="
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        "
      >
        ${icon}
      </div>
    `,

    className: "",

    iconSize: [30, 30],

    iconAnchor: [15, 15],

    popupAnchor: [0, -15]

  });
}


/* =========================================================
   COMPONENT
   ========================================================= */

export default function VulnerableObjects({
  latitude,
  longitude,
  gasZone,
  objects
}: Props) {


  /* =======================================================
     ALLEEN OBJECTEN BINNEN:

     1. 500 meter cirkel
     OF
     2. GASZONE
     ======================================================= */

  const visibleObjects =
    objects.filter((obj) => {

      const distance =
        distanceInMeters(
          latitude,
          longitude,
          obj.latitude,
          obj.longitude
        );

      const insideCircle =
        distance <= 500;

      const insideGasZone =
        pointInGasZone(
          obj.latitude,
          obj.longitude,
          gasZone ?? []
        );

      return (
        insideCircle ||
        insideGasZone
      );

    });


  /* =======================================================
     DEBUG
     ======================================================= */

  console.log(
    "🟢 Totaal objecten:",
    objects.length
  );

  console.log(
    "🔵 Gaszone punten:",
    gasZone?.length ?? 0
  );

  console.log(
    "📍 Zichtbare objecten:",
    visibleObjects.length
  );


  /* =======================================================
     KAARTOBJECTEN
     ======================================================= */

  return (
    <>

      {visibleObjects.map((obj) => (

        <Marker
          key={obj.id}
          position={[
            obj.latitude,
            obj.longitude
          ]}
          icon={iconForType(obj.type)}
        >

          <Popup>

            <b>
              {obj.name}
            </b>

            <br />

            {obj.type}

          </Popup>

        </Marker>

      ))}

    </>
  );
}