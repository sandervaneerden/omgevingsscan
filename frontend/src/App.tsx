import { useRef, useState } from "react";
import "./App.css";
import MapView from "./components/MapView";
import SearchBar from "./components/SearchBar";
import WeatherPanel from "./components/WeatherPanel";
import {
  getBeaufort,
  getWeather,
} from "./services/weatherService";
import { getVulnerableObjects } from "./services/vulnerableObjectService";
import type { WeatherResult } from "./services/weatherService";

const OBJECT_SEARCH_RADIUS = 3000;
const OBJECT_CIRCLE_RADIUS = 500;

type Category =
  | "Zorg"
  | "Onderwijs"
  | "Religie"
  | "Winkels"
  | "Maatschappelijk"
  | "Verblijf"
  | "Overig";

interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
}

interface VulnerableObject {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distance?: number;
  address?: string;
}

function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return Math.round(R * c);
}

function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
) {
  const x = point[1];
  const y = point[0];

  let inside = false;

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];

    const xj = polygon[j][1];
    const yj = polygon[j][0];

    const intersect =
      yi > y !== yj > y &&
      x <
        ((xj - xi) * (y - yi)) /
          (yj - yi) +
          xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

function categoryForType(
  type: string
): Category {
  switch (type) {
    case "hospital":
    case "clinic":
      return "Zorg";

    case "nursing_home":
    case "mental_health":
    case "disabled_care":
    case "protected_living":
    case "hospice":
    case "rehabilitation":
    case "home_care":
    case "doctor":
    case "dentist":
    case "physiotherapy":
    case "pharmacy":
    case "healthcare":
    case "care":
      return "Zorg";

    case "school":
    case "kindergarten":
      return "Onderwijs";

    case "place_of_worship":
      return "Religie";

    case "shop":
      return "Winkels";

    case "community_centre":
    case "social_facility":
      return "Maatschappelijk";

    case "hotel":
    case "hostel":
    case "guest_house":
      return "Verblijf";

    default:
      return "Overig";
  }
}

function objectTypeName(type: string) {
  switch (type) {
    case "hospital":
      return "Ziekenhuis";

    case "clinic":
      return "Kliniek";

    case "nursing_home":
      return "Verpleeghuis";

    case "mental_health":
      return "GGZ / psychiatrie";

    case "disabled_care":
      return "Gehandicaptenzorg";

    case "protected_living":
      return "Beschermd wonen";

    case "hospice":
      return "Hospice";

    case "rehabilitation":
      return "Revalidatie";

    case "home_care":
      return "Thuiszorg";

    case "doctor":
      return "Huisarts";

    case "dentist":
      return "Tandarts";

    case "physiotherapy":
      return "Fysiotherapie";

    case "pharmacy":
      return "Apotheek";

    case "healthcare":
    case "care":
      return "Zorg";

    case "school":
      return "School";

    case "kindergarten":
      return "Kinderopvang";

    case "place_of_worship":
      return "Gebedshuis";

    case "shop":
      return "Winkel";

    case "community_centre":
      return "Buurt-/wijkcentrum";

    case "social_facility":
      return "Maatschappelijke voorziening";

    case "hotel":
      return "Hotel";

    case "hostel":
      return "Hostel";

    case "guest_house":
      return "Pension / gastenverblijf";

    default:
      return "Overig";
  }
}

function iconForType(type: string) {
  switch (type) {
    case "hospital":
    case "clinic":
      return (
        <span className="object-icon object-icon-hospital">
          ✚
        </span>
      );

    case "nursing_home":
    case "mental_health":
    case "disabled_care":
    case "protected_living":
    case "hospice":
    case "rehabilitation":
    case "home_care":
    case "doctor":
    case "dentist":
    case "physiotherapy":
    case "pharmacy":
    case "healthcare":
    case "care":
      return (
        <span className="object-icon object-icon-care">
          ✚
        </span>
      );

    case "school":
    case "kindergarten":
      return (
        <span className="object-icon object-icon-school">
          🏫
        </span>
      );

    case "place_of_worship":
      return (
        <span className="object-icon object-icon-religion">
          ⛪
        </span>
      );

    case "shop":
      return (
        <span className="object-icon object-icon-shop">
          🛒
        </span>
      );

    case "community_centre":
    case "social_facility":
      return (
        <span className="object-icon object-icon-community">
          🏢
        </span>
      );

    case "hotel":
    case "hostel":
    case "guest_house":
      return (
        <span className="object-icon object-icon-hotel">
          🏨
        </span>
      );

    default:
      return (
        <span className="object-icon object-icon-other">
          ●
        </span>
      );
  }
}

function categoryIcon(
  category: Category
) {
  switch (category) {
    case "Zorg":
      return "✚";

    case "Onderwijs":
      return "🏫";

    case "Religie":
      return "⛪";

    case "Winkels":
      return "🛒";

    case "Maatschappelijk":
      return "🏢";

    case "Verblijf":
      return "🏨";

    case "Overig":
      return "●";
  }
}

const categoryOrder: Category[] = [
  "Zorg",
  "Onderwijs",
  "Religie",
  "Winkels",
  "Maatschappelijk",
  "Verblijf",
  "Overig",
];

function copyToClipboard(text: string) {
  const textarea =
    document.createElement("textarea");

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(
      textarea
    );
  }
}

function App() {
  const [location, setLocation] =
    useState<LocationData | null>(null);

  const [weather, setWeather] =
    useState<WeatherResult | null>(null);

  const [objects, setObjects] =
    useState<VulnerableObject[]>([]);

  const [objectsLoading, setObjectsLoading] =
    useState(false);

  const [gasZone, setGasZone] =
    useState<[number, number][] | null>(
      null
    );

  const [
    collapsedCategories,
    setCollapsedCategories,
  ] = useState<Record<Category, boolean>>({
    Zorg: true,
    Onderwijs: true,
    Religie: true,
    Winkels: true,
    Maatschappelijk: true,
    Verblijf: true,
    Overig: true,
  });

  const [
    enabledCategories,
    setEnabledCategories,
  ] = useState<Record<Category, boolean>>({
    Zorg: true,
    Onderwijs: true,
    Religie: true,
    Winkels: true,
    Maatschappelijk: true,
    Verblijf: true,
    Overig: true,
  });

  const [copiedSection, setCopiedSection] =
    useState<
      "weather" | "objects" | null
    >(null);

  const requestIdRef = useRef(0);

  function toggleCategory(
    category: Category
  ) {
    setCollapsedCategories(
      (previous) => ({
        ...previous,
        [category]:
          !previous[category],
      })
    );
  }

  function toggleCategoryVisibility(
    category: Category
  ) {
    setEnabledCategories(
      (previous) => ({
        ...previous,
        [category]:
          !previous[category],
      })
    );
  }

  async function loadObjects(
    latitude: number,
    longitude: number,
    currentRequestId: number
  ) {
    setObjectsLoading(true);

    try {
      const result =
        await getVulnerableObjects(
          latitude,
          longitude,
          OBJECT_SEARCH_RADIUS
        );

      if (
        requestIdRef.current !==
        currentRequestId
      ) {
        return;
      }

      setObjects(result || []);
    } catch (error) {
      console.error(
        "Fout bij ophalen kwetsbare objecten:",
        error
      );

      if (
        requestIdRef.current ===
        currentRequestId
      ) {
        setObjects([]);
      }
    } finally {
      if (
        requestIdRef.current ===
        currentRequestId
      ) {
        setObjectsLoading(false);
      }
    }
  }

  async function handleLocationFound(
    data: LocationData
  ) {
    const currentRequestId =
      ++requestIdRef.current;

    setLocation(data);
    setWeather(null);
    setObjects([]);
    setGasZone(null);

    try {
      const weatherData =
        await getWeather(
          data.latitude,
          data.longitude
        );

      if (
        requestIdRef.current ===
        currentRequestId
      ) {
        setWeather(weatherData);
      }
    } catch (error) {
      console.error(
        "Fout bij ophalen weer:",
        error
      );
    }

    await loadObjects(
      data.latitude,
      data.longitude,
      currentRequestId
    );
  }

  const filteredObjects =
    objects.filter((object) => {
      if (
        !location ||
        typeof object.latitude !==
          "number" ||
        typeof object.longitude !==
          "number"
      ) {
        return false;
      }

      if (
        !object.name ||
        object.name.trim() === ""
      ) {
        return false;
      }

      if (
        object.type ===
          "shopping_centre" &&
        !object.name
      ) {
        return false;
      }

      const distance =
        distanceInMeters(
          location.latitude,
          location.longitude,
          object.latitude,
          object.longitude
        );

      const insideCircle =
        distance <=
        OBJECT_CIRCLE_RADIUS;

      const insideGasZone =
        gasZone &&
        pointInPolygon(
          [
            object.latitude,
            object.longitude,
          ],
          gasZone
        );

      return (
        insideCircle ||
        insideGasZone
      );
    });

  const visibleObjects =
    filteredObjects.filter(
      (object) => {
        const category =
          categoryForType(
            object.type
          );

        return enabledCategories[
          category
        ];
      }
    );

  const groupedObjects: Record<
    Category,
    VulnerableObject[]
  > = {
    Zorg: [],
    Onderwijs: [],
    Religie: [],
    Winkels: [],
    Maatschappelijk: [],
    Verblijf: [],
    Overig: [],
  };

  visibleObjects.forEach(
    (object) => {
      const category =
        categoryForType(
          object.type
        );

      groupedObjects[
        category
      ].push(object);
    }
  );

  const totalVisibleObjects =
    visibleObjects.length;

  function copyWeather() {
    if (!weather) {
      return;
    }

    const windSpeedMs =
      weather.windSpeed / 3.6;

    const text = `METEOSITUATIE

Windkracht: ${getBeaufort(
      weather.windSpeed
    )} Beaufort
Windsnelheid: ${weather.windSpeed.toFixed(
      1
    )} km/u (${windSpeedMs.toFixed(
      1
    )} m/s)
Windrichting: ${
      weather.windDirectionText
    } (${Math.round(
      weather.windDirection
    )}°)
Temperatuur: ${
      weather.temperature
    } °C
Meting: ${
      weather.measurementTime
    }
Bron: Open-Meteo`;

    copyToClipboard(text);

    setCopiedSection("weather");

    setTimeout(() => {
      setCopiedSection(
        (current) =>
          current === "weather"
            ? null
            : current
      );
    }, 1500);
  }

  function copyObjects() {
    if (!location) {
      return;
    }

    let text = `KWETSBARE OBJECTEN

Incidentlocatie: ${location.address}

`;

    categoryOrder.forEach(
      (category) => {
        const categoryObjects =
          groupedObjects[
            category
          ];

        if (
          categoryObjects.length ===
          0
        ) {
          return;
        }

        text += `${category} (${categoryObjects.length})\n`;

        categoryObjects.forEach(
          (object) => {
            const distance =
              distanceInMeters(
                location.latitude,
                location.longitude,
                object.latitude,
                object.longitude
              );

            text += `- ${
              object.name
            } — ${objectTypeName(
              object.type
            )} — ${distance} m\n`;
          }
        );

        text += "\n";
      }
    );

    copyToClipboard(
      text.trim()
    );

    setCopiedSection("objects");

    setTimeout(() => {
      setCopiedSection(
        (current) =>
          current === "objects"
            ? null
            : current
      );
    }, 1500);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>
            Omgevingsscan
          </h1>

          <p>
            Operationeel overzicht
            van de omgeving rond
            een incident
          </p>
        </div>
      </header>

      <main className="app-content">
        <section className="panel location-panel">
          <h2>
            Incidentlocatie
          </h2>

          <div className="location-search">
            <SearchBar
              onLocationFound={
                handleLocationFound
              }
            />
          </div>

          {location && (
            <div className="location-info">
              <strong>
                {
                  location.address
                }
              </strong>

              <div>
                {location.latitude.toFixed(
                  5
                )}
                ,{" "}
                {location.longitude.toFixed(
                  5
                )}
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-title-actions">
            <h2>
              Meteo
            </h2>

            <button
              type="button"
              className="copy-button"
              onClick={
                copyWeather
              }
              disabled={!weather}
            >
              {copiedSection ===
              "weather"
                ? "✓ Gekopieerd"
                : "📋 Kopiëren"}
            </button>
          </div>

          <WeatherPanel
            weather={weather}
          />
        </section>

        <section className="panel">
          <div className="panel-title-actions">
            <h2>
              Kwetsbare objecten
              {totalVisibleObjects >
                0 &&
                ` (${totalVisibleObjects})`}
            </h2>

            <button
              type="button"
              className="copy-button"
              onClick={
                copyObjects
              }
              disabled={
                !location ||
                visibleObjects.length ===
                  0
              }
            >
              {copiedSection ===
              "objects"
                ? "✓ Gekopieerd"
                : "📋 Kopiëren"}
            </button>
          </div>

          {!objectsLoading &&
            filteredObjects.length >
              0 && (
              <div className="category-filters">
                {categoryOrder.map(
                  (category) => {
                    const enabled =
                      enabledCategories[
                        category
                      ];

                    return (
                      <button
                        key={category}
                        type="button"
                        className={`category-filter-button ${
                          enabled
                            ? "category-filter-active"
                            : "category-filter-inactive"
                        }`}
                        onClick={() =>
                          toggleCategoryVisibility(
                            category
                          )
                        }
                        aria-pressed={
                          enabled
                        }
                        title={
                          enabled
                            ? `${category} verbergen`
                            : `${category} tonen`
                        }
                      >
                        <span
  className="category-filter-checkbox"
  style={{
    color: enabled ? "#2e7d32" : "#000000",
  }}
>
  {enabled ? "☑" : "☐"}
</span>

                        <span className="category-filter-name">
                          {category}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            )}

          {objectsLoading && (
            <div className="loading">
              Kwetsbare objecten
              laden...
            </div>
          )}

          {!objectsLoading &&
            filteredObjects.length ===
              0 && (
              <div className="empty-state">
                Geen kwetsbare
                objecten gevonden
                binnen het
                geselecteerde
                gebied.
              </div>
            )}

          {!objectsLoading &&
            filteredObjects.length >
              0 &&
            visibleObjects.length ===
              0 && (
              <div className="empty-state">
                Geen zichtbare
                categorieën
                geselecteerd.
              </div>
            )}

          {!objectsLoading &&
            filteredObjects.length >
              0 && (
              <div className="object-categories">
                {categoryOrder.map(
                  (category) => {
                    const categoryObjects =
                      groupedObjects[
                        category
                      ];

                    if (
                      categoryObjects.length ===
                      0
                    ) {
                      return null;
                    }

                    return (
                      <div
                        key={category}
                        className="object-category"
                      >
                        <button
                          type="button"
                          className="category-header"
                          onClick={() =>
                            toggleCategory(
                              category
                            )
                          }
                        >
                          <span className="category-title">
                            <span className="category-icon">
                              {categoryIcon(
                                category
                              )}
                            </span>

                            <span>
                              {
                                category
                              }{" "}
                              (
                              {
                                categoryObjects.length
                              }
                              )
                            </span>
                          </span>

                          <span>
                            {
                              collapsedCategories[
                                category
                              ]
                                ? "▶"
                                : "▼"
                            }
                          </span>
                        </button>

                        {!collapsedCategories[
                          category
                        ] && (
                          <div className="object-list">
                            {categoryObjects.map(
                              (
                                object
                              ) => {
                                const distance =
                                  location
                                    ? distanceInMeters(
                                        location.latitude,
                                        location.longitude,
                                        object.latitude,
                                        object.longitude
                                      )
                                    : null;

                                return (
                                  <div
                                    key={
                                      object.id
                                    }
                                    className="object-item"
                                  >
                                    <div className="object-item-icon">
                                      {iconForType(
                                        object.type
                                      )}
                                    </div>

                                    <div className="object-item-content">
                                      <div className="object-item-name">
                                        {
                                          object.name
                                        }
                                      </div>

                                      <div className="object-item-type">
                                        {objectTypeName(
                                          object.type
                                        )}
                                      </div>

                                      {distance !==
                                        null && (
                                        <div className="object-item-distance">
                                          {
                                            distance
                                          }{" "}
                                          m
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
        </section>

        <section className="panel map-panel">
          <MapView
            latitude={
              location?.latitude ??
              53.1406
            }
            longitude={
              location?.longitude ??
              7.035
            }
            windDirection={
              weather?.windDirection ??
              0
            }
            windSpeed={
              weather?.windSpeed ??
              0
            }
            weatherLoaded={
              weather !== null
            }
            objects={
              visibleObjects
            }
            onGasZoneCreated={
              setGasZone
            }
          />
        </section>
      </main>
    </div>
  );
}

export default App;