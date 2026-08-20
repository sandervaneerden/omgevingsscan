const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());


// --------------------------------------------------
// OVERPASS SERVERS
// --------------------------------------------------

const OVERPASS_SERVERS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];


// --------------------------------------------------
// TEST ROUTE
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Omgevingsscan backend werkt"
  });
});


// --------------------------------------------------
// KWETSBARE OBJECTEN
// --------------------------------------------------

app.get("/api/vulnerable-objects", async (req, res) => {

  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const radius = Number(req.query.radius || 3000);


  console.log("");
  console.log("🔎 Objecten opvragen");
  console.log("Locatie:", latitude, longitude);
  console.log("Radius:", radius);


  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radius)
  ) {

    return res.status(400).json({
      error: "Ongeldige locatie of radius"
    });

  }


  // ------------------------------------------------
  // OVERPASS QUERY
  // ------------------------------------------------

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


  // ------------------------------------------------
  // OVERPASS PROBEREN
  // ------------------------------------------------

  let data = null;
  let laatsteFout = null;


  for (const server of OVERPASS_SERVERS) {

    try {

      console.log("");
      console.log("🌍 Overpass proberen:");
      console.log(server);


      const response = await fetch(
        server,
        {
          method: "POST",

          headers: {
            "Content-Type": "text/plain",
            "User-Agent": "Omgevingsscan/1.0"
          },

          body: query,

          signal: AbortSignal.timeout(40000)
        }
      );


      console.log(
        "Overpass status:",
        response.status
      );


      if (!response.ok) {

        const foutTekst =
          await response.text();

        console.error(
          "❌ Overpass fout:",
          response.status
        );

        console.error(
          foutTekst.substring(0, 500)
        );


        laatsteFout =
          new Error(
            `Overpass HTTP ${response.status}`
          );


        continue;

      }


      data = await response.json();


      console.log(
        "✅ Overpass antwoord ontvangen"
      );


      break;


    } catch (error) {

      console.error(
        "❌ Overpass verbinding mislukt:",
        error.message
      );


      laatsteFout = error;

    }

  }


  // ------------------------------------------------
  // GEEN OVERPASS SERVER BESCHIKBAAR
  // ------------------------------------------------

  if (!data) {

    console.error(
      "❌ Alle Overpass servers mislukt"
    );


    return res.status(502).json({

      error:
        "Alle Overpass servers zijn tijdelijk niet beschikbaar",

      details:
        laatsteFout?.message || "Onbekende fout"

    });

  }


  // ------------------------------------------------
  // OBJECTEN VERWERKEN
  // ------------------------------------------------

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

      }

      else if (
        el.tags?.amenity === "hospital"
      ) {

        type = "hospital";

      }

      else if (
        el.tags?.amenity === "place_of_worship"
      ) {

        type = "church";

      }

      else if (
        el.tags?.shop
      ) {

        type = "shop";

      }

      else if (
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

        longitude: lon

      };

    })

    .filter(Boolean);


  // ------------------------------------------------
  // DUBBELE OBJECTEN VERWIJDEREN
  // ------------------------------------------------

  const uniqueObjects = Array.from(

    new Map(
      objects.map(
        (object) => [
          `${object.id}-${object.type}`,
          object
        ]
      )
    ).values()

  );


  console.log("");
  console.log(
    "✅ Objecten gevonden:",
    uniqueObjects.length
  );


  console.log(
    "🏫 Scholen:",
    uniqueObjects.filter(
      o => o.type === "school"
    ).length
  );


  console.log(
    "🏥 Ziekenhuizen:",
    uniqueObjects.filter(
      o => o.type === "hospital"
    ).length
  );


  console.log(
    "⛪ Kerken:",
    uniqueObjects.filter(
      o => o.type === "church"
    ).length
  );


  console.log(
    "🏪 Winkels:",
    uniqueObjects.filter(
      o => o.type === "shop"
    ).length
  );


  console.log(
    "🏢 Buurthuizen:",
    uniqueObjects.filter(
      o => o.type === "community"
    ).length
  );


  res.json(uniqueObjects);

});


// --------------------------------------------------
// SERVER STARTEN
// --------------------------------------------------

module.exports = app;