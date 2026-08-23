const OVERPASS_SERVERS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // OPTIONS / CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Alleen GET toestaan
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  // Query parameters uitlezen
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const radius = Number(req.query.radius || 3000);

  // Controleren
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radius)
  ) {
    return res.status(400).json({
      error: "Ongeldige locatie of radius",
    });
  }

  // Overpass query
  const query = `
[out:json][timeout:30];

(
  node["amenity"="school"](around:${radius},${latitude},${longitude});
  way["amenity"="school"](around:${radius},${latitude},${longitude});

  node["amenity"="hospital"](around:${radius},${latitude},${longitude});
  way["amenity"="hospital"](around:${radius},${latitude},${longitude});

  node["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});
  way["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});

  node["shop"](around:${radius},${latitude},${longitude});
  way["shop"](around:${radius},${latitude},${longitude});

  node["amenity"="community_centre"](around:${radius},${latitude},${longitude});
  way["amenity"="community_centre"](around:${radius},${latitude},${longitude});
);

out center;
`;

  let data = null;
  let laatsteFout = null;

  // Overpass servers proberen
  for (const server of OVERPASS_SERVERS) {
    try {
      console.log("Overpass proberen:", server);

      const response = await fetch(server, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "Omgevingsscan/1.0",
        },
        body: query,
      });

      if (!response.ok) {
        laatsteFout = new Error(
          `Overpass HTTP ${response.status}`
        );

        continue;
      }

      data = await response.json();

      console.log(
        "Overpass objecten ontvangen:",
        data.elements?.length || 0
      );

      break;

    } catch (error) {
      laatsteFout = error;
    }
  }

  // Geen Overpass server beschikbaar
  if (!data) {
    return res.status(502).json({
      error:
        "Alle Overpass servers zijn tijdelijk niet beschikbaar",
      details:
        laatsteFout?.message || "Onbekende fout",
    });
  }

  // Objecten omzetten naar ons formaat
  const objects = data.elements
    .map((el) => {

      const lat =
        el.lat ??
        el.center?.lat;

      const lon =
        el.lon ??
        el.center?.lon;

      if (
        typeof lat !== "number" ||
        typeof lon !== "number"
      ) {
        return null;
      }

      let type = "public";

      if (
        el.tags?.amenity === "school"
      ) {
        type = "school";

      } else if (
        el.tags?.amenity === "hospital"
      ) {
        type = "hospital";

      } else if (
        el.tags?.amenity === "place_of_worship"
      ) {
        type = "church";

      } else if (
        el.tags?.shop
      ) {
        type = "shop";

      } else if (
        el.tags?.amenity === "community_centre"
      ) {
        type = "community";
      }

      return {
        id: String(el.id),

        name:
          el.tags?.name ||
          "Onbekend object",

        type,

        latitude: lat,

        longitude: lon,
      };
    })
    .filter(Boolean);

  // Dubbele objecten verwijderen
  const uniqueObjects =
    Array.from(
      new Map(
        objects.map((object) => [
          `${object.id}-${object.type}`,
          object,
        ])
      ).values()
    );

  console.log(
    "Unieke objecten:",
    uniqueObjects.length
  );

  return res.status(200).json(
    uniqueObjects
  );
}