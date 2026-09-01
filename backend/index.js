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
  // We zoeken bewust op meerdere OSM-tags.
  //
  // Een school kan bijvoorbeeld geregistreerd zijn als:
  //
  // amenity=school
  //
  // maar ook uitsluitend als:
  //
  // building=school
  //
  // Daarom zoeken we beide.
  // ==================================================

  const query = `
[out:json][timeout:20];

(
  // ==================================================
  // ZORG
  // ==================================================

  nwr["amenity"="hospital"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="clinic"]
    (around:${radius},${latitude},${longitude});

  nwr["social_facility"="nursing_home"]
    (around:${radius},${latitude},${longitude});

  nwr["social_facility"="care_home"]
    (around:${radius},${latitude},${longitude});

  nwr["social_facility"="assisted_living"]
    (around:${radius},${latitude},${longitude});

  nwr["social_facility"="retirement_home"]
    (around:${radius},${latitude},${longitude});


  // ==================================================
  // ONDERWIJS
  // ==================================================

  nwr["amenity"="school"]
    (around:${radius},${latitude},${longitude});

  nwr["building"="school"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="college"]
    (around:${radius},${latitude},${longitude});

  nwr["building"="college"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="university"]
    (around:${radius},${latitude},${longitude});

  nwr["building"="university"]
    (around:${radius},${latitude},${longitude});

  nwr["landuse"="education"]
    (around:${radius},${latitude},${longitude});


  // ==================================================
  // KINDEROPVANG
  // ==================================================

  nwr["amenity"="kindergarten"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="childcare"]
    (around:${radius},${latitude},${longitude});


  // ==================================================
  // RELIGIE
  // ==================================================

  nwr["amenity"="place_of_worship"]
    (around:${radius},${latitude},${longitude});


  // ==================================================
  // MAATSCHAPPELIJK
  // ==================================================

  nwr["amenity"="community_centre"]
    (around:${radius},${latitude},${longitude});


  // ==================================================
  // SUPERMARKTEN
  // ==================================================

  nwr["shop"="supermarket"]
    (around:${radius},${latitude},${longitude});


  // ==================================================
  // WINKELCENTRA / MARKTEN
  // ==================================================

  nwr["shop"="mall"]
    (around:${radius},${latitude},${longitude});

  nwr["amenity"="marketplace"]
    (around:${radius},${latitude},${longitude});


  // ==================================================
  // HOTELS
  // ==================================================

  nwr["tourism"="hotel"]
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

          signal: AbortSignal.timeout(25000),
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

      // ==================================================
      // COÖRDINATEN
      // ==================================================

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


      // ==================================================
      // TAGS
      // ==================================================

      const tags = el.tags || {};


      // ==================================================
      // NAAM
      // ==================================================

      let name =
        tags.name ||
        tags["name:nl"];


      // ==================================================
      // TYPE
      // ==================================================

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
        tags.social_facility === "retirement_home"
      ) {

        type = "nursing_home";

      }


      // ==================================================
      // SCHOOL
      // ==================================================
      //
      // Zowel:
      //
      // amenity=school
      //
      // als:
      //
      // building=school
      //
      // worden als school behandeld.
      // ==================================================

      else if (
        tags.amenity === "school" ||
        tags.building === "school"
      ) {

        type = "school";

      }


      // ==================================================
      // COLLEGE
      // ==================================================

      else if (
        tags.amenity === "college" ||
        tags.building === "college"
      ) {

        type = "school";

      }


      // ==================================================
      // UNIVERSITEIT
      // ==================================================

      else if (
        tags.amenity === "university" ||
        tags.building === "university"
      ) {

        type = "school";

      }


      // ==================================================
      // ONDERWIJSTERREIN
      // ==================================================

      else if (
        tags.landuse === "education"
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
      // MAATSCHAPPELIJK
      // ==================================================

      else if (
        tags.amenity === "community_centre"
      ) {

        type = "community";

      }


      // ==================================================
      // SUPERMARKT
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
        tags.shop === "mall" ||
        tags.amenity === "marketplace"
      ) {

        type = "shopping_centre";

      }


      // ==================================================
      // HOTEL
      // ==================================================

      else if (
        tags.tourism === "hotel"
      ) {

        type = "hotel";

      }


      // ==================================================
      // NIET RELEVANT
      // ==================================================

      if (!type) {

        return null;

      }


      // ==================================================
      // NAAMLOZE BAG-SCHOOLGEBOUWEN
      // ==================================================
      //
      // Sommige BAG-objecten hebben wel:
      //
      // building=school
      //
      // maar geen naam.
      //
      // Deze tonen we niet meer als:
      //
      // "Onbekend object"
      //
      // maar als:
      //
      // "Schoolgebouw (BAG)"
      //
      // Zo blijft duidelijk wat voor object het is.
      // ==================================================

      if (
        type === "school" &&
        !name &&
        tags.building === "school"
      ) {

        name = "Schoolgebouw (BAG)";

      }


      // ==================================================
      // ALGEMENE NAAMLOZE OBJECTEN
      // ==================================================
      //
      // Voor andere objecttypen gebruiken we een neutrale
      // naam als OSM geen naam heeft.
      // ==================================================

      if (!name) {

        name = "Onbekend object";

      }


      // ==================================================
      // OBJECT TERUGGEVEN
      // ==================================================

      return {

        id:
          `${el.type}-${el.id}`,

        name,

        type,

        latitude: lat,

        longitude: lon,

      };

    })

    .filter(Boolean);


  // ==================================================
  // DUBBELE OBJECTEN VERWIJDEREN
  // ==================================================
  //
  // Hetzelfde OSM-object kan door meerdere queries
  // worden gevonden.
  //
  // Bijvoorbeeld een object dat zowel:
  //
  // amenity=school
  //
  // als:
  //
  // building=school
  //
  // heeft.
  //
  // Het OSM-ID blijft hetzelfde, dus we houden slechts
  // één exemplaar over.
  // ==================================================

  const uniqueObjects =
    Array.from(
      new Map(
        objects.map(
          (object) => [
            object.id,
            object,
          ]
        )
      ).values()
    );


  // ==================================================
  // RESULTAAT SORTEREN
  // ==================================================
  //
  // Alfabetisch op naam.
  // ==================================================

  uniqueObjects.sort(
    (a, b) =>
      a.name.localeCompare(
        b.name,
        "nl",
        {
          sensitivity: "base",
        }
      )
  );


  console.log(
    "🟢 Unieke relevante objecten:",
    uniqueObjects.length
  );


  // ==================================================
  // RESULTAAT
  // ==================================================

  return res.status(200).json(
    uniqueObjects
  );

});


// ==================================================
// SERVER STARTEN
// ==================================================

app.listen(
  PORT,
  () => {

    console.log("");
    console.log("======================================");
    console.log("🚒 Omgevingsscan backend");
    console.log(`🚀 Server draait op poort ${PORT}`);
    console.log("======================================");
    console.log("");

  }
);


// ==================================================
// EXPORT
// ==================================================

module.exports = app;