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

import type {
  VulnerableObject
} from "../services/vulnerableObjectService";


// ======================================================
// LEAFLET MARKER CORRECT LADEN IN VITE
// ======================================================

delete (
  L.Icon.Default.prototype as any
)._getIconUrl;

L.Icon.Default.mergeOptions({

  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"

});


// ======================================================
// PROPS
// ======================================================

interface MapViewProps {

  latitude: number;

  longitude: number;

  windDirection: number;

  windSpeed: number;

  objects: VulnerableObject[];

  onGasZoneChange: (
    zone: [number, number][]
  ) => void;

}


// ======================================================
// MAPVIEW
// ======================================================

function MapView({

  latitude,

  longitude,

  windDirection,

  windSpeed,

  objects,

  onGasZoneChange

}: MapViewProps) {


  // ====================================================
  // INCIDENTLOCATIE
  // ====================================================

  const position: [number, number] = [

    latitude,

    longitude

  ];


  // ====================================================
  // GASZONE
  // ====================================================

  const [gasZone, setGasZone] =
    useState<[number, number][]>([]);


  // ====================================================
  // WINDRICHTING
  //
  // windDirection = richting waar de wind vandaan komt
  //
  // Gas verspreidt zich met de wind mee.
  // Daarom 180 graden draaien.
  // ====================================================

  const dispersionDirection =
    (windDirection + 180) % 360;


  // ====================================================
  // GASZONE BIJWERKEN
  // ====================================================

  function handleGasZoneCreated(
    zone: [number, number][]
  ) {

    console.log(
      "🔴 Nieuwe gaszone ontvangen:",
      zone.length,
      "punten"
    );

    setGasZone(zone);

    onGasZoneChange(zone);

  }


  // ====================================================
  // RENDER
  // ====================================================

  return (

    <MapContainer

      center={position}

      zoom={15}

      style={{

        height: "600px",

        width: "100%"

      }}

    >


      {/* ================================================
          KAART AUTOMATISCH NAAR NIEUWE LOCATIE
          ================================================ */}

      <MapUpdater

        latitude={latitude}

        longitude={longitude}

      />


      {/* ================================================
          OPENSTREETMAP
          ================================================ */}

      <TileLayer

        attribution="&copy; OpenStreetMap contributors"

        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"

      />


      {/* ================================================
          INCIDENTLOCATIE
          ================================================ */}

      <Marker

        position={position}

      >

        <Popup>

          <b>Incidentlocatie</b>

          <br />

          {latitude.toFixed(5)},
          {" "}
          {longitude.toFixed(5)}

        </Popup>

      </Marker>


      {/* ================================================
          VASTE ZOEKCIRKEL VAN 500 METER
          ================================================ */}

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


      {/* ================================================
          GASZONE
          ================================================ */}

      <RiskArea

        latitude={latitude}

        longitude={longitude}

        windDirection={dispersionDirection}

        windSpeed={windSpeed}

        onZoneCreated={
          handleGasZoneCreated
        }

      />


      {/* ================================================
          KWETSBARE OBJECTEN
          
          BELANGRIJK:
          Deze component doet GEEN API-call.

          De objecten zijn al door App.tsx opgehaald
          met een zoekradius van 1000 meter.

          Hierdoor gebruiken kaart en lijst dezelfde
          dataset.
          ================================================ */}

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
