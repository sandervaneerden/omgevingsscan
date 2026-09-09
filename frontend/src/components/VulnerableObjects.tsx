import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

import type {
  VulnerableObject,
} from "../services/vulnerableObjectService";


interface VulnerableObjectsProps {
  latitude: number;
  longitude: number;
  gasZone: [number, number][];
  objects: VulnerableObject[];
}


/* =========================================================
   AFSTAND
   ========================================================= */

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {

  const R = 6371000;

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

  return R * c;
}


/* =========================================================
   PUNT IN POLYGON
   ========================================================= */

function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {

  let inside = false;

  const x = point[1];
  const y = point[0];

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {

    const xi = polygon[i][1];
    const yi = polygon[i][0];

    const xj = polygon[j][1];
    const yj = polygon[j][0];

    const intersect =
      yi > y !== yj > y &&
      x <
        ((xj - xi) * (y - yi)) /
          (yj - yi) +
          xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}


/* =========================================================
   TYPE → NEDERLANDSE NAAM
   ========================================================= */

function labelForType(
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

    case "doctor":
    case "doctors":
      return "Huisarts";

    case "dentist":
      return "Tandarts";

    case "pharmacy":
      return "Apotheek";

    case "physiotherapist":
    case "physiotherapy":
      return "Fysiotherapie";

    case "psychologist":
      return "Psycholoog";

    case "mental_health":
      return "Geestelijke gezondheidszorg (GGZ)";

    case "disability_care":
      return "Gehandicaptenzorg";

    case "hospice":
      return "Hospice / palliatieve zorg";

    case "rehabilitation":
      return "Revalidatie";

    case "home_care":
      return "Thuiszorg";

    case "other_care":
      return "Zorgvoorziening";


    case "school":
      return "School";

    case "kindergarten":
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


    case "shop":
      return "Winkel";

    case "supermarket":
      return "Supermarkt";

    case "department_store":
      return "Warenhuis";

    case "shopping_centre":
    case "mall":
      return "Winkelcentrum";

    case "hardware_store":
      return "Bouwmarkt";


    case "community":
      return "Maatschappelijke instelling";

    case "community_centre":
      return "Buurt- / wijkcentrum";


    case "hotel":
      return "Hotel";


    case "sport":
    case "sports_centre":
    case "stadium":
      return "Sportvoorziening";


    case "marketplace":
      return "Markt";


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

function getAddress(
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
   ICOON
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
       ZIEKENHUIS
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
       ===================================================== */

    case "healthcare":
    case "care":
    case "nursing_home":
    case "care_home":
    case "residential_care":
    case "doctor":
    case "doctors":
    case "dentist":
    case "pharmacy":
    case "physiotherapist":
    case "physiotherapy":
    case "psychologist":
    case "mental_health":
    case "disability_care":
    case "hospice":
    case "rehabilitation":
    case "home_care":
    case "other_care":


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
       ONDERWIJS
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
       ===================================================== */

    case "hotel":

      icon = `
        <svg
          viewBox="0 0 32 32"
          width="30"
          height="30"
        >

          <rect
            x="5"
            y="5"
            width="22"
            height="22"
            rx="2"
            fill="#00838f"
          />

          <rect
            x="9"
            y="10"
            width="4"
            height="4"
            fill="white"
          />

          <rect
            x="19"
            y="10"
            width="4"
            height="4"
            fill="white"
          />

          <rect
            x="9"
            y="17"
            width="4"
            height="4"
            fill="white"
          />

          <rect
            x="19"
            y="17"
            width="4"
            height="4"
            fill="white"
          />

          <rect
            x="14"
            y="20"
            width="4"
            height="7"
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
  objects,
}: VulnerableObjectsProps) {

  return (
    <>
      {objects.map((object) => {

        const distance =
          object.distance ??
          distanceMeters(
            latitude,
            longitude,
            object.latitude,
            object.longitude
          );


        const inGasZone =
          gasZone.length >= 3
            ? pointInPolygon(
                [
                  object.latitude,
                  object.longitude,
                ],
                gasZone
              )
            : false;


        const phone =
          getPhoneNumber(object);

        const website =
          getWebsite(object);

        const address =
          getAddress(object);

        const bag =
          object.bag;

        const pand =
          object.pand;


        return (
          <Marker
            key={object.id}
            position={[
              object.latitude,
              object.longitude,
            ]}
            icon={iconForType(object.type)}
          >

            <Popup>

              <div
                style={{
                  color: "#111",
                  minWidth: "220px",
                  maxWidth: "320px",
                  lineHeight: 1.4,
                }}
              >

                <strong>
                  {object.name || "Onbekend object"}
                </strong>

                <br />

                <span>
                  {labelForType(object.type)}
                </span>

                <br />

                <span>
                  Afstand: {Math.round(distance)} meter
                </span>


                {address && (
                  <>
                    <br />
                    <span>
                      📍 {address}
                    </span>
                  </>
                )}


                {phone && (
                  <>
                    <br />
                    <span>
                      ☎️{" "}
                      <a
                        href={`tel:${phone}`}
                        style={{
                          color: "#1565c0",
                        }}
                      >
                        {phone}
                      </a>
                    </span>
                  </>
                )}


                {website && (
                  <>
                    <br />
                    <span>
                      🌐{" "}
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
                        }}
                      >
                        Website
                      </a>
                    </span>
                  </>
                )}


                {bag?.oppervlakte !== null &&
                  bag?.oppervlakte !== undefined && (
                    <>
                      <br />
                      <span>
                        📐 Oppervlakte:{" "}
                        {bag.oppervlakte} m²
                      </span>
                    </>
                  )}


                {pand?.bouwjaar !== null &&
                  pand?.bouwjaar !== undefined && (
                    <>
                      <br />
                      <span>
                        🏗️ Bouwjaar:{" "}
                        {pand.bouwjaar}
                      </span>
                    </>
                  )}


                {pand?.aantal_verblijfsobjecten !== null &&
                  pand?.aantal_verblijfsobjecten !== undefined && (
                    <>
                      <br />
                      <span>
                        🏢 Verblijfsobjecten:{" "}
                        {pand.aantal_verblijfsobjecten}
                      </span>
                    </>
                  )}


                {pand?.gebruiksdoel && (
                  <>
                    <br />
                    <span>
                      🏷️ Gebruiksdoel:{" "}
                      {formatBAGUsePurpose(
                        pand.gebruiksdoel
                      )}
                    </span>
                  </>
                )}


                {inGasZone && (
                  <>
                    <br />

                    <strong
                      style={{
                        color: "red",
                      }}
                    >
                      ⚠️ Binnen gasmal
                    </strong>
                  </>
                )}

              </div>

            </Popup>

          </Marker>
        );
      })}
    </>
  );
}