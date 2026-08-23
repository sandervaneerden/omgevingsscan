import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useState } from "react";

import RiskArea from "./RiskArea";
import MapUpdater from "./MapUpdater";
import VulnerableObjects from "./VulnerableObjects";

import { getVulnerableObjects } from "../services/vulnerableObjectService";

import type {
  VulnerableObject
} from "../services/vulnerableObjectService";


// =====================================================
// LEAFLET MARKER
// =====================================================

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"
});


// =====================================================
// PROPS
// =====================================================

interface MapViewProps {
  latitude: number;
  longitude: number;
  windDirection: number;
  windSpeed: number;
}


// =====================================================
// MAPVIEW
// =====================================================

function MapView({
  latitude,
  longitude,
  windDirection,
  windSpeed
}: MapViewProps) {

  const position: [number, number] = [
    latitude,
    longitude
  ];


  // ===================================================
  // GASZONE
  // ===================================================

  const [
    gasZone,
    setGasZone
  ] = useState<[number, number][]>([]);


  // ===================================================
  // OBJECTEN
  // ===================================================

  const [
    objects,
    setObjects
  ] = useState<VulnerableObject[]>([]);


  // ===================================================
  // OBJECTEN OPHALEN
  // ===================================================

  useEffect(() => {

    let cancelled = false;

    async function loadObjects() {

      console.log(
        "🔎 Objecten zoeken..."
      );

      console.log(
        "📍 Locatie:",
        latitude,
        longitude
      );

      console.log(
        "📏 Zoekradius: 1000 meter"
      );

      try {

        const result =
          await getVulnerableObjects(
            latitude,
            longitude,
            1000
          );

        if (cancelled) {
          return;
        }

        console.log(
          "✅ Objecten ontvangen:",
          result.length
        );

        setObjects(result);

      } catch (error) {

        console.error(
          "❌ Fout bij ophalen objecten:",
          error
        );

        if (!cancelled) {
          setObjects([]);
        }

      }

    }

    loadObjects();

    return () => {
      cancelled = true;
    };

  }, [
    latitude,
    longitude
  ]);


  // ===================================================
  // WIND
  // ===================================================

  const dispersionDirection =
    (windDirection + 180) % 360;


  // ===================================================
  // RENDER
  // ===================================================

  return (

    <MapContainer
      center={position}
      zoom={15}
      style={{
        height: "600px",
        width: "100%"
      }}
    >

      <MapUpdater
        latitude={latitude}
        longitude={longitude}
      />


      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />


      {/* INCIDENTLOCATIE */}

      <Marker
        position={position}
      >

        <Popup>
          Incidentlocatie
        </Popup>

      </Marker>


      {/* ZOEKGEBIED 1 KM */}

      <Circle
        center={position}
        radius={500}
        pathOptions={{
          color: "blue",
          fillColor: "blue",
          fillOpacity: 0.05,
          weight: 2
        }}
      />


      {/* GASZONE */}

      <RiskArea
        latitude={latitude}
        longitude={longitude}
        windDirection={dispersionDirection}
        windSpeed={windSpeed}
        onZoneCreated={setGasZone}
      />


      {/* KWETSBARE OBJECTEN */}

      <VulnerableObjects
        latitude={latitude}
        longitude={longitude}
        gasZone={gasZone}
        objects={objects}
      />

    </MapContainer>

  );
}


export default MapView;
