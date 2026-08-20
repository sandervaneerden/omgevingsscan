import { useMap } from "react-leaflet";
import { useEffect } from "react";

interface MapUpdaterProps {
  latitude: number;
  longitude: number;
}

function MapUpdater({
  latitude,
  longitude
}: MapUpdaterProps) {

  const map = useMap();

  useEffect(() => {

    map.setView(
      [latitude, longitude],
      15
    );

  }, [latitude, longitude, map]);

  return null;
}

export default MapUpdater;