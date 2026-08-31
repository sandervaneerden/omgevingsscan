const OVERPASS_SERVERS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function handler(req, res) {

  // =========================================================
  // CORS
  // =========================================================

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


  // =========================================================
  // OPTIONS / CORS PREFLIGHT
  // =========================================================

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }


  // =========================================================
  // ALLEEN GET
  // =========================================================

  if (req.method !== "GET") {

    return res.status(405).json({
      error: "Method not allowed",
    });

  }


  // =========================================================
  // QUERY PARAMETERS
  // =========================================================

  const latitude =
    Number(req.query.latitude);

  const longitude =
    Number(req.query.longitude);

  const radius =
    Number(req.query.radius || 3000);


  // =========================================================
  // CONTROLEREN
  // =========================================================

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radius)
  ) {

    return res.status(400).json({
      error: "Ongeldige locatie of radius",
    });

  }


  // =========================================================
  // OVERPASS QUERY
  //
  // Alleen relevante objecten worden opgehaald.
  //
  // Zorg:
  // - ziekenhuis
  // - kliniek
  // - verpleeghuis
  // - verzorgingshuis
  //
  // Algemene healthcare-objecten worden NIET opgehaald.
  // Hierdoor worden bijvoorbeeld tandartsen, huisartsen,
  // psychologen, fysiotherapeuten en prothesepraktijken
  // uitgesloten.
  // =========================================================

  const query = `
[out:json][timeout:30];

(

  // =======================================================
  // ONDERWIJS
  // =======================================================

  node["amenity"="school"](around:${radius},${latitude},${longitude});
  way["amenity"="school"](around:${radius},${latitude},${longitude});

  node["amenity"="kindergarten"](around:${radius},${latitude},${longitude});
  way["amenity"="kindergarten"](around:${radius},${latitude},${longitude});


  // =======================================================
  // ZIEKENHUIS
  // =======================================================

  node["amenity"="hospital"](around:${radius},${latitude},${longitude});
  way["amenity"="hospital"](around:${radius},${latitude},${longitude});


  // =======================================================
  // KLINIEK
  // =======================================================

  node["amenity"="clinic"](around:${radius},${latitude},${longitude});
  way["amenity"="clinic"](around:${radius},${latitude},${longitude});


  // =======================================================
  // VERPLEEGHUIS
  // =======================================================

  node["social_facility"="nursing_home"](around:${radius},${latitude},${longitude});
  way["social_facility"="nursing_home"](around:${radius},${latitude},${longitude});


  // =======================================================
  // VERZORGINGSHUIS
  // =======================================================

  node["social_facility"="care_home"](around:${radius},${latitude},${longitude});
  way["social_facility"="care_home"](around:${radius},${latitude},${longitude});


  // =======================================================
  // RELIGIE
  // =======================================================

  node["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});
  way["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});


  // =======================================================
  // WINKELS
  // =======================================================

  node["shop"](around:${radius},${latitude},${longitude});
  way["shop"](around:${radius},${latitude},${longitude});


  // =======================================================
  // MAATSCHAPPELIJK
  // =======================================================

  node["amenity"="community_centre"](around:${radius},${latitude},${longitude});
  way["amenity"="community_centre"](around:${radius},${latitude},${longitude});

);

out center;
`;


  // =========================================================
  // OVERPASS SERVERS PROBEREN
  // =========================================================

  let data = null;
  let laatsteFout = null;


  for (const server of OVERPASS_SERVERS) {

    try {

      console.log(
        "Overpass proberen:",
        server
      );


      const response =
        await fetch(
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

        laatsteFout =
          new Error(
            `Overpass HTTP ${response.status}`
          );

        continue;
      }


      data =
        await response.json();


      console.log(
        "Overpass objecten ontvangen:",
        data.elements?.length || 0
      );


      break;

    } catch (error) {

      laatsteFout = error;

    }

  }


  // =========================================================
  // GEEN OVERPASS SERVER BESCHIKBAAR
  // =========================================================

  if (!data) {

    return res.status(502).json({

      error:
        "Alle Overpass servers zijn tijdelijk niet beschikbaar",

      details:
        laatsteFout?.message ||
        "Onbekende fout",

    });

  }


  // =========================================================
  // OBJECTEN OMZETTEN
  // =========================================================

  const objects =
    data.elements

      .map((el) => {

        // ---------------------------------------------------
        // POSITIE
        // ---------------------------------------------------

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


        // ---------------------------------------------------
        // TAGS
        // ---------------------------------------------------

        const tags =
          el.tags || {};


        // ---------------------------------------------------
        // STANDAARD TYPE
        // ---------------------------------------------------

        let type = "public";


        // ===================================================
        // ZIEKENHUIS
        // ===================================================

        if (
          tags.amenity === "hospital"
        ) {

          type = "hospital";

        }


        // ===================================================
        // KLINIEK
        // ===================================================

        else if (
          tags.amenity === "clinic"
        ) {

          type = "clinic";

        }


        // ===================================================
        // VERPLEEGHUIS
        // ===================================================

        else if (
          tags.social_facility === "nursing_home"
        ) {

          type = "nursing_home";

        }


        // ===================================================
        // VERZORGINGSHUIS
        // ===================================================

        else if (
          tags.social_facility === "care_home"
        ) {

          type = "care_home";

        }


        // ===================================================
        // SCHOOL
        // ===================================================

        else if (
          tags.amenity === "school"
        ) {

          type = "school";

        }


        // ===================================================
        // KINDEROPVANG
        // ===================================================

        else if (
          tags.amenity === "kindergarten"
        ) {

          type = "kindergarten";

        }


        // ===================================================
        // RELIGIE
        // ===================================================

        else if (
          tags.amenity === "place_of_worship"
        ) {

          type = "church";

        }


        // ===================================================
        // WINKEL
        // ===================================================

        else if (
          tags.shop
        ) {

          type = "shop";

        }


        // ===================================================
        // MAATSCHAPPELIJK
        // ===================================================

        else if (
          tags.amenity === "community_centre"
        ) {

          type = "community";

        }


        // ===================================================
        // OBJECT
        // ===================================================

        return {

          id:
            `${el.type}-${el.id}`,

          name:
            tags.name ||
            "Onbekend object",

          type,

          latitude:
            lat,

          longitude:
            lon,

        };

      })


      // =====================================================
      // ONGELDIGE OBJECTEN VERWIJDEREN
      // =====================================================

      .filter(Boolean);


  // =========================================================
  // DUBBELE OBJECTEN VERWIJDEREN
  // =========================================================

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


  // =========================================================
  // LOG
  // =========================================================

  console.log(
    "Unieke objecten:",
    uniqueObjects.length
  );


  // =========================================================
  // RESULTAAT
  // =========================================================

  return res.status(200).json(
    uniqueObjects
  );

}
module.exports = handler;
