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


// =========================================================
// LEAFLET MARKER CORRECT LADEN IN VITE
// =========================================================

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"
});


// =========================================================
// PROPS
// =========================================================

interface MapViewProps {
  latitude: number;
  longitude: number;
  windDirection: number;
  windSpeed: number;
  weatherLoaded: boolean;
  objects: VulnerableObject[];
}


// =========================================================
// MAPVIEW
// =========================================================

function MapView({
  latitude,
  longitude,
  windDirection,
  windSpeed,
  weatherLoaded,
  objects
}: MapViewProps) {

  // =======================================================
  // KAARTPOSITIE
  // =======================================================

  const position: [number, number] = [
    latitude,
    longitude
  ];


  // =======================================================
  // GASZONE
  // =======================================================

  const [gasZone, setGasZone] =
    useState<[number, number][]>([]);


  // =======================================================
  // WINDRICHTING
  //
  // De meteorologische windrichting geeft aan waar de wind
  // vandaan komt.
  //
  // Het gas verspreidt zich met de wind mee.
  // Daarom draaien we de richting 180 graden.
  // =======================================================

  const dispersionDirection =
    (windDirection + 180) % 360;


  // =======================================================
  // KAART
  // =======================================================

  return (

    <MapContainer
      center={position}
      zoom={15}
      style={{
        height: "600px",
        width: "100%"
      }}
    >

      {/* =================================================
          KAART NAAR NIEUWE LOCATIE
          ================================================= */}

      <MapUpdater
        latitude={latitude}
        longitude={longitude}
      />


      {/* =================================================
          OPENSTREETMAP
          ================================================= */}

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />


      {/* =================================================
          INCIDENTLOCATIE
          ================================================= */}

      <Marker
        position={position}
      >

        <Popup>
          Incidentlocatie
        </Popup>

      </Marker>


      {/* =================================================
          ZOEKCIRKEL 500 METER
          ================================================= */}

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


      {/* =================================================
          GASZONE
          
          Alleen tonen wanneer actuele meteo beschikbaar is.
          
          Bij:
          
          weatherLoaded = false
          
          wordt de RiskArea helemaal niet geladen.
          Daardoor kan de oude/onjuiste gasmal niet
          zichtbaar zijn voordat de nieuwe meteo binnen is.
          ================================================= */}

      {weatherLoaded && (

        <RiskArea
          latitude={latitude}
          longitude={longitude}
          windDirection={dispersionDirection}
          windSpeed={windSpeed}
          onZoneCreated={setGasZone}
        />

      )}


      {/* =================================================
          KWETSBARE OBJECTEN
          
          De objecten worden door App.tsx opgehaald.
          MapView doet zelf geen API-call meer.
          ================================================= */}

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