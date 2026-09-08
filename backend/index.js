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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeStreet(value) {
  return normalizeText(value)
    .replace(/\bstraat\b/g, "")
    .replace(/\bweg\b/g, "")
    .replace(/\blaan\b/g, "")
    .replace(/\bplein\b/g, "")
    .replace(/\bdijk\b/g, "")
    .replace(/\bpad\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHouseNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const match = String(value)
    .trim()
    .match(/^(\d+)/);

  return match ? match[1] : null;
}

function distanceMeters(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371000;

  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) *
      Math.cos(p2) *
      Math.sin(dLon / 2) ** 2;

  return Math.round(
    R *
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      )
  );
}

function getElementCoordinates(element) {
  if (
    element.lat !== undefined &&
    element.lon !== undefined
  ) {
    return {
      latitude: element.lat,
      longitude: element.lon,
    };
  }

  if (element.center) {
    return {
      latitude: element.center.lat,
      longitude: element.center.lon,
    };
  }

  return null;
}

function detectCareTypeFromText(text) {
  const value = normalizeText(text);

  if (
    value.includes("verpleeghuis") ||
    value.includes("verzorgingshuis") ||
    value.includes("woonzorgcentrum") ||
    value.includes("woonzorg") ||
    value.includes("zorgcentrum") ||
    value.includes("woongemeenschap") ||
    value.includes("woonvoorziening") ||
    value.includes("groepswoning") ||
    value.includes("groepswonen") ||
    value.includes("seniorenwoning") ||
    value.includes("senioren") ||
    value.includes("ouderenzorg") ||
    value.includes("bejaardenhuis") ||
    value.includes("ouderen")
  ) {
    return "nursing_home";
  }

  if (
    value.includes("gehandicaptenzorg") ||
    value.includes("gehandicapten") ||
    value.includes("verstandelijk gehandicapten") ||
    value.includes(
      "zorg voor verstandelijk gehandicapten"
    ) ||
    value.includes("disabled") ||
    value.includes("dagbesteding") ||
    value.includes("zorgboerderij")
  ) {
    return "disability_care";
  }

  if (
    value.includes("beschermd wonen") ||
    value.includes("begeleid wonen") ||
    value.includes("begeleide woonvorm") ||
    value.includes("woonbegeleiding")
  ) {
    return "disability_care";
  }

  if (
    value.includes("hospice") ||
    value.includes("palliatieve zorg") ||
    value.includes("palliatieve")
  ) {
    return "hospice";
  }

  if (
    value.includes("ggz") ||
    value.includes(
      "geestelijke gezondheidszorg"
    ) ||
    value.includes("psychiatr") ||
    value.includes("psychiatrisch") ||
    value.includes("psychische zorg") ||
    value.includes("mental health") ||
    value.includes("geestelijke zorg") ||
    value.includes(
      "geestelijke gezondheids"
    ) ||
    value.includes("psychologie") ||
    value.includes("psycholoog")
  ) {
    return "mental_health";
  }

  if (
    value.includes("revalidatie") ||
    value.includes(
      "revalidatiecentrum"
    ) ||
    value.includes(
      "revalidatiekliniek"
    ) ||
    value.includes("rehabilitatie")
  ) {
    return "rehabilitation";
  }

  if (
    value.includes("thuiszorg") ||
    value.includes("wijkverpleging") ||
    value.includes("thuisverpleging") ||
    value.includes("wijkzorg")
  ) {
    return "home_care";
  }

  if (
    value.includes("huisarts") ||
    value.includes(
      "huisartsenpraktijk"
    ) ||
    value.includes("gezondheidscentrum")
  ) {
    return "doctor";
  }

  if (
    value.includes("tandarts") ||
    value.includes(
      "tandartsenpraktijk"
    ) ||
    value.includes("tandzorg") ||
    value.includes("mondzorg") ||
    value.includes(
      "prothesepraktijk"
    )
  ) {
    return "dentist";
  }

  if (
    value.includes("fysiotherapie") ||
    value.includes("fysiotherapeut") ||
    value.includes("fysiopraktijk")
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
    value.includes(
      "kinderdagverblijf"
    ) ||
    value.includes(
      "kinderdagopvang"
    ) ||
    value.includes("dagopvang") ||
    value.includes("peuteropvang") ||
    value.includes("kinderopvang")
  ) {
    return "daycare";
  }

  if (
    value.includes("zorglocatie") ||
    value.includes(
      "zorgvoorziening"
    ) ||
    value.includes(
      "zorginstelling"
    ) ||
    value.includes(
      "zorgorganisatie"
    )
  ) {
    return "other_care";
  }

  return null;
}

function getObjectType(tags = {}) {
  const name = tags.name || "";
  const operator = tags.operator || "";

  const normalizedName =
    normalizeText(name);

  const normalizedOperator =
    normalizeText(operator);

  const socialFacility =
    normalizeText(
      tags.social_facility
    );

  const socialFor =
    normalizeText(
      tags["social_facility:for"]
    );

  const healthcare =
    normalizeText(
      tags.healthcare
    );

  const healthcareSpeciality =
    normalizeText(
      tags["healthcare:speciality"]
    );

  const amenity =
    normalizeText(tags.amenity);

  const building =
    normalizeText(tags.building);

  const tourism =
    normalizeText(tags.tourism);

  const shop =
    normalizeText(tags.shop);

  const leisure =
    normalizeText(tags.leisure);

  /*
   * Specifieke organisaties eerst.
   */

  if (
    normalizedName === "jonx" ||
    (
      normalizedName.includes("jonx") &&
      normalizedOperator.includes(
        "lentis"
      )
    )
  ) {
    return "mental_health";
  }

  if (
    normalizedName === "dignis" ||
    (
      normalizedName.includes("dignis") &&
      normalizedOperator.includes(
        "lentis"
      )
    )
  ) {
    return "nursing_home";
  }

  /*
   * Zorgclassificatie uit naam,
   * healthcare, social_facility en
   * healthcare:speciality.
   */

  const careFromText =
    detectCareTypeFromText(
      `${name} ${socialFacility} ${socialFor} ${healthcare} ${healthcareSpeciality}`
    );

  if (careFromText) {
    return careFromText;
  }

  /*
   * Healthcare.
   */

  if (
    amenity === "hospital" ||
    healthcare === "hospital"
  ) {
    return "hospital";
  }

  if (
    healthcare === "mental_health" ||
    healthcare === "psychologist" ||
    healthcare === "psychiatrist"
  ) {
    return "mental_health";
  }

  if (
    healthcareSpeciality.includes(
      "psychiatr"
    ) ||
    healthcareSpeciality.includes(
      "psycholog"
    )
  ) {
    return "mental_health";
  }

  if (
    amenity === "doctors" ||
    amenity === "doctor" ||
    healthcare === "doctor"
  ) {
    return "doctor";
  }

  if (
    amenity === "dentist" ||
    healthcare === "dentist"
  ) {
    return "dentist";
  }

  if (
    amenity === "pharmacy" ||
    healthcare === "pharmacy"
  ) {
    return "pharmacy";
  }

  if (
    healthcare ===
      "physiotherapist" ||
    healthcare ===
      "physiotherapy"
  ) {
    return "physiotherapy";
  }

  if (
    amenity === "clinic" ||
    healthcare === "clinic"
  ) {
    return "clinic";
  }

  /*
   * Social facilities.
   */

  if (
    amenity ===
    "social_facility"
  ) {
    if (
      socialFacility ===
        "nursing_home" ||
      socialFacility ===
        "assisted_living" ||
      socialFacility ===
        "group_home"
    ) {
      return "nursing_home";
    }

    if (
      socialFor.includes("disabled") ||
      socialFor.includes(
        "disability"
      ) ||
      socialFacility.includes(
        "disabled"
      )
    ) {
      return "disability_care";
    }

    if (
      socialFacility === "hospice"
    ) {
      return "hospice";
    }

    if (
      socialFacility ===
        "day_care" ||
      socialFacility ===
        "daycare"
    ) {
      return "daycare";
    }

    if (
      socialFacility ===
      "rehabilitation"
    ) {
      return "rehabilitation";
    }

    return "other_care";
  }

  /*
   * Onderwijs.
   */

  if (
    amenity === "school" ||
    building === "school" ||
    amenity ===
      "kindergarten"
  ) {
    return "school";
  }

  /*
   * Religieuze gebouwen.
   */

  if (
    amenity ===
    "place_of_worship"
  ) {
    return "place_of_worship";
  }

  /*
   * Buurt- en
   * gemeenschapsvoorzieningen.
   */

  if (
    amenity ===
    "community_centre"
  ) {
    return "community_centre";
  }

  /*
   * Sport.
   */

  if (
    leisure ===
      "sports_centre" ||
    leisure === "stadium"
  ) {
    return "sports";
  }

  /*
   * Hotels.
   */

  if (
    tourism === "hotel" ||
    tourism === "hostel" ||
    tourism ===
      "guest_house"
  ) {
    return "hotel";
  }

  /*
   * Winkels.
   */

  if (
    shop === "supermarket"
  ) {
    return "supermarket";
  }

  if (
    amenity === "marketplace"
  ) {
    return "marketplace";
  }

  return null;
}

function priorityForType(type) {
  const priorities = {
    nursing_home: 1,
    disability_care: 2,
    hospice: 3,
    mental_health: 4,
    rehabilitation: 5,
    home_care: 6,
    hospital: 7,
    clinic: 8,
    doctor: 9,
    pharmacy: 10,
    physiotherapy: 11,
    dentist: 12,
    other_care: 13,
    school: 14,
    daycare: 15,
    place_of_worship: 16,
    community_centre: 17,
    hotel: 18,
    sports: 19,
    supermarket: 20,
    marketplace: 21,
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
    "other_care",
    "hospital",
    "clinic",
    "doctor",
    "dentist",
    "physiotherapy",
    "pharmacy",
  ].includes(type);
}

function namesMatch(
  objectA,
  objectB
) {
  const nameA =
    normalizeText(
      objectA.name
    );

  const nameB =
    normalizeText(
      objectB.name
    );

  if (
    !nameA ||
    !nameB
  ) {
    return false;
  }

  if (
    nameA === nameB
  ) {
    return true;
  }

  /*
   * Wanneer de ene naam volledig in de
   * andere zit, behandelen we dit ook
   * als dezelfde voorziening.
   */

  if (
    nameA.length >= 5 &&
    nameB.length >= 5 &&
    (
      nameA.includes(nameB) ||
      nameB.includes(nameA)
    )
  ) {
    return true;
  }

  return false;
}

function addressesMatch(
  objectA,
  objectB
) {
  const postcodeA =
    normalizeText(
      objectA.address?.postcode
    );

  const postcodeB =
    normalizeText(
      objectB.address?.postcode
    );

  const houseA =
    normalizeHouseNumber(
      objectA.address?.housenumber
    );

  const houseB =
    normalizeHouseNumber(
      objectB.address?.housenumber
    );

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

  const streetA =
    normalizeStreet(
      objectA.address?.street
    );

  const streetB =
    normalizeStreet(
      objectB.address?.street
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

async function queryOverpass(
  latitude,
  longitude,
  radius
) {
  const query = `
[out:json][timeout:30];
(
  nwr(around:${radius},${latitude},${longitude})["amenity"="social_facility"];
  nwr(around:${radius},${latitude},${longitude})["healthcare"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="hospital"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="clinic"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="doctors"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="dentist"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="pharmacy"];
  nwr(around:${radius},${latitude},${longitude})["amenity"="school"];
  nwr(around:${radius},${latitude},${longitude})["building"="school"];
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

  for (
    const server of OVERPASS_SERVERS
  ) {
    try {
      console.log(
        `Overpass proberen: ${server}`
      );

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () =>
            controller.abort(),
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

              Accept:
                "application/json",

              "User-Agent":
                "Omgevingsscan/1.0",
            },

            body:
              `data=${encodeURIComponent(
                query
              )}`,

            signal:
              controller.signal,
          }
        );

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(
          `Overpass HTTP ${response.status}`
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

  const uniqueElements = [];
  const seen = new Set();

  for (
    const element of allElements
  ) {
    const key =
      `${element.type}-${element.id}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    uniqueElements.push(
      element
    );
  }

  console.log(
    `Overpass totaal: ${allElements.length} objecten, ${uniqueElements.length} unieke objecten`
  );

  return uniqueElements;
}

function processOSMObjects(
  elements,
  latitude,
  longitude,
  radius
) {
  const objects = [];

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

    const tags =
      element.tags || {};

    const type =
      getObjectType(tags);

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

    if (
      distance > radius
    ) {
      continue;
    }

    const address = {
      street:
        tags["addr:street"] ||
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
      tags.operator ||
      tags["official_name"] ||
      "Onbekend object";

    let confidence =
      "high";

    if (
      type ===
      "other_care"
    ) {
      confidence =
        "medium";
    }

    objects.push({
      id:
        `osm-${element.type}-${element.id}`,

      name,

      type,

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,

      distance,

      source: "OSM",

      confidence,

      address,

      tags,
    });
  }

  console.log(
    `OSM verwerkt: ${objects.length} relevante objecten`
  );

  return objects;
}

async function queryBAG(
  latitude,
  longitude,
  radius
) {
  const baseUrl =
    "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items";

  const bbox =
    `${longitude - 0.01},` +
    `${latitude - 0.01},` +
    `${longitude + 0.01},` +
    `${latitude + 0.01}`;

  let url =
    `${baseUrl}?f=json` +
    `&limit=1000` +
    `&bbox=${bbox}`;

  const allFeatures = [];

  let page = 1;

  try {
    console.log(
      "BAG proberen..."
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

      if (page > 20) {
        console.log(
          "BAG veiligheidslimiet van 20 pagina's bereikt."
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

function isActiveBAGObject(
  feature
) {
  const status =
    normalizeText(
      feature.properties?.status
    );

  if (!status) {
    return true;
  }

  if (
    status.includes(
      "ingetrokken"
    ) ||
    status.includes(
      "buiten gebruik"
    ) ||
    status.includes(
      "verbouwing"
    ) ||
    status.includes(
      "ten onrechte"
    ) ||
    status.includes(
      "niet gerealiseerd"
    )
  ) {
    return false;
  }

  return true;
}

function getBAGType(
  feature
) {
  const properties =
    feature.properties || {};

  const usage =
    normalizeText(
      properties.gebruiksdoel
    );

  if (!usage) {
    return null;
  }

  if (
    usage.includes(
      "onderwijsfunctie"
    )
  ) {
    return "school";
  }

  if (
    usage.includes(
      "sportfunctie"
    )
  ) {
    return "sports";
  }

  if (
    usage.includes(
      "logiesfunctie"
    )
  ) {
    return "hotel";
  }

  if (
    usage.includes(
      "bijeenkomstfunctie"
    )
  ) {
    const text =
      normalizeText(
        `${properties.openbare_ruimte_naam || ""} ` +
        `${properties.woonplaats_naam || ""} ` +
        `${properties.identificatie || ""}`
      );

    if (
      text.includes("kerk") ||
      text.includes("moskee") ||
      text.includes("synagoge") ||
      text.includes("buurthuis") ||
      text.includes("wijkcentrum") ||
      text.includes("dorpshuis")
    ) {
      return "place_of_worship";
    }
  }

  return null;
}

function processBAGObjects(
  features,
  latitude,
  longitude,
  radius
) {
  const objects = [];

  for (
    const feature of features
  ) {
    if (
      !isActiveBAGObject(
        feature
      )
    ) {
      continue;
    }

    const type =
      getBAGType(feature);

    if (!type) {
      continue;
    }

    const geometry =
      feature.geometry;

    if (!geometry) {
      continue;
    }

    let coordinates =
      null;

    if (
      geometry.type ===
        "Point" &&
      Array.isArray(
        geometry.coordinates
      )
    ) {
      coordinates = {
        longitude:
          geometry.coordinates[0],

        latitude:
          geometry.coordinates[1],
      };
    }

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

    const properties =
      feature.properties || {};

    const street =
      properties.openbare_ruimte_naam ||
      null;

    const housenumber =
      properties.huisnummer ??
      null;

    const houseLetter =
      properties.huisletter ||
      null;

    const postcode =
      properties.postcode ||
      null;

    const city =
      properties.woonplaats_naam ||
      null;

    const addressName =
      `${street || ""} ${housenumber || ""}${houseLetter || ""}`.trim();

    objects.push({
      id:
        `bag-${
          properties.identificatie ||
          Math.random()
        }`,

      name:
        addressName ||
        "BAG object",

      type,

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,

      distance,

      source: "BAG",

      confidence: "medium",

      address: {
        street,

        housenumber,

        houseLetter,

        addition:
          properties.toevoeging ||
          null,

        postcode,

        city,
      },

      bag: properties,
    });
  }

  console.log(
    `BAG verwerkt: ${objects.length} relevante objecten`
  );

  return objects;
}

function enrichOSMWithBAG(
  osmObjects,
  bagObjects
) {
  let enriched = 0;

  for (
    const osm of osmObjects
  ) {
    let bestMatch =
      null;

    let bestDistance =
      Infinity;

    for (
      const bag of bagObjects
    ) {
      if (
        addressesMatch(
          osm,
          bag
        )
      ) {
        const d =
          distanceMeters(
            osm.latitude,
            osm.longitude,
            bag.latitude,
            bag.longitude
          );

        if (
          d < bestDistance
        ) {
          bestDistance = d;
          bestMatch = bag;
        }
      }
    }

    if (
      !bestMatch &&
      !osm.address?.street &&
      !osm.address?.housenumber
    ) {
      for (
        const bag of bagObjects
      ) {
        const d =
          distanceMeters(
            osm.latitude,
            osm.longitude,
            bag.latitude,
            bag.longitude
          );

        if (
          d <= 15 &&
          d < bestDistance
        ) {
          bestDistance = d;
          bestMatch = bag;
        }
      }
    }

    if (bestMatch) {
      enriched++;

      osm.bag =
        bestMatch.bag;

      if (
        !osm.address?.street
      ) {
        osm.address.street =
          bestMatch.address.street;
      }

      if (
        !osm.address?.housenumber
      ) {
        osm.address.housenumber =
          bestMatch.address.housenumber;
      }

      if (
        !osm.address?.postcode
      ) {
        osm.address.postcode =
          bestMatch.address.postcode;
      }

      if (
        !osm.address?.city
      ) {
        osm.address.city =
          bestMatch.address.city;
      }

      if (
        osm.type ===
          "other_care" &&
        bestMatch.type !==
          "other_care"
      ) {
        osm.type =
          bestMatch.type;
      }
    }
  }

  console.log(
    `OSM/BAG verrijking: ${enriched} objecten gekoppeld`
  );

  return osmObjects;
}

function removeDuplicates(
  objects
) {
  const result = [];

  const sorted =
    [...objects].sort(
      (a, b) => {
        const priorityDiff =
          priorityForType(a.type) -
          priorityForType(b.type);

        if (
          priorityDiff !== 0
        ) {
          return priorityDiff;
        }

        if (
          a.source !== b.source
        ) {
          return a.source ===
            "OSM"
            ? -1
            : 1;
        }

        return (
          a.distance -
          b.distance
        );
      }
    );

  for (
    const object of sorted
  ) {
    let duplicate =
      false;

    for (
      const existing of result
    ) {
      if (
        object.type !==
        existing.type
      ) {
        continue;
      }

      const d =
        distanceMeters(
          object.latitude,
          object.longitude,
          existing.latitude,
          existing.longitude
        );

      /*
       * Bij zorgobjecten zijn meerdere
       * verschillende organisaties op
       * dezelfde locatie mogelijk.
       *
       * Daarom verwijderen we daar niet
       * meer blind op basis van afstand.
       */

      if (
        isCareType(object.type)
      ) {
        /*
         * Exact dezelfde naam = vrijwel
         * zeker dezelfde voorziening.
         */

        if (
          namesMatch(
            object,
            existing
          )
        ) {
          duplicate = true;
          break;
        }

        /*
         * BAG-objecten zonder echte naam
         * mogen een OSM-object op dezelfde
         * locatie niet dubbel weergeven.
         */

        if (
          object.source === "BAG" &&
          existing.source === "OSM" &&
          (
            object.name ===
              "BAG object" ||
            !object.name
          ) &&
          d <= 25
        ) {
          duplicate = true;
          break;
        }

        /*
         * Als beide objecten exact hetzelfde
         * adres hebben én één van beide geen
         * bruikbare naam heeft, beschouwen we
         * ze als hetzelfde object.
         */

        if (
          d <= 25 &&
          addressesMatch(
            object,
            existing
          ) &&
          (
            object.name ===
              "Onbekend object" ||
            existing.name ===
              "Onbekend object" ||
            object.name ===
              "BAG object" ||
            existing.name ===
              "BAG object"
          )
        ) {
          duplicate = true;
          break;
        }

        /*
         * Verschillende benoemde zorgobjecten
         * op dezelfde locatie blijven dus
         * bewust behouden.
         */

        continue;
      }

      /*
       * Voor niet-zorgobjecten blijft de
       * oorspronkelijke afstandscontrole
       * bestaan.
       */

      const maxDistance =
        30;

      if (
        d <= maxDistance
      ) {
        duplicate = true;
        break;
      }
    }

    if (!duplicate) {
      result.push(
        object
      );
    }
  }

  return result.sort(
    (a, b) => {
      const priorityDiff =
        priorityForType(a.type) -
        priorityForType(b.type);

      if (
        priorityDiff !== 0
      ) {
        return priorityDiff;
      }

      return (
        a.distance -
        b.distance
      );
    }
  );
}

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

      const bagFeatures =
        await queryBAG(
          latitude,
          longitude,
          radius
        );

      const bagObjects =
        processBAGObjects(
          bagFeatures,
          latitude,
          longitude,
          radius
        );

      enrichOSMWithBAG(
        osmObjects,
        bagObjects
      );

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

app.listen(
  PORT,
  () => {
    console.log(
      `Omgevingsscan backend draait op poort ${PORT}`
    );
  }
);