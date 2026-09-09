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

// ============================================================
// HULPFUNCTIES
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
    .replace(/\bpad\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHouseNumber(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const dLat =
    (lat2 - lat1) *
    Math.PI /
    180;

  const dLon =
    (lon2 - lon1) *
    Math.PI /
    180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

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
    element.lat !== undefined &&
    element.lon !== undefined
  ) {
    return {
      latitude: Number(element.lat),
      longitude: Number(element.lon),
    };
  }

  if (
    element.center &&
    element.center.lat !== undefined &&
    element.center.lon !== undefined
  ) {
    return {
      latitude: Number(element.center.lat),
      longitude: Number(element.center.lon),
    };
  }

  if (
    element.geometry &&
    element.geometry.length
  ) {
    const first = element.geometry[0];

    if (
      first.lat !== undefined &&
      first.lon !== undefined
    ) {
      return {
        latitude: Number(first.lat),
        longitude: Number(first.lon),
      };
    }
  }

  return null;
}

// ============================================================
// ZORGTYPE DETECTIE
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
    value.includes("dignis") ||
    value.includes("doven") ||
    value.includes("visueel gehandicapten")
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
    value.includes("kinderopvang") ||
    value.includes("kinderdagverblijf") ||
    value.includes("peuterspeelzaal")
  ) {
    return "daycare";
  }

  return null;
}

// ============================================================
// OBJECTCLASSIFICATIE
// ============================================================

function getObjectType(tags = {}) {
  const amenity =
    normalizeText(tags.amenity);

  const healthcare =
    normalizeText(tags.healthcare);

  const socialFacility =
    normalizeText(tags.social_facility);

  const tourism =
    normalizeText(tags.tourism);

  const shop =
    normalizeText(tags.shop);

  const leisure =
    normalizeText(tags.leisure);

  const sport =
    normalizeText(tags.sport);

  const name =
    normalizeText(
      [
        tags.name,
        tags.operator,
        tags.official_name,
        tags.description,
      ]
        .filter(Boolean)
        .join(" ")
    );

  if (name.includes("jonx")) {
    return "mental_health";
  }

  if (name.includes("dignis")) {
    return "nursing_home";
  }

  const careFromText =
    detectCareTypeFromText(name);

  if (careFromText) {
    return careFromText;
  }

  if (
    healthcare === "hospital" ||
    amenity === "hospital"
  ) {
    return "hospital";
  }

  if (
    healthcare === "clinic" ||
    amenity === "clinic"
  ) {
    return "clinic";
  }

  if (
    healthcare === "doctor" ||
    amenity === "doctors"
  ) {
    return "doctor";
  }

  if (
    healthcare === "dentist" ||
    amenity === "dentist"
  ) {
    return "dentist";
  }

  if (healthcare === "physiotherapist") {
    return "physiotherapy";
  }

  if (
    healthcare === "pharmacy" ||
    amenity === "pharmacy"
  ) {
    return "pharmacy";
  }

  if (socialFacility) {
    return "other_care";
  }

  if (
    amenity === "school" ||
    amenity === "kindergarten" ||
    amenity === "college" ||
    amenity === "university"
  ) {
    return "school";
  }

  if (amenity === "place_of_worship") {
    return "place_of_worship";
  }

  if (
    amenity === "community_centre" ||
    amenity === "social_centre"
  ) {
    return "community_centre";
  }

  if (
    leisure === "sports_centre" ||
    leisure === "stadium" ||
    sport
  ) {
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

  return "other";
}

// ============================================================
// PRIORITEIT
// ============================================================

function priorityForType(type) {
  const priorities = {
    nursing_home: 1,
    disability_care: 1,
    hospice: 1,
    mental_health: 1,
    rehabilitation: 1,
    hospital: 1,
    clinic: 1,

    school: 2,
    daycare: 2,

    doctor: 3,
    dentist: 3,
    physiotherapy: 3,
    pharmacy: 3,
    home_care: 3,
    other_care: 3,

    place_of_worship: 4,
    community_centre: 4,

    sports: 5,
    hotel: 6,

    supermarket: 7,
    marketplace: 7,

    other: 8,
  };

  return priorities[type] || 99;
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
// MATCHING
// ============================================================

function namesMatch(name1, name2) {
  const a = normalizeText(name1);
  const b = normalizeText(name2);

  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  if (
    a.includes(b) ||
    b.includes(a)
  ) {
    return true;
  }

  return false;
}

function addressesMatch(a, b) {
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

// ============================================================
// OVERPASS
// ============================================================

async function queryOverpass(
  latitude,
  longitude,
  radius
) {
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

  const allElements = [];

  for (const server of OVERPASS_SERVERS) {
    try {
      console.log(
        `Overpass proberen: ${server}`
      );

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => controller.abort(),
          20000
        );

      const response =
        await fetch(
          server,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
              "User-Agent":
                "Omgevingsscan/1.0",
            },
            body:
              `data=${encodeURIComponent(query)}`,
            signal:
              controller.signal,
          }
        );

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const elements =
        data.elements || [];

      console.log(
        `Overpass succesvol: ${elements.length} objecten`
      );

      allElements.push(
        ...elements
      );

    } catch (error) {
      console.log(
        `Overpass fout bij ${server}: ${error.message}`
      );
    }
  }

  const unique = new Map();

  for (const element of allElements) {
    const key =
      `${element.type}-${element.id}`;

    if (!unique.has(key)) {
      unique.set(
        key,
        element
      );
    }
  }

  const result =
    Array.from(unique.values());

  console.log(
    `Overpass totaal: ${allElements.length} objecten, ${result.length} unieke objecten`
  );

  return result;
}

// ============================================================
// OSM VERWERKEN
// ============================================================

function processOSMObjects(
  elements,
  latitude,
  longitude,
  radius
) {
  const objects = [];

  for (const element of elements) {
    const coordinates =
      getElementCoordinates(element);

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

    if (distance > radius) {
      continue;
    }

    const tags =
      element.tags || {};

    const type =
      getObjectType(tags);

    const street =
      tags["addr:street"] || "";

    const housenumber =
      tags["addr:housenumber"] || "";

    const postcode =
      tags["addr:postcode"] || "";

    const city =
      tags["addr:city"] ||
      tags["addr:town"] ||
      tags["addr:village"] ||
      "";

    const name =
      tags.name ||
      tags.operator ||
      tags.official_name ||
      "Onbekend object";

    objects.push({
      id:
        `${element.type}-${element.id}`,

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

      source: "OSM",

      confidence:
        type === "other_care"
          ? "medium"
          : "high",

      tags,
    });
  }

  console.log(
    `OSM verwerkt: ${objects.length} relevante objecten`
  );

  return objects;
}

// ============================================================
// BAG VERBLIJFSOBJECTEN
// ============================================================

async function queryBAG(
  latitude,
  longitude,
  radius
) {
  const baseUrl =
    "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items";

  const latDelta =
    radius / 111000;

  const lonDelta =
    radius /
    (
      111000 *
      Math.cos(
        latitude * Math.PI / 180
      )
    );

  const bbox =
    `${longitude - lonDelta},` +
    `${latitude - latDelta},` +
    `${longitude + lonDelta},` +
    `${latitude + latDelta}`;

  let url =
    `${baseUrl}?f=json` +
    `&limit=1000` +
    `&bbox=${bbox}`;

  const allFeatures = [];

  let page = 1;

  try {
    console.log(
      `BAG proberen binnen ${radius} meter...`
    );

    while (url) {
      console.log(
        `BAG pagina ${page} ophalen...`
      );

      const response =
        await fetch(
          url,
          {
            headers: {
              Accept:
                "application/geo+json",
              "User-Agent":
                "Omgevingsscan/1.0",
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          `BAG HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const features =
        data.features || [];

      allFeatures.push(
        ...features
      );

      console.log(
        `BAG pagina ${page}: ${features.length} objecten`
      );

      const nextLink =
        data.links?.find(
          (link) =>
            link.rel === "next" &&
            link.href
        )?.href || null;

      url =
        nextLink;

      page++;

      if (page > 10) {
        console.log(
          "BAG veiligheidslimiet van 10 pagina's bereikt."
        );

        break;
      }
    }

    console.log(
      `BAG succesvol: ${allFeatures.length} verblijfsobjecten`
    );

    return allFeatures;

  } catch (error) {
    console.log(
      `BAG fout: ${error.message}`
    );

    return [];
  }
}

// ============================================================
// BAG PAND OPHALEN
// ============================================================

async function queryBAGPand(pandHref) {
  if (!pandHref) {
    return null;
  }

  try {
    console.log(
      `BAG pand ophalen: ${pandHref}`
    );

    const response =
      await fetch(
        pandHref,
        {
          headers: {
            Accept:
              "application/geo+json",
            "User-Agent":
              "Omgevingsscan/1.0",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `BAG pand HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    return data;

  } catch (error) {
    console.log(
      `BAG pand fout: ${error.message}`
    );

    return null;
  }
}

// ============================================================
// BAG PAND GEGEVENS
// ============================================================

async function enrichBAGFeaturesWithPand(
  features
) {
  const cache =
    new Map();

  let processed = 0;

  for (const feature of features) {
    const properties =
      feature.properties || {};

    const pandHref =
      Array.isArray(
        properties["pand.href"]
      )
        ? properties["pand.href"][0]
        : properties["pand.href"];

    if (!pandHref) {
      continue;
    }

    if (
      cache.has(pandHref)
    ) {
      feature.pand =
        cache.get(pandHref);

      continue;
    }

    const pand =
      await queryBAGPand(
        pandHref
      );

    if (!pand) {
      continue;
    }

    const pandProperties =
      pand.properties || {};

    const pandData = {
      identificatie:
        pandProperties.identificatie ||
        null,

      bouwjaar:
        pandProperties.bouwjaar ||
        null,

      aantal_verblijfsobjecten:
        pandProperties.aantal_verblijfsobjecten ||
        null,

      gebruiksdoel:
        pandProperties.gebruiksdoel ||
        null,

      status:
        pandProperties.status ||
        null,
    };

    cache.set(
      pandHref,
      pandData
    );

    feature.pand =
      pandData;

    processed++;

    console.log(
      `BAG pand verwerkt: ${processed}`
    );
  }

  console.log(
    `BAG pandverrijking gereed: ${processed} panden`
  );

  return features;
}

// ============================================================
// BAG STATUS
// ============================================================

function isActiveBAGObject(feature) {
  const properties =
    feature.properties || {};

  const status =
    normalizeText(
      properties.status
    );

  if (
    status.includes("ingetrokken") ||
    status.includes("buiten gebruik") ||
    status.includes("verbouwing") ||
    status.includes("ten onrechte") ||
    status.includes("niet gerealiseerd")
  ) {
    return false;
  }

  return true;
}

// ============================================================
// BAG TYPE
// ============================================================

function getBAGType(feature) {
  const properties =
    feature.properties || {};

  const gebruiksdoel =
    properties.gebruiksdoel;

  if (!gebruiksdoel) {
    return null;
  }

  const text =
    Array.isArray(gebruiksdoel)
      ? gebruiksdoel
          .join(" ")
          .toLowerCase()
      : String(
          gebruiksdoel
        ).toLowerCase();

  if (
    text.includes(
      "onderwijsfunctie"
    )
  ) {
    return "school";
  }

  if (
    text.includes(
      "sportfunctie"
    )
  ) {
    return "sports";
  }

  if (
    text.includes(
      "logiesfunctie"
    )
  ) {
    return "hotel";
  }

  if (
    text.includes(
      "bijeenkomstfunctie"
    )
  ) {
    const combined =
      normalizeText(
        [
          properties.openbare_ruimte_naam,
          properties.woonplaats_naam,
        ]
          .filter(Boolean)
          .join(" ")
      );

    if (
      combined.includes("kerk") ||
      combined.includes("moskee") ||
      combined.includes("synagoge") ||
      combined.includes("buurthuis") ||
      combined.includes("wijkcentrum") ||
      combined.includes("dorpshuis")
    ) {
      return "place_of_worship";
    }
  }

  return null;
}

// ============================================================
// BAG ADRES MAKEN
// ============================================================

function getBAGAddress(feature) {
  const properties =
    feature.properties || {};

  const street =
    properties.openbare_ruimte_naam ||
    "";

  const housenumber =
    properties.huisnummer ||
    "";

  const houseletter =
    properties.huisletter ||
    "";

  const toevoeging =
    properties.toevoeging ||
    "";

  const postcode =
    properties.postcode ||
    "";

  const city =
    properties.woonplaats_naam ||
    "";

  let fullHouseNumber =
    String(
      housenumber
    );

  if (houseletter) {
    fullHouseNumber +=
      String(
        houseletter
      );
  }

  if (toevoeging) {
    fullHouseNumber +=
      `-${toevoeging}`;
  }

  return {
    street,
    housenumber:
      fullHouseNumber,
    postcode,
    city,
  };
}

// ============================================================
// BAG COORDINATEN
// ============================================================

function getBAGCoordinates(feature) {
  if (
    !feature.geometry ||
    feature.geometry.type !== "Point"
  ) {
    return null;
  }

  const coordinates =
    feature.geometry.coordinates;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ) {
    return null;
  }

  const longitude =
    Number(coordinates[0]);

  const latitude =
    Number(coordinates[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

// ============================================================
// BAG OBJECTEN VERWERKEN
// ============================================================

function processBAGObjects(
  features,
  latitude,
  longitude,
  radius
) {
  const objects = [];

  for (const feature of features) {
    if (
      !isActiveBAGObject(feature)
    ) {
      continue;
    }

    const type =
      getBAGType(feature);

    if (!type) {
      continue;
    }

    const coordinates =
      getBAGCoordinates(feature);

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

    if (distance > radius) {
      continue;
    }

    const properties =
      feature.properties || {};

    const address =
      getBAGAddress(feature);

    const addressParts = [
      address.street,
      address.housenumber,
      address.postcode,
      address.city,
    ].filter(Boolean);

    const name =
      addressParts.join(" ") ||
      "BAG object";

    objects.push({
      id:
        `bag-${properties.identificatie || Math.random()}`,

      name,

      type,

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,

      distance,

      priority:
        priorityForType(type),

      address,

      source: "BAG",

      confidence: "medium",

      bag: properties,

      pand:
        feature.pand || null,
    });
  }

  console.log(
    `BAG verwerkt: ${objects.length} relevante objecten`
  );

  return objects;
}

// ============================================================
// OSM + BAG KOPPELEN
// ============================================================
//
// We gebruiken ALLE BAG-verblijfsobjecten.
//
// ref:bag kan in OSM verwijzen naar:
// - een BAG verblijfsobject-ID
// - een BAG pand-ID
//
// Daarom bouwen we twee indexen.
//
// Matchvolgorde:
// 1. ref:bag -> verblijfsobject-ID
// 2. ref:bag -> pand-ID
// 3. exact adres
// 4. afstand <= 15 meter als OSM geen straat heeft
// ============================================================

function enrichOSMWithBAG(
  osmObjects,
  bagFeatures
) {
  let linked = 0;
  let directRefMatches = 0;
  let pandRefMatches = 0;
  let addressMatches = 0;
  let distanceMatches = 0;

  // --------------------------------------------------------
  // BAG indexen
  // --------------------------------------------------------

  const bagByVoId =
    new Map();

  const bagByPandId =
    new Map();

  for (const feature of bagFeatures) {
    if (
      !isActiveBAGObject(feature)
    ) {
      continue;
    }

    const properties =
      feature.properties || {};

    // ------------------------------------------------------
    // BAG verblijfsobject-ID
    // ------------------------------------------------------

    const verblijfsobjectId =
      properties.identificatie;

    if (verblijfsobjectId) {
      bagByVoId.set(
        String(verblijfsobjectId).trim(),
        feature
      );
    }

    // ------------------------------------------------------
    // BAG pand-ID
    //
    // OSM ref:bag verwijst vaak naar het pand.
    // ------------------------------------------------------

    const pandId =
      feature.pand?.identificatie;

    if (
      pandId &&
      !bagByPandId.has(
        String(pandId).trim()
      )
    ) {
      bagByPandId.set(
        String(pandId).trim(),
        feature
      );
    }
  }

  console.log(
    `BAG index: ${bagByVoId.size} verblijfsobjecten, ${bagByPandId.size} panden`
  );

  // --------------------------------------------------------
  // OSM objecten koppelen
  // --------------------------------------------------------

  for (const osm of osmObjects) {
    let bestFeature = null;
    let bestDistance = Infinity;

    // ======================================================
    // 1. DIRECTE KOPPELING VIA ref:bag
    // ======================================================

    const refBag =
      osm.tags?.["ref:bag"];

    if (refBag) {
      const refValue =
        String(refBag).trim();

      // ----------------------------------------------------
      // 1A. ref:bag = BAG verblijfsobject-ID
      // ----------------------------------------------------

      const voFeature =
        bagByVoId.get(
          refValue
        );

      if (voFeature) {
        bestFeature =
          voFeature;

        const coordinates =
          getBAGCoordinates(
            voFeature
          );

        if (coordinates) {
          bestDistance =
            distanceMeters(
              osm.latitude,
              osm.longitude,
              coordinates.latitude,
              coordinates.longitude
            );
        }

        directRefMatches++;

        console.log(
          `BAG directe VO-match: ${osm.name} -> ${refValue}`
        );
      }

      // ----------------------------------------------------
      // 1B. ref:bag = BAG pand-ID
      // ----------------------------------------------------

      if (!bestFeature) {
        const pandFeature =
          bagByPandId.get(
            refValue
          );

        if (pandFeature) {
          bestFeature =
            pandFeature;

          const coordinates =
            getBAGCoordinates(
              pandFeature
            );

          if (coordinates) {
            bestDistance =
              distanceMeters(
                osm.latitude,
                osm.longitude,
                coordinates.latitude,
                coordinates.longitude
              );
          }

          pandRefMatches++;

          console.log(
            `BAG directe pand-match: ${osm.name} -> pand ${refValue}`
          );
        }
      }
    }

    // ======================================================
    // 2. MATCHEN OP ADRES
    // ======================================================

    if (!bestFeature) {
      for (const feature of bagFeatures) {
        if (
          !isActiveBAGObject(feature)
        ) {
          continue;
        }

        const bagAddress =
          getBAGAddress(
            feature
          );

        if (
          !addressesMatch(
            osm.address,
            bagAddress
          )
        ) {
          continue;
        }

        const coordinates =
          getBAGCoordinates(
            feature
          );

        if (!coordinates) {
          continue;
        }

        const d =
          distanceMeters(
            osm.latitude,
            osm.longitude,
            coordinates.latitude,
            coordinates.longitude
          );

        if (
          d < bestDistance
        ) {
          bestDistance =
            d;

          bestFeature =
            feature;
        }
      }

      if (bestFeature) {
        addressMatches++;
      }
    }

    // ======================================================
    // 3. MATCHEN OP AFSTAND
    // ======================================================
    //
    // Alleen wanneer OSM geen straat heeft.
    // ======================================================

    if (
      !bestFeature &&
      !osm.address?.street
    ) {
      for (const feature of bagFeatures) {
        if (
          !isActiveBAGObject(feature)
        ) {
          continue;
        }

        const coordinates =
          getBAGCoordinates(
            feature
          );

        if (!coordinates) {
          continue;
        }

        const d =
          distanceMeters(
            osm.latitude,
            osm.longitude,
            coordinates.latitude,
            coordinates.longitude
          );

        if (
          d <= 15 &&
          d < bestDistance
        ) {
          bestDistance =
            d;

          bestFeature =
            feature;
        }
      }

      if (bestFeature) {
        distanceMatches++;
      }
    }

    // ======================================================
    // GEEN BAG-MATCH
    // ======================================================

    if (!bestFeature) {
      continue;
    }

    linked++;

    const bagProperties =
      bestFeature.properties || {};

    const bagAddress =
      getBAGAddress(
        bestFeature
      );

    // ======================================================
    // BAG DATA AAN OSM OBJECT HANGEN
    // ======================================================

    osm.bag = {
      ...bagProperties,

      verblijfsobject_id:
        bagProperties.identificatie ||
        null,
    };

    osm.pand =
      bestFeature.pand ||
      null;

    // ======================================================
    // ONTBREKENDE ADRESGEGEVENS AANVULLEN
    // ======================================================

    if (!osm.address) {
      osm.address = {};
    }

    if (
      !osm.address.street &&
      bagAddress.street
    ) {
      osm.address.street =
        bagAddress.street;
    }

    if (
      !osm.address.housenumber &&
      bagAddress.housenumber
    ) {
      osm.address.housenumber =
        bagAddress.housenumber;
    }

    if (
      !osm.address.postcode &&
      bagAddress.postcode
    ) {
      osm.address.postcode =
        bagAddress.postcode;
    }

    if (
      !osm.address.city &&
      bagAddress.city
    ) {
      osm.address.city =
        bagAddress.city;
    }

    // ======================================================
    // OSM TYPE ALLEEN UPGRADEN ALS HET other_care IS
    // ======================================================

    if (
      osm.type === "other_care"
    ) {
      const bagType =
        getBAGType(
          bestFeature
        );

      if (bagType) {
        osm.type =
          bagType;

        osm.priority =
          priorityForType(
            osm.type
          );
      }
    }
  }

  console.log(
    `OSM/BAG verrijking: ${linked} objecten gekoppeld`
  );

  console.log(
    `BAG directe VO-matches: ${directRefMatches}`
  );

  console.log(
    `BAG directe pand-matches: ${pandRefMatches}`
  );

  console.log(
    `BAG adres-matches: ${addressMatches}`
  );

  console.log(
    `BAG afstand-matches: ${distanceMatches}`
  );
}

// ============================================================
// DUBBELEN VERWIJDEREN
// ============================================================

function removeDuplicates(
  objects
) {
  const sorted =
    [...objects].sort(
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

  const result = [];

  for (const object of sorted) {
    let duplicate =
      false;

    for (const existing of result) {
      const distance =
        distanceMeters(
          object.latitude,
          object.longitude,
          existing.latitude,
          existing.longitude
        );

      if (
        isCareType(
          object.type
        ) ||
        isCareType(
          existing.type
        )
      ) {
        if (
          namesMatch(
            object.name,
            existing.name
          ) &&
          distance <= 30
        ) {
          duplicate = true;
          break;
        }

        if (
          object.source === "BAG" &&
          distance <= 15 &&
          (
            !object.name ||
            object.name === "BAG object"
          )
        ) {
          duplicate = true;
          break;
        }

        if (
          existing.source === "BAG" &&
          distance <= 15 &&
          (
            !existing.name ||
            existing.name === "BAG object"
          )
        ) {
          duplicate = true;
          break;
        }

      } else {
        if (
          distance <= 30
        ) {
          duplicate = true;
          break;
        }
      }

      if (
        distance <= 30 &&
        addressesMatch(
          object.address,
          existing.address
        )
      ) {
        if (
          object.source === "BAG" ||
          existing.source === "BAG"
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

// ============================================================
// API
// ============================================================

app.get(
  "/api/vulnerable-objects",
  async (req, res) => {
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
          req.query.radius || 500
        );

      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        ) ||
        !Number.isFinite(
          radius
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "latitude, longitude en radius moeten geldige getallen zijn.",
          });
      }

      // ------------------------------------------------------
      // OSM / Overpass
      // ------------------------------------------------------

      const elements =
        await queryOverpass(
          latitude,
          longitude,
          radius
        );

      const osmObjects =
        processOSMObjects(
          elements,
          latitude,
          longitude,
          radius
        );

      // ------------------------------------------------------
      // BAG verblijfsobjecten
      // ------------------------------------------------------

      let bagFeatures =
        await queryBAG(
          latitude,
          longitude,
          radius
        );

      // ------------------------------------------------------
      // BAG pandgegevens ophalen
      // ------------------------------------------------------

      bagFeatures =
        await enrichBAGFeaturesWithPand(
          bagFeatures
        );

      // ------------------------------------------------------
      // BAG-objecten maken
      //
      // Alleen BAG-objecten met een herkenbaar type worden
      // zelfstandig toegevoegd aan de lijst.
      // ------------------------------------------------------

      const bagObjects =
        processBAGObjects(
          bagFeatures,
          latitude,
          longitude,
          radius
        );

      // ------------------------------------------------------
      // BAG koppelen aan OSM
      //
      // We gebruiken ALLE BAG-features.
      //
      // Hierdoor werkt ref:bag ook wanneer deze naar
      // een BAG pand verwijst.
      // ------------------------------------------------------

      enrichOSMWithBAG(
        osmObjects,
        bagFeatures
      );

      // ------------------------------------------------------
      // Alles combineren
      // ------------------------------------------------------

      const combined = [
        ...osmObjects,
        ...bagObjects,
      ];

      console.log(
        `Totaal relevante objecten: ${combined.length}`
      );

      const uniqueObjects =
        removeDuplicates(
          combined
        );

      console.log(
        `Na verwijderen duplicaten: ${uniqueObjects.length}`
      );

      res.json(
        uniqueObjects
      );

    } catch (error) {
      console.error(
        "API fout:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Kon kwetsbare objecten niet ophalen.",
        });
    }
  }
);

// ============================================================
// SERVER START
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      `Omgevingsscan backend draait op poort ${PORT}`
    );
  }
);