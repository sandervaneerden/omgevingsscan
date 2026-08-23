import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import L from "leaflet";

import { useState } from "react";

import RiskArea from "./RiskArea";
import MapUpdater from "./MapUpdater";
import VulnerableObjects from "./VulnerableObjects";

import type { VulnerableObject } from "./VulnerableObjects";


// =========================
// LEAFLET MARKER
// =========================

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({

  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"

});


// =========================
// TYPES
// =========================

interface VisibleVulnerableObject
  extends VulnerableObject {

  distance: number;

  insideCircle: boolean;

  insideGasZone: boolean;

}


interface MapViewProps {

  latitude: number;

  longitude: number;

  windDirection: number;

  windSpeed: number;

  onGasZoneCreated?: (
    zone: [number, number][]
  ) => void;

  onVisibleObjectsChange?: (
    objects: VisibleVulnerableObject[]
  ) => void;

}


// =========================
// MAPVIEW
// =========================

function MapView({

  latitude,

  longitude,

  windDirection,

  windSpeed,

  onGasZoneCreated,

  onVisibleObjectsChange

}: MapViewProps) {


  const position: [number, number] = [

    latitude,

    longitude

  ];


  const [gasZone, setGasZone] =
    useState<[number, number][]>([]);


  // =========================
  // WINDRICHTING
  // =========================

  // Wind komt uit deze richting.
  // Gas verspreidt zich met de wind mee.

  const dispersionDirection =
    (windDirection + 180) % 360;


  // =========================
  // GASZONE
  // =========================

  function handleZoneCreated(
    zone: [number, number][]
  ) {

    console.log(
      "🔴 Gaszone ontvangen:",
      zone.length,
      "punten"
    );

    setGasZone(zone);

    onGasZoneCreated?.(zone);

  }


  // =========================
  // RENDER
  // =========================

  return (

    <MapContainer

      center={position}

      zoom={15}

      style={{

        height: "600px",

        width: "100%"

      }}

    >


      {/* =========================
          KAART BIJWERKEN
      ========================= */}

      <MapUpdater

        latitude={latitude}

        longitude={longitude}

      />


      {/* =========================
          OPENSTREETMAP
      ========================= */}

      <TileLayer

        attribution="&copy; OpenStreetMap contributors"

        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"

      />


      {/* =========================
          INCIDENTLOCATIE
      ========================= */}

      <Marker

        position={position}

      >

        <Popup>

          <b>
            Incidentlocatie
          </b>

          <br />

          {latitude.toFixed(5)},{" "}
          {longitude.toFixed(5)}

        </Popup>

      </Marker>


      {/* =========================
          500 METER ZOEKCIRKEL
      ========================= */}

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


      {/* =========================
          GASZONE
      ========================= */}

      <RiskArea

        latitude={latitude}

        longitude={longitude}

        windDirection={dispersionDirection}

        windSpeed={windSpeed}

        onZoneCreated={handleZoneCreated}

      />


      {/* =========================
          KWETSBARE OBJECTEN
          
          Objecten binnen:
          - 500 meter
          OF
          - gaszone
      ========================= */}

      <VulnerableObjects

        latitude={latitude}

        longitude={longitude}

        gasZone={gasZone}

        onVisibleObjectsChange={
          onVisibleObjectsChange
        }

      />


    </MapContainer>

  );

}


export default MapView;
