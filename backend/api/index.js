const OVERPASS_SERVERS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];


// ============================================================
// HULPFUNCTIES
// ============================================================

function getCoordinates(element) {
  const latitude =
    element.lat ??
    element.center?.lat;

  const longitude =
    element.lon ??
    element.center?.lon;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number"
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}


function getName(tags) {
  return (
    tags.name ||
    tags["name:nl"] ||
    tags["official_name:nl"] ||
    tags.operator ||
    null
  );
}


function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


// ============================================================
// AFSTAND BEREKENEN
// ============================================================

function distanceInMeters(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {

  const earthRadius = 6371000;

  const toRadians =
    value => value * Math.PI / 180;

  const lat1 =
    toRadians(latitude1);

  const lat2 =
    toRadians(latitude2);

  const deltaLat =
    toRadians(
      latitude2 - latitude1
    );

  const deltaLon =
    toRadians(
      longitude2 - longitude1
    );

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(deltaLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}


// ============================================================
// TYPE BEPALEN
// ============================================================

function determineType(tags) {

  // ----------------------------------------------------------
  // ZIEKENHUIS
  // ----------------------------------------------------------

  if (tags.amenity === "hospital") {
    return "hospital";
  }


  // ----------------------------------------------------------
  // KLINIEK
  // ----------------------------------------------------------

  if (tags.amenity === "clinic") {
    return "clinic";
  }


  // ----------------------------------------------------------
  // VERPLEEGHUIS / WOONZORG
  // ----------------------------------------------------------

  if (
    tags.social_facility === "nursing_home" ||
    tags.social_facility === "care_home" ||
    tags.social_facility === "assisted_living" ||
    tags.social_facility === "retirement_home" ||
    tags.social_facility === "group_home"
  ) {
    return "nursing_home";
  }


  // ----------------------------------------------------------
  // ZORG
  // ----------------------------------------------------------

  if (
    tags.healthcare ||
    tags.social_facility
  ) {
    return "care";
  }


  // ----------------------------------------------------------
  // SCHOOL
  // ----------------------------------------------------------

  if (
    tags.amenity === "school" ||
    tags.education === "school" ||
    tags.school
  ) {
    return "school";
  }


  // ----------------------------------------------------------
  // COLLEGE
  // ----------------------------------------------------------

  if (
    tags.amenity === "college" ||
    tags.education === "college" ||
    tags.building === "college"
  ) {
    return "school";
  }


  // ----------------------------------------------------------
  // UNIVERSITEIT
  // ----------------------------------------------------------

  if (
    tags.amenity === "university" ||
    tags.education === "university" ||
    tags.building === "university"
  ) {
    return "school";
  }


  // ----------------------------------------------------------
  // SCHOOLGEBOUW
  // ----------------------------------------------------------

  if (
    tags.building === "school" ||
    tags.building === "college" ||
    tags.building === "university"
  ) {
    return "school";
  }


  // ----------------------------------------------------------
  // ONDERWIJSTERREIN
  // ----------------------------------------------------------

  if (
    tags.landuse === "education"
  ) {
    return "school";
  }


  // ----------------------------------------------------------
  // EDUCATION=*
  // ----------------------------------------------------------

  if (
    tags.education
  ) {
    return "school";
  }


  // ----------------------------------------------------------
  // KINDEROPVANG
  // ----------------------------------------------------------

  if (
    tags.amenity === "kindergarten" ||
    tags.amenity === "childcare" ||
    tags.education === "kindergarten"
  ) {
    return "kindergarten";
  }


  // ----------------------------------------------------------
  // RELIGIE
  // ----------------------------------------------------------

  if (
    tags.amenity === "place_of_worship"
  ) {
    return "church";
  }


  // ----------------------------------------------------------
  // MAATSCHAPPELIJK
  // ----------------------------------------------------------

  if (
    tags.amenity === "community_centre"
  ) {
    return "community";
  }


  // ----------------------------------------------------------
  // SUPERMARKT
  // ----------------------------------------------------------

  if (
    tags.shop === "supermarket"
  ) {
    return "supermarket";
  }


  // ----------------------------------------------------------
  // WINKELCENTRUM
  // ----------------------------------------------------------

  if (
    tags.shop === "mall"
  ) {
    return "shopping_centre";
  }


  // ----------------------------------------------------------
  // MARKT
  // ----------------------------------------------------------

  if (
    tags.amenity === "marketplace"
  ) {
    return "marketplace";
  }


  // ----------------------------------------------------------
  // HOTEL
  // ----------------------------------------------------------

  if (
    tags.tourism === "hotel"
  ) {
    return "hotel";
  }


  return null;
}


// ============================================================
// OVERPASS QUERY
// ============================================================

function buildQuery(
  latitude,
  longitude,
  radius
) {

  return `
[out:json][timeout:25];

(
  // ==========================================================
  // ZORG
  // ==========================================================

  nwr["amenity"="hospital"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="clinic"]
    (around:${radius},${latitude},${longitude});

  nwr["healthcare"]
    (around:${radius},${latitude},${longitude});

  nwr["social_facility"]
    (around:${radius},${latitude},${longitude});


  // ==========================================================
  // SCHOLEN
  // ==========================================================

  nwr["amenity"="school"]
    (around:${radius},${latitude},${longitude});

  nwr["education"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="college"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="university"]
    (around:${radius},${latitude},${longitude});

  nwr["building"="school"]
    (around:${radius},${latitude},${longitude});

  nwr["building"="college"]
    (around:${radius},${latitude},${longitude});

  nwr["building"="university"]
    (around:${radius},${latitude},${longitude});

  nwr["landuse"="education"]
    (around:${radius},${latitude},${longitude});


  // ==========================================================
  // KINDEROPVANG
  // ==========================================================

  nwr["amenity"="kindergarten"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="childcare"]
    (around:${radius},${latitude},${longitude});


  // ==========================================================
  // RELIGIE
  // ==========================================================

  nwr["amenity"="place_of_worship"]
    (around:${radius},${latitude},${longitude});


  // ==========================================================
  // MAATSCHAPPELIJK
  // ==========================================================

  nwr["amenity"="community_centre"]
    (around:${radius},${latitude},${longitude});


  // ==========================================================
  // SUPERMARKTEN
  // ==========================================================

  nwr["shop"="supermarket"]
    (around:${radius},${latitude},${longitude});


  // ==========================================================
  // WINKELCENTRA
  // ==========================================================

  nwr["shop"="mall"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="marketplace"]
    (around:${radius},${latitude},${longitude});


  // ==========================================================
  // HOTELS
  // ==========================================================

  nwr["tourism"="hotel"]
    (around:${radius},${latitude},${longitude});

);

out center tags;
`;
}


// ============================================================
// OVERPASS AANROEP
// ============================================================

async function fetchFromOverpass(query) {

  let laatsteFout = null;

  for (const server of OVERPASS_SERVERS) {

    try {

      console.log(
        "🌍 Overpass:",
        server
      );


      const response = await fetch(
        server,
        {
          method: "POST",

          headers: {
            "Content-Type": "text/plain",
            "User-Agent": "Omgevingsscan/1.0",
          },

          body: query,

          signal: AbortSignal.timeout(30000),
        }
      );


      console.log(
        "Overpass status:",
        response.status
      );


      if (!response.ok) {

        laatsteFout =
          new Error(
            `Overpass HTTP ${response.status}`
          );

        continue;
      }


      const data =
        await response.json();


      if (
        !data ||
        !Array.isArray(data.elements)
      ) {

        laatsteFout =
          new Error(
            "Ongeldige Overpass response"
          );

        continue;
      }


      console.log(
        "✅ Overpass objecten:",
        data.elements.length
      );


      return data;

    } catch (error) {

      console.error(
        "❌ Overpass fout:",
        error.message
      );

      laatsteFout = error;
    }
  }


  throw (
    laatsteFout ||
    new Error(
      "Geen Overpass-server beschikbaar"
    )
  );
}


// ============================================================
// HANDLER
// ============================================================

async function handler(req, res) {

  // ==========================================================
  // CORS
  // ==========================================================

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );


  // ==========================================================
  // OPTIONS
  // ==========================================================

  if (req.method === "OPTIONS") {

    return res
      .status(200)
      .end();
  }


  // ==========================================================
  // ALLEEN GET
  // ==========================================================

  if (req.method !== "GET") {

    return res
      .status(405)
      .json({
        error: "Method not allowed",
      });
  }


  // ==========================================================
  // PARAMETERS
  // ==========================================================

  const latitude =
    Number(req.query.latitude);

  const longitude =
    Number(req.query.longitude);

  const radius =
    Number(
      req.query.radius || 500
    );


  // ==========================================================
  // INPUT CONTROLEREN
  // ==========================================================

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radius) ||
    radius <= 0
  ) {

    return res
      .status(400)
      .json({
        error:
          "Ongeldige locatie of radius",
      });
  }


  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    "🔎 Kwetsbare objecten"
  );
  console.log(
    "📍 Locatie:",
    latitude,
    longitude
  );
  console.log(
    "📏 Radius:",
    radius,
    "meter"
  );
  console.log(
    "=========================================="
  );


  // ==========================================================
  // QUERY
  // ==========================================================

  const query =
    buildQuery(
      latitude,
      longitude,
      radius
    );


  // ==========================================================
  // OVERPASS
  // ==========================================================

  let data;

  try {

    data =
      await fetchFromOverpass(
        query
      );

  } catch (error) {

    console.error(
      "❌ Alle Overpass-servers mislukt:",
      error.message
    );

    return res
      .status(502)
      .json({
        error:
          "Overpass is tijdelijk niet beschikbaar",

        details:
          error.message,
      });
  }


  // ==========================================================
  // OBJECTEN VERWERKEN
  // ==========================================================

  const objects = [];


  for (const element of data.elements) {

    const coordinates =
      getCoordinates(element);


    if (!coordinates) {
      continue;
    }


    const tags =
      element.tags || {};


    const type =
      determineType(tags);


    if (!type) {
      continue;
    }


    const name =
      getName(tags);


    // --------------------------------------------------------
    // Winkelcentra, markten en hotels zonder naam niet tonen
    // --------------------------------------------------------

    if (
      (
        type === "shopping_centre" ||
        type === "marketplace" ||
        type === "hotel"
      ) &&
      !name
    ) {
      continue;
    }


    // --------------------------------------------------------
    // Object toevoegen
    // --------------------------------------------------------

    objects.push({

      id:
        `${element.type}-${element.id}`,

      name:
        name ||
        "Onbekend object",

      type,

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,

    });
  }


  // ==========================================================
  // DUBBELE OBJECTEN FILTEREN
  // ==========================================================

  const uniqueObjects = [];


  for (const object of objects) {

    const normalized =
      normalizeName(
        object.name
      );


    // --------------------------------------------------------
    // Naamloze schoolgebouwen niet zelfstandig tonen
    // --------------------------------------------------------

    if (
      object.type === "school" &&
      (
        !normalized ||
        normalized === "onbekend object"
      )
    ) {

      continue;
    }


    // --------------------------------------------------------
    // Naamloze overige objecten behouden
    // --------------------------------------------------------

    if (
      !normalized ||
      normalized === "onbekend object"
    ) {

      uniqueObjects.push(
        object
      );

      continue;
    }


    // --------------------------------------------------------
    // Controleren op bestaand duplicaat
    // --------------------------------------------------------

    const duplicate =
      uniqueObjects.find(
        existing => {

          // Ander type = geen duplicaat
          if (
            existing.type !== object.type
          ) {

            return false;
          }


          // Andere naam = geen duplicaat
          if (
            normalizeName(
              existing.name
            ) !== normalized
          ) {

            return false;
          }


          // Afstand bepalen
          const distance =
            distanceInMeters(
              existing.latitude,
              existing.longitude,
              object.latitude,
              object.longitude
            );


          // Alleen binnen 100 meter als duplicaat
          return distance <= 100;
        }
      );


    // --------------------------------------------------------
    // Duplicaat gevonden
    // --------------------------------------------------------

    if (duplicate) {

      continue;
    }


    // --------------------------------------------------------
    // Nieuw uniek object
    // --------------------------------------------------------

    uniqueObjects.push(
      object
    );
  }


  // ==========================================================
  // PRIORITEIT
  // ==========================================================

  const priority = {

    hospital: 1,

    nursing_home: 2,

    clinic: 3,

    care: 4,

    school: 5,

    kindergarten: 6,

    church: 7,

    community: 8,

    supermarket: 9,

    shopping_centre: 10,

    marketplace: 11,

    hotel: 12,

  };


  // ==========================================================
  // SORTEREN
  // ==========================================================

  uniqueObjects.sort(
    (a, b) => {

      const priorityA =
        priority[a.type] || 99;

      const priorityB =
        priority[b.type] || 99;


      if (
        priorityA !== priorityB
      ) {

        return (
          priorityA -
          priorityB
        );
      }


      return a.name
        .localeCompare(
          b.name,
          "nl"
        );
    }
  );


  // ==========================================================
  // LOGGING
  // ==========================================================

  console.log("");
  console.log(
    "=========================================="
  );

  console.log(
    "✅ Definitieve objecten:",
    uniqueObjects.length
  );


  console.log(
    "🏥 Ziekenhuizen:",
    uniqueObjects.filter(
      o => o.type === "hospital"
    ).length
  );


  console.log(
    "👵 Verpleeghuizen:",
    uniqueObjects.filter(
      o => o.type === "nursing_home"
    ).length
  );


  console.log(
    "🏥 Klinieken:",
    uniqueObjects.filter(
      o => o.type === "clinic"
    ).length
  );


  console.log(
    "♿ Zorg:",
    uniqueObjects.filter(
      o => o.type === "care"
    ).length
  );


  console.log(
    "🏫 Scholen:",
    uniqueObjects.filter(
      o => o.type === "school"
    ).length
  );


  console.log(
    "👶 Kinderopvang:",
    uniqueObjects.filter(
      o => o.type === "kindergarten"
    ).length
  );


  console.log(
    "⛪ Kerken:",
    uniqueObjects.filter(
      o => o.type === "church"
    ).length
  );


  console.log(
    "🏢 Maatschappelijk:",
    uniqueObjects.filter(
      o => o.type === "community"
    ).length
  );


  console.log(
    "🛒 Supermarkten:",
    uniqueObjects.filter(
      o => o.type === "supermarket"
    ).length
  );


  console.log(
    "🏬 Winkelcentra:",
    uniqueObjects.filter(
      o => o.type === "shopping_centre"
    ).length
  );


  console.log(
    "🏨 Hotels:",
    uniqueObjects.filter(
      o => o.type === "hotel"
    ).length
  );


  console.log(
    "=========================================="
  );


  // ==========================================================
  // RESPONSE
  // ==========================================================

  return res
    .status(200)
    .json(uniqueObjects);
}


// ============================================================
// EXPORT
// ============================================================

module.exports = handler;