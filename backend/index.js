const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/* =========================================================
   CONFIGURATIE
========================================================= */

const OVERPASS_SERVERS = [
  "http://lz4.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const OVERPASS_TIMEOUTS = [
  15000,
  20000,
  20000,
];

const DUO_SCHOOLS_PATH = path.join(
  __dirname,
  "data",
  "duo-schools.json"
);

const LRK_CHILDCARE_PATH = path.join(
  __dirname,
  "data",
  "lrk-childcare.json"
);

const BAG_BASE_URL =
  "https://api.pdok.nl/kadaster/bag/ogc/v2";

/* =========================================================
   DUO
========================================================= */

let duoSchools = [];

try {
  if (fs.existsSync(DUO_SCHOOLS_PATH)) {
    const raw = fs.readFileSync(
      DUO_SCHOOLS_PATH,
      "utf8"
    );

    duoSchools = JSON.parse(raw);

    if (!Array.isArray(duoSchools)) {
      console.error(
        "DUO-bestand bevat geen array."
      );

      duoSchools = [];
    } else {
      console.log(
        `DUO-scholen geladen: ${duoSchools.length}`
      );
    }
  } else {
    console.warn(
      `DUO-bestand niet gevonden: ${DUO_SCHOOLS_PATH}`
    );
  }
} catch (error) {
  console.error(
    "Fout bij laden DUO-scholen:",
    error.message
  );

  duoSchools = [];
}

/* =========================================================
   LRK
========================================================= */

let lrkChildcare = [];

try {
  if (fs.existsSync(LRK_CHILDCARE_PATH)) {
    const raw = fs.readFileSync(
      LRK_CHILDCARE_PATH,
      "utf8"
    );

    lrkChildcare = JSON.parse(raw);

    if (!Array.isArray(lrkChildcare)) {
      console.error(
        "LRK-bestand bevat geen array."
      );

      lrkChildcare = [];
    } else {
      console.log(
        `LRK-kinderopvang geladen: ${lrkChildcare.length}`
      );
    }
  } else {
    console.warn(
      `LRK-bestand niet gevonden: ${LRK_CHILDCARE_PATH}`
    );
  }
} catch (error) {
  console.error(
    "Fout bij laden LRK-kinderopvang:",
    error.message
  );

  lrkChildcare = [];
}

/* =========================================================
   CACHE
========================================================= */

const bagPandCache = new Map();
const bagPandPromiseCache = new Map();

/* =========================================================
   ALGEMENE HELPERS
========================================================= */

function firstDefined(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeStreet(value) {
  return normalizeText(value)
    .replace(/\bstraat\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHouseNumber(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function normalizePostcode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function normalizeBAGId(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  let result = String(value).trim();

  if (!result) {
    return null;
  }

  result = result.replace(/[?#].*$/, "");
  result = result.replace(/\/+$/, "");

  if (result.includes("/")) {
    const parts = result.split("/");
    result = parts[parts.length - 1];
  }

  return result || null;
}

function distanceMeters(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371000;

  const phi1 =
    (lat1 * Math.PI) / 180;

  const phi2 =
    (lat2 * Math.PI) / 180;

  const dPhi =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLambda =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(dLambda / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

function getElementCoordinates(element) {
  if (
    element.lat != null &&
    element.lon != null
  ) {
    return {
      latitude: Number(element.lat),
      longitude: Number(element.lon),
    };
  }

  if (
    element.center &&
    element.center.lat != null &&
    element.center.lon != null
  ) {
    return {
      latitude: Number(
        element.center.lat
      ),
      longitude: Number(
        element.center.lon
      ),
    };
  }

  return null;
}

/* =========================================================
   TYPE CLASSIFICATIE
========================================================= */

function detectCareTypeFromText(text) {
  const normalized =
    normalizeText(text);

  if (
    /\bverpleeghuis\b/.test(normalized) ||
    /\bverzorgingshuis\b/.test(normalized) ||
    /\bwoonzorgcentrum\b/.test(normalized) ||
    /\bwoonzorg\b/.test(normalized) ||
    /\bouderenzorg\b/.test(normalized) ||
    /\bzorgcentrum\b/.test(normalized) ||
    /\bverzorgingstehuis\b/.test(normalized) ||
    /\bseniorencomplex\b/.test(normalized)
  ) {
    return "nursing_home";
  }

  if (
    /\bgehandicaptenzorg\b/.test(normalized) ||
    /\bgehandicapten\b/.test(normalized) ||
    /\bwoonbegeleiding\b/.test(normalized) ||
    /\bbegeleid wonen\b/.test(normalized) ||
    /\bzorg voor gehandicapten\b/.test(normalized) ||
    /\bverstandelijk gehandicapten\b/.test(normalized)
  ) {
    return "disability_care";
  }

  if (
    /\bhospice\b/.test(normalized) ||
    /\bpalliatieve zorg\b/.test(normalized)
  ) {
    return "hospice";
  }

  if (
    /\bggz\b/.test(normalized) ||
    /\bgeestelijke gezondheidszorg\b/.test(normalized) ||
    /\bpsychiatr/.test(normalized) ||
    /\bpsychiatrisch\b/.test(normalized)
  ) {
    return "mental_health";
  }

  if (
    /\brevalidatie\b/.test(normalized) ||
    /\brevalidatiecentrum\b/.test(normalized) ||
    /\brehabilitatie\b/.test(normalized)
  ) {
    return "rehabilitation";
  }

  if (
    /\bdagbesteding\b/.test(normalized) &&
    (
      /\bzorg\b/.test(normalized) ||
      /\bgehandicapten\b/.test(normalized)
    )
  ) {
    return "disability_care";
  }

  if (
    /\bthuiszorg\b/.test(normalized) ||
    /\bwijkverpleging\b/.test(normalized)
  ) {
    return "home_care";
  }

  if (
    /\bhuisarts\b/.test(normalized) ||
    /\bhuisartsen\b/.test(normalized) ||
    /\bpraktijk voor huisarts\b/.test(normalized) ||
    /\bdokter\b/.test(normalized)
  ) {
    return "doctor";
  }

  if (
    /\bkinderdagverblijf\b/.test(normalized) ||
    /\bkinderopvang\b/.test(normalized) ||
    /\bpeuterspeelzaal\b/.test(normalized) ||
    /\bkindcentrum\b/.test(normalized) ||
    /\bkinderdagcentrum\b/.test(normalized) ||
    /\bbso\b/.test(normalized)
  ) {
    return "daycare";
  }

  if (
    /\bziekenhuis\b/.test(normalized) ||
    /\bhospital\b/.test(normalized)
  ) {
    return "hospital";
  }

  if (
    /\bkliniek\b/.test(normalized) ||
    /\bclinic\b/.test(normalized)
  ) {
    return "clinic";
  }

  if (
    /\btandarts\b/.test(normalized) ||
    /\btandartsen\b/.test(normalized) ||
    /\btandheelkunde\b/.test(normalized) ||
    /\bprothese\b/.test(normalized)
  ) {
    return "dentist";
  }

  if (
    /\bfysiotherapie\b/.test(normalized) ||
    /\bfysiotherapeut\b/.test(normalized)
  ) {
    return "physiotherapy";
  }

  if (
    /\bapotheek\b/.test(normalized) ||
    /\bpharmacy\b/.test(normalized)
  ) {
    return "pharmacy";
  }

  return null;
}

function getObjectType(tags = {}) {
  const text = [
    tags.name,
    tags.description,
    tags.operator,
    tags.official_name,
    tags.alt_name,
  ]
    .filter(Boolean)
    .join(" ");

  const detectedCareType =
    detectCareTypeFromText(text);

  if (detectedCareType) {
    return detectedCareType;
  }

  const name =
    normalizeText(tags.name);

  if (
    name === "jonx" ||
    name.includes("dignis")
  ) {
    return "disability_care";
  }

  if (
    tags.amenity ===
    "social_facility"
  ) {
    const facility =
      normalizeText(
        [
          tags["social_facility"],
          tags.name,
          tags.description,
          tags.operator,
        ]
          .filter(Boolean)
          .join(" ")
      );

    if (
      facility.includes("nursing_home") ||
      facility.includes("nursing home") ||
      facility.includes("verpleeghuis") ||
      facility.includes("verzorgingshuis") ||
      facility.includes("woonzorg") ||
      facility.includes("assisted_living") ||
      facility.includes("groep_wonen") ||
      facility.includes("group_home")
    ) {
      return "nursing_home";
    }

    if (
      facility.includes("disability") ||
      facility.includes("gehandicap") ||
      facility.includes("woonbegeleiding")
    ) {
      return "disability_care";
    }

    if (
      facility.includes("hospice") ||
      facility.includes("palliative")
    ) {
      return "hospice";
    }

    if (
      facility.includes("mental_health") ||
      facility.includes("ggz")
    ) {
      return "mental_health";
    }

    return null;
  }

  if (
    tags.healthcare === "hospital"
  ) {
    return "hospital";
  }

  if (
    tags.amenity === "hospital"
  ) {
    return "hospital";
  }

  if (
    tags.healthcare === "clinic"
  ) {
    return "clinic";
  }

  if (
    tags.amenity === "clinic"
  ) {
    return "clinic";
  }

  if (
    tags.healthcare === "doctor" ||
    tags.healthcare ===
      "general_practitioner" ||
    tags.amenity === "doctors"
  ) {
    return "doctor";
  }

  if (
    tags.healthcare === "dentist" ||
    tags.amenity === "dentist"
  ) {
    return "dentist";
  }

  if (
    tags.healthcare ===
      "physiotherapist" ||
    tags.healthcare ===
      "physiotherapy"
  ) {
    return "physiotherapy";
  }

  if (
    tags.healthcare === "pharmacy" ||
    tags.amenity === "pharmacy"
  ) {
    return "pharmacy";
  }

  if (
    tags.amenity === "school"
  ) {
    return "school";
  }

  if (
    tags.amenity === "kindergarten" ||
    tags.amenity === "childcare"
  ) {
    return "daycare";
  }

  if (
    tags.amenity ===
    "place_of_worship"
  ) {
    return "place_of_worship";
  }

  if (
    tags.amenity ===
    "community_centre"
  ) {
    return "community_centre";
  }

  if (
    tags.leisure ===
      "sports_centre" ||
    tags.leisure === "stadium"
  ) {
    return "sports";
  }

  if (
    tags.tourism === "hotel" ||
    tags.tourism === "hostel" ||
    tags.tourism === "guest_house"
  ) {
    return "hotel";
  }

  if (
    tags.shop === "supermarket"
  ) {
    return "supermarket";
  }

  if (
    tags.amenity ===
    "marketplace"
  ) {
    return "marketplace";
  }

  return null;
}

function priorityForType(type) {
  switch (type) {
    case "hospital":
      return 1;

    case "nursing_home":
    case "disability_care":
    case "hospice":
    case "mental_health":
    case "rehabilitation":
      return 2;

    case "school":
    case "daycare":
      return 4;

    case "place_of_worship":
      return 5;

    case "community_centre":
    case "sports":
      return 6;

    case "hotel":
      return 7;

    case "supermarket":
    case "marketplace":
      return 8;

    default:
      return 99;
  }
}

function isReturnedVulnerableType(type) {
  return [
    "hospital",
    "nursing_home",
    "disability_care",
    "hospice",
    "mental_health",
    "rehabilitation",
    "school",
    "daycare",
    "place_of_worship",
    "community_centre",
    "sports",
    "hotel",
    "supermarket",
    "marketplace",
  ].includes(type);
}

/* =========================================================
   ADRES
========================================================= */

function namesMatch(
  nameA,
  nameB
) {
  const a =
    normalizeText(nameA);

  const b =
    normalizeText(nameB);

  if (!a || !b) {
    return false;
  }

  return (
    a === b ||
    a.includes(b) ||
    b.includes(a)
  );
}

/*
 * Algemene adresmatch.
 *
 * Deze functie blijft bewust redelijk breed voor bestaande
 * OSM/BAG-deduplicatie.
 *
 * Voor LRK gebruiken we hieronder een aparte, strengere
 * functie: lrkAddressesMatch().
 */

function addressesMatch(
  addressA = {},
  addressB = {}
) {
  const streetA =
    normalizeStreet(
      addressA.street
    );

  const streetB =
    normalizeStreet(
      addressB.street
    );

  const houseA =
    normalizeHouseNumber(
      addressA.housenumber
    );

  const houseB =
    normalizeHouseNumber(
      addressB.housenumber
    );

  const postcodeA =
    normalizePostcode(
      addressA.postcode
    );

  const postcodeB =
    normalizePostcode(
      addressB.postcode
    );

  if (
    streetA &&
    streetB &&
    houseA &&
    houseB &&
    streetA === streetB &&
    houseA === houseB
  ) {
    return true;
  }

  if (
    postcodeA &&
    postcodeB &&
    houseA &&
    houseB &&
    postcodeA === postcodeB &&
    houseA === houseB
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   LRK ADRESMATCH
========================================================= */

// 🟨 GEWIJZIGD:
//
// Strenge adrescontrole uitsluitend voor LRK.
//
// Belangrijk:
// straat + huisnummer alleen is NIET voldoende.
//
// Als beide postcodes bekend zijn, moeten die exact
// overeenkomen.
//
// Als één of beide postcodes ontbreken, gebruiken we
// de woonplaats als aanvullende controle.
//
// Hiermee voorkomen we bijvoorbeeld:
//
// LRK:
// Oosterstraat 3A
// 7413 XV Deventer
//
// BAG:
// Oosterstraat 3A
// 9679 KJ Scheemda
//
// Dit mag NOOIT als dezelfde locatie worden gezien.

function lrkAddressesMatch(
  lrkAddress = {},
  bagAddress = {}
) {
  const streetA =
    normalizeStreet(
      lrkAddress.street
    );

  const streetB =
    normalizeStreet(
      bagAddress.street
    );

  const houseA =
    normalizeHouseNumber(
      lrkAddress.housenumber
    );

  const houseB =
    normalizeHouseNumber(
      bagAddress.housenumber
    );

  const postcodeA =
    normalizePostcode(
      lrkAddress.postcode
    );

  const postcodeB =
    normalizePostcode(
      bagAddress.postcode
    );

  /*
   * LRK -> BAG is bewust een zeer strenge koppeling.
   *
   * Alle drie moeten aanwezig zijn:
   *
   * 1. postcode
   * 2. straat
   * 3. huisnummer
   *
   * Ontbreekt één van deze gegevens?
   * Dan GEEN LRK/BAG-match.
   */

  if (
    !postcodeA ||
    !postcodeB ||
    !streetA ||
    !streetB ||
    !houseA ||
    !houseB
  ) {
    return false;
  }

  /*
   * Postcode moet exact overeenkomen.
   */

  if (
    postcodeA !== postcodeB
  ) {
    return false;
  }

  /*
   * Straat moet overeenkomen.
   */

  if (
    streetA !== streetB
  ) {
    return false;
  }

  /*
   * Huisnummer moet overeenkomen.
   */

  if (
    houseA !== houseB
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   DUO
========================================================= */

function processDUOSchools(
  records,
  latitude,
  longitude,
  radius
) {
  if (!Array.isArray(records)) {
    return [];
  }

  const results = [];

  for (
    let index = 0;
    index < records.length;
    index++
  ) {
    const school =
      records[index];

    const schoolLat =
      Number(
        school.latitude
      );

    const schoolLon =
      Number(
        school.longitude
      );

    if (
      !Number.isFinite(
        schoolLat
      ) ||
      !Number.isFinite(
        schoolLon
      )
    ) {
      continue;
    }

    const distance =
      distanceMeters(
        latitude,
        longitude,
        schoolLat,
        schoolLon
      );

    if (
      distance > radius
    ) {
      continue;
    }

    const address = {
      street:
        school.street ||
        null,

      housenumber:
        school.houseNumber ||
        null,

      postcode:
        school.postcode ||
        null,

      city:
        school.city ||
        null,
    };

    const vestigingCode =
      school.duo &&
      school.duo.vestigingCode
        ? school.duo.vestigingCode
        : null;

    const instellingCode =
      school.duo &&
      school.duo.instellingCode
        ? school.duo.instellingCode
        : null;

    const uniqueId =
      vestigingCode ||
      instellingCode ||
      `index-${index}`;

    results.push({
      id:
        `duo-${uniqueId}`,

      name:
        school.name ||
        "School",

      type: "school",

      latitude:
        schoolLat,

      longitude:
        schoolLon,

      distance:
        Math.round(distance),

      priority:
        priorityForType(
          "school"
        ),

      address,

      source: "DUO",

      confidence:
        school.confidence ||
        "high",

      duo:
        school.duo ||
        null,

      pdok:
        school.pdok ||
        null,

      tags: {
        source: "DUO",

        school_type:
          school.type ||
          null,
      },
    });
  }

  return results;
}

/* =========================================================
   OVERPASS
========================================================= */

async function queryOneOverpassServer(
  server,
  timeoutMs,
  query
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const body =
      new URLSearchParams();

    body.set(
      "data",
      query
    );

    const response =
      await fetch(
        server,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded; charset=UTF-8",

            "Accept":
              "application/json",

            "User-Agent":
              "Omgevingsscan/1.0 (https://omgevingsscan.vercel.app)",
          },

          body:
            body.toString(),

          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const json =
      await response.json();

    return Array.isArray(
      json.elements
    )
      ? json.elements
      : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function queryOverpassGet(
  server,
  timeoutMs,
  query
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const url =
      `${server}?data=${encodeURIComponent(
        query
      )}`;

    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            "Accept":
              "application/json",

            "User-Agent":
              "Omgevingsscan/1.0 (https://omgevingsscan.vercel.app)",
          },

          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const json =
      await response.json();

    return Array.isArray(
      json.elements
    )
      ? json.elements
      : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function queryOverpass(latitude, longitude, radius) {
  const servers = ["https://overpass-api.de/api/interpreter"];
  const query = "[out:json][timeout:3];(nwr[amenity](around:" + radius + "," + latitude + "," + longitude + ");nwr[leisure](around:" + radius + "," + latitude + "," + longitude + ");nwr[tourism](around:" + radius + "," + latitude + "," + longitude + ");nwr[shop](around:" + radius + "," + latitude + "," + longitude + "););out center tags;";
  for (const server of servers) {
    try {
      console.log("OSM/Overpass ophalen via " + server);
      const elements = await queryOverpassGet(server, 4000, query);
      console.log("OSM-objecten opgehaald: " + elements.length);
      return elements;
    } catch (error) {
      console.warn("OSM/Overpass mislukt: " + error.message);
    }
  }
  console.warn("OSM/Overpass niet beschikbaar; doorgaan zonder OSM.");
  return [];
}

function processOSMObjects(
  elements,
  latitude,
  longitude,
  radius
) {
  const results = [];

  for (
    const element of elements
  ) {
    const coordinates =
      getElementCoordinates(
        element
      );

    if (!coordinates) {
      continue;
    }

    const distance =
      distanceMeters(
        latitude,
        longitude,
        coordinates.latitude,
        coordinates.longitude
      );

    if (
      distance > radius
    ) {
      continue;
    }

    const tags =
      element.tags || {};

    const type =
      getObjectType(tags);

    if (!type) {
      continue;
    }

    if (
      [
        "doctor",
        "dentist",
        "physiotherapy",
        "pharmacy",
      ].includes(type)
    ) {
      console.log(
        `OSM uitgesloten: ${
          tags.name ||
          tags.official_name ||
          tags.alt_name ||
          "Onbekend object"
        } (${type})`
      );

      continue;
    }

    if (
      !isReturnedVulnerableType(
        type
      )
    ) {
      continue;
    }

    const address = {
      street:
        tags["addr:street"] ||
        tags.street ||
        null,

      housenumber:
        tags["addr:housenumber"] ||
        null,

      postcode:
        tags["addr:postcode"] ||
        null,

      city:
        tags["addr:city"] ||
        null,
    };

    const name =
      tags.name ||
      tags.official_name ||
      tags.alt_name ||
      (
        type === "school"
          ? "School"
          : type
      );

    results.push({
      id:
        `osm-${element.type}-${element.id}`,

      name,

      type,

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,

      distance:
        Math.round(distance),

      priority:
        priorityForType(type),

      address,

      source: "OSM",

      confidence:
        type === "school"
          ? "medium"
          : "high",

      tags,
    });
  }

  return results;
}

/* =========================================================
   BAG
========================================================= */

async function queryBAG(
  latitude,
  longitude,
  radius
) {
  const latDelta =
    radius / 111320;

  const cosLat =
    Math.cos(
      (latitude * Math.PI) / 180
    );

  const lonDelta =
    radius /
    (
      111320 *
      Math.max(
        Math.abs(cosLat),
        0.01
      )
    );

  const minLon =
    longitude - lonDelta;

  const maxLon =
    longitude + lonDelta;

  const minLat =
    latitude - latDelta;

  const maxLat =
    latitude + latDelta;

  let url =
    `${BAG_BASE_URL}/collections/` +
    `verblijfsobject/items` +
    `?bbox=${minLon},${minLat},${maxLon},${maxLat}` +
    "&limit=1000" +
    "&f=json";

  const results = [];

  try {
    for (
      let page = 0;
      page < 10;
      page++
    ) {
      console.log(
        `BAG ophalen pagina ${page + 1}`
      );

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          15000
        );

      try {
        const response =
          await fetch(
            url,
            {
              method: "GET",

              headers: {
                "Accept":
                  "application/geo+json, application/json",

                "User-Agent":
                  "Omgevingsscan/1.0 (https://omgevingsscan.vercel.app)",
              },

              signal:
                controller.signal,
            }
          );

        if (!response.ok) {
          throw new Error(
            `BAG HTTP ${response.status}`
          );
        }

        const data =
          await response.json();

        if (
          Array.isArray(
            data.features
          )
        ) {
          results.push(
            ...data.features
          );
        }

        const nextLink =
          Array.isArray(
            data.links
          )
            ? data.links.find(
                link =>
                  link.rel ===
                    "next" &&
                  link.href
              )
            : null;

        if (
          !nextLink ||
          !nextLink.href
        ) {
          break;
        }

        url =
          nextLink.href;
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (error) {
    console.warn(
      `BAG query mislukt: ${error.message}`
    );
  }

  return results;
}

function getBAGType(
  feature
) {
  const properties =
    feature.properties || {};

  const gebruiksdoel =
    normalizeText(
      Array.isArray(
        properties.gebruiksdoel
      )
        ? properties.gebruiksdoel.join(
            " "
          )
        : properties.gebruiksdoel
    );

  if (
    gebruiksdoel.includes(
      "onderwijsfunctie"
    )
  ) {
    return "school";
  }

  if (
    gebruiksdoel.includes(
      "logiesfunctie"
    )
  ) {
    return "hotel";
  }


  return null;
}

/* =========================================================
   BAG IDENTIFICATIES
========================================================= */

function getBAGVerblijfsobjectId(
  feature
) {
  const properties =
    feature?.properties || {};

  const value =
    firstDefined(
      properties.identificatie,
      properties.verblijfsobjectidentificatie,
      properties.verblijfsobject_identificatie,
      properties.verblijfsobject_id,
      properties.verblijfsobjectId,
      properties[
        "verblijfsobject:identificatie"
      ],
      properties.id,
      feature?.id
    );

  return normalizeBAGId(
    value
  );
}

function getBAGPandId(
  feature
) {
  const properties =
    feature?.properties || {};

  const value =
    firstDefined(
      properties.pand_id,
      properties.pandidentificatie,
      properties.pand_identificatie,
      properties[
        "pand:identificatie"
      ],
      properties.pandId
    );

  return normalizeBAGId(
    value
  );
}

function getBAGPandHref(
  feature
) {
  const properties =
    feature?.properties || {};

  const pand =
    firstDefined(
      properties.pand,
      properties.pand_href,
      properties[
        "pand:href"
      ]
    );

  if (
    Array.isArray(pand)
  ) {
    if (
      pand.length === 0
    ) {
      return null;
    }

    for (
      const item of pand
    ) {
      if (
        typeof item ===
        "string"
      ) {
        return item;
      }

      if (
        item &&
        typeof item ===
          "object"
      ) {
        const href =
          firstDefined(
            item.href,
            item["@id"],
            item.id
          );

        if (href) {
          return href;
        }
      }
    }

    return null;
  }

  if (
    pand &&
    typeof pand ===
      "object"
  ) {
    return firstDefined(
      pand.href,
      pand["@id"],
      pand.id
    );
  }

  if (
    typeof pand ===
    "string"
  ) {
    return pand;
  }

  return null;
}

/* =========================================================
   BAG PAND GEGEVENS
========================================================= */

async function queryBAGPand(
  href
) {
  if (!href) {
    return null;
  }

  if (
    bagPandCache.has(href)
  ) {
    return bagPandCache.get(
      href
    );
  }

  if (
    bagPandPromiseCache.has(
      href
    )
  ) {
    return bagPandPromiseCache.get(
      href
    );
  }

  const promise =
    (async () => {
      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          10000
        );

      try {
        const response =
          await fetch(
            href,
            {
              method: "GET",

              headers: {
                "Accept":
                  "application/geo+json, application/json",

                "User-Agent":
                  "Omgevingsscan/1.0 (https://omgevingsscan.vercel.app)",
              },

              signal:
                controller.signal,
            }
          );

        if (!response.ok) {
          console.warn(
            `BAG pand HTTP ${response.status}: ${href}`
          );

          return null;
        }

        const data =
          await response.json();

        const properties =
          data.properties || {};

        const aantalVerblijfsobjecten =
          firstDefined(
            properties.aantal_verblijfsobjecten,
            properties.aantalVerblijfsobjecten
          );

        const oppervlakte =
          firstDefined(
            properties.oppervlakte,
            properties.oppervlakte_verblijfsobject
          );

        const identificatie =
          firstDefined(
            properties.identificatie,
            properties.pandidentificatie,
            properties.pand_identificatie,
            properties.id
          );

        const result = {
          identificatie:
            normalizeBAGId(
              identificatie
            ),

          bouwjaar:
            firstDefined(
              properties.bouwjaar
            ),

          aantal_verblijfsobjecten:
            aantalVerblijfsobjecten,

          aantalVerblijfsobjecten:
            aantalVerblijfsobjecten,

          oppervlakte,

          gebruiksdoel:
            firstDefined(
              properties.gebruiksdoel
            ),

          status:
            firstDefined(
              properties.status
            ),

          documentdatum:
            firstDefined(
              properties.documentdatum
            ),

          documentnummer:
            firstDefined(
              properties.documentnummer
            ),

          raw:
            properties,
        };

        bagPandCache.set(
          href,
          result
        );

        return result;
      } catch (error) {
        console.warn(
          `BAG pand query mislukt: ${error.message}`
        );

        return null;
      } finally {
        clearTimeout(timeout);
      }
    })();

  bagPandPromiseCache.set(
    href,
    promise
  );

  try {
    return await promise;
  } finally {
    bagPandPromiseCache.delete(
      href
    );
  }
}

/* =========================================================
   BAG ADRES HELPERS
========================================================= */

function getBAGStreet(
  properties = {}
) {
  return firstDefined(
    properties.openbare_ruimte_naam,
    properties.openbareRuimte,
    properties.openbare_ruimte,
    properties.straat
  );
}

function getBAGCity(
  properties = {}
) {
  return firstDefined(
    properties.woonplaats_naam,
    properties.woonplaats,
    properties.woonplaatsnaam
  );
}

function getBAGHouseNumber(
  properties = {}
) {
  const huisnummer =
    properties.huisnummer;

  const huisletter =
    properties.huisletter;

  const toevoeging =
    properties.toevoeging;

  let result =
    huisnummer != null
      ? String(huisnummer)
      : "";

  if (huisletter) {
    result += String(
      huisletter
    );
  }

  if (toevoeging) {
    result += String(
      toevoeging
    );
  }

  return result || null;
}

/* =========================================================
   BAG NORMALISATIE
========================================================= */

function normalizeBAGProperties(
  properties = {}
) {
  const aantalVerblijfsobjecten =
    firstDefined(
      properties.aantal_verblijfsobjecten,
      properties.aantalVerblijfsobjecten
    );

  const identificatie =
    getBAGVerblijfsobjectId({
      properties,
    });

  return {
    ...properties,

    identificatie,

    oppervlakte:
      firstDefined(
        properties.oppervlakte,
        properties.oppervlakte_verblijfsobject
      ),

    bouwjaar:
      firstDefined(
        properties.bouwjaar
      ),

    aantal_verblijfsobjecten:
      aantalVerblijfsobjecten,

    aantalVerblijfsobjecten:
      aantalVerblijfsobjecten,

    gebruiksdoel:
      firstDefined(
        properties.gebruiksdoel
      ),

    status:
      firstDefined(
        properties.status
      ),
  };
}

/* =========================================================
   BESTE BAG MATCH
========================================================= */

function getBestBAGFeatureForOSM(
  osm,
  features
) {
  if (
    !Array.isArray(features) ||
    features.length === 0
  ) {
    return null;
  }

  const osmBag =
    firstDefined(
      osm?.tags?.["ref:bag"],
      osm?.tags?.[
        "ref:bag:verblijfsobject"
      ]
    );

  const normalizedOsmBag =
    normalizeBAGId(
      osmBag
    );

  if (normalizedOsmBag) {
    const direct =
      features.find(
        feature => {
          const bagId =
            getBAGVerblijfsobjectId(
              feature
            );

          return (
            normalizeBAGId(
              bagId
            ) ===
            normalizedOsmBag
          );
        }
      );

    if (direct) {
      console.log(
        `BAG directe match: ${
          osm.name || "Onbekend"
        } -> ${
          normalizedOsmBag
        }`
      );

      return direct;
    }

    console.log(
      `BAG ref gevonden maar geen directe match: ${
        osm.name || "Onbekend"
      } -> ${
        normalizedOsmBag
      }`
    );
  }

  if (
    osm.address
  ) {
    const addressMatch =
      features.find(
        feature => {
          const p =
            feature.properties ||
            {};

          return addressesMatch(
            osm.address,
            {
              street:
                getBAGStreet(p),

              housenumber:
                getBAGHouseNumber(p),

              postcode:
                firstDefined(
                  p.postcode
                ),
            }
          );
        }
      );

    if (addressMatch) {
      console.log(
        `BAG adres-match: ${
          osm.name || "Onbekend"
        }`
      );

      return addressMatch;
    }
  }

  if (
    !Number.isFinite(
      Number(osm.latitude)
    ) ||
    !Number.isFinite(
      Number(osm.longitude)
    )
  ) {
    return null;
  }

  let best = null;
  let bestDistance = Infinity;

  for (
    const feature of features
  ) {
    const geometry =
      feature.geometry;

    if (
      !geometry ||
      geometry.type !== "Point" ||
      !Array.isArray(
        geometry.coordinates
      )
    ) {
      continue;
    }

    const lon =
      Number(
        geometry.coordinates[0]
      );

    const lat =
      Number(
        geometry.coordinates[1]
      );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }

    const d =
      distanceMeters(
        Number(osm.latitude),
        Number(osm.longitude),
        lat,
        lon
      );

    if (
      d <= 30 &&
      d < bestDistance
    ) {
      best = feature;
      bestDistance = d;
    }
  }

  if (best) {
    console.log(
      `BAG afstand-match: ${
        osm.name || "Onbekend"
      } -> ${Math.round(
        bestDistance
      )}m`
    );
  }

  return best;
}

/* =========================================================
   BAG PANDEN VERZAMELEN
========================================================= */

function collectRequiredBAGPandHrefs(
  features,
  osmObjects
) {
  const hrefs =
    new Set();

  for (
    const feature of features
  ) {
    const href =
      getBAGPandHref(
        feature
      );

    if (href) {
      hrefs.add(href);
    }
  }

  for (
    const osm of osmObjects
  ) {
    const match =
      getBestBAGFeatureForOSM(
        osm,
        features
      );

    if (!match) {
      continue;
    }

    const href =
      getBAGPandHref(
        match
      );

    if (href) {
      hrefs.add(href);
    }
  }

  return hrefs;
}

async function enrichBAGFeaturesWithPand(
  features,
  requiredHrefs
) {
  const hrefs =
    Array.from(
      requiredHrefs
    );

  const concurrency = 15;

  for (
    let i = 0;
    i < hrefs.length;
    i += concurrency
  ) {
    const batch =
      hrefs.slice(
        i,
        i + concurrency
      );

    await Promise.all(
      batch.map(
        href =>
          queryBAGPand(
            href
          )
      )
    );
  }

  return features;
}

/* =========================================================
   BAG OBJECTEN
========================================================= */

function processBAGObjects(
  features,
  latitude,
  longitude,
  radius
) {
  const results = [];

  for (
    const feature of features
  ) {
    const type =
      getBAGType(
        feature
      );

    if (!type) {
      continue;
    }

    const geometry =
      feature.geometry;

    if (
      !geometry ||
      geometry.type !== "Point" ||
      !Array.isArray(
        geometry.coordinates
      )
    ) {
      continue;
    }

    const lon =
      Number(
        geometry.coordinates[0]
      );

    const lat =
      Number(
        geometry.coordinates[1]
      );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }

    const distance =
      distanceMeters(
        latitude,
        longitude,
        lat,
        lon
      );

    if (
      distance > radius
    ) {
      continue;
    }

    const originalProperties =
      feature.properties ||
      {};

    const p =
      normalizeBAGProperties(
        originalProperties
      );

    const street =
      getBAGStreet(p);

    const housenumber =
      getBAGHouseNumber(p);

    const postcode =
      firstDefined(
        p.postcode,
        p.postcode_woonplaats
      );

    const city =
      getBAGCity(p);

    const address = {
      street,
      housenumber,
      postcode,
      city,
    };

    const name =
      street &&
      housenumber
        ? `${street} ${housenumber}`
        : type;

    const pandHref =
      getBAGPandHref(
        feature
      );

    const pand =
      pandHref
        ? (
            bagPandCache.get(
              pandHref
            ) || null
          )
        : null;

    const bagDetails = {
      verblijfsobjectIdentificatie:
        getBAGVerblijfsobjectId(
          feature
        ),

      oppervlakte:
        p.oppervlakte ??
        null,

      bouwjaar:
        pand?.bouwjaar ??
        p.bouwjaar ??
        null,

      aantal_verblijfsobjecten:
        pand?.aantal_verblijfsobjecten ??
        null,

      aantalVerblijfsobjecten:
        pand?.aantalVerblijfsobjecten ??
        null,

      gebruiksdoel:
        pand?.gebruiksdoel ??
        p.gebruiksdoel ??
        null,

      status:
        pand?.status ??
        p.status ??
        null,

      pandIdentificatie:
        pand?.identificatie ??
        getBAGPandId(feature),

      pand,
    };

    results.push({
      id:
        `bag-${
          getBAGVerblijfsobjectId(
            feature
          ) ||
          `${lat}-${lon}`
        }`,

      name,

      type,

      latitude: lat,

      longitude: lon,

      distance:
        Math.round(
          distance
        ),

      priority:
        priorityForType(
          type
        ),

      address,

      source: "BAG",

      confidence: "medium",

      bag: p,

      pand,

      bagDetails,
    });
  }

  return results;
}

/* =========================================================
   LRK ADRES PARSER
========================================================= */

// 🟨 GEWIJZIGD:
// Ook de officiële LRK-woonplaats wordt meegenomen.
// Dit is nodig wanneer een postcode ontbreekt of als
// aanvullende controle.

function parseLRKAddress(
  record
) {
  const addressText =
    String(
      record?.address || ""
    ).trim();

  const result = {
    street: null,

    housenumber: null,

    postcode:
      record?.postcode ||
      null,

    city:
      record?.city ||
      null,
  };

  if (!addressText) {
    return result;
  }

  /*
   * Voorbeelden:
   *
   * Kerklaan 4
   * Oosterstraat 3A
   * Hoofdweg 12-14
   */

  const houseMatch =
    addressText.match(
      /^(.*?)[,\s]+(\d+[A-Za-z]?(?:[-/]\d+)?)$/
    );

  if (houseMatch) {
    result.street =
      houseMatch[1].trim();

    result.housenumber =
      houseMatch[2].trim();
  } else {
    result.street =
      addressText;
  }

  return result;
}

/* =========================================================
   LRK ADRESCONTROLE
========================================================= */

// 🟨 GEWIJZIGD:
//
// LRK/BAG-ID-match wordt nu gecontroleerd met de
// strenge lrkAddressesMatch().
//
// Een BAG-ID alleen is dus NIET voldoende.
//
// Ook wordt hier niet meer geprobeerd om straat +
// huisnummer en postcode + huisnummer afzonderlijk
// goed te keuren. Dat was de oorzaak van de fout.

function validateLRKBAGMatch(
  record,
  bagFeature
) {
  if (
    !record ||
    !bagFeature
  ) {
    return false;
  }

  const lrkAddress =
    parseLRKAddress(
      record
    );

  const p =
    bagFeature.properties ||
    {};

  const bagAddress = {
    street:
      getBAGStreet(p),

    housenumber:
      getBAGHouseNumber(p),

    postcode:
      firstDefined(
        p.postcode,
        p.postcode_woonplaats
      ),

    city:
      getBAGCity(p),
  };

  const match =
    lrkAddressesMatch(
      lrkAddress,
      bagAddress
    );

  if (match) {
    return true;
  }

  console.warn(
    "LRK/BAG MATCH AFGEWEZEN:",
    record.name || "Onbekend",
    "| LRK:",
    record.address || "-",
    record.postcode || "-",
    record.city || "-",
    "| BAG:",
    bagAddress.street || "-",
    bagAddress.housenumber || "-",
    bagAddress.postcode || "-",
    bagAddress.city || "-"
  );

  return false;
}

/* =========================================================
   LRK KINDEROPVANG
========================================================= */

// 🟨 GEWIJZIGD:
//
// Matchvolgorde:
//
// 1. Exact BAG-ID + strenge adrescontrole
// 2. Exact LRK-adres + strenge adrescontrole
// 3. Coördinaten binnen 30 meter
//
// Belangrijk:
//
// Een BAG-ID alleen is NIET voldoende.
//
// Een straat + huisnummer alleen is ook NIET voldoende
// voor LRK.
//
// Hierdoor kan een locatie uit een andere plaats niet
// meer via een gelijk straat/huisnummer worden gekoppeld.

function processLRKChildcare(
  records,
  bagFeatures,
  latitude,
  longitude,
  radius
) {
  if (
    !Array.isArray(records) ||
    !Array.isArray(bagFeatures)
  ) {
    return [];
  }

  const results = [];

  let matchedByBagId = 0;
  let matchedByAddress = 0;
  let matchedByDistance = 0;
  let rejectedBagIdAddress = 0;
  let noMatch = 0;
  let outsideRadius = 0;

  /* -------------------------------------------------------
     BAG-ID index
  ------------------------------------------------------- */

  const bagById = new Map();

  for (
    const feature of bagFeatures
  ) {
    const bagId =
  normalizeBAGId(
   getBAGVerblijfsobjectId(
  feature
)
  );

    if (!bagId) {
      continue;
    }

    /*
     * Alleen echte BAG-verblijfsobject-ID's
     * van 16 cijfers gebruiken.
     */

    if (
      !/^\d{16}$/.test(
        bagId
      )
    ) {
      continue;
    }

    bagById.set(
      bagId,
      feature
    );
  }

  console.log(
    `LRK/BAG index: ${bagById.size} geldige BAG-ID's beschikbaar`
  );

  const bagByAddress =
    new Map();

  for (
    const feature of bagFeatures
  ) {
    const p =
      feature.properties ||
      {};

    const key =
      [
        normalizePostcode(
          firstDefined(
            p.postcode,
            p.postcode_woonplaats
          )
        ),
        normalizeStreet(
          getBAGStreet(p)
        ),
        normalizeHouseNumber(
          getBAGHouseNumber(p)
        ),
      ].join("|");

    if (
      key !== "||" &&
      !bagByAddress.has(key)
    ) {
      bagByAddress.set(
        key,
        feature
      );
    }
  }

  console.log(
    `LRK/BAG adres-index: ${bagByAddress.size} unieke adressen beschikbaar`
  );

  /* -------------------------------------------------------
     LRK-records verwerken
  ------------------------------------------------------- */

  for (
    const record of records
  ) {
    if (!record) {
      continue;
    }

    const lrkBagId =
      normalizeBAGId(
        record.bagId
      );

    let bagFeature = null;

    /* -----------------------------------------------------
       MATCH 1: EXACT BAG-ID
    ----------------------------------------------------- */

    if (
      lrkBagId &&
      /^\d{16}$/.test(
        lrkBagId
      )
    ) {
      const candidate =
        bagById.get(
          lrkBagId
        );

      if (candidate) {
        /*
         * 🟨 GEWIJZIGD:
         *
         * Een exact BAG-ID is alleen geldig als
         * het adres óók overeenkomt met LRK.
         */

        if (
          validateLRKBAGMatch(
            record,
            candidate
          )
        ) {
          bagFeature =
            candidate;

          matchedByBagId++;
        } else {
          rejectedBagIdAddress++;

          /*
           * ID bestaat wel, maar het BAG-adres
           * komt niet overeen.
           *
           * Dus deze feature wordt niet gebruikt.
           */
        }
      }
    }

    /* -----------------------------------------------------
       MATCH 2: ADRES
    ----------------------------------------------------- */

    if (!bagFeature) {
      const lrkAddress =
        parseLRKAddress(
          record
        );

      const addressKey =
        [
          normalizePostcode(
            lrkAddress.postcode
          ),
          normalizeStreet(
            lrkAddress.street
          ),
          normalizeHouseNumber(
            lrkAddress.housenumber
          ),
        ].join("|");

      const addressMatch =
        bagByAddress.get(
          addressKey
        );

      if (addressMatch) {
        /*
         * Extra strenge controle blijft behouden.
         * De index versnelt alleen het zoeken.
         */
        const p =
          addressMatch.properties ||
          {};

        const bagAddress = {
          street:
            getBAGStreet(p),

          housenumber:
            getBAGHouseNumber(p),

          postcode:
            firstDefined(
              p.postcode,
              p.postcode_woonplaats
            ),

          city:
            getBAGCity(p),
        };

        if (
          lrkAddressesMatch(
            lrkAddress,
            bagAddress
          )
        ) {
          bagFeature =
            addressMatch;

          matchedByAddress++;
        }
      }
    }

    /* -----------------------------------------------------
       MATCH 3: COÖRDINATEN
    ----------------------------------------------------- */

   
    /* -----------------------------------------------------
       GEEN MATCH
    ----------------------------------------------------- */

    if (!bagFeature) {
      noMatch++;

      /*
       * 🟨 GEWIJZIGD:
       *
       * Algemene debug voor een aantal specifieke testrecords.
       */

      if (
        String(record.lrkId) ===
        "300248544"
      ) {
        console.warn(
          "LRK DEBUG: Nijntje heeft GEEN BAG-match."
        );

        console.warn(
          `LRK BAG-ID: ${lrkBagId}`
        );

        console.warn(
          `LRK adres: ${record.address || "-"}`
        );

        console.warn(
          `LRK postcode: ${record.postcode || "-"}`
        );

        console.warn(
          `LRK plaats: ${record.city || "-"}`
        );
      }

      if (
        String(record.lrkId) ===
        "869184465"
      ) {
        console.warn(
          "LRK DEBUG: Kastanjeboom heeft GEEN BAG-match."
        );

        console.warn(
          `LRK BAG-ID: ${lrkBagId || "-"}`
        );

        console.warn(
          `LRK adres: ${record.address || "-"}`
        );

        console.warn(
          `LRK postcode: ${record.postcode || "-"}`
        );

        console.warn(
          `LRK plaats: ${record.city || "-"}`
        );
      }

      continue;
    }

    /* -----------------------------------------------------
       BAG-COÖRDINATEN
    ----------------------------------------------------- */

    const geometry =
      bagFeature.geometry;

    if (
      !geometry ||
      geometry.type !== "Point" ||
      !Array.isArray(
        geometry.coordinates
      )
    ) {
      continue;
    }

    const lon =
      Number(
        geometry.coordinates[0]
      );

    const lat =
      Number(
        geometry.coordinates[1]
      );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }

    const distance =
      distanceMeters(
        latitude,
        longitude,
        lat,
        lon
      );

    if (
      distance > radius
    ) {
      outsideRadius++;

      continue;
    }

    /* -----------------------------------------------------
       BAG GEGEVENS
    ----------------------------------------------------- */

    const bagProperties =
      normalizeBAGProperties(
        bagFeature.properties ||
          {}
      );

    const street =
      getBAGStreet(
        bagProperties
      );

    const housenumber =
      getBAGHouseNumber(
        bagProperties
      );

    const postcode =
      firstDefined(
        bagProperties.postcode,
        record.postcode
      );

    const city =
      firstDefined(
        getBAGCity(
          bagProperties
        ),
        record.city
      );

    const parsedLRKAddress =
      parseLRKAddress(
        record
      );

    const address = {
      street:
        street ||
        parsedLRKAddress.street ||
        null,

      housenumber:
        housenumber ||
        parsedLRKAddress.housenumber ||
        null,

      postcode,

      city,
    };

    /* -----------------------------------------------------
       LRK OBJECT
    ----------------------------------------------------- */

    const type =
      "daycare";

    const pandHref =
      getBAGPandHref(
        bagFeature
      );

    const pand =
      pandHref
        ? (
            bagPandCache.get(
              pandHref
            ) || null
          )
        : null;

    const finalBagId =
      normalizeBAGId(
        getBAGVerblijfsobjectId(
          bagFeature
        )
      ) ||
      lrkBagId;

    const result = {
      id:
        record.id ||
        `lrk-${record.lrkId}`,

      name:
        record.name ||
        "Kinderopvang",

      type,

      latitude: lat,

      longitude: lon,

      distance:
        Math.round(
          distance
        ),

      priority:
        priorityForType(
          type
        ),

      address,

      source: "LRK",

      confidence: "high",

      lrkType:
        record.type ||
        null,

      childPlaces:
        record.childPlaces ??
        null,

      lrk: {
        lrkId:
          record.lrkId ||
          null,

        type:
          record.type ||
          null,

        childPlaces:
          record.childPlaces ??
          null,

        municipality:
          record.municipality ||
          null,

        website:
          record.website ||
          null,
      },

      bagId:
        finalBagId,

      bag: {
        ...bagProperties,

        identificatie:
          finalBagId,
      },

      pand,

      bagDetails: {
        verblijfsobjectIdentificatie:
          finalBagId,

        oppervlakte:
          bagProperties.oppervlakte ??
          null,

        bouwjaar:
          pand?.bouwjaar ??
          bagProperties.bouwjaar ??
          null,

        aantal_verblijfsobjecten:
          pand?.aantal_verblijfsobjecten ??
          null,

        aantalVerblijfsobjecten:
          pand?.aantalVerblijfsobjecten ??
          null,

        gebruiksdoel:
          pand?.gebruiksdoel ??
          bagProperties.gebruiksdoel ??
          null,

        status:
          pand?.status ??
          bagProperties.status ??
          null,

        pandIdentificatie:
          pand?.identificatie ??
          getBAGPandId(
            bagFeature
          ),

        pand,
      },
    };

    /* -----------------------------------------------------
       DEBUG NIJNTJE
    ----------------------------------------------------- */

    if (
      String(record.lrkId) ===
      "300248544"
    ) {
      console.log(
        "LRK DEBUG: Nijntje succesvol gekoppeld!"
      );

      console.log(
        `  BAG-ID: ${result.bagId}`
      );

      console.log(
        `  Coördinaten: ${lat}, ${lon}`
      );

      console.log(
        `  Afstand: ${Math.round(distance)}m`
      );
    }

    /* -----------------------------------------------------
       DEBUG KASTANJEBOOM
    ----------------------------------------------------- */

    if (
      String(record.lrkId) ===
      "869184465"
    ) {
      console.log(
        "LRK DEBUG: BSO Kastanjeboom verwerkt."
      );

      console.log(
        `  LRK adres: ${record.address || "-"}`
      );

      console.log(
        `  LRK postcode: ${record.postcode || "-"}`
      );

      console.log(
        `  LRK plaats: ${record.city || "-"}`
      );

      console.log(
        `  LRK BAG-ID: ${lrkBagId || "-"}`
      );

      console.log(
        `  BAG-ID resultaat: ${finalBagId || "-"}`
      );

      console.log(
        `  BAG adres: ${address.street || "-"} ${address.housenumber || ""}`
      );

      console.log(
        `  BAG postcode: ${address.postcode || "-"}`
      );

      console.log(
        `  BAG plaats: ${address.city || "-"}`
      );

      console.log(
        `  Afstand: ${Math.round(distance)}m`
      );
    }

    results.push(
      result
    );
  }

  /* -------------------------------------------------------
     LOGGING
  ------------------------------------------------------- */

  console.log(
    `LRK koppeling resultaat: ${results.length} objecten`
  );

  console.log(
    `  Match via BAG-ID + adrescontrole: ${matchedByBagId}`
  );

  console.log(
    `  BAG-ID match afgewezen wegens adres: ${rejectedBagIdAddress}`
  );

  console.log(
    `  Match via adres: ${matchedByAddress}`
  );

  console.log(
    `  Match via afstand: ${matchedByDistance}`
  );

  console.log(
    `  Geen BAG-match: ${noMatch}`
  );

  console.log(
    `  Buiten radius: ${outsideRadius}`
  );

  return results;
}

/* =========================================================
   OSM MET BAG VERRIJKEN
========================================================= */

function enrichOSMWithBAG(
  osmObjects,
  bagFeatures
) {
  if (
    !Array.isArray(
      osmObjects
    ) ||
    !Array.isArray(
      bagFeatures
    )
  ) {
    return;
  }

  for (
    const osm of osmObjects
  ) {
    const match =
      getBestBAGFeatureForOSM(
        osm,
        bagFeatures
      );

    if (!match) {
      console.log(
        `GEEN BAG-MATCH: ${
          osm.name || "Onbekend"
        }`
      );

      continue;
    }

    const originalProperties =
      match.properties ||
      {};

    const properties =
      normalizeBAGProperties(
        originalProperties
      );

    const bagId =
      getBAGVerblijfsobjectId(
        match
      );

    const pandHref =
      getBAGPandHref(
        match
      );

    const pand =
      pandHref
        ? (
            bagPandCache.get(
              pandHref
            ) || null
          )
        : null;

    osm.bag =
      properties;

    osm.bagId =
      bagId;

    osm.pand =
      pand;

    osm.pandHref =
      pandHref ||
      null;

    osm.bagDetails = {
      verblijfsobjectIdentificatie:
        bagId,

      oppervlakte:
        properties.oppervlakte ??
        null,

      bouwjaar:
        pand?.bouwjaar ??
        properties.bouwjaar ??
        null,

      aantal_verblijfsobjecten:
        pand?.aantal_verblijfsobjecten ??
        null,

      aantalVerblijfsobjecten:
        pand?.aantalVerblijfsobjecten ??
        null,

      gebruiksdoel:
        pand?.gebruiksdoel ??
        properties.gebruiksdoel ??
        null,

      status:
        pand?.status ??
        properties.status ??
        null,

      pandIdentificatie:
        pand?.identificatie ??
        getBAGPandId(match),

      pand,
    };

    if (
      !osm.address ||
      (
        !osm.address.street &&
        !osm.address.housenumber &&
        !osm.address.postcode &&
        !osm.address.city
      )
    ) {
      osm.address = {
        street:
          getBAGStreet(
            properties
          ),

        housenumber:
          getBAGHouseNumber(
            properties
          ),

        postcode:
          firstDefined(
            properties.postcode
          ),

        city:
          getBAGCity(
            properties
          ),
      };
    }

    console.log(
      `BAG gekoppeld aan OSM: ${
        osm.name || "Onbekend"
      } | BAG ${
        bagId || "-"
      } | pand ${
        pand?.identificatie ||
        "-"
      } | oppervlakte ${
        properties.oppervlakte ??
        "-"
      }`
    );
  }
}

/* =========================================================
   DEDUPLICATIE
========================================================= */

function deduplicateObjects(
  objects
) {
  const result = [];

  const sourcePriority = {
    DUO: 1,
    LRK: 2,
    OSM: 3,
    BAG: 4,
  };

  const sorted =
    [...objects].sort(
      (a, b) => {
        const sourceA =
          sourcePriority[
            a.source
          ] || 99;

        const sourceB =
          sourcePriority[
            b.source
          ] || 99;

        if (
          sourceA !==
          sourceB
        ) {
          return (
            sourceA -
            sourceB
          );
        }

        return (
          (a.distance || 0) -
          (b.distance || 0)
        );
      }
    );

  for (
    const object of sorted
  ) {
    let duplicate =
      false;

    const objectBagId =
      normalizeBAGId(
        object.bagId ||
        (
          object.bag &&
          (
            object.bag.identificatie ||
            object.bag.id
          )
        )
      );

    const objectPandId =
      object.pand &&
      normalizeBAGId(
        object.pand.identificatie ||
        object.pand.id
      );

    for (
      const existing of result
    ) {
      const existingBagId =
        normalizeBAGId(
          existing.bagId ||
          (
            existing.bag &&
            (
              existing.bag.identificatie ||
              existing.bag.id
            )
          )
        );

      const existingPandId =
        existing.pand &&
        normalizeBAGId(
          existing.pand.identificatie ||
          existing.pand.id
        );

      if (
        objectBagId &&
        existingBagId &&
        objectBagId ===
          existingBagId
      ) {
        duplicate = true;
        break;
      }

      if (
        objectPandId &&
        existingPandId &&
        objectPandId ===
          existingPandId
      ) {
        duplicate = true;
        break;
      }

      if (
        object.type ===
          existing.type &&
        addressesMatch(
          object.address,
          existing.address
        )
      ) {
        duplicate = true;
        break;
      }

      if (
        object.type ===
          "school" &&
        existing.type ===
          "school" &&
        (
          object.source ===
            "DUO" ||
          existing.source ===
            "DUO"
        )
      ) {
        const d =
          distanceMeters(
            object.latitude,
            object.longitude,
            existing.latitude,
            existing.longitude
          );

        if (
          d <= 100
        ) {
          duplicate = true;
          break;
        }

        if (
          namesMatch(
            object.name,
            existing.name
          ) &&
          d <= 250
        ) {
          duplicate = true;
          break;
        }
      }

      if (
        object.type ===
          existing.type &&
        namesMatch(
          object.name,
          existing.name
        )
      ) {
        const d =
          distanceMeters(
            object.latitude,
            object.longitude,
            existing.latitude,
            existing.longitude
          );

        if (
          d <= 50
        ) {
          duplicate = true;
          break;
        }
      }
    }

    if (!duplicate) {
      result.push(
        object
      );
    }
  }

  return result;
}

/* =========================================================
   API
========================================================= */

app.get(
  "/api/vulnerable-objects",
  async (
    req,
    res
  ) => {
    try {
      const latitude =
        Number(
          req.query.latitude
        );

      const longitude =
        Number(
          req.query.longitude
        );

      const radius =
        Number(
          req.query.radius
        ) || 500;

      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "latitude en longitude zijn verplicht.",
          });
      }

      console.log(
        `Omgevingsscan: ${latitude}, ${longitude}, radius ${radius}m`
      );

      /* -----------------------------------------------------
         1. DUO
      ----------------------------------------------------- */

      const duoObjects =
        processDUOSchools(
          duoSchools,
          latitude,
          longitude,
          radius
        );

      console.log(
        `DUO-scholen binnen radius: ${duoObjects.length}`
      );

      /* -----------------------------------------------------
         2. OVERPASS
      ----------------------------------------------------- */

      const osmElements =
        await queryOverpass(
          latitude,
          longitude,
          radius
        );

      const osmObjects =
        processOSMObjects(
          osmElements,
          latitude,
          longitude,
          radius
        );

      console.log(
        `OSM-objecten binnen radius: ${osmObjects.length}`
      );

      /* -----------------------------------------------------
         3. BAG
      ----------------------------------------------------- */
let bagFeatures =
  await queryBAG(
    latitude,
    longitude,
    radius
  );

const bagVoorFilter =
  bagFeatures.length;

bagFeatures =
  bagFeatures.filter(
    feature => {
      const status =
        normalizeText(
          feature?.properties?.status
        );

      return (
        status !==
        "verblijfsobject ingetrokken"
      );
    }
  );

console.log(
  `BAG-verblijfsobjecten gevonden: ${bagVoorFilter}`
);

console.log(
  `BAG-verblijfsobjecten actief: ${bagFeatures.length}`
);

      const requiredPandHrefs =
        collectRequiredBAGPandHrefs(
          bagFeatures,
          osmObjects
        );

      console.log(
        `BAG-panden te verrijken: ${requiredPandHrefs.size}`
      );

      await enrichBAGFeaturesWithPand(
        bagFeatures,
        requiredPandHrefs
      );

      const bagObjects =
        processBAGObjects(
          bagFeatures,
          latitude,
          longitude,
          radius
        );

      console.log(
        `BAG-objecten binnen radius: ${bagObjects.length}`
      );

      /* -----------------------------------------------------
         4. BAG AAN OSM KOPPELEN
      ----------------------------------------------------- */

      enrichOSMWithBAG(
        osmObjects,
        bagFeatures
      );

      /* -----------------------------------------------------
         5. LRK
      ----------------------------------------------------- */

      const lrkObjects =
        processLRKChildcare(
          lrkChildcare,
          bagFeatures,
          latitude,
          longitude,
          radius
        );

      console.log(
        `LRK-kinderopvang binnen radius: ${lrkObjects.length}`
      );

      /* -----------------------------------------------------
         6. COMBINEREN
      ----------------------------------------------------- */

      const combined = [
        ...duoObjects,
        ...lrkObjects,
        ...osmObjects,
        ...bagObjects,
      ];

      /* -----------------------------------------------------
         7. DEDUPLICEREN
      ----------------------------------------------------- */

      const objects =
        deduplicateObjects(
          combined
        );

      /* -----------------------------------------------------
         8. SORTEREN
      ----------------------------------------------------- */

      objects.sort(
        (a, b) => {
          if (
            a.priority !==
            b.priority
          ) {
            return (
              a.priority - b.priority
            );
          }

          return (
            (a.distance || 0) -
            (b.distance || 0)
          );
        }
      );

      console.log(
        `Eindresultaat: ${objects.length} objecten`
      );

      res.json(
        objects
      );
    } catch (error) {
      console.error(
        "Fout vulnerable-objects:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Fout bij ophalen kwetsbare objecten.",

          message:
            error.message,
        });
    }
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (
    req,
    res
  ) => {
    res.json({
      status: "ok",

      service:
        "omgevingsscan-backend",

      port:
        PORT,

      duoSchoolsLoaded:
        duoSchools.length,

      lrkChildcareLoaded:
        lrkChildcare.length,
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `Omgevingsscan backend draait op poort ${PORT}`
    );

    console.log(
      `DUO-scholen beschikbaar: ${duoSchools.length}`
    );

    console.log(
      `LRK-kinderopvang beschikbaar: ${lrkChildcare.length}`
    );
  }
);