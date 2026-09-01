const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// ---------------------------------------------------------
// Afstand tussen twee coordinaten in meters
// ---------------------------------------------------------
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------
// Type bepalen
// ---------------------------------------------------------
function getObjectType(tags = {}) {
  // Zorginstellingen / maatschappelijke voorzieningen
  if (tags.social_facility) {
    return tags.social_facility;
  }

  // Zorg via amenity=clinic/hospital/etc.
  if (tags.amenity === "hospital") {
    return "hospital";
  }

  if (tags.amenity === "clinic") {
    return "clinic";
  }

  if (tags.amenity === "doctors") {
    return "doctor";
  }

  if (tags.amenity === "pharmacy") {
    return "pharmacy";
  }

  if (tags.amenity === "school") {
    return "school";
  }

  if (tags.amenity === "kindergarten") {
    return "kindergarten";
  }

  if (tags.amenity === "place_of_worship") {
    return "church";
  }

  if (tags.amenity === "community_centre") {
    return "community";
  }

  if (tags.tourism === "hotel") {
    return "hotel";
  }

  if (tags.shop === "supermarket") {
    return "supermarket";
  }

  if (tags.amenity === "social_facility") {
    return "care_facility";
  }

  if (tags.shop) {
    return "shop";
  }

  return null;
}

// ---------------------------------------------------------
// Naam bepalen
// ---------------------------------------------------------
function getObjectName(tags = {}) {
  return (
    tags.name ||
    tags["official_name"] ||
    tags["alt_name"] ||
    tags["short_name"] ||
    "Onbekende locatie"
  );
}

// ---------------------------------------------------------
// Overpass query
// ---------------------------------------------------------
function buildOverpassQuery(latitude, longitude, radius) {
  return `
[out:json][timeout:50];

(
  // -------------------------------------------------------
  // Alle social facilities
  // Hiermee pakken we o.a.:
  // group_home
  // assisted_living
  // nursing_home
  // outreach
  // workshop
  // shelter
  // etc.
  // -------------------------------------------------------
  nwr["amenity"="social_facility"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Ziekenhuizen
  // -------------------------------------------------------
  nwr["amenity"="hospital"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Klinieken
  // -------------------------------------------------------
  nwr["amenity"="clinic"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Huisartsen / dokters
  // -------------------------------------------------------
  nwr["amenity"="doctors"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Apotheken
  // -------------------------------------------------------
  nwr["amenity"="pharmacy"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Scholen
  // -------------------------------------------------------
  nwr["amenity"="school"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Kinderopvang
  // -------------------------------------------------------
  nwr["amenity"="kindergarten"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Kerken / gebedshuizen
  // -------------------------------------------------------
  nwr["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Buurt- en gemeenschapscentra
  // -------------------------------------------------------
  nwr["amenity"="community_centre"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Supermarkten
  // -------------------------------------------------------
  nwr["shop"="supermarket"](around:${radius},${latitude},${longitude});

  // -------------------------------------------------------
  // Hotels
  // -------------------------------------------------------
  nwr["tourism"="hotel"](around:${radius},${latitude},${longitude});
);

out center tags;
`;
}

// ---------------------------------------------------------
// Overpass ophalen
// ---------------------------------------------------------
async function queryOverpass(query) {
  let lastError = null;

  for (const url of OVERPASS_URLS) {
    try {
      console.log(`Overpass proberen: ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "Omgevingsscan/1.0",
        },
        body: new URLSearchParams({
          data: query,
        }).toString(),
      });

      const text = await response.text();

      console.log(`Overpass status: ${response.status}`);

      if (!response.ok) {
        lastError = new Error(
          `Overpass HTTP ${response.status}: ${text.substring(0, 300)}`
        );
        continue;
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch (error) {
        lastError = new Error(
          `Overpass gaf geen JSON terug: ${text.substring(0, 300)}`
        );
        continue;
      }

      if (!data || !Array.isArray(data.elements)) {
        lastError = new Error("Ongeldig Overpass antwoord");
        continue;
      }

      return data;
    } catch (error) {
      console.error(`Overpass fout bij ${url}:`, error.message);
      lastError = error;
    }
  }

  throw lastError || new Error("Geen Overpass-server beschikbaar");
}

// ---------------------------------------------------------
// Vulnerable objects API
// ---------------------------------------------------------
app.get("/api/vulnerable-objects", async (req, res) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const radius = Number(req.query.radius || 500);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        error: "Ongeldige latitude of longitude",
      });
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      return res.status(400).json({
        error: "Ongeldige radius",
      });
    }

    console.log(
      `Omgevingsscan: lat=${latitude}, lon=${longitude}, radius=${radius}m`
    );

    const query = buildOverpassQuery(latitude, longitude, radius);

    const data = await queryOverpass(query);

    const objects = [];

    for (const element of data.elements) {
      const tags = element.tags || {};

      const type = getObjectType(tags);

      if (!type) {
        continue;
      }

      let objectLatitude = null;
      let objectLongitude = null;

      // Node
      if (
        element.type === "node" &&
        Number.isFinite(element.lat) &&
        Number.isFinite(element.lon)
      ) {
        objectLatitude = element.lat;
        objectLongitude = element.lon;
      }

      // Way / relation met center
      if (
        element.center &&
        Number.isFinite(element.center.lat) &&
        Number.isFinite(element.center.lon)
      ) {
        objectLatitude = element.center.lat;
        objectLongitude = element.center.lon;
      }

      if (
        !Number.isFinite(objectLatitude) ||
        !Number.isFinite(objectLongitude)
      ) {
        continue;
      }

      // Extra veiligheidscontrole op afstand
      const distance = distanceMeters(
        latitude,
        longitude,
        objectLatitude,
        objectLongitude
      );

      if (distance > radius) {
        continue;
      }

      objects.push({
        id: `${element.type}-${element.id}`,
        name: getObjectName(tags),
        type,
        latitude: objectLatitude,
        longitude: objectLongitude,
      });
    }

    // -------------------------------------------------------
    // Dubbelen verwijderen
    // -------------------------------------------------------
    const uniqueObjects = Array.from(
      new Map(objects.map((object) => [object.id, object])).values()
    );

    // -------------------------------------------------------
    // Sorteer op afstand vanaf incident
    // -------------------------------------------------------
    uniqueObjects.sort((a, b) => {
      const distanceA = distanceMeters(
        latitude,
        longitude,
        a.latitude,
        a.longitude
      );

      const distanceB = distanceMeters(
        latitude,
        longitude,
        b.latitude,
        b.longitude
      );

      return distanceA - distanceB;
    });

    console.log(
      `Aantal gevonden objecten: ${uniqueObjects.length}`
    );

    return res.json(uniqueObjects);
  } catch (error) {
    console.error("Vulnerable objects fout:", error);

    return res.status(500).json({
      error: "Geen geldig antwoord van Overpass",
      details: error.message,
    });
  }
});

// ---------------------------------------------------------
// Health check
// ---------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "omgevingsscan-backend",
  });
});

// ---------------------------------------------------------
// Server starten
// ---------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Backend draait op http://localhost:${PORT}`);
});