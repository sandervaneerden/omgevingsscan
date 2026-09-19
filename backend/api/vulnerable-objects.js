const fs = require("fs");
const path = require("path");

const OVERPASS_SERVERS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const DEFAULT_RADIUS = 500;
const MAX_RADIUS = 5000;

/*
 * DUO-scholen
 */
let duoSchools = [];

try {
  const duoPath = path.join(
    __dirname,
    "..",
    "data",
    "duo-schools.json"
  );

  if (fs.existsSync(duoPath)) {
    duoSchools = JSON.parse(
      fs.readFileSync(duoPath, "utf8")
    );

    if (!Array.isArray(duoSchools)) {
      duoSchools = [];
    }

    console.log(
      `DUO scholen geladen: ${duoSchools.length}`
    );
  } else {
    console.warn(
      `DUO bestand niet gevonden: ${duoPath}`
    );
  }
} catch (error) {
  console.error(
    "Fout bij laden DUO-scholen:",
    error
  );

  duoSchools = [];
}

/* ---------------------------------------------------------
 * Helpers
 * --------------------------------------------------------- */

function getCoordinates(element) {
  if (!element) return null;

  if (
    typeof element.lat === "number" &&
    typeof element.lon === "number"
  ) {
    return {
      latitude: element.lat,
      longitude: element.lon,
    };
  }

  if (
    element.center &&
    typeof element.center.lat === "number" &&
    typeof element.center.lon === "number"
  ) {
    return {
      latitude: element.center.lat,
      longitude: element.center.lon,
    };
  }

  return null;
}

function getName(tags = {}) {
  return (
    tags.name ||
    tags["name:nl"] ||
    tags.official_name ||
    tags["official_name:nl"] ||
    tags.operator ||
    null
  );
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeStreet(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /straat|str\.|weg|laan|plein|singel|dreef|kade|pad|laan$/g,
      ""
    )
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function normalizeHouseNumber(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function distanceInMeters(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

/* ---------------------------------------------------------
 * Zorgclassificatie
 * --------------------------------------------------------- */

function determineCareType(tags = {}) {
  const text = [
    tags.name,
    tags["name:nl"],
    tags.official_name,
    tags["official_name:nl"],
    tags.alt_name,
    tags.description,
    tags.operator,
    tags["operator:type"],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const socialFacility = String(
    tags.social_facility || ""
  ).toLowerCase();

  const healthcare = String(
    tags.healthcare || ""
  ).toLowerCase();

  const amenity = String(
    tags.amenity || ""
  ).toLowerCase();

  /* ---------------------------------------------
   * Verpleging / ouderenzorg
   * --------------------------------------------- */

  if (
    socialFacility === "nursing_home" ||
    socialFacility === "care_home" ||
    socialFacility === "assisted_living" ||
    socialFacility === "retirement_home" ||
    socialFacility === "group_home"
  ) {
    return "nursing_home";
  }

  if (
    /verpleeghuis|verzorgingshuis|woonzorgcentrum|ouderenzorg|zorgcentrum|verzorgingstehuis/.test(
      text
    )
  ) {
    return "nursing_home";
  }

  /* ---------------------------------------------
   * Gehandicaptenzorg
   * --------------------------------------------- */

  if (
    /gehandicaptenzorg|gehandicapten|woonbegeleiding|zorg voor gehandicapten/.test(
      text
    )
  ) {
    return "disability_care";
  }

  if (/jonx\b|dignis\b/.test(text)) {
    return "disability_care";
  }

  if (
    socialFacility === "group_home" &&
    /zorg|begeleiding|gehandicap/.test(text)
  ) {
    return "disability_care";
  }

  /* ---------------------------------------------
   * Hospice / palliatieve zorg
   * --------------------------------------------- */

  if (
    /hospice|palliatieve zorg|palliatief/.test(
      text
    )
  ) {
    return "hospice";
  }

  /* ---------------------------------------------
   * GGZ / psychiatrie
   * --------------------------------------------- */

  if (
    /ggz|geestelijke gezondheidszorg|psychiatr|psycho.?geriatr/.test(
      text
    )
  ) {
    return "mental_health";
  }

  /* ---------------------------------------------
   * Revalidatie
   * --------------------------------------------- */

  if (
    /revalidatie|rehabilitatie/.test(text)
  ) {
    return "rehabilitation";
  }

  /* ---------------------------------------------
   * Ziekenhuis
   * --------------------------------------------- */

  if (
    healthcare === "hospital" ||
    amenity === "hospital" ||
    /\bziekenhuis\b|\bhospital\b/.test(text)
  ) {
    return "hospital";
  }

  /* ---------------------------------------------
   * Kliniek
   * --------------------------------------------- */

  if (
    healthcare === "clinic" ||
    amenity === "clinic"
  ) {
    if (
      /tand|dent|fysio|fysiother|prothese|schoonheid|cosmet/.test(
        text
      )
    ) {
      return null;
    }

    return "clinic";
  }

  /* ---------------------------------------------
   * Huisarts
   * --------------------------------------------- */

  if (
    healthcare === "doctor" ||
    healthcare === "general_practitioner" ||
    amenity === "doctors" ||
    /\b(huisarts|huisartsenpraktijk)\b/.test(
      text
    )
  ) {
    return "doctor";
  }

  return null;
}

/* ---------------------------------------------------------
 * 🟨 Kinderopvang
 * --------------------------------------------------------- */

function determineChildcareType(tags = {}) {
  const text = [
    tags.name,
    tags["name:nl"],
    tags.official_name,
    tags["official_name:nl"],
    tags.alt_name,
    tags.description,
    tags.operator,
    tags["operator:type"],
    tags["childcare:type"],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const amenity = String(
    tags.amenity || ""
  ).toLowerCase();

  const childcare = String(
    tags.childcare || ""
  ).toLowerCase();

  const childcareType = String(
    tags["childcare:type"] || ""
  ).toLowerCase();

  /*
   * Officiële OSM-tags
   */

  if (
    amenity === "kindergarten" ||
    amenity === "childcare"
  ) {
    return "kindergarten";
  }

  if (childcare) {
    return "kindergarten";
  }

  if (
    childcareType === "daycare" ||
    childcareType === "preschool" ||
    childcareType === "after_school" ||
    childcareType === "kindergarten"
  ) {
    return "kindergarten";
  }

  /*
   * Nederlandse benamingen
   */

  if (
    /\bkinderdagverblijf\b/.test(text) ||
    /\bkinderdagopvang\b/.test(text) ||
    /\bkinderopvang\b/.test(text) ||
    /\bpeuterspeelzaal\b/.test(text) ||
    /\bpeuteropvang\b/.test(text) ||
    /\bbuitenschoolse opvang\b/.test(text) ||
    /\bvoor[- ]?en naschoolse opvang\b/.test(text) ||
    /\bcr[eè]che\b/.test(text) ||
    /\bdaycare\b/.test(text) ||
    /\bchildcare\b/.test(text)
  ) {
    return "kindergarten";
  }

  /*
   * BSO wordt vaak alleen als BSO geregistreerd.
   */

  if (/\bbso\b/.test(text)) {
    return "kindergarten";
  }

  return null;
}

/* ---------------------------------------------------------
 * OSM type bepalen
 * --------------------------------------------------------- */

function determineType(tags = {}) {
  /*
   * 🟨 Kinderopvang wordt als eerste gecontroleerd.
   */

  const childcareType =
    determineChildcareType(tags);

  if (childcareType) {
    return childcareType;
  }

  const careType =
    determineCareType(tags);

  if (careType) {
    return careType;
  }

  const amenity = String(
    tags.amenity || ""
  ).toLowerCase();

  const building = String(
    tags.building || ""
  ).toLowerCase();

  const landuse = String(
    tags.landuse || ""
  ).toLowerCase();

  const shop = String(
    tags.shop || ""
  ).toLowerCase();

  /* Onderwijs */

  if (
    amenity === "school" ||
    amenity === "college" ||
    amenity === "university" ||
    tags.education ||
    building === "school" ||
    landuse === "education"
  ) {
    return "school";
  }

  /* Kinderopvang */

  if (
    amenity === "kindergarten" ||
    amenity === "childcare" ||
    tags.childcare
  ) {
    return "kindergarten";
  }

  /* Religie */

  if (
    amenity === "place_of_worship" ||
    tags.religion
  ) {
    return "church";
  }

  /* Maatschappelijk */

  if (
    amenity === "community_centre" ||
    amenity === "social_centre"
  ) {
    return "community";
  }

  /* Winkels */

  if (shop === "supermarket") {
    return "supermarket";
  }

  if (
    shop === "mall" ||
    tags.mall === "yes"
  ) {
    return "shopping_centre";
  }

  if (amenity === "marketplace") {
    return "marketplace";
  }

  return null;
}

/* ---------------------------------------------------------
 * DUO
 * --------------------------------------------------------- */

function getDuoSchoolType(school) {
  const type = String(
    school?.type || ""
  ).toLowerCase();

  if (
    type.includes("kindergarten") ||
    (type.includes("special") &&
      type.includes("early"))
  ) {
    return "kindergarten";
  }

  return "school";
}

function getDuoSchoolAddress(school) {
  return {
    street: school.street || null,
    housenumber:
      school.houseNumber || null,
    postcode: school.postcode || null,
    city: school.city || null,
  };
}

function getDuoSchools(
  latitude,
  longitude,
  radius
) {
  const result = [];

  if (
    !Array.isArray(duoSchools) ||
    duoSchools.length === 0
  ) {
    return result;
  }

  for (const school of duoSchools) {
    const lat = Number(
      school.latitude
    );

    const lon = Number(
      school.longitude
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }

    const distance =
      distanceInMeters(
        latitude,
        longitude,
        lat,
        lon
      );

    if (distance > radius) {
      continue;
    }

    const name =
      school.name || "School";

    result.push({
      id:
        school.duo?.vestigingCode ||
        school.duo?.instellingCode ||
        `duo-${normalizeName(
          name
        )}-${lat}-${lon}`,

      name,

      type:
        getDuoSchoolType(school),

      latitude: lat,

      longitude: lon,

      distance:
        Math.round(distance),

      priority: 5,

      address:
        getDuoSchoolAddress(school),

      source: "DUO",

      confidence:
        school.confidence ||
        "high",

      duo:
        school.duo || null,

      pdok:
        school.pdok || null,
    });
  }

  return result;
}

/* ---------------------------------------------------------
 * Overpass query
 * --------------------------------------------------------- */

function buildQuery(
  latitude,
  longitude,
  radius
) {
  return `
[out:json][timeout:30];

(
  /* Zorginstellingen */

  nwr(around:${radius},${latitude},${longitude})["amenity"="hospital"];
  nwr(around:${radius},${latitude},${longitude})["healthcare"="hospital"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="clinic"];
  nwr(around:${radius},${latitude},${longitude})["healthcare"="clinic"];
  nwr(around:${radius},${latitude},${longitude})["healthcare"="doctor"];
  nwr(around:${radius},${latitude},${longitude})["healthcare"="general_practitioner"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="doctors"];
  nwr(around:${radius},${latitude},${longitude})["social_facility"];
  nwr(around:${radius},${latitude},${longitude})["social_facility:for"];

  /* 🟨 Kinderopvang */

  nwr(around:${radius},${latitude},${longitude})["amenity"="kindergarten"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="childcare"];
  nwr(around:${radius},${latitude},${longitude})["childcare"];
  nwr(around:${radius},${latitude},${longitude})["childcare:type"];

  nwr(around:${radius},${latitude},${longitude})["name"~"kinderdagverblijf|kinderdagopvang|kinderopvang|peuterspeelzaal|peuteropvang|buitenschoolse opvang|BSO|creche|crèche",i];

  nwr(around:${radius},${latitude},${longitude})["description"~"kinderdagverblijf|kinderdagopvang|kinderopvang|peuterspeelzaal|peuteropvang|buitenschoolse opvang|BSO|creche|crèche",i];

  /* Onderwijs - DUO is leidend, OSM als aanvulling */

  nwr(around:${radius},${latitude},${longitude})["amenity"="school"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="college"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="university"];
  nwr(around:${radius},${latitude},${longitude})["building"="school"];
  nwr(around:${radius},${latitude},${longitude})["landuse"="education"];
  nwr(around:${radius},${latitude},${longitude})["education"];

  /* Religie */

  nwr(around:${radius},${latitude},${longitude})["amenity"="place_of_worship"];

  /* Maatschappelijk */

  nwr(around:${radius},${latitude},${longitude})["amenity"="community_centre"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="social_centre"];

  /* Winkels */

  nwr(around:${radius},${latitude},${longitude})["shop"="supermarket"];
  nwr(around:${radius},${latitude},${longitude})["shop"="mall"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="marketplace"];
);

out center tags;
`;
}

/* ---------------------------------------------------------
 * Overpass ophalen
 * --------------------------------------------------------- */

async function fetchFromOverpass(query) {
  let lastError = null;

  for (const server of OVERPASS_SERVERS) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(() => {
        controller.abort();
      }, 30000);

    try {
      console.log(
        `Overpass proberen: ${server}`
      );

      const response =
        await fetch(server, {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded; charset=UTF-8",
          },

          body:
            `data=${encodeURIComponent(
              query
            )}`,

          signal:
            controller.signal,
        });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} bij ${server}`
        );
      }

      const data =
        await response.json();

      if (
        !data ||
        !Array.isArray(
          data.elements
        )
      ) {
        throw new Error(
          `Ongeldige Overpass response van ${server}`
        );
      }

      console.log(
        `Overpass succesvol: ${server}, ${data.elements.length} elementen`
      );

      return data.elements;
    } catch (error) {
      clearTimeout(timeout);

      lastError = error;

      console.warn(
        `Overpass mislukt (${server}):`,
        error.message
      );
    }
  }

  console.error(
    "Alle Overpass servers mislukt:",
    lastError?.message ||
      "onbekende fout"
  );

  return [];
}

/* ---------------------------------------------------------
 * OSM verwerken
 * --------------------------------------------------------- */

function processOSMObjects(
  elements,
  latitude,
  longitude
) {
  const results = [];

  for (const element of elements) {
    const tags =
      element.tags || {};

    const type =
      determineType(tags);

    if (!type) {
      continue;
    }

    const coordinates =
      getCoordinates(element);

    if (!coordinates) {
      continue;
    }

    const distance =
      distanceInMeters(
        latitude,
        longitude,
        coordinates.latitude,
        coordinates.longitude
      );

    const name =
      getName(tags);

    if (
      !name &&
      (
        type === "supermarket" ||
        type === "shopping_centre" ||
        type === "marketplace" ||
        type === "community"
      )
    ) {
      continue;
    }

    const address = {
      street:
        tags["addr:street"] ||
        tags["addr:place"] ||
        null,

      housenumber:
        tags["addr:housenumber"] ||
        null,

      postcode:
        tags["addr:postcode"] ||
        null,

      city:
        tags["addr:city"] ||
        tags["addr:town"] ||
        tags["addr:village"] ||
        null,
    };

    results.push({
      id:
        `osm-${element.type}-${element.id}`,

      name:
        name || type,

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
        type === "hospital" ||
        type === "nursing_home" ||
        type === "disability_care" ||
        type === "hospice" ||
        type === "mental_health" ||
        type === "rehabilitation"
          ? "high"
          : "medium",

      tags,
    });
  }

  return results;
}

/* ---------------------------------------------------------
 * Prioriteit
 * --------------------------------------------------------- */

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

    case "clinic":
      return 3;

    case "doctor":
      return 4;

    case "school":
      return 5;

    case "kindergarten":
      return 6;

    case "church":
      return 7;

    case "community":
      return 8;

    case "supermarket":
      return 9;

    case "shopping_centre":
      return 10;

    case "marketplace":
      return 11;

    default:
      return 99;
  }
}

/* ---------------------------------------------------------
 * Deduplicatie
 * --------------------------------------------------------- */

function sameAddress(a, b) {
  if (!a || !b) {
    return false;
  }

  const streetA =
    normalizeStreet(a.street);

  const streetB =
    normalizeStreet(b.street);

  const houseA =
    normalizeHouseNumber(
      a.housenumber
    );

  const houseB =
    normalizeHouseNumber(
      b.housenumber
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

  return false;
}

function namesSimilar(a, b) {
  const nameA =
    normalizeName(a);

  const nameB =
    normalizeName(b);

  if (!nameA || !nameB) {
    return false;
  }

  if (nameA === nameB) {
    return true;
  }

  if (
    nameA.length >= 8 &&
    nameB.length >= 8 &&
    (
      nameA.includes(nameB) ||
      nameB.includes(nameA)
    )
  ) {
    return true;
  }

  return false;
}

function shouldDeduplicate(a, b) {
  if (
    a.type === "school" &&
    b.type === "school"
  ) {
    const distance =
      distanceInMeters(
        a.latitude,
        a.longitude,
        b.latitude,
        b.longitude
      );

    if (distance <= 100) {
      return true;
    }

    if (
      namesSimilar(
        a.name,
        b.name
      ) &&
      sameAddress(
        a.address,
        b.address
      )
    ) {
      return true;
    }
  }

  if (a.type === b.type) {
    const distance =
      distanceInMeters(
        a.latitude,
        a.longitude,
        b.latitude,
        b.longitude
      );

    if (distance <= 30) {
      if (
        namesSimilar(
          a.name,
          b.name
        ) ||
        sameAddress(
          a.address,
          b.address
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function deduplicateObjects(objects) {
  const result = [];

  const sorted =
    [...objects].sort(
      (a, b) => {
        if (
          a.source === "DUO" &&
          b.source !== "DUO"
        ) {
          return -1;
        }

        if (
          a.source !== "DUO" &&
          b.source === "DUO"
        ) {
          return 1;
        }

        return (
          (a.priority || 99) -
          (b.priority || 99)
        );
      }
    );

  for (const object of sorted) {
    let duplicate = false;

    for (const existing of result) {
      if (
        shouldDeduplicate(
          object,
          existing
        )
      ) {
        duplicate = true;
        break;
      }
    }

    if (!duplicate) {
      result.push(object);
    }
  }

  return result;
}

/* ---------------------------------------------------------
 * CORS
 * --------------------------------------------------------- */

function setCors(res) {
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
}

/* ---------------------------------------------------------
 * Vercel handler
 * --------------------------------------------------------- */

module.exports = async function handler(
  req,
  res
) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      error:
        "Alleen GET is toegestaan",
    });
  }

  try {
    const latitude =
      Number(req.query.latitude);

    const longitude =
      Number(req.query.longitude);

    let radius =
      Number(
        req.query.radius ||
          DEFAULT_RADIUS
      );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return res.status(400).json({
        error:
          "latitude en longitude zijn verplicht en moeten numeriek zijn",
      });
    }

    if (!Number.isFinite(radius)) {
      radius =
        DEFAULT_RADIUS;
    }

    radius = Math.max(
      50,
      Math.min(
        radius,
        MAX_RADIUS
      )
    );

    console.log(
      `Omgevingsscan objecten: ${latitude}, ${longitude}, radius ${radius}m`
    );

    /* ---------------------------------------------
     * 1. DUO
     * --------------------------------------------- */

    const duoObjects =
      getDuoSchools(
        latitude,
        longitude,
        radius
      );

    console.log(
      `DUO scholen binnen ${radius}m: ${duoObjects.length}`
    );

    /* ---------------------------------------------
     * 2. OSM / Overpass
     * --------------------------------------------- */

    const query =
      buildQuery(
        latitude,
        longitude,
        radius
      );

    const elements =
      await fetchFromOverpass(
        query
      );

    const osmObjects =
      processOSMObjects(
        elements,
        latitude,
        longitude
      );

    console.log(
      `OSM relevante objecten: ${osmObjects.length}`
    );

    /* ---------------------------------------------
     * 3. Combineren
     * --------------------------------------------- */

    const combined = [
      ...duoObjects,
      ...osmObjects,
    ];

    /* ---------------------------------------------
     * 4. Dedupliceren
     * --------------------------------------------- */

    const objects =
      deduplicateObjects(
        combined
      );

    /* ---------------------------------------------
     * 5. Sorteren
     * --------------------------------------------- */

    objects.sort(
      (a, b) => {
        const priorityDifference =
          (a.priority || 99) -
          (b.priority || 99);

        if (
          priorityDifference !== 0
        ) {
          return priorityDifference;
        }

        return (
          (a.distance || 0) -
          (b.distance || 0)
        );
      }
    );

    /* ---------------------------------------------
     * 6. Statistieken
     * --------------------------------------------- */

    const counts = {};

    for (const object of objects) {
      counts[object.type] =
        (counts[object.type] || 0) +
        1;
    }

    console.log(
      "Eindresultaat:",
      objects.length,
      counts
    );

    return res.status(200).json({
      objects,

      meta: {
        latitude,

        longitude,

        radius,

        total:
          objects.length,

        sources: {
          DUO:
            duoObjects.length,

          OSM:
            osmObjects.length,
        },

        counts,
      },
    });
  } catch (error) {
    console.error(
      "Fout vulnerable-objects:",
      error
    );

    return res.status(500).json({
      error:
        "Kon kwetsbare objecten niet ophalen",

      details:
        error.message,
    });
  }
};