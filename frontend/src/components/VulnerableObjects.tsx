import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { getVulnerableObjects } from "../services/vulnerableObjectService";
import L from "leaflet";


interface VulnerableObject {

  id:string;
  name:string;
  type:string;
  latitude:number;
  longitude:number;

}


interface Props {

  latitude:number;
  longitude:number;
  gasZone?:[number,number][];

}



function iconForType(type:string){

  let icon="📍";

  if(type==="school")
    icon="🏫";

  if(type==="hospital")
    icon="🏥";

  if(type==="church")
    icon="⛪";

  if(type==="shop")
    icon="🏪";


  return L.divIcon({

    html:
      `<div style="font-size:24px">${icon}</div>`,

    className:""

  });

}




export default function VulnerableObjects({

  latitude,

  longitude

}:Props){


  const [objects,setObjects] = useState<VulnerableObject[]>([]);



  useEffect(()=>{


    async function load(){


      try {


      const result = await getVulnerableObjects(

  latitude,

  longitude,

  3000,


);
        console.log(
          "Objecten geladen:",
          result.length
        );


        console.log("Overpass objecten:", result);

setObjects(result);


      } catch(error){


        console.error(
          "Object fout:",
          error
        );


      }


    }


    load();


  },[latitude,longitude]);




  return (

    <>

    {

      objects.map(obj=>(


        <Marker

          key={obj.id}

          position={[

            obj.latitude,

            obj.longitude

          ]}

          icon={iconForType(obj.type)}

        >

          <Popup>

            <b>{obj.name}</b>

            <br/>

            {obj.type}

          </Popup>


        </Marker>


      ))

    }

    </>

  );


}