export interface WeatherResult {
  windSpeed: number;
  windDirection: number;
  windDirectionText: string;
  temperature: number;
  measurementTime: string;
}


// Zet graden om naar windrichting tekst
function degreesToDirection(degrees: number): string {

  const directions = [
    "N",
    "NO",
    "O",
    "ZO",
    "Z",
    "ZW",
    "W",
    "NW"
  ];


  const index =
    Math.round(degrees / 45) % 8;


  return directions[index];
}


// Beaufort berekening
function calculateBeaufort(speed: number): number {

  if (speed < 2) return 0;
  if (speed < 6) return 1;
  if (speed < 12) return 2;
  if (speed < 20) return 3;
  if (speed < 29) return 4;
  if (speed < 39) return 5;
  if (speed < 50) return 6;
  if (speed < 62) return 7;
  if (speed < 75) return 8;
  if (speed < 89) return 9;
  if (speed < 103) return 10;
  if (speed < 118) return 11;

  return 12;
}


export function getBeaufort(speed: number): number {
  return calculateBeaufort(speed);
}



export async function getWeather(
  latitude: number,
  longitude: number
): Promise<WeatherResult> {


  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=Europe%2FAmsterdam`;



  const response =
    await fetch(url);



  if (!response.ok) {

    throw new Error(
      "Weergegevens ophalen mislukt"
    );

  }



  const data =
    await response.json();



  // Belangrijk:
  // Open-Meteo geeft de richting waar de wind VANDAAN komt.
  // Deze waarde houden we voor de gebruiker zichtbaar.

  const windDirection =
    data.current.wind_direction_10m;



  return {

    windSpeed:
      data.current.wind_speed_10m,


    windDirection:
      windDirection,


    windDirectionText:
      degreesToDirection(
        windDirection
      ),


    temperature:
      data.current.temperature_2m,


    measurementTime:
      data.current.time

  };

}