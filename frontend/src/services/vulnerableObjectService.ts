export interface VulnerableObject {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
}

export async function getVulnerableObjects(
  latitude: number,
  longitude: number,
  radius: number
): Promise<VulnerableObject[]> {

  console.log("🔎 Kwetsbare objecten zoeken...");
  console.log("Locatie:", latitude, longitude);
  console.log("Zoekradius:", radius, "meter");

  const query = `
    [out:json][timeout:25];

    (
      node["amenity"="school"](around:${radius},${latitude},${longitude});
      way["amenity"="school"](around:${radius},${latitude},${longitude});
      relation["amenity"="school"](around:${radius},${latitude},${longitude});

      node["amenity"="hospital"](around:${radius},${latitude},${longitude});
      way["amenity"="hospital"](around:${radius},${latitude},${longitude});
      relation["amenity"="hospital"](around:${radius},${latitude},${longitude});

      node["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});
      way["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});
      relation["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});

      node["amenity"="community_centre"](around:${radius},${latitude},${longitude});
      way["amenity"="community_centre"](around:${radius},${latitude},${longitude});
      relation["amenity"="community_centre"](around:${radius},${latitude},${longitude});

      node["shop"](around:${radius},${latitude},${longitude});
      way["shop"](around:${radius},${latitude},${longitude});
      relation["shop"](around:${radius},${latitude},${longitude});
    );

    out center tags;
  `;

  try {

    const response = await fetch(
      "https://overpass.private.coffee/api/interpreter",
      {
        method: "POST",

        headers: {
          "Content-Type": "text/plain"
        },

        body: query
      }
    );


    if (!response.ok) {

      console.error(
        "❌ Overpass fout:",
        response.status,
        response.statusText
      );

      return [];
    }


    const data = await response.json();


    if (
      !data ||
      !Array.isArray(data.elements)
    ) {

      console.error(
        "❌ Ongeldig antwoord van Overpass:",
        data
      );

      return [];
    }


    console.log(
      "✅ Overpass objecten gevonden:",
      data.elements.length
    );


    const objects: VulnerableObject[] = [];


    for (const el of data.elements) {

      const lat =
        el.lat ??
        el.center?.lat;

      const lon =
        el.lon ??
        el.center?.lon;


      if (
        typeof lat !== "number" ||
        typeof lon !== "number"
      ) {

        continue;
      }


      const tags = el.tags ?? {};


      let type = "public";


      if (
        tags.amenity === "school"
      ) {

        type = "school";

      } else if (
        tags.amenity === "hospital"
      ) {

        type = "hospital";

      } else if (
        tags.amenity === "place_of_worship"
      ) {

        type = "church";

      } else if (
        tags.shop
      ) {

        type = "shop";

      } else if (
        tags.amenity === "community_centre"
      ) {

        type = "community_centre";

      }


      const object: VulnerableObject = {

        id: `${el.type}-${el.id}`,

        name:
          tags.name ||
          "Onbekend object",

        type,

        latitude: lat,

        longitude: lon

      };


      objects.push(object);
    }


    console.log(
      "📍 Geldige objecten:",
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
