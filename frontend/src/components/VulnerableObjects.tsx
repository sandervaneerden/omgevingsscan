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

function iconForType(type: string) {
  let icon = "📍";

  if (type === "school") {
    icon = "🏫";
  }

  if (type === "hospital") {
    icon = "🏥";
  }

  if (type === "church") {
    icon = "⛪";
  }

  if (type === "shop") {
    icon = "🏪";
  }

  if (type === "community") {
    icon = "🏢";
  }

  return L.divIcon({
    html:
      '<div style="font-size:24px">' +
      icon +
      "</div>",
    className: ""
  });
}

export default function VulnerableObjects({
  latitude,
  longitude,
  gasZone,
  objects
}: Props) {
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
        distance <= 1000;

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
            <b>{obj.name}</b>
            <br />
            {obj.type}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
