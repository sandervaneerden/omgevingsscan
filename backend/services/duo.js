const DUO_API_URL =
  "https://onderwijsdata.duo.nl/api/3/action/datastore_search";

const PDOK_API_URL =
  "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

const DUO_RESOURCES = {
  po: "dcc9c9a5-6d01-410b-967f-810557588ba4",
  vo: "5187f8d5-ff9c-4284-8e06-4311f0354956",
  mbo: "1a946297-a7ca-48d5-9ae8-19ad73bf8176",
  so: "8f0f1639-712d-4adb-bb59-cabd43730dc8",
};

const PAGE_SIZE = 5000;
const REQUEST_TIMEOUT_MS = 30000;

function firstNonEmpty(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return String(value).trim();
    }
  }

  return null;
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function classifyEducation(record, dataset) {
  const text = normalizeText(
    [
      record["ONDERWIJSSTRUCTUUR"],
      record["ONDERWIJSSOORT"],
      record["SOORT ONDERWIJS"],
      record["ONDERWIJSTYPE"],
      record["MBO INSTELLINGSSOORT - NAAM"],
      record["MBO INSTELLINGSSOORT"],
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (
    text.includes("speciaal basisonderwijs") ||
    text === "sbo"
  ) {
    return "special_primary_school";
  }

  if (
    text.includes("voortgezet speciaal onderwijs") ||
    text === "vso"
  ) {
    return "special_secondary_school";
  }

  if (
    text === "so" ||
    text.includes("speciaal onderwijs")
  ) {
    return "special_school";
  }

  if (
    text.includes("basisonderwijs") ||
    text === "po"
  ) {
    return "primary_school";
  }

  if (
    text.includes("voortgezet onderwijs") ||
    text === "vo"
  ) {
    return "secondary_school";
  }

  if (
    dataset === "mbo" ||
    text.includes("middelbaar beroepsonderwijs")
  ) {
    return "mbo";
  }

  if (dataset === "so") {
    return "special_school";
  }

  if (dataset === "vo") {
    return "secondary_school";
  }

  return "primary_school";
}

function normalizeRecord(record, dataset) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const name = firstNonEmpty(
    record["VESTIGINGSNAAM"],
    record["INSTELLINGSNAAM"],
    record["SCHOOLNAAM"],
    record["NAAM"]
  );

  const street = firstNonEmpty(
    record["STRAATNAAM"]
  );

  const houseNumber = firstNonEmpty(
    record["HUISNUMMER-TOEVOEGING"]
  );

  const postcode = firstNonEmpty(
    record["POSTCODE"]
  );

  const city = firstNonEmpty(
    record["PLAATSNAAM"]
  );

  if (!name && !street && !postcode) {
    return null;
  }

  return {
    name:
      name ||
      "Onbekende onderwijsinstelling",

    type: classifyEducation(
      record,
      dataset
    ),

    street,
    houseNumber,
    postcode,
    city,

    source: "DUO",
    confidence: "high",

    duo: {
      instellingCode:
        record["INSTELLINGSCODE"] ||
        null,

      vestigingCode:
        record["VESTIGINGSCODE"] ||
        null,

      bevoegdGezag:
        record["BEVOEGD GEZAG NUMMER"] ||
        null,

      denomination:
        record["DENOMINATIE"] ||
        null,

      website:
        record["INTERNETADRES"] ||
        null,
    },

    raw: record,
  };
}

async function fetchDuoPage(
  resourceId,
  offset
) {
  const url = new URL(
    DUO_API_URL
  );

  url.searchParams.set(
    "resource_id",
    resourceId
  );

  url.searchParams.set(
    "limit",
    String(PAGE_SIZE)
  );

  url.searchParams.set(
    "offset",
    String(offset)
  );

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response =
      await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept:
            "application/json",
        },
      });

    if (!response.ok) {
      throw new Error(
        `DUO HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (
      !data.success ||
      !data.result
    ) {
      throw new Error(
        "DUO gaf geen geldig resultaat terug."
      );
    }

    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllDuoRecords(
  resourceId,
  dataset
) {
  const allRecords = [];
  let offset = 0;

  while (true) {
    console.log(
      `DUO ${dataset}: records ${offset} t/m ${
        offset + PAGE_SIZE - 1
      } ophalen...`
    );

    const result =
      await fetchDuoPage(
        resourceId,
        offset
      );

    const records =
      Array.isArray(result.records)
        ? result.records
        : [];

    allRecords.push(
      ...records
    );

    console.log(
      `DUO ${dataset}: ${records.length} records ontvangen`
    );

    if (
      records.length < PAGE_SIZE
    ) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return allRecords;
}

async function loadDuoDataset(
  dataset
) {
  const resourceId =
    DUO_RESOURCES[dataset];

  if (!resourceId) {
    throw new Error(
      `Onbekende DUO-dataset: ${dataset}`
    );
  }

  console.log(
    `DUO ${dataset} ophalen...`
  );

  const records =
    await fetchAllDuoRecords(
      resourceId,
      dataset
    );

  console.log(
    `DUO ${dataset}: totaal ${records.length} records`
  );

  return records
    .map((record) =>
      normalizeRecord(
        record,
        dataset
      )
    )
    .filter(Boolean);
}

async function loadDuoSchools() {
  const datasets = [];

  for (
    const dataset of [
      "po",
      "so",
      "vo",
      "mbo",
    ]
  ) {
    try {
      const records =
        await loadDuoDataset(
          dataset
        );

      datasets.push(
        ...records
      );
    } catch (error) {
      console.error(
        `DUO ${dataset} fout:`,
        error.message
      );
    }
  }

  const unique = [];
  const seen = new Set();

  for (const record of datasets) {
    const key = [
      normalizeText(
        record.name
      ),
      normalizeText(
        record.street
      ),
      normalizeText(
        record.houseNumber
      ),
      normalizeText(
        record.postcode
      ),
      normalizeText(
        record.city
      ),
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(record);
  }

  console.log(
    `DUO totaal unieke locaties: ${unique.length}`
  );

  return unique;
}

function buildAddress(record) {
  if (!record) {
    return null;
  }

  return [
    record.street,
    record.houseNumber,
    record.postcode,
    record.city,
  ]
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    )
    .join(" ")
    .trim();
}


/*
 * ---------------------------------------------------------
 * PDOK GEOCODING
 * ---------------------------------------------------------
 */

async function geocodeAddress(
  address
) {
  if (!address) {
    return null;
  }

  const url = new URL(
    PDOK_API_URL
  );

  url.searchParams.set(
    "q",
    address
  );

  url.searchParams.set(
    "rows",
    "1"
  );

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response =
      await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept:
            "application/json",
        },
      });

    if (!response.ok) {
      throw new Error(
        `PDOK HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    const docs =
      data?.response?.docs;

    if (
      !Array.isArray(docs) ||
      docs.length === 0
    ) {
      return null;
    }

    const result =
      docs[0];

    /*
     * PDOK geeft bijvoorbeeld:
     *
     * POINT(7.02531333 53.16466026)
     *
     * Dus:
     * longitude = eerste waarde
     * latitude  = tweede waarde
     */

    const point =
      result.centroide_ll;

    if (
      typeof point !== "string"
    ) {
      return null;
    }

    const match =
      point.match(
        /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i
      );

    if (!match) {
      return null;
    }

    const longitude =
      Number(match[1]);

    const latitude =
      Number(match[2]);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    return {
      latitude,
      longitude,

      pdok: {
        weergavenaam:
          result.weergavenaam ||
          null,

        adresseerbaarObjectId:
          result.adresseerbaarobject_id ||
          null,

        identificatie:
          result.identificatie ||
          null,

        type:
          result.type ||
          null,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}


/*
 * Geocode één DUO-record.
 *
 * We bewaren het originele DUO-adres én
 * voegen latitude/longitude toe.
 */

async function geocodeDuoRecord(
  record
) {
  const address =
    buildAddress(record);

  if (!address) {
    return {
      ...record,
      latitude: null,
      longitude: null,
      geocodeStatus: "no_address",
    };
  }

  try {
    const location =
      await geocodeAddress(
        address
      );

    if (!location) {
      return {
        ...record,
        latitude: null,
        longitude: null,
        geocodeStatus: "not_found",
        geocodeAddress: address,
      };
    }

    return {
      ...record,

      latitude:
        location.latitude,

      longitude:
        location.longitude,

      geocodeStatus: "success",

      geocodeAddress:
        address,

      pdok:
        location.pdok,
    };
  } catch (error) {
    console.error(
      `PDOK fout voor ${address}:`,
      error.message
    );

    return {
      ...record,
      latitude: null,
      longitude: null,
      geocodeStatus: "error",
      geocodeAddress: address,
      geocodeError: error.message,
    };
  }
}


/*
 * Geocode een beperkt aantal DUO-records.
 *
 * Deze functie gebruiken we eerst voor testen.
 * Later kunnen we een volledige importfunctie
 * maken die alle 8.645 locaties verwerkt.
 */

async function geocodeDuoSchools(
  records,
  limit = null
) {
  const input =
    limit !== null
      ? records.slice(0, limit)
      : records;

  const result = [];

  console.log(
    `PDOK: ${input.length} DUO-locaties geocoderen...`
  );

  for (
    let i = 0;
    i < input.length;
    i++
  ) {
    const record =
      input[i];

    console.log(
      `PDOK: ${i + 1}/${input.length} - ${
        record.name
      }`
    );

    const geocoded =
      await geocodeDuoRecord(
        record
      );

    result.push(
      geocoded
    );
  }

  const success =
    result.filter(
      (record) =>
        record.geocodeStatus ===
        "success"
    ).length;

  console.log(
    `PDOK klaar: ${success}/${result.length} adressen gevonden`
  );

  return result;
}

module.exports = {
  loadDuoSchools,
  buildAddress,
  geocodeAddress,
  geocodeDuoRecord,
  geocodeDuoSchools,
};