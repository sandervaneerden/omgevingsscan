export interface AddressResult {
  address: string;
  latitude: number;
  longitude: number;
}

export async function searchAddress(
  query: string
): Promise<AddressResult | null> {

  const url =
    `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(query)}&rows=1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Adres zoeken mislukt");
  }

  const data = await response.json();

  if (!data.response.docs.length) {
    return null;
  }

  const result = data.response.docs[0];

  const point = result.centroide_ll;

  if (!point) {
    console.error("Geen locatie gevonden:", result);
    return null;
  }

  // POINT(lon lat)
  const coordinates = point
    .replace("POINT(", "")
    .replace(")", "")
    .split(" ");

  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    console.error("Ongeldige coordinaten:", point);
    return null;
  }

  return {
    address: result.weergavenaam,
    latitude,
    longitude,
  };
}