import { Polygon } from "react-leaflet";
import { useEffect, useMemo } from "react";


interface RiskAreaProps {

  latitude: number;

  longitude: number;

  windDirection: number;

  windSpeed: number;

  onZoneCreated?: (
    points: [number, number][]
  ) => void;

}


// =========================================================
// PUNT BEREKENEN OP BASIS VAN AFSTAND EN RICHTING
// =========================================================

function destinationPoint(

  lat: number,

  lon: number,

  distance: number,

  bearing: number

): [number, number] {

  const R = 6371000;

  const brng =
    bearing * Math.PI / 180;

  const lat1 =
    lat * Math.PI / 180;

  const lon1 =
    lon * Math.PI / 180;


  const lat2 =
    Math.asin(

      Math.sin(lat1) *
      Math.cos(distance / R)

      +

      Math.cos(lat1) *
      Math.sin(distance / R) *
      Math.cos(brng)

    );


  const lon2 =

    lon1 +

    Math.atan2(

      Math.sin(brng) *
      Math.sin(distance / R) *
      Math.cos(lat1),

      Math.cos(distance / R) -

      Math.sin(lat1) *
      Math.sin(lat2)

    );


  return [

    lat2 * 180 / Math.PI,

    lon2 * 180 / Math.PI

  ];

}


// =========================================================
// GASZONE
// =========================================================

function RiskArea({

  latitude,

  longitude,

  windDirection,

  windSpeed,

  onZoneCreated

}: RiskAreaProps) {


  // =======================================================
  // WINDSNELHEID
  //
  // Open-Meteo levert de windsnelheid in km/h.
  //
  // Voor de berekening van de gaszone gebruiken we m/s.
  // =======================================================

  const windSpeedMs =
    windSpeed / 3.6;


  // =======================================================
  // LENGTE GASZONE
  //
  // Minimum: 300 meter
  // Vervolgens +250 meter per m/s wind
  // Maximum: 2800 meter
  // =======================================================

  const length = Math.min(

    300 + windSpeedMs * 250,

    2800

  );


  // =======================================================
  // BREEDTE GASZONE
  // =======================================================

  const width = 250;


  // =======================================================
  // PUNTEN VAN DE GASZONE
  //
  // De vorm begint bij de incidentlocatie en loopt
  // vervolgens met de wind mee.
  // =======================================================

  const points =
    useMemo(() => {

      const result:
        [number, number][] = [];


      const steps = 40;


      for (
        let i = 0;
        i <= steps;
        i++
      ) {

        const angle =
          Math.PI * i / steps;


        /*
         * Voor iedere positie over de lengte van de
         * gaszone bepalen we de halve breedte.
         */

        const forward =
          (1 - Math.cos(angle)) *
          (length / 2);


        const side =
          Math.sin(angle) *
          width;


        /*
         * Middenlijn van de gaszone.
         */

        const centerPoint =
          destinationPoint(

            latitude,

            longitude,

            forward,

            windDirection

          );


        /*
         * Linkerzijde.
         */

        const leftPoint =
          destinationPoint(

            centerPoint[0],

            centerPoint[1],

            side,

            windDirection + 90

          );


        result.push(leftPoint);

      }


      /*
       * Rechterzijde terug naar het begin.
       */

      for (
        let i = steps;
        i >= 0;
        i--
      ) {

        const angle =
          Math.PI * i / steps;


        const forward =
          (1 - Math.cos(angle)) *
          (length / 2);


        const side =
          Math.sin(angle) *
          width;


        const centerPoint =
          destinationPoint(

            latitude,

            longitude,

            forward,

            windDirection

          );


        const rightPoint =
          destinationPoint(

            centerPoint[0],

            centerPoint[1],

            side,

            windDirection - 90

          );


        result.push(rightPoint);

      }


      return result;

    }, [

      latitude,

      longitude,

      windDirection,

      windSpeed,

      length

    ]);


  // =======================================================
  // GASZONE DOORGEVEN AAN MAPVIEW
  // =======================================================

  useEffect(() => {

    if (onZoneCreated) {

      onZoneCreated(points);

    }

  }, [

    points,

    onZoneCreated

  ]);


  // =======================================================
  // TEKEN GASZONE
  // =======================================================

  return (

    <Polygon

      positions={points}

      pathOptions={{

        color: "red",

        fillColor: "red",

        fillOpacity: 0.25,

        weight: 2

      }}

    />

  );

}


export default RiskArea;