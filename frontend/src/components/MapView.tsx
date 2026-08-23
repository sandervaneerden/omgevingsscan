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


// Leaflet marker correct laden in Vite

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"
});


interface MapViewProps {
  latitude: number;
  longitude: number;
  windDirection: number;
  windSpeed: number;
}


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

  const [gasZone, setGasZone] =
    useState<[number, number][]>([]);

  const [objects, setObjects] =
    useState<VulnerableObject[]>([]);


  // Objecten ophalen binnen 1 kilometer

  useEffect(() => {

    let cancelled = false;

    async function loadObjects() {

      console.log(
        "🔎 Kwetsbare objecten zoeken..."
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


  // Wind komt uit deze richting.
  // Gas verspreidt zich met de wind mee.

  const dispersionDirection =
    (windDirection + 180) % 360;


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


      {/* Incidentlocatie */}

      <Marker
        position={position}
      >
        <Popup>
          Incidentlocatie
        </Popup>
      </Marker>


      {/* Zoekcirkel van 500 meter */}

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


      {/* Gaszone */}

      <RiskArea
        latitude={latitude}
        longitude={longitude}
        windDirection={dispersionDirection}
        windSpeed={windSpeed}
        onZoneCreated={setGasZone}
      />


      {/* Kwetsbare objecten */}

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
