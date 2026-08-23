export interface VulnerableObject {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
}

const BACKEND_URL =
  "https://opulent-sniffle-966rqwj6pp742xp49-3001.app.github.dev";

export async function getVulnerableObjects(
  latitude: number,
  longitude: number,
  radius: number
): Promise<VulnerableObject[]> {

  console.log("🔎 Kwetsbare objecten zoeken...");
  console.log("Locatie:", latitude, longitude);
  console.log("Zoekradius:", radius);

  const url =
    `${BACKEND_URL}/api/vulnerable-objects` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&radius=${radius}`;

  console.log("Backend verzoek:", url);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        "❌ Backend fout:",
        response.status,
        response.statusText
      );

      return [];
    }

    const data = await response.json();

    console.log(
      "✅ Objecten ontvangen:",
      data.length
    );

    console.log(
      "📍 Objecten:",
      data
    );

    return data;

  } catch (error) {

    console.error(
      "❌ Fout bij ophalen objecten:",
      error
    );

    return [];
  }
}