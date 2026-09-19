const fs = require("fs");
const path = require("path");

// 🟨 GEWIJZIGD
// Officiële LRK CSV → compacte dataset voor de Omgevingsscan.

const inputFile = path.join(__dirname, "data", "lrk.csv");
const outputFile = path.join(__dirname, "data", "lrk-childcare.json");

const csv = fs.readFileSync(inputFile, "utf8");

// 🟨 GEWIJZIGD
// LRK gebruikt puntkomma's als scheidingsteken.
// Eenvoudige parser die rekening houdt met ; binnen quotes.
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ";" && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);

  return result;
}

const lines = csv
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "");

const headers = parseCSVLine(lines[0]);

const column = {};
headers.forEach((header, index) => {
  column[header.trim()] = index;
});

function value(row, name) {
  const index = column[name];

  if (index === undefined) {
    return "";
  }

  return (row[index] || "").trim();
}

// 🟨 GEWIJZIGD
// Alleen daadwerkelijk ingeschreven KDV- en BSO-locaties.
// VGO = gastouderopvang en GOB = gastouderbureau.
// Die nemen we bewust niet op als kwetsbaar object.
const allowedTypes = new Set(["KDV", "BSO"]);

const objects = [];

let totalRows = 0;
let activeKdvBso = 0;
let skippedInactive = 0;
let skippedOtherType = 0;
let withBagId = 0;
let withoutBagId = 0;

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);

  if (row.length < headers.length) {
    continue;
  }

  totalRows++;

  const type = value(row, "type_oko");
  const status = value(row, "status");

  if (!allowedTypes.has(type)) {
    skippedOtherType++;
    continue;
  }

  if (status.toLowerCase() !== "ingeschreven") {
    skippedInactive++;
    continue;
  }

  activeKdvBso++;

  const lrkId = value(row, "lrk_id");
  const name = value(row, "actuele_naam_oko");
  const address = value(row, "opvanglocatie_adres");
  const postcode = value(row, "opvanglocatie_postcode");
  const city = value(row, "opvanglocatie_woonplaats");
  const bagId = value(row, "bag_id");
  const places = value(row, "aantal_kindplaatsen");
  const website = value(row, "contact_website");
  const municipality = value(row, "verantwoordelijke_gemeente");

  if (bagId) {
    withBagId++;
  } else {
    withoutBagId++;
  }

  objects.push({
    id: `lrk-${lrkId}`,
    source: "LRK",
    lrkId,
    type: type === "KDV" ? "kinderdagverblijf" : "bso",
    name,
    address,
    postcode,
    city,
    bagId: bagId || null,
    childPlaces: places ? Number(places) : null,
    municipality,
    website: website || null,
  });
}

// 🟨 GEWIJZIGD
// Sorteer zodat het JSON-bestand stabiel blijft.
objects.sort((a, b) => {
  return (
    a.city.localeCompare(b.city, "nl") ||
    a.name.localeCompare(b.name, "nl") ||
    a.lrkId.localeCompare(b.lrkId)
  );
});

fs.writeFileSync(
  outputFile,
  JSON.stringify(objects, null, 2),
  "utf8"
);

console.log("");
console.log("=== LRK IMPORT ===");
console.log(`Totaal CSV-regels:       ${totalRows}`);
console.log(`Actieve KDV/BSO:         ${activeKdvBso}`);
console.log(`Overige typen:           ${skippedOtherType}`);
console.log(`Niet ingeschreven:       ${skippedInactive}`);
console.log(`Met BAG-ID:              ${withBagId}`);
console.log(`Zonder BAG-ID:           ${withoutBagId}`);
console.log(`JSON-objecten:            ${objects.length}`);
console.log(`Uitvoer:                 ${outputFile}`);
console.log("");