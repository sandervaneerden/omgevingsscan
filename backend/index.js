const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const OVERPASS_SERVERS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const OVERPASS_TIMEOUTS = [
  5000,
  10000,
  10000,
];

// ============================================================
// GLOBAL CACHES
// ============================================================

const bagPandCache = new Map();
const bagPandPromiseCache = new Map();

// ============================================================
// HELPERS
// ============================================================

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
    .replace(/\bweg\b/g, "")
    .replace(/\blaan\b/g, "")
    .replace(/\bplein\b/g, "")
    .replace(/\bdijk\b/g, "")
    .replace(/\bkade\b/g, "")
    .replace(/\bpad\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHouseNumber(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;

  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) *
      Math.cos(p2) *
      Math.sin(dl / 2) *
      Math.sin(dl / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getElementCoordinates(element) {
  if (!element) {
    return null;
  }

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

// ============================================================
// CARE TYPE DETECTION
// ============================================================

function detectCareTypeFromText(text) {
  const value = normalizeText(text);

  if (
    value.includes("verpleeghuis") ||
    value.includes("verzorgingshuis") ||
    value.includes("woonzorgcentrum") ||
    value.includes("ouderenzorg") ||
    value.includes("zorgcentrum") ||
    value.includes("verzorgingstehuis")
  ) {
    return "nursing_home";
  }

  if (
    value.includes("gehandicaptenzorg") ||
    value.includes("gehandicapten") ||
    value.includes("woonbegeleiding") ||
    value.includes("zorg voor gehandicapten")
  ) {
    return "disability_care";
  }

  if (
    value.includes("hospice") ||
    value.includes("palliatief")
  ) {
    return "hospice";
  }

  if (
    value.includes("ggz") ||
    value.includes("geestelijke gezondheidszorg") ||
    value.includes("psychiatr") ||
    value.includes("mentale zorg")
  ) {
    return "mental_health";
  }

  if (
    value.includes("revalidatie") ||
    value.includes("rehabilitatie")
  ) {
    return "rehabilitation";
  }

  if (
    value.includes("thuiszorg") ||
    value.includes("wijkverpleging") ||
    value.includes("home care")
  ) {
    return "home_care";
  }

  if (
    value.includes("huisarts") ||
    value.includes("dokter")
  ) {
    return "doctor";
  }

  if (
    value.includes("tandarts") ||
    value.includes("dentist")
  ) {
    return "dentist";
  }

  if (
    value.includes("fysiotherapie") ||
    value.includes("fysiotherapeut")
  ) {
    return "physiotherapy";
  }

  if (
    value.includes("apotheek") ||
    value.includes("pharmacy")
  ) {
    return "pharmacy";
  }

  if (
    value.includes("kinderdagverblijf") ||
    value.includes("kinderopvang") ||
    value.includes("peuterspeelzaal")
  ) {
    return "daycare";
  }

  if (
    value.includes("ziekenhuis") ||
    value.includes("hospital")
  ) {
    return "hospital";
  }

  if (
    value.includes("kliniek") ||
    value.includes("clinic")
  ) {
    return "clinic";
  }

  return null;
}

// ============================================================
// OBJECT TYPE
// ============================================================

function getObjectType(tags = {}) {
  const name = tags.name || "";
  const amenity = normalizeText(tags.amenity);
  const healthcare = normalizeText(tags.healthcare);
  const socialFacility = normalizeText(tags.social_facility);
  const shop = normalizeText(tags.shop);
  const tourism = normalizeText(tags.tourism);
  const leisure = normalizeText(tags.leisure);

  const text = [
    name,
    tags.description,
    tags.operator,
    tags["official_name"],
    tags["alt_name"],
  ]
    .filter(Boolean)
    .join(" ");

  const detectedCareType = detectCareTypeFromText(text);

  if (detectedCareType) {
    return detectedCareType;
  }

  const normalizedName = normalizeText(name);

  if (
    normalizedName.includes("jonx") ||
    normalizedName.includes("dignis")
  ) {
    return "disability_care";
  }

  if (
    socialFacility.includes("nursing_home") ||
    socialFacility.includes("care") ||
    socialFacility.includes("assisted_living")
  ) {
    return "other_care";
  }

  if (
    healthcare.includes("hospital") ||
    amenity === "hospital"
  ) {
    return "hospital";
  }

  if (
    healthcare.includes("clinic") ||
    amenity === "clinic"
  ) {
    return "clinic";
  }

  if (
    healthcare.includes("doctor") ||
    healthcare.includes("general_practitioner") ||
    amenity === "doctors"
  ) {
    return "doctor";
  }

  if (
    healthcare.includes("dentist") ||
    amenity === "dentist"
  ) {
    return "dentist";
  }

  if (
    healthcare.includes("physiotherapist") ||
    healthcare.includes("physiotherapy")
  ) {
    return "physiotherapy";
  }

  if (
    healthcare.includes("pharmacy") ||
    amenity === "pharmacy"
  ) {
    return "pharmacy";
  }

  if (amenity === "school") {
    return "school";
  }

  if (amenity === "kindergarten") {
    return "daycare";
  }

  if (amenity === "place_of_worship") {
    return "place_of_worship";
  }

  if (amenity === "community_centre") {
    return "community_centre";
  }

  if (leisure === "sports_centre") {
    return "sports";
  }

  if (leisure === "stadium") {
    return "sports";
  }

  if (
    tourism === "hotel" ||
    tourism === "hostel" ||
    tourism === "guest_house"
  ) {
    return "hotel";
  }

  if (shop === "supermarket") {
    return "supermarket";
  }

  if (amenity === "marketplace") {
    return "marketplace";
  }

  if (socialFacility) {
    return "other_care";
  }

  return "other";
}

// ============================================================
// PRIORITY
// ============================================================

function priorityForType(type) {
  switch (type) {
    case "hospital":
      return 1;

    case "nursing_home":
    case "disability_care":
    case "hospice":
    case "mental_health":
    case "rehabilitation":
    case "other_care":
      return 2;

    case "doctor":
    case "dentist":
    case "physiotherapy":
    case "pharmacy":
      return 3;

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
      return 9;
  }
}

function isCareType(type) {
  return [
    "nursing_home",
    "disability_care",
    "hospice",
    "mental_health",
    "rehabilitation",
    "home_care",
    "doctor",
    "dentist",
    "physiotherapy",
    "pharmacy",
    "daycare",
    "other_care",
    "hospital",
    "clinic",
  ].includes(type);
}

// ============================================================
// NAME / ADDRESS MATCHING
// ============================================================

function namesMatch(a, b) {
  const first = normalizeText(a);
  const second = normalizeText(b);

  if (!first || !second) {
    return false;
  }

  if (first === second) {
    return true;
  }

  if (
    first.length >= 5 &&
    second.length >= 5 &&
    (first.includes(second) || second.includes(first))
  ) {
    return true;
  }

  return false;
}

function addressesMatch(osm, bag) {
  if (!osm || !bag) {
    return false;
  }

  const osmStreet = normalizeStreet(
    osm.address?.street || osm.tags?.["addr:street"]
  );

  const bagStreet = normalizeStreet(
    bag.properties?.openbare_ruimte_naam ||
      bag.properties?.["openbare_ruimte_naam"]
  );

  const osmNumber = normalizeHouseNumber(
    osm.address?.housenumber ||
      osm.tags?.["addr:housenumber"]
  );

  const bagNumber = normalizeHouseNumber(
    bag.properties?.huisnummer
  );

  if (!osmStreet || !bagStreet || !osmNumber || !bagNumber) {
    return false;
  }

  return (
    osmStreet === bagStreet &&
    osmNumber === bagNumber
  );
}

// ============================================================
// OVERPASS
// ============================================================

async function queryOneOverpassServer(server, timeoutMs, query) {
  console.log(
    `Overpass proberen: ${server} (timeout ${timeoutMs} ms)`
  );

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(server, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Omgevingsscan/1.0",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const elements = data.elements || [];

    console.log(
      `Overpass succesvol via ${server}: ${elements.length} objecten`
    );

    return elements;
  } finally {
    clearTimeout(timeout);
  }
}

async function queryOverpass(latitude, longitude, radius) {
  const query = `
[out:json][timeout:25];

(
  nwr(around:${radius},${latitude},${longitude})["amenity"="social_facility"];
  nwr(around:${radius},${latitude},${longitude})["social_facility"];
  nwr(around:${radius},${latitude},${longitude})["healthcare"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="hospital"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="clinic"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="doctors"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="dentist"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="pharmacy"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="school"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="kindergarten"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="place_of_worship"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="community_centre"];
  nwr(around:${radius},${latitude},${longitude})["leisure"="sports_centre"];
  nwr(around:${radius},${latitude},${longitude})["leisure"="stadium"];
  nwr(around:${radius},${latitude},${longitude})["tourism"="hotel"];
  nwr(around:${radius},${latitude},${longitude})["tourism"="hostel"];
  nwr(around:${radius},${latitude},${longitude})["tourism"="guest_house"];
  nwr(around:${radius},${latitude},${longitude})["shop"="supermarket"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="marketplace"];
);

out center tags;
`;

  for (let i = 0; i < OVERPASS_SERVERS.length; i++) {
    const server = OVERPASS_SERVERS[i];
    const timeoutMs = OVERPASS_TIMEOUTS[i] || 10000;

    try {
      return await queryOneOverpassServer(
        server,
        timeoutMs,
        query
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        console.log(
          `Overpass timeout bij ${server} na ${timeoutMs} ms`
        );
      } else {
        console.log(
          `Overpass fout bij ${server}: ${error.message}`
        );
      }
    }
  }

  console.log(
    "Geen enkele Overpass-server kon worden gebruikt."
  );

  return [];
}

// ============================================================
// PROCESS OSM
// ============================================================

function processOSMObjects(elements, latitude, longitude) {
  const results = [];

  for (const element of elements) {
    const coordinates = getElementCoordinates(element);

    if (!coordinates) {
      continue;
    }

    const tags = element.tags || {};

    const type = getObjectType(tags);

    if (type === "other") {
      continue;
    }

    const distance = distanceMeters(
      latitude,
      longitude,
      coordinates.latitude,
      coordinates.longitude
    );

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

    const name =
      tags.name ||
      tags["official_name"] ||
      tags["alt_name"] ||
      `${type}`;

    results.push({
      id: `${element.type}-${element.id}`,
      name,
      type,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      distance,
      priority: priorityForType(type),
      address,
      source: "OSM",
      confidence:
        type === "other_care"
          ? "medium"
          : "high",
      tags,
    });
  }

  return results;
}

// ============================================================
// BAG
// ============================================================

async function queryBAG(latitude, longitude, radius) {
  const baseUrl =
    "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items";

  const results = [];

  const deltaLat = radius / 111320;
  const deltaLon =
    radius /
    (111320 * Math.cos((latitude * Math.PI) / 180));

  const minLon = longitude - deltaLon;
  const minLat = latitude - deltaLat;
  const maxLon = longitude + deltaLon;
  const maxLat = latitude + deltaLat;

  const limit = 1000;
  let page = 1;

  let nextUrl =
    `${baseUrl}` +
    `?bbox=${minLon},${minLat},${maxLon},${maxLat}` +
    `&limit=${limit}` +
    `&f=json`;

  console.log(
    `BAG proberen binnen ${radius} meter...`
  );

  while (page <= 10 && nextUrl) {
    console.log(
      `BAG pagina ${page} ophalen...`
    );

    try {
      const response = await fetch(nextUrl, {
        headers: {
          Accept: "application/geo+json",
          "User-Agent": "Omgevingsscan/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(
          `BAG HTTP ${response.status}`
        );
      }

      const data = await response.json();
      const features = data.features || [];

      console.log(
        `BAG pagina ${page}: ${features.length} objecten`
      );

      results.push(...features);

      // --------------------------------------------------------
      // BAG gebruikt cursor-based pagination.
      // De API geeft zelf een next-link terug.
      // --------------------------------------------------------

      const nextLink =
        Array.isArray(data.links)
          ? data.links.find(
              (link) =>
                link &&
                link.rel === "next" &&
                link.href
            )
          : null;

      if (!nextLink) {
        nextUrl = null;
        break;
      }

      nextUrl = nextLink.href;
      page++;
    } catch (error) {
      console.log(
        `BAG fout: ${error.message}`
      );
      break;
    }
  }

  console.log(
    `BAG succesvol: ${results.length} verblijfsobjecten`
  );

  return results;
}

// ============================================================
// BAG HELPERS
// ============================================================

function getBAGType(feature) {
  const properties = feature?.properties || {};

  const gebruiksdoel =
    properties.gebruiksdoel ||
    properties["gebruiksdoel"];

  if (Array.isArray(gebruiksdoel)) {
    const values = gebruiksdoel.map((x) =>
      normalizeText(x)
    );

    if (
      values.some(
        (x) =>
          x.includes("gezondheidszorg") ||
          x.includes("medisch")
      )
    ) {
      return "healthcare";
    }

    if (
      values.some(
        (x) =>
          x.includes("onderwijs")
      )
    ) {
      return "school";
    }

    if (
      values.some(
        (x) =>
          x.includes("bijeenkomst")
      )
    ) {
      return "community";
    }

    if (
      values.some(
        (x) =>
          x.includes("logies")
      )
    ) {
      return "hotel";
    }

    if (
      values.some(
        (x) =>
          x.includes("winkelfunctie")
      )
    ) {
      return "shop";
    }
  }

  return null;
}

function getBAGPandHref(feature) {
  const properties =
    feature?.properties || {};

  const value =
    properties["pand.href"];

  if (Array.isArray(value)) {
    return value[0]
      ? String(value[0]).trim()
      : "";
  }

  if (!value) {
    return "";
  }

  return String(value).trim();
}

function getBAGPandId(feature) {
  const href = getBAGPandHref(feature);

  if (!href) {
    return "";
  }

  try {
    const cleanHref =
      href.split("?")[0];

    const parts =
      cleanHref
        .split("/")
        .filter(Boolean);

    return parts.length
      ? decodeURIComponent(
          parts[parts.length - 1]
        ).trim()
      : "";
  } catch {
    return "";
  }
}

// ============================================================
// BAG PAND
// ============================================================

async function queryBAGPand(href) {
  if (!href) {
    return null;
  }

  if (bagPandCache.has(href)) {
    return bagPandCache.get(href);
  }

  if (bagPandPromiseCache.has(href)) {
    return bagPandPromiseCache.get(href);
  }

  const promise = (async () => {
    console.log(
      `BAG pand ophalen: ${href}`
    );

    const controller =
      new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 8000);

    try {
      const response = await fetch(
        href,
        {
          headers: {
            Accept:
              "application/geo+json",
            "User-Agent":
              "Omgevingsscan/1.0",
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `BAG pand HTTP ${response.status}`
        );
      }

      const feature =
        await response.json();

      const properties =
        feature?.properties || {};

      const pandData = {
        identificatie:
          properties.identificatie ||
          properties["identificatie"] ||
          null,

        bouwjaar:
          properties.bouwjaar ??
          null,

        aantal_verblijfsobjecten:
          properties.aantal_verblijfsobjecten ??
          null,

        gebruiksdoel:
          properties.gebruiksdoel ||
          null,

        status:
          properties.status ||
          null,
      };

      bagPandCache.set(
        href,
        pandData
      );

      return pandData;
    } catch (error) {
      console.log(
        `BAG pand fout bij ${href}: ${error.message}`
      );

      return null;
    } finally {
      clearTimeout(timeout);
      bagPandPromiseCache.delete(href);
    }
  })();

  bagPandPromiseCache.set(
    href,
    promise
  );

  return promise;
}

// ============================================================
// BEST BAG MATCH
// ============================================================

function getBestBAGFeatureForOSM(
  osm,
  bagFeatures
) {
  if (!osm || !bagFeatures?.length) {
    return null;
  }

  const osmBagRef =
    osm.tags?.["ref:bag"] ||
    osm.tags?.["ref:bag:verblijfsobject"];

  if (osmBagRef) {
    const direct =
      bagFeatures.find((feature) => {
        const id =
          feature?.properties?.identificatie;

        return (
          id &&
          String(id) ===
            String(osmBagRef)
        );
      });

    if (direct) {
      return direct;
    }
  }

  const osmPandRef =
    osm.tags?.["ref:bag:pand"];

  if (osmPandRef) {
    const directPand =
      bagFeatures.find(
        (feature) =>
          getBAGPandId(feature) ===
          String(osmPandRef)
      );

    if (directPand) {
      return directPand;
    }
  }

  const addressMatch =
    bagFeatures.find((feature) =>
      addressesMatch(
        osm,
        feature
      )
    );

  if (addressMatch) {
    return addressMatch;
  }

  let closest = null;
  let closestDistance = Infinity;

  for (const feature of bagFeatures) {
    const coordinates =
      getElementCoordinates(
        feature
      );

    if (!coordinates) {
      continue;
    }

    const distance =
      distanceMeters(
        osm.latitude,
        osm.longitude,
        coordinates.latitude,
        coordinates.longitude
      );

    if (
      distance <= 15 &&
      distance < closestDistance
    ) {
      closest = feature;
      closestDistance = distance;
    }
  }

  return closest;
}

// ============================================================
// REQUIRED BAG PAND HREFS
// ============================================================

function collectRequiredBAGPandHrefs(
  osmObjects,
  bagFeatures
) {
  const required =
    new Set();

  for (const feature of bagFeatures) {
    const type =
      getBAGType(feature);

    if (!type) {
      continue;
    }

    const href =
      getBAGPandHref(feature);

    if (href) {
      required.add(href);
    }
  }

  for (const osm of osmObjects) {
    const best =
      getBestBAGFeatureForOSM(
        osm,
        bagFeatures
      );

    if (!best) {
      continue;
    }

    const href =
      getBAGPandHref(best);

    if (href) {
      required.add(href);
    }
  }

  return [...required];
}

// ============================================================
// ENRICH BAG FEATURES WITH PAND
// ============================================================

async function enrichBAGFeaturesWithPand(
  features,
  requiredHrefs
) {
  console.log(
    `BAG: ${requiredHrefs.length} benodigde panden geselecteerd`
  );

  const concurrency = 15;

  for (
    let i = 0;
    i < requiredHrefs.length;
    i += concurrency
  ) {
    const batch =
      requiredHrefs.slice(
        i,
        i + concurrency
      );

    await Promise.all(
      batch.map(async (href) => {
        const pand =
          await queryBAGPand(href);

        if (!pand) {
          return;
        }

        for (const feature of features) {
          if (
            getBAGPandHref(feature) ===
            href
          ) {
            feature.pand = pand;
          }
        }
      })
    );
  }

  const enriched =
    features.filter(
      (feature) =>
        feature.pand
    ).length;

  console.log(
    `BAG pandverrijking gereed: ${requiredHrefs.length} nieuwe panden opgehaald`
  );

  console.log(
    `BAG pandgegevens gekoppeld aan ${enriched} verblijfsobjecten`
  );

  console.log(
    `BAG pandcache bevat: ${bagPandCache.size} panden`
  );
}

// ============================================================
// PROCESS BAG OBJECTS
// ============================================================

function processBAGObjects(
  bagFeatures,
  latitude,
  longitude
) {
  const results = [];

  for (const feature of bagFeatures) {
    const coordinates =
      getElementCoordinates(
        feature
      );

    if (!coordinates) {
      continue;
    }

    const type =
      getBAGType(feature);

    if (!type) {
      continue;
    }

    const distance =
      distanceMeters(
        latitude,
        longitude,
        coordinates.latitude,
        coordinates.longitude
      );

    const properties =
      feature.properties || {};

    const street =
      properties.openbare_ruimte_naam ||
      properties["openbare_ruimte_naam"] ||
      null;

    const housenumber =
      properties.huisnummer ||
      null;

    const postcode =
      properties.postcode ||
      null;

    const city =
      properties.woonplaats_naam ||
      null;

    const name =
      street && housenumber
        ? `${street} ${housenumber}`
        : `${type}`;

    results.push({
      id:
        properties.identificatie ||
        `bag-${Math.random()
          .toString(36)
          .slice(2)}`,

      name,

      type,

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,

      distance,

      priority:
        priorityForType(type),

      address: {
        street,
        housenumber,
        postcode,
        city,
      },

      source: "BAG",

      confidence: "medium",

      tags: properties,

      bag: {
        ...properties,
        verblijfsobject_id:
          properties.identificatie ||
          null,
      },

      pand:
        feature.pand ||
        null,
    });
  }

  return results;
}

// ============================================================
// ENRICH OSM WITH BAG
// ============================================================

function enrichOSMWithBAG(
  osmObjects,
  bagFeatures
) {
  const bagByVOId =
    new Map();

  const bagByPandId =
    new Map();

  for (const feature of bagFeatures) {
    const properties =
      feature.properties || {};

    const voId =
      properties.identificatie;

    if (voId) {
      bagByVOId.set(
        String(voId),
        feature
      );
    }

    const pandId =
      getBAGPandId(feature);

    if (pandId) {
      if (
        !bagByPandId.has(pandId)
      ) {
        bagByPandId.set(
          pandId,
          []
        );
      }

      bagByPandId
        .get(pandId)
        .push(feature);
    }
  }

  console.log(
    `BAG index: ${bagByVOId.size} verblijfsobjecten, ${bagByPandId.size} panden`
  );

  let directVOMatches = 0;
  let directPandMatches = 0;
  let addressMatches = 0;
  let distanceMatches = 0;

  let enrichedCount = 0;

  for (const osm of osmObjects) {
    let bestFeature = null;

    const osmBagRef =
      osm.tags?.["ref:bag"] ||
      osm.tags?.["ref:bag:verblijfsobject"];

    if (osmBagRef) {
      bestFeature =
        bagByVOId.get(
          String(osmBagRef)
        );

      if (bestFeature) {
        directVOMatches++;
      }
    }

    if (!bestFeature) {
      const osmPandRef =
        osm.tags?.["ref:bag:pand"];

      if (osmPandRef) {
        const candidates =
          bagByPandId.get(
            String(osmPandRef)
          );

        if (
          candidates &&
          candidates.length
        ) {
          bestFeature =
            candidates[0];

          directPandMatches++;
        }
      }
    }

    if (!bestFeature) {
      for (const feature of bagFeatures) {
        if (
          addressesMatch(
            osm,
            feature
          )
        ) {
          bestFeature =
            feature;

          addressMatches++;
          break;
        }
      }
    }

    if (!bestFeature) {
      let closest = null;
      let closestDistance =
        Infinity;

      for (const feature of bagFeatures) {
        const coordinates =
          getElementCoordinates(
            feature
          );

        if (!coordinates) {
          continue;
        }

        const distance =
          distanceMeters(
            osm.latitude,
            osm.longitude,
            coordinates.latitude,
            coordinates.longitude
          );

        if (
          distance <= 15 &&
          distance < closestDistance
        ) {
          closest =
            feature;

          closestDistance =
            distance;
        }
      }

      if (closest) {
        bestFeature =
          closest;

        distanceMatches++;
      }
    }

    if (!bestFeature) {
      continue;
    }

    const bagProperties =
      bestFeature.properties ||
      {};

    osm.bag = {
      ...bagProperties,
      verblijfsobject_id:
        bagProperties.identificatie ||
        null,
    };

    osm.pand =
      bestFeature.pand ||
      null;

    enrichedCount++;
  }

  console.log(
    `OSM/BAG verrijking: ${enrichedCount} objecten gekoppeld`
  );

  console.log(
    `BAG directe VO-matches: ${directVOMatches}`
  );

  console.log(
    `BAG directe pand-matches: ${directPandMatches}`
  );

  console.log(
    `BAG adres-matches: ${addressMatches}`
  );

  console.log(
    `BAG afstand-matches: ${distanceMatches}`
  );

  return osmObjects;
}

// ============================================================
// DEDUPLICATION
// ============================================================

function deduplicateObjects(
  objects
) {
  const result = [];

  const used = new Set();

  for (const object of objects) {
    const key =
      `${normalizeText(object.name)}|` +
      `${normalizeStreet(object.address?.street)}|` +
      `${normalizeHouseNumber(object.address?.housenumber)}`;

    if (used.has(key)) {
      continue;
    }

    used.add(key);
    result.push(object);
  }

  return result;
}

// ============================================================
// API ROUTE
// ============================================================

app.get(
  "/api/vulnerable-objects",
  async (req, res) => {
    const startTime =
      Date.now();

    const latitude =
      Number(req.query.latitude);

    const longitude =
      Number(req.query.longitude);

    const radius =
      Number(req.query.radius || 500);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return res.status(400).json({
        error:
          "Ongeldige latitude of longitude",
      });
    }

    console.log(
      "============================================================"
    );

    console.log(
      `Nieuwe objectscan: ${latitude}, ${longitude}, radius ${radius}m`
    );

    console.log(
      "============================================================"
    );

    try {
      // --------------------------------------------------------
      // OVERPASS
      // --------------------------------------------------------

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
          longitude
        );

      console.log(
        `OSM verwerkt: ${osmObjects.length} relevante objecten`
      );

      // --------------------------------------------------------
      // BAG
      // --------------------------------------------------------

      const bagFeatures =
        await queryBAG(
          latitude,
          longitude,
          radius
        );

      // --------------------------------------------------------
      // BAG PANDEN BEPALEN
      // --------------------------------------------------------

      const requiredPandHrefs =
        collectRequiredBAGPandHrefs(
          osmObjects,
          bagFeatures
        );

      console.log(
        `BAG: ${requiredPandHrefs.length} panden nodig voor deze scan`
      );

      await enrichBAGFeaturesWithPand(
        bagFeatures,
        requiredPandHrefs
      );

      // --------------------------------------------------------
      // BAG OBJECTEN
      // --------------------------------------------------------

      const bagObjects =
        processBAGObjects(
          bagFeatures,
          latitude,
          longitude
        );

      console.log(
        `BAG verwerkt: ${bagObjects.length} relevante objecten`
      );

      // --------------------------------------------------------
      // OSM + BAG KOPPELEN
      // --------------------------------------------------------

      enrichOSMWithBAG(
        osmObjects,
        bagFeatures
      );

      // --------------------------------------------------------
      // COMBINEREN
      // --------------------------------------------------------

      const combined = [
        ...osmObjects,
        ...bagObjects,
      ];

      console.log(
        `Totaal relevante objecten: ${combined.length}`
      );

      // --------------------------------------------------------
      // DEDUPLICEREN
      // --------------------------------------------------------

      const deduplicated =
        deduplicateObjects(
          combined
        );

      console.log(
        `Na verwijderen duplicaten: ${deduplicated.length}`
      );

      // --------------------------------------------------------
      // SORTEREN
      // --------------------------------------------------------

      deduplicated.sort(
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
            a.distance -
            b.distance
          );
        }
      );

      const processingTime =
        Date.now() -
        startTime;

      console.log(
        `Totale verwerkingstijd: ${processingTime} ms`
      );

      console.log(
        "============================================================"
      );

      res.json(
        deduplicated
      );
    } catch (error) {
      console.error(
        "Fout tijdens objectscan:",
        error
      );

      res.status(500).json({
        error:
          "Fout tijdens ophalen van kwetsbare objecten",
        message:
          error.message,
      });
    }
  }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "ok",
      service: "omgevingsscan-backend",
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      `Omgevingsscan backend draait op http://localhost:${PORT}`
    );
  }
);