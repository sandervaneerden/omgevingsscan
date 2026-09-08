import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

interface VulnerableObject {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

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
   ICOON
   ========================================================= */

function iconForType(
  type: string
): L.DivIcon {

  let emoji = "📍";

  switch (type) {

    case "hospital":
    case "clinic":
      emoji = "🏥";
      break;

    case "healthcare":
    case "care":
    case "nursing_home":
    case "care_home":
    case "residential_care":
    case "disability_care":
    case "mental_health":
    case "hospice":
    case "rehabilitation":
    case "home_care":
    case "other_care":
    case "doctor":
    case "doctors":
    case "dentist":
    case "pharmacy":
    case "physiotherapist":
    case "physiotherapy":
    case "psychologist":
      emoji = "⚕️";
      break;

    case "school":
    case "kindergarten":
    case "childcare":
    case "college":
    case "university":
      emoji = "🎓";
      break;

    case "church":
    case "place_of_worship":
    case "mosque":
    case "synagogue":
      emoji = "⛪";
      break;

    case "shop":
    case "supermarket":
    case "department_store":
    case "shopping_centre":
    case "mall":
    case "hardware_store":
      emoji = "🛒";
      break;

    case "community":
    case "community_centre":
      emoji = "🏢";
      break;

    case "hotel":
      emoji = "🏨";
      break;

    case "sport":
    case "sports_centre":
    case "stadium":
      emoji = "🏟️";
      break;

    case "marketplace":
      emoji = "🛍️";
      break;
  }

  return L.divIcon({
    className: "vulnerable-object-marker",

    html: `
      <div style="
        font-size: 24px;
        line-height: 30px;
        text-align: center;
        width: 30px;
        height: 30px;
        background: white;
        border-radius: 50%;
        border: 2px solid #333;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      ">
        ${emoji}
      </div>
    `,

    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
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
                  minWidth: "180px",
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