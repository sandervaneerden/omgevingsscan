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

  // Query parameters
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

  // ============================================
  // OVERPASS QUERY
  // ============================================

  const query = `
[out:json][timeout:30];

(
  // --------------------------------------------
  // ONDERWIJS
  // --------------------------------------------

  node["amenity"="school"](around:${radius},${latitude},${longitude});
  way["amenity"="school"](around:${radius},${latitude},${longitude});

  node["amenity"="kindergarten"](around:${radius},${latitude},${longitude});
  way["amenity"="kindergarten"](around:${radius},${latitude},${longitude});


  // --------------------------------------------
  // ZORG
  // --------------------------------------------

  node["amenity"="hospital"](around:${radius},${latitude},${longitude});
  way["amenity"="hospital"](around:${radius},${latitude},${longitude});

  node["amenity"="clinic"](around:${radius},${latitude},${longitude});
  way["amenity"="clinic"](around:${radius},${latitude},${longitude});

  node["healthcare"](around:${radius},${latitude},${longitude});
  way["healthcare"](around:${radius},${latitude},${longitude});

  node["social_facility"](around:${radius},${latitude},${longitude});
  way["social_facility"](around:${radius},${latitude},${longitude});


  // --------------------------------------------
  // RELIGIE
  // --------------------------------------------

  node["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});
  way["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});


  // --------------------------------------------
  // WINKELS
  // --------------------------------------------

  node["shop"](around:${radius},${latitude},${longitude});
  way["shop"](around:${radius},${latitude},${longitude});


  // --------------------------------------------
  // MAATSCHAPPELIJK
  // --------------------------------------------

  node["amenity"="community_centre"](around:${radius},${latitude},${longitude});
  way["amenity"="community_centre"](around:${radius},${latitude},${longitude});

);

out center;
`;

  let data = null;
  let laatsteFout = null;

  // ============================================
  // OVERPASS SERVERS PROBEREN
  // ============================================

  for (const server of OVERPASS_SERVERS) {
    try {
      console.log(
        "Overpass proberen:",
        server
      );

      const response = await fetch(
        server,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "User-Agent":
              "Omgevingsscan/1.0",
          },
          body: query,
        }
      );

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

  // ============================================
  // GEEN OVERPASS SERVER
  // ============================================

  if (!data) {

    return res.status(502).json({
      error:
        "Alle Overpass servers zijn tijdelijk niet beschikbaar",

      details:
        laatsteFout?.message ||
        "Onbekende fout",
    });

  }


  // ============================================
  // OBJECTEN OMZETTEN
  // ============================================

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


      const tags =
        el.tags || {};


      let type = "public";


      // ------------------------------------------
      // ZORG
      // ------------------------------------------

      if (
        tags.amenity === "hospital"
      ) {

        type = "hospital";

      }

      else if (
        tags.amenity === "clinic" ||
        tags.healthcare
      ) {

        type = "healthcare";

      }

      else if (
        tags.social_facility === "nursing_home" ||
        tags.social_facility === "care_home"
      ) {

        type = "nursing_home";

      }

      else if (
        tags.social_facility
      ) {

        type = "care";

      }


      // ------------------------------------------
      // ONDERWIJS
      // ------------------------------------------

      else if (
        tags.amenity === "school"
      ) {

        type = "school";

      }

      else if (
        tags.amenity === "kindergarten"
      ) {

        type = "kindergarten";

      }


      // ------------------------------------------
      // KERK
      // ------------------------------------------

      else if (
        tags.amenity === "place_of_worship"
      ) {

        type = "church";

      }


      // ------------------------------------------
      // WINKEL
      // ------------------------------------------

      else if (
        tags.shop
      ) {

        type = "shop";

      }


      // ------------------------------------------
      // MAATSCHAPPELIJK
      // ------------------------------------------

      else if (
        tags.amenity === "community_centre"
      ) {

        type = "community";

      }


      return {

        id: String(el.id),

        name:
          tags.name ||
          "Onbekend object",

        type,

        latitude: lat,

        longitude: lon,

      };

    })

    .filter(Boolean);


  // ============================================
  // DUBBELE OBJECTEN VERWIJDEREN
  // ============================================

  const uniqueObjects =
    Array.from(
      new Map(
        objects.map(
          (object) => [
            `${object.id}-${object.type}`,
            object,
          ]
        )
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