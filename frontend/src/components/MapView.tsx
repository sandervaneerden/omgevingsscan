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

  onGasZoneCreated?: (
    zone: [number, number][]
  ) => void;

}


function MapView({

  latitude,

  longitude,

  windDirection,

  windSpeed,

  onGasZoneCreated

}: MapViewProps) {


  const position: [number, number] = [

    latitude,

    longitude

  ];


  const [gasZone, setGasZone] = useState<

    [number, number][]

  >([]);


  // Wind komt uit deze richting.
  // Gas verspreidt zich met de wind mee.

  const dispersionDirection =

    (windDirection + 180) % 360;


  function handleZoneCreated(
    zone: [number, number][]
  ) {

    setGasZone(zone);

    if (onGasZoneCreated) {

      onGasZoneCreated(zone);

    }

  }


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


      <Marker

        position={position}

      >

        <Popup>

          Incidentlocatie

        </Popup>

      </Marker>


      {/* vaste zoekcirkel 500 meter */}

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


      {/* ovale gasmal */}

      <RiskArea

        latitude={latitude}

        longitude={longitude}

        windDirection={dispersionDirection}

        windSpeed={windSpeed}

        onZoneCreated={handleZoneCreated}

      />


      {/* objecten in cirkel + gasmal */}

      <VulnerableObjects

        latitude={latitude}

        longitude={longitude}

        gasZone={gasZone}

      />


    </MapContainer>

  );

}


export default MapView;
