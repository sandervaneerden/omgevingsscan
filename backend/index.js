const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());


// ==================================================
// OVERPASS SERVERS
// ==================================================

const OVERPASS_SERVERS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];


// ==================================================
// TEST ROUTE
// ==================================================

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Omgevingsscan backend werkt",
  });
});


// ==================================================
// KWETSBARE OBJECTEN
// ==================================================

app.get("/api/vulnerable-objects", async (req, res) => {

  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const radius = Number(req.query.radius || 500);


  console.log("");
  console.log("======================================");
  console.log("🔎 Kwetsbare objecten opvragen");
  console.log("📍 Locatie:", latitude, longitude);
  console.log("📏 Radius:", radius);
  console.log("======================================");


  // ==================================================
  // INPUT CONTROLEREN
  // ==================================================

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radius) ||
    radius <= 0
  ) {

    return res.status(400).json({
      error: "Ongeldige locatie of radius",
    });

  }


  // ==================================================
  // OVERPASS QUERY
  // ==================================================
  //
  // Alleen relevante objecten voor de omgevingsscan.
  //
  // ZORG:
  // - ziekenhuizen
  // - klinieken
  // - verpleeghuizen
  // - woonzorg
  //
  // GEEN algemene healthcare-query.
  //
  // Hierdoor worden bijvoorbeeld:
  // - tandartsen
  // - psychologen
  // - prothesepraktijken
  // - fysiotherapeuten
  //
  // NIET meer automatisch meegenomen.
  // ==================================================

  const query = `
[out:json][timeout:15];

(
  // ================================================
  // ZIEKENHUIZEN
  // ================================================

  nwr["amenity"="hospital"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // KLINIEKEN
  // ================================================

  nwr["amenity"="clinic"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // VERPLEEGHUIZEN
  // ================================================

  nwr["social_facility"="nursing_home"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // WOONZORG / VERZORGD WONEN
  // ================================================

  nwr["social_facility"="care_home"]
    (around:${radius},${latitude},${longitude});

  nwr["social_facility"="assisted_living"]
    (around:${radius},${latitude},${longitude});

  nwr["social_facility"="retirement_home"]
    (around:${radius},${latitude},${longitude});

  nwr["social_facility"="group_home"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // SCHOLEN
  // ================================================

  nwr["amenity"="school"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // KINDEROPVANG
  // ================================================

  nwr["amenity"="kindergarten"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="childcare"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // RELIGIE
  // ================================================

  nwr["amenity"="place_of_worship"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // MAATSCHAPPELIJK
  // ================================================

  nwr["amenity"="community_centre"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // SUPERMARKTEN
  // ================================================

  nwr["shop"="supermarket"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // WINKELCENTRA
  // ================================================

  nwr["shop"="mall"]
    (around:${radius},${latitude},${longitude});


  // ================================================
  // MARKTEN
  // ================================================

  nwr["amenity"="marketplace"]
    (around:${radius},${latitude},${longitude});

);

out center tags;
`;


  // ==================================================
  // OVERPASS AANROEPEN
  // ==================================================

  let data = null;
  let laatsteFout = null;


  for (const server of OVERPASS_SERVERS) {

    try {

      console.log("🌍 Overpass:", server);


      const response = await fetch(
        server,
        {
          method: "POST",

          headers: {
            "Content-Type": "text/plain",
            "User-Agent": "Omgevingsscan/1.0",
          },

          body: query,

          signal: AbortSignal.timeout(60000),
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


      data = await response.json();


      console.log(
        "✅ Overpass objecten:",
        data.elements?.length || 0
      );


      break;


    } catch (error) {

      console.error(
        "❌ Overpass fout:",
        error.message
      );

      laatsteFout = error;

    }

  }


  // ==================================================
  // GEEN DATA
  // ==================================================

  if (!data) {

    return res.status(502).json({

      error:
        "Overpass is tijdelijk niet beschikbaar",

      details:
        laatsteFout?.message ||
        "Onbekende fout",

    });

  }


  // ==================================================
  // OBJECTEN VERWERKEN
  // ==================================================

  const objects = data.elements

    .map((el) => {


      // ----------------------------------------------
      // COÖRDINATEN
      // ----------------------------------------------

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


      // ----------------------------------------------
      // TAGS
      // ----------------------------------------------

      const tags = el.tags || {};


      // ----------------------------------------------
      // NAAM
      // ----------------------------------------------

      const name =
        tags.name ||
        tags["name:nl"] ||
        null;


      // ----------------------------------------------
      // TYPE
      // ----------------------------------------------

      let type = null;


      // ==================================================
      // ZIEKENHUIS
      // ==================================================

      if (
        tags.amenity === "hospital"
      ) {

        type = "hospital";

      }


      // ==================================================
      // KLINIEK
      // ==================================================

      else if (
        tags.amenity === "clinic"
      ) {

        type = "clinic";

      }


      // ==================================================
      // VERPLEEGHUIS / WOONZORG
      // ==================================================

      else if (
        tags.social_facility === "nursing_home" ||
        tags.social_facility === "care_home" ||
        tags.social_facility === "assisted_living" ||
        tags.social_facility === "retirement_home" ||
        tags.social_facility === "group_home"
      ) {

        type = "nursing_home";

      }


      // ==================================================
      // SCHOOL
      // ==================================================

      else if (
        tags.amenity === "school"
      ) {

        type = "school";

      }


      // ==================================================
      // KINDEROPVANG
      // ==================================================

      else if (
        tags.amenity === "kindergarten" ||
        tags.amenity === "childcare"
      ) {

        type = "kindergarten";

      }


      // ==================================================
      // RELIGIE
      // ==================================================

      else if (
        tags.amenity === "place_of_worship"
      ) {

        type = "church";

      }


      // ==================================================
      // SUPERMARKET
      // ==================================================

      else if (
        tags.shop === "supermarket"
      ) {

        type = "supermarket";

      }


      // ==================================================
      // WINKELCENTRUM
      // ==================================================

      else if (
        tags.shop === "mall"
      ) {

        type = "shopping_centre";

      }


      // ==================================================
      // MARKT
      // ==================================================

      else if (
        tags.amenity === "marketplace"
      ) {

        type = "marketplace";

      }


      // ==================================================
      // MAATSCHAPPELIJK
      // ==================================================

      else if (
        tags.amenity === "community_centre"
      ) {

        type = "community";

      }


      // ==================================================
      // ONBEKEND TYPE
      // ==================================================

      if (!type) {

        return null;

      }


      // ==================================================
      // NAAMLOZE OBJECTEN
      // ==================================================

      if (
        (
          type === "shopping_centre" ||
          type === "marketplace"
        ) &&
        !name
      ) {

        return null;

      }


      // ==================================================
      // RESULTAAT
      // ==================================================

      return {

        id:
          `${el.type}-${el.id}`,

        name:
          name ||
          "Onbekend object",

        type,

        latitude: lat,

        longitude: lon,

      };

    })

    .filter(Boolean);


  // ==================================================
  // DUBBELE OBJECTEN VERWIJDEREN
  // ==================================================

  const uniqueObjects =
    Array.from(
      new Map(
        objects.map(
          (object) => {

            const key =
              `${object.type}-${object.name
                .trim()
                .toLowerCase()}`;

            return [
              key,
              object
            ];

          }
        )
      ).values()
    );


  // ==================================================
  // PRIORITEIT
  // ==================================================

  const priority = {

    hospital: 1,

    nursing_home: 2,

    clinic: 3,

    school: 4,

    kindergarten: 5,

    church: 6,

    community: 7,

    supermarket: 8,

    shopping_centre: 9,

    marketplace: 10,

  };


  // ==================================================
  // SORTEREN
  // ==================================================

  uniqueObjects.sort(
    (a, b) =>
      (priority[a.type] || 99) -
      (priority[b.type] || 99)
  );


  // ==================================================
  // LOGGING
  // ==================================================

  console.log("");

  console.log(
    "======================================"
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
    "🏥 Klinieken:",
    uniqueObjects.filter(
      o => o.type === "clinic"
    ).length
  );

  console.log(
    "👵 Verpleeghuizen:",
    uniqueObjects.filter(
      o => o.type === "nursing_home"
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
    "======================================"
  );


  // ==================================================
  // ANTWOORD
  // ==================================================

  return res.json(
    uniqueObjects
  );

});


// ==================================================
// LOKALE SERVER
// ==================================================

if (require.main === module) {

  app.listen(
    PORT,
    "0.0.0.0",
    () => {

      console.log(
        `🚒 Omgevingsscan backend draait op poort ${PORT}`
      );

    }
  );

}


// ==================================================
// EXPORT
// ==================================================

module.exports = app;