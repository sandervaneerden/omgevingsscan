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

// 🟨 GEWIJZIGD: LRK-bestand toegevoegd
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

// 🟨 GEWIJZIGD: LRK kinderopvang laden

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

/*
 * BAG-identificaties kunnen als:
 *
 * 1895100000006952
 *
 * of bijvoorbeeld als URI worden aangeleverd.
 *
 * Daarom vergelijken we altijd de laatste
 * betekenisvolle ID-component.
 */

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

async function queryOverpass(
  latitude,
  longitude,
  radius
) {
  const searchRadius =
    Math.max(
      Number(radius) || 500,
      700
    );

  const query = `
[out:json][timeout:25];
(
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="social_facility"];
  nwr(around:${searchRadius},${latitude},${longitude})["healthcare"];
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="hospital"];
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="clinic"];
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="doctors"];
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="school"];
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="kindergarten"];
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="childcare"];
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="place_of_worship"];
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="community_centre"];
  nwr(around:${searchRadius},${latitude},${longitude})["leisure"="sports_centre"];
  nwr(around:${searchRadius},${latitude},${longitude})["leisure"="stadium"];
  nwr(around:${searchRadius},${latitude},${longitude})["tourism"="hotel"];
  nwr(around:${searchRadius},${latitude},${longitude})["tourism"="hostel"];
  nwr(around:${searchRadius},${latitude},${longitude})["tourism"="guest_house"];
  nwr(around:${searchRadius},${latitude},${longitude})["shop"="supermarket"];
  nwr(around:${searchRadius},${latitude},${longitude})["amenity"="marketplace"];
);

out center tags;
`;

  for (
    let i = 0;
    i < OVERPASS_SERVERS.length;
    i++
  ) {
    const server =
      OVERPASS_SERVERS[i];

    const timeout =
      Math.max(
        OVERPASS_TIMEOUTS[i] ||
          15000,
        15000
      );

    try {
      console.log(
        `Overpass proberen: ${server}`
      );

      const elements =
        await queryOneOverpassServer(
          server,
          timeout,
          query
        );

      console.log(
        `Overpass POST resultaat: ${elements.length} objecten`
      );

      return elements;
    } catch (error) {
      console.warn(
        `Overpass POST fout ${server}: ${error.message}`
      );

      if (
        error.message.includes(
          "HTTP 406"
        ) ||
        error.message.includes(
          "HTTP 400"
        ) ||
        error.message.includes(
          "HTTP 415"
        )
      ) {
        try {
          console.log(
            `Overpass GET fallback: ${server}`
          );

          const elements =
            await queryOverpassGet(
              server,
              timeout,
              query
            );

          console.log(
            `Overpass GET resultaat: ${elements.length} objecten`
          );

          return elements;
        } catch (getError) {
          console.warn(
            `Overpass GET fout ${server}: ${getError.message}`
          );
        }
      }

      if (
        error.message.includes(
          "HTTP 429"
        ) ||
        error.message.includes(
          "HTTP 503"
        )
      ) {
        console.log(
          "Overpass tijdelijk overbelast/rate limited. 3 seconden wachten..."
        );

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              3000
            )
        );
      }
    }
  }

  console.warn(
    "Alle Overpass-servers mislukt."
  );

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
      "bijeenkomstfunctie"
    )
  ) {
    return "community";
  }

  if (
    gebruiksdoel.includes(
      "logiesfunctie"
    )
  ) {
    return "hotel";
  }

  if (
    gebruiksdoel.includes(
      "winkelfunctie"
    )
  ) {
    return "shop";
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
   LRK KINDEROPVANG
========================================================= */

// 🟨 GEWIJZIGD:
// LRK wordt gekoppeld aan de reeds opgehaalde BAG-features.
//
// Matchvolgorde:
// 1. Exact BAG-ID
// 2. Adres
// 3. Coördinaten binnen 30 meter
//
// Hierdoor zijn kleine verschillen in BAG-ID-formaat,
// adresvelden of data-opmaak geen reden om een LRK-locatie
// te verliezen.

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
  let noMatch = 0;
  let outsideRadius = 0;

  /*
   * -------------------------------------------------------
   * 1. BAG-index maken
   * -------------------------------------------------------
   */

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

    bagById.set(
      bagId,
      feature
    );
  }

  console.log(
    `LRK/BAG index: ${bagById.size} BAG-ID's beschikbaar`
  );

  /*
   * -------------------------------------------------------
   * 2. LRK-records verwerken
   * -------------------------------------------------------
   */

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

    /*
     * -----------------------------------------------------
     * MATCH 1: DIRECT BAG-ID
     * -----------------------------------------------------
     */

    if (lrkBagId) {
      bagFeature =
        bagById.get(
          lrkBagId
        );

      if (bagFeature) {
        matchedByBagId++;
      }
    }

    /*
     * -----------------------------------------------------
     * MATCH 2: ADRES
     * -----------------------------------------------------
     *
     * Dit is een fallback voor LRK-locaties waarbij het
     * BAG-ID niet exact overeenkomt.
     * -----------------------------------------------------
     */

    if (!bagFeature) {
      const lrkAddress = {
        street:
          record.address ||
          null,

        housenumber:
          null,

        postcode:
          record.postcode ||
          null,
      };

      /*
       * Het LRK-adres staat bijvoorbeeld als:
       *
       * "Kerklaan 4"
       *
       * Daarom proberen we straat + huisnummer uit het
       * adres te halen.
       */

      const addressText =
        String(
          record.address || ""
        ).trim();

      const houseMatch =
        addressText.match(
          /^(.*?)[,\s]+(\d+[A-Za-z]?(?:[-/]\d+)?)$/
        );

      if (houseMatch) {
        lrkAddress.street =
          houseMatch[1].trim();

        lrkAddress.housenumber =
          houseMatch[2].trim();
      }

      const addressMatch =
        bagFeatures.find(
          feature => {
            const p =
              feature.properties ||
              {};

            return addressesMatch(
              lrkAddress,
              {
                street:
                  getBAGStreet(p),

                housenumber:
                  getBAGHouseNumber(p),

                postcode:
                  firstDefined(
                    p.postcode,
                    p.postcode_woonplaats
                  ),
              }
            );
          }
        );

      if (addressMatch) {
        bagFeature =
          addressMatch;

        matchedByAddress++;
      }
    }

    /*
     * -----------------------------------------------------
     * MATCH 3: NABIJHEID
     * -----------------------------------------------------
     *
     * Alleen gebruiken als het LRK-record zelf
     * coördinaten bevat.
     */

    if (
      !bagFeature &&
      Number.isFinite(
        Number(record.latitude)
      ) &&
      Number.isFinite(
        Number(record.longitude)
      )
    ) {
      let best = null;
      let bestDistance =
        Infinity;

      for (
        const feature of bagFeatures
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

        const bagLon =
          Number(
            geometry.coordinates[0]
          );

        const bagLat =
          Number(
            geometry.coordinates[1]
          );

        if (
          !Number.isFinite(
            bagLat
          ) ||
          !Number.isFinite(
            bagLon
          )
        ) {
          continue;
        }

        const d =
          distanceMeters(
            Number(record.latitude),
            Number(record.longitude),
            bagLat,
            bagLon
          );

        if (
          d <= 30 &&
          d < bestDistance
        ) {
          best =
            feature;

          bestDistance =
            d;
        }
      }

      if (best) {
        bagFeature =
          best;

        matchedByDistance++;
      }
    }

    /*
     * -----------------------------------------------------
     * Geen BAG-match
     * -----------------------------------------------------
     */

    if (!bagFeature) {
      noMatch++;

      /*
       * Specifieke debug voor Nijntje.
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
      }

      continue;
    }

    /*
     * -----------------------------------------------------
     * BAG-coördinaten
     * -----------------------------------------------------
     */

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

    /*
     * -----------------------------------------------------
     * BAG gegevens
     * -----------------------------------------------------
     */

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

    const address = {
      street:
        street ||
        record.address ||
        null,

      housenumber,

      postcode,

      city,
    };

    /*
     * -----------------------------------------------------
     * LRK object
     * -----------------------------------------------------
     */

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

      // 🟨 GEWIJZIGD:
      // Origineel LRK-type behouden.
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

      // 🟨 GEWIJZIGD:
      // BAG-ID expliciet aan het LRK-object koppelen.
      bagId:
        normalizeBAGId(
          getBAGVerblijfsobjectId(
            bagFeature
          )
        ) ||
        lrkBagId,

      bag: {
        ...bagProperties,

        identificatie:
          normalizeBAGId(
            getBAGVerblijfsobjectId(
              bagFeature
            )
          ) ||
          lrkBagId,
      },

      pand,

      bagDetails: {
        verblijfsobjectIdentificatie:
          normalizeBAGId(
            getBAGVerblijfsobjectId(
              bagFeature
            )
          ) ||
          lrkBagId,

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

    /*
     * Specifieke controle voor Nijntje.
     */

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

    results.push(
      result
    );
  }

  // 🟨 GEWIJZIGD:
  // Uitgebreide logging om LRK/BAG-koppeling te controleren.

  console.log(
    `LRK koppeling resultaat: ${results.length} objecten`
  );

  console.log(
    `  Match via BAG-ID: ${matchedByBagId}`
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

  // 🟨 GEWIJZIGD:
  // LRK krijgt voorrang op OSM en BAG.
  // DUO blijft de primaire bron voor scholen.

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

      const bagFeatures =
        await queryBAG(
          latitude,
          longitude,
          radius
        );

      console.log(
        `BAG-verblijfsobjecten gevonden: ${bagFeatures.length}`
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

      // 🟨 GEWIJZIGD:
      // LRK koppelen aan de BAG-features die al voor
      // deze zoekopdracht zijn opgehaald.

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

      // 🟨 GEWIJZIGD:
      // LRK toegevoegd als zelfstandige bron.

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
              a.priority -
              b.priority
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

      // 🟨 GEWIJZIGD
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

    // 🟨 GEWIJZIGD
    console.log(
      `LRK-kinderopvang beschikbaar: ${lrkChildcare.length}`
    );
  }
);