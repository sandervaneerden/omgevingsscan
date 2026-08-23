import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import L from "leaflet";

import {
  useEffect,
  useState
} from "react";

import RiskArea from "./RiskArea";
import MapUpdater from "./MapUpdater";
import VulnerableObjects from "./VulnerableObjects";

import {
  getVulnerableObjects
} from "../services/vulnerableObjectService";

import type {
  VulnerableObject
} from "../services/vulnerableObjectService";


// =====================================================
// LEAFLET MARKER
// =====================================================

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


// =====================================================
// PROPS
// =====================================================

interface MapViewProps {

  latitude: number;

  longitude: number;

  windDirection: number;

  windSpeed: number;

  onVisibleObjectsChange?: (
    objects: VulnerableObject[]
  ) => void;

  onObjectsLoadingChange?: (
    loading: boolean
  ) => void;

}


// =====================================================
// COMPONENT
// =====================================================

function MapView({

  latitude,

  longitude,

  windDirection,

  windSpeed,

  onVisibleObjectsChange,

  onObjectsLoadingChange

}: MapViewProps) {


  // ===================================================
  // POSITIE
  // ===================================================

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


  const [
    objectsLoading,
    setObjectsLoading
  ] = useState(true);


  // ===================================================
  // OBJECTEN OPHALEN
  // ===================================================

  useEffect(() => {

    let cancelled = false;


    async function loadObjects() {

      console.log(
        "🔎 Objecten ophalen voor:",
        latitude,
        longitude
      );

      setObjectsLoading(true);

      onObjectsLoadingChange?.(true);

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

      } finally {

        if (!cancelled) {

          setObjectsLoading(false);

          onObjectsLoadingChange?.(
            false
          );

        }

      }

    }


    loadObjects();


    return () => {

      cancelled = true;

    };

  }, [
    latitude,
    longitude,
    onObjectsLoadingChange
  ]);


  // ===================================================
  // WINDRICHTING
  // ===================================================

  // Wind komt UIT deze richting.
  // Gas verspreidt zich MET de wind mee.

  const dispersionDirection =
    (windDirection + 180) % 360;


  // ===================================================
  // LOADING STATUS
  // ===================================================

  if (objectsLoading) {

    console.log(
      "⏳ Kwetsbare objecten worden geladen..."
    );

  }


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


      {/* =============================================
          KAART NAAR NIEUWE LOCATIE
      ============================================= */}

      <MapUpdater

        latitude={latitude}

        longitude={longitude}

      />


      {/* =============================================
          OPENSTREETMAP
      ============================================= */}

      <TileLayer

        attribution="&copy; OpenStreetMap contributors"

        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"

      />


      {/* =============================================
          INCIDENTLOCATIE
      ============================================= */}

      <Marker
        position={position}
      >

        <Popup>

          Incidentlocatie

        </Popup>

      </Marker>


      {/* =============================================
          ZOEKCIRKEL 500 METER
      ============================================= */}

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


      {/* =============================================
          GASZONE
      ============================================= */}

      <RiskArea

        latitude={latitude}

        longitude={longitude}

        windDirection={
          dispersionDirection
        }

        windSpeed={windSpeed}

        onZoneCreated={
          setGasZone
        }

      />


      {/* =============================================
          KWETSBARE OBJECTEN
      ============================================= */}

      <VulnerableObjects

        latitude={latitude}

        longitude={longitude}

        objects={objects}

        gasZone={gasZone}

        onVisibleObjectsChange={
          onVisibleObjectsChange
        }

      />

    </MapContainer>

  );

}


export default MapView;