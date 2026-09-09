export interface VulnerableObjectAddress {
  street?: string;
  housenumber?: string | number;
  houseletter?: string | null;
  postcode?: string;
  city?: string;
}


export interface VulnerableObjectTags {
  phone?: string;
  "contact:phone"?: string;
  mobile?: string;
  "contact:mobile"?: string;
  website?: string;
  "contact:website"?: string;
  [key: string]: unknown;
}


export interface VulnerableObjectBAG {
  bronhouder_identificatie?: string | null;
  bronhouder_naam?: string | null;
  identificatie?: string | null;
  openbare_ruimte_naam?: string | null;
  huisnummer?: number | null;
  huisletter?: string | null;
  postcode?: string | null;
  woonplaats_naam?: string | null;
  oppervlakte?: number | null;
  gebruiksdoel?: string | null;
  status?: string | null;
  verblijfsobject_id?: string | null;
  [key: string]: unknown;
}


export interface VulnerableObjectPand {
  identificatie?: string | null;
  bouwjaar?: number | null;
  aantal_verblijfsobjecten?: number | null;
  gebruiksdoel?: string | null;
  status?: string | null;
}


export interface VulnerableObject {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;

  distance?: number;

  address?: VulnerableObjectAddress;

  tags?: VulnerableObjectTags;

  bag?: VulnerableObjectBAG;

  pand?: VulnerableObjectPand;

  source?: string;

  confidence?: string;

  priority?: number;
}


/* =========================================================
   KWETSBARE OBJECTEN OPHALEN
   ========================================================= */

export async function getVulnerableObjects(
  latitude: number,
  longitude: number,
  radius: number
): Promise<VulnerableObject[]> {

  const url =
    `/api/vulnerable-objects` +
    `?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    `&radius=${encodeURIComponent(radius)}`;

  console.log(
    "🔎 Kwetsbare objecten ophalen:",
    url
  );


  try {

    const response =
      await fetch(url);


    /* -------------------------------------------------------
       HTTP CONTROLE
       ------------------------------------------------------- */

    if (!response.ok) {

      throw new Error(
        `Backend geeft HTTP ${response.status} terug`
      );
    }


    /* -------------------------------------------------------
       JSON
       ------------------------------------------------------- */

    const data: unknown =
      await response.json();


    if (!Array.isArray(data)) {

      throw new Error(
        "Backend gaf geen array terug"
      );
    }


    /* -------------------------------------------------------
       OBJECTEN VALIDEREN
       ------------------------------------------------------- */

    const objects =
      data.filter(
        (
          object
        ): object is VulnerableObject => {

          if (
            typeof object !== "object" ||
            object === null
          ) {
            return false;
          }


          const item =
            object as Record<string, unknown>;


          return (
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            typeof item.type === "string" &&
            typeof item.latitude === "number" &&
            Number.isFinite(item.latitude) &&
            typeof item.longitude === "number" &&
            Number.isFinite(item.longitude)
          );
        }
      );


    console.log(
      "✅ Kwetsbare objecten ontvangen:",
      objects.length
    );


    return objects;

  } catch (error) {

    console.error(
      "❌ Fout bij ophalen kwetsbare objecten:",
      error
    );

    return [];
  }
}