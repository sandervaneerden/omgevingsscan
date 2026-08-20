import { Polygon } from "react-leaflet";
import { useEffect } from "react";


interface RiskAreaProps {

  latitude: number;

  longitude: number;

  windDirection: number;

  windSpeed: number;

  onZoneCreated?: (
    points:[number,number][]
  ) => void;

}



function destinationPoint(

  lat:number,

  lon:number,

  distance:number,

  bearing:number

):[number,number] {


  const R = 6371000;


  const brng = bearing * Math.PI / 180;

  const lat1 = lat * Math.PI / 180;

  const lon1 = lon * Math.PI / 180;


  const lat2 = Math.asin(

    Math.sin(lat1) *

    Math.cos(distance / R)

    +

    Math.cos(lat1) *

    Math.sin(distance / R)

    *

    Math.cos(brng)

  );


  const lon2 =

    lon1 +

    Math.atan2(

      Math.sin(brng)

      *

      Math.sin(distance / R)

      *

      Math.cos(lat1),

      Math.cos(distance / R)

      -

      Math.sin(lat1)

      *

      Math.sin(lat2)

    );


  return [

    lat2 * 180 / Math.PI,

    lon2 * 180 / Math.PI

  ];

}





function RiskArea({

  latitude,

  longitude,

  windDirection,

  windSpeed,

  onZoneCreated

}:RiskAreaProps) {



  const length = Math.min(

    1400 + windSpeed * 250,

    2800

  );


  const width = 250;


  const points:[number,number][] = [];


  const steps = 40;


  const centerDistance = length / 2;


  const center = destinationPoint(

    latitude,

    longitude,

    centerDistance,

    windDirection

  );





  for(let i=0;i<=steps;i++){


    const angle =

      Math.PI * 2 * i / steps;



    const forward =

      Math.cos(angle)

      *

      centerDistance;



    const side =

      Math.sin(angle)

      *

      width;



    const forwardPoint = destinationPoint(

      center[0],

      center[1],

      Math.abs(forward),

      forward >= 0

        ? windDirection

        : windDirection + 180

    );



    const finalPoint = destinationPoint(

      forwardPoint[0],

      forwardPoint[1],

      Math.abs(side),

      side >= 0

        ? windDirection + 90

        : windDirection - 90

    );


    points.push(finalPoint);

  }





  useEffect(()=>{


    if(onZoneCreated){

      onZoneCreated(points);

    }


  },[

    latitude,

    longitude,

    windDirection,

    windSpeed

  ]);





  return (

    <Polygon

      positions={points}

      pathOptions={{

        color:"red",

        fillColor:"red",

        fillOpacity:0.25

      }}

    />

  );

}



export default RiskArea;