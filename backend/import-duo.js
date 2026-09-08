const fs = require("fs");
const path = require("path");

const duo = require("./services/duo");

const OUTPUT_FILE = path.join(
  __dirname,
  "data",
  "duo-schools.json"
);

async function main() {
  console.log("");
  console.log("========================================");
  console.log(" DUO ONDERWIJS IMPORT");
  console.log("========================================");
  console.log("");

  // --------------------------------------------------
  // 1. Alle DUO-locaties ophalen
  // --------------------------------------------------

  console.log("Stap 1: DUO-locaties ophalen...");

  const schools =
    await duo.loadDuoSchools();

  console.log("");
  console.log(
    `DUO locaties gevonden: ${schools.length}`
  );

  // --------------------------------------------------
  // 2. Alle locaties geocoderen
  // --------------------------------------------------

  console.log("");
  console.log(
    "Stap 2: adressen geocoderen via PDOK..."
  );

  console.log(
    "Dit kan enige tijd duren."
  );

  const geocoded =
    await duo.geocodeDuoSchools(
      schools
    );

  // --------------------------------------------------
  // 3. Resultaat analyseren
  // --------------------------------------------------

  const success =
    geocoded.filter(
      x =>
        x.geocodeStatus ===
        "success"
    );

  const notFound =
    geocoded.filter(
      x =>
        x.geocodeStatus ===
        "not_found"
    );

  const errors =
    geocoded.filter(
      x =>
        x.geocodeStatus ===
          "error" ||
        x.geocodeStatus ===
          "no_address"
    );

  // --------------------------------------------------
  // 4. Alleen relevante velden bewaren
  // --------------------------------------------------

  const output =
    geocoded.map(record => ({
      name: record.name,

      type: record.type,

      street: record.street,

      houseNumber:
        record.houseNumber,

      postcode:
        record.postcode,

      city: record.city,

      latitude:
        record.latitude,

      longitude:
        record.longitude,

      source:
        record.source,

      confidence:
        record.confidence,

      geocodeStatus:
        record.geocodeStatus,

      geocodeAddress:
        record.geocodeAddress,

      duo: record.duo || null,

      pdok: record.pdok || null,
    }));

  // --------------------------------------------------
  // 5. JSON opslaan
  // --------------------------------------------------

  fs.mkdirSync(
    path.dirname(OUTPUT_FILE),
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );

  // --------------------------------------------------
  // 6. Samenvatting
  // --------------------------------------------------

  console.log("");
  console.log("");
  console.log("========================================");
  console.log(" IMPORT VOLTOOID");
  console.log("========================================");

  console.log(
    `Totaal DUO:       ${geocoded.length}`
  );

  console.log(
    `PDOK gevonden:    ${success.length}`
  );

  console.log(
    `Niet gevonden:    ${notFound.length}`
  );

  console.log(
    `Fouten:           ${errors.length}`
  );

  console.log("");
  console.log(
    `Bestand: ${OUTPUT_FILE}`
  );

  console.log("========================================");
  console.log("");

  // --------------------------------------------------
  // 7. Niet gevonden adressen tonen
  // --------------------------------------------------

  if (notFound.length > 0) {
    console.log("");
    console.log(
      "Niet gevonden adressen:"
    );

    for (const item of notFound) {
      console.log(
        `- ${item.name} | ${item.geocodeAddress || "geen adres"}`
      );
    }
  }

  // --------------------------------------------------
  // 8. Fouten tonen
  // --------------------------------------------------

  if (errors.length > 0) {
    console.log("");
    console.log(
      "Fouten:"
    );

    for (const item of errors) {
      console.log(
        `- ${item.name} | ${
          item.geocodeAddress ||
          "geen adres"
        } | ${
          item.geocodeError ||
          item.geocodeStatus
        }`
      );
    }
  }
}

main().catch(error => {
  console.error("");
  console.error(
    "IMPORT MISLUKT:"
  );
  console.error(
    error
  );
  process.exit(1);
});