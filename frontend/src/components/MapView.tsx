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

import type {
  VulnerableObject
} from "../services/vulnerableObjectService";


/* =========================================================
   CONSTANTEN
   ========================================================= */

const OBJECT_CIRCLE_RADIUS = 500;


/* =========================================================
   LEAFLET MARKER CORRECT LADEN IN VITE
   ========================================================= */

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"
});


/* =========================================================
   PROPS
   ========================================================= */

interface MapViewProps {

  latitude: number;

  longitude: number;

  windDirection: number;

  windSpeed: number;

  weatherLoaded: boolean;

  objects: VulnerableObject[];

  onGasZoneCreated?: (
    points: [number, number][]
  ) => void;
}


/* =========================================================
   MAPVIEW
   ========================================================= */

function MapView({
  latitude,
  longitude,
  windDirection,
  windSpeed,
  weatherLoaded,
  objects,
  onGasZoneCreated
}: MapViewProps) {


  /* =======================================================
     KAARTPOSITIE
     ======================================================= */

  const position: [number, number] = [
    latitude,
    longitude
  ];


  /* =======================================================
     GASZONE
     ======================================================= */

  const [
    gasZone,
    setGasZone
  ] = useState<[number, number][]>([]);


  /* =======================================================
     NIEUWE LOCATIE
     
     Wanneer een nieuw adres wordt gezocht:
     
     - oude gasmal verwijderen
     - oude selectie verwijderen
     - daarna wordt de nieuwe gasmal opgebouwd
     ======================================================= */

  useEffect(() => {

    console.log(
      "📍 MapView: nieuwe locatie"
    );

    setGasZone([]);

  }, [
    latitude,
    longitude
  ]);


  /* =======================================================
     WINDRICHTING
     
     De meteorologische windrichting geeft aan waar de wind
     vandaan komt.
     
     De gaswolk verspreidt zich met de wind mee.
     
     Daarom draaien we de richting 180 graden.
     ======================================================= */

  const dispersionDirection =
    (windDirection + 180) % 360;


  /* =======================================================
     GASZONE AANGEMAAKT
     ======================================================= */

  function handleGasZoneCreated(
    points: [number, number][]
  ) {

    console.log(
      "🔴 Gaszone aangemaakt:",
      points.length,
      "punten"
    );


    setGasZone(points);


    if (onGasZoneCreated) {

      onGasZoneCreated(points);

    }
  }


  /* =======================================================
     KAART
     ======================================================= */

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
          500 METER CIRKEL
          ================================================= */}

      <Circle
        center={position}
        radius={OBJECT_CIRCLE_RADIUS}
        pathOptions={{
          color: "blue",
          fillColor: "blue",
          fillOpacity: 0.05,
          weight: 2
        }}
      />


      {/* =================================================
          GASZONE
          
          BELANGRIJK:
          
          De gasmal staat los van de 500-metercirkel.
          
          RiskArea bepaalt zelf de volledige lengte van de
          gasmal op basis van windrichting en windsnelheid.
          
          De gasmal kan daardoor bijvoorbeeld 2 km lang zijn.
          ================================================= */}

      {weatherLoaded && (

        <RiskArea
          latitude={latitude}
          longitude={longitude}
          windDirection={dispersionDirection}
          windSpeed={windSpeed}
          onZoneCreated={handleGasZoneCreated}
        />

      )}


      {/* =================================================
          KWETSBARE OBJECTEN
          
          App.tsx geeft hier ALLE objecten uit de 3 km
          zoekopdracht door.
          
          VulnerableObjects bepaalt vervolgens zelf welke
          objecten daadwerkelijk op de kaart komen.
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