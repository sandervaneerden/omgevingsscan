const express = require("express");
const cors = require("cors");
const dns = require("dns");

// Geef IPv4 voorrang.
// Dit voorkomt dat Node fetch blijft hangen op een IPv6-route
// die in Codespaces mogelijk niet goed werkt.
dns.setDefaultResultOrder("ipv4first");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

/*
 * =========================
 * OVERPASS SERVERS
 * =========================
 */

const OVERPASS_SERVERS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

/*
 * =========================
 * AFSTAND BEREKENEN
 * =========================
 */

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const toRad = (value) =>
    (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

/*
 * =========================
 * NAAM OBJECT
 * =========================
 */

function getObjectName(tags = {}) {
  return (
    tags.name ||
    tags["name:nl"] ||
    tags.operator ||
    tags.brand ||
    "Onbekende locatie"
  );
}

/*
 * =========================
 * OBJECT TYPE
 * =========================
 */

function getObjectType(tags = {}) {
  const amenity = String(
    tags.amenity || ""
  ).toLowerCase();

  const healthcare = String(
    tags.healthcare || ""
  ).toLowerCase();

  const socialFacility = String(
    tags.social_facility || ""
  ).toLowerCase();

  const socialFor = String(
    tags["social_facility:for"] || ""
  ).toLowerCase();

  const shop = String(
    tags.shop || ""
  ).toLowerCase();

  const tourism = String(
    tags.tourism || ""
  ).toLowerCase();

  const schoolType = String(
    tags["school:type"] || ""
  ).toLowerCase();

  const schoolSpecialNeeds = String(
    tags["school:special_needs"] || ""
  ).toLowerCase();

  const education = String(
    tags.education || ""
  ).toLowerCase();

  const description = String(
    tags.description || ""
  ).toLowerCase();

  const name = String(
    tags.name || ""
  ).toLowerCase();

  /*
   * =========================
   * ZORG
   * =========================
   */

  if (amenity === "hospital") {
    return "hospital";
  }

  if (amenity === "clinic") {
    return "clinic";
  }

  if (
    healthcare === "psychiatry" ||
    healthcare === "mental_health" ||
    healthcare === "psychology" ||
    socialFacility === "mental_health"
  ) {
    return "mental_health";
  }

  if (
    socialFacility === "nursing_home" ||
    healthcare === "nursing_home"
  ) {
    return "nursing_home";
  }

  if (
    socialFacility === "care_home" ||
    healthcare === "care_home"
  ) {
    return "care_home";
  }

  if (
    socialFacility === "assisted_living" ||
    socialFacility === "residential_care"
  ) {
    return "assisted_living";
  }

  if (
    socialFacility === "group_home" ||
    socialFacility === "group_home_for_disabled"
  ) {
    return "group_home";
  }

  if (
    socialFacility === "hospice" ||
    healthcare === "hospice"
  ) {
    return "hospice";
  }

  if (
    socialFacility === "disability_care" ||
    (
      socialFacility === "workshop" &&
      (
        socialFor.includes("disabled") ||
        socialFor.includes("disability")
      )
    )
  ) {
    return "disability_care";
  }

  if (
    socialFacility === "day_care" ||
    socialFacility === "daycare"
  ) {
    return "day_care";
  }

  if (
    socialFacility === "shelter" ||
    socialFacility === "refugee_shelter" ||
    socialFacility === "homeless_shelter"
  ) {
    return "shelter";
  }

  if (
    socialFacility === "ambulatory_care" ||
    socialFacility === "outreach"
  ) {
    return "home_care";
  }

  if (
    socialFacility === "care" ||
    socialFacility === "social_service" ||
    socialFacility === "social_centre"
  ) {
    return "other_care";
  }

  /*
   * =========================
   * ONDERWIJS
   * =========================
   */

  if (amenity === "school") {
    const isSpecialEducation =
      schoolSpecialNeeds === "only" ||
      schoolSpecialNeeds.includes("special") ||
      schoolType === "special" ||
      schoolType === "special_education" ||
      education === "special" ||
      education === "special_education" ||
      description.includes("speciaal onderwijs") ||
      description.includes(
        "voortgezet speciaal onderwijs"
      ) ||
      description.includes(
        "speciaal basisonderwijs"
      ) ||
      description.includes(
        "praktijkonderwijs"
      ) ||
      name.includes(
        "speciaal onderwijs"
      );

    if (isSpecialEducation) {
      return "special_school";
    }

    return "school";
  }

  /*
   * Kinderopvang
   */

  if (
    amenity === "kindergarten" ||
    amenity === "childcare" ||
    socialFacility === "child_daycare"
  ) {
    return "kindergarten";
  }

  /*
   * =========================
   * MAATSCHAPPELIJK
   * =========================
   */

  if (amenity === "place_of_worship") {
    return "church";
  }

  /*
   * Sportverenigingen blijven
   * onderdeel van de resultaten.
   */

  if (
    amenity === "community_centre" ||
    amenity === "social_centre"
  ) {
    return "community";
  }

  /*
   * =========================
   * OVERIG
   * =========================
   */

  if (
    tourism === "hotel" ||
    tourism === "hostel"
  ) {
    return "hotel";
  }

  if (shop === "supermarket") {
    return "supermarket";
  }

  if (
    shop === "mall" ||
    amenity === "shopping_centre"
  ) {
    return "shopping_centre";
  }

  if (
    amenity === "marketplace" ||
    shop === "marketplace"
  ) {
    return "marketplace";
  }

  /*
   * Algemene winkels worden voorlopig
   * nog NIET meegenomen.
   */

  return null;
}

/*
 * =========================
 * PRIORITEIT
 * =========================
 */

function getPriority(type) {
  const priorities = {
    hospital: 1,

    nursing_home: 2,
    care_home: 3,
    assisted_living: 4,
    group_home: 5,
    disability_care: 6,
    mental_health: 7,
    hospice: 8,
    clinic: 9,
    home_care: 10,
    other_care: 11,
    shelter: 12,

    special_school: 20,
    school: 21,
    kindergarten: 22,

    church: 30,
    community: 31,

    hotel: 40,
    supermarket: 41,
    shopping_centre: 42,
    marketplace: 43,
  };

  return priorities[type] || 99;
}

/*
 * =========================
 * OVERPASS QUERY
 * =========================
 */

async function queryOverpass(query) {
  let lastError = null;

  for (const server of OVERPASS_SERVERS) {
    const controller =
      new AbortController();

    // Maximaal 15 seconden wachten
    // op één Overpass-server.
    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      console.log(
        `Overpass proberen: ${server}`
      );

      /*
       * Zelfde POST-formaat als de werkende curl.
       */

      const body =
        new URLSearchParams({
          data: query,
        }).toString();

      const response = await fetch(
        server,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",

            "User-Agent":
              "Omgevingsscan/1.0",
          },

          body,

          signal:
            controller.signal,
        }
      );

      /*
       * Timeout stoppen zodra er antwoord is.
       */

      clearTimeout(timeout);

      /*
       * Server geeft bijvoorbeeld 429,
       * 406, 502 of 504.
       */

      if (!response.ok) {
        const error =
          new Error(
            `Overpass HTTP ${response.status}`
          );

        console.error(
          `Overpass fout bij ${server}: ${error.message}`
        );

        lastError = error;

        continue;
      }

      const data =
        await response.json();

      console.log(
        `Overpass succesvol: ${server}`
      );

      return data;
    } catch (error) {
      clearTimeout(timeout);

      if (
        error.name ===
        "AbortError"
      ) {
        console.error(
          `Overpass timeout bij ${server}`
        );

        lastError =
          new Error(
            `Overpass timeout bij ${server}`
          );
      } else {
        console.error(
          `Overpass fout bij ${server}:`,
          error.message
        );

        lastError = error;
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "Alle Overpass servers mislukt"
    )
  );
}

/*
 * =========================
 * VULNERABLE OBJECTS API
 * =========================
 */

app.get(
  "/api/vulnerable-objects",
  async (req, res) => {
    try {
      const latitude = Number(
        req.query.latitude
      );

      const longitude = Number(
        req.query.longitude
      );

      const radius = Number(
        req.query.radius || 500
      );

      /*
       * =========================
       * CONTROLE INVOER
       * =========================
       */

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return res.status(400).json({
          error:
            "latitude en longitude zijn verplicht",
        });
      }

      if (
        !Number.isFinite(radius) ||
        radius <= 0
      ) {
        return res.status(400).json({
          error:
            "radius moet groter zijn dan 0",
        });
      }

      /*
       * =========================
       * OVERPASS QUERY
       * =========================
       */

      const query = `
        [out:json][timeout:50];

        (
          /*
           * ZORG
           */

          nwr["social_facility"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["amenity"="hospital"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["amenity"="clinic"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["healthcare"="psychiatry"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["healthcare"="mental_health"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["healthcare"="psychology"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          /*
           * ONDERWIJS
           */

          nwr["amenity"="school"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["amenity"="kindergarten"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["amenity"="childcare"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          /*
           * MAATSCHAPPELIJK
           */

          nwr["amenity"="place_of_worship"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["amenity"="community_centre"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["amenity"="social_centre"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          /*
           * OVERIG
           */

          nwr["tourism"="hotel"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["tourism"="hostel"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["shop"="supermarket"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["shop"="mall"](
            around:${radius},
            ${latitude},
            ${longitude}
          );

          nwr["amenity"="marketplace"](
            around:${radius},
            ${latitude},
            ${longitude}
          );
        );

        out center tags;
      `;

      const data =
        await queryOverpass(query);

      const objects = [];

      /*
       * =========================
       * RESULTATEN VERWERKEN
       * =========================
       */

      for (
        const element of
          data.elements || []
      ) {
        const tags =
          element.tags || {};

        const type =
          getObjectType(tags);

        /*
         * Niet relevant.
         */

        if (!type) {
          continue;
        }

        let objectLatitude = null;
        let objectLongitude = null;

        /*
         * NODE
         */

        if (
          element.type === "node" &&
          Number.isFinite(element.lat) &&
          Number.isFinite(element.lon)
        ) {
          objectLatitude =
            element.lat;

          objectLongitude =
            element.lon;
        }

        /*
         * WAY / RELATION
         */

        else if (
          element.center &&
          Number.isFinite(
            element.center.lat
          ) &&
          Number.isFinite(
            element.center.lon
          )
        ) {
          objectLatitude =
            element.center.lat;

          objectLongitude =
            element.center.lon;
        }

        /*
         * Geen bruikbare positie.
         */

        if (
          !Number.isFinite(
            objectLatitude
          ) ||
          !Number.isFinite(
            objectLongitude
          )
        ) {
          continue;
        }

        /*
         * =========================
         * AFSTAND
         * =========================
         */

        const distance =
          distanceMeters(
            latitude,
            longitude,
            objectLatitude,
            objectLongitude
          );

        /*
         * Extra radiuscontrole.
         */

        if (distance > radius) {
          continue;
        }

        objects.push({
          id:
            `${element.type}-${element.id}`,

          name:
            getObjectName(tags),

          type,

          latitude:
            objectLatitude,

          longitude:
            objectLongitude,

          distance:
            Math.round(distance),

          tags,
        });
      }

      /*
       * =========================
       * DUBBELE OBJECTEN VERWIJDEREN
       * =========================
       */

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

      /*
       * =========================
       * SORTEREN
       * =========================
       */

      uniqueObjects.sort(
        (a, b) => {
          const priorityDifference =
            getPriority(a.type) -
            getPriority(b.type);

          if (
            priorityDifference !== 0
          ) {
            return priorityDifference;
          }

          return (
            a.distance -
            b.distance
          );
        }
      );

      /*
       * =========================
       * RESPONSE
       * =========================
       */

      res.json(uniqueObjects);
    } catch (error) {
      console.error(
        "Fout bij vulnerable-objects:",
        error
      );

      res.status(500).json({
        error:
          "Kon kwetsbare/relevante objecten niet ophalen",

        details:
          error.message,
      });
    }
  }
);

/*
 * =========================
 * HEALTH CHECK
 * =========================
 */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "ok",
    });
  }
);

/*
 * =========================
 * SERVER START
 * =========================
 */

app.listen(
  PORT,
  () => {
    console.log(
      `Omgevingsscan backend draait op poort ${PORT}`
    );
  }
);