import { getBeaufort } from "../services/weatherService";
import type { WeatherResult } from "../services/weatherService";

interface WeatherPanelProps {
  weather: WeatherResult | null;
}


// =========================================================
// WINDRICHTING MET GRADEN
// =========================================================

function getWindDirectionWithDegrees(
  direction: string,
  degrees: number
): string {

  if (!Number.isFinite(degrees)) {
    return direction;
  }

  return `${direction} (${Math.round(degrees)}°)`;
}


// =========================================================
// WEATHER PANEL
// =========================================================

function WeatherPanel({
  weather
}: WeatherPanelProps) {

  // =======================================================
  // GEEN WEERGEGEVENS
  // =======================================================

  if (!weather) {

    return (

      <div className="weather">

        <p>
          💨 Windkracht:{" "}
          <strong>--</strong>
        </p>

        <p>
          🌬 Windsnelheid:{" "}
          <strong>--</strong>
        </p>

        <p>
          🧭 Windrichting:{" "}
          <strong>--</strong>
        </p>

        <p>
          🌡 Temperatuur:{" "}
          <strong>--</strong>
        </p>

        <p>
          🕒 Meting:{" "}
          <strong>--</strong>
        </p>

      </div>

    );
  }


  // =======================================================
  // WINDSNELHEID
  //
  // weather.windSpeed komt binnen als km/u.
  // =======================================================

  const windSpeedKmh =
    weather.windSpeed;

  const windSpeedMs =
    windSpeedKmh / 3.6;


  // =======================================================
  // WINDKRACHT
  // =======================================================

  const beaufort =
    getBeaufort(
      windSpeedKmh
    );


  // =======================================================
  // WINDRICHTING
  //
  // De windrichting in graden komt uit de WeatherResult.
  // =======================================================

  const windDirectionDegrees =
    Number(
      weather.windDirection
    );


  const windDirection =
    getWindDirectionWithDegrees(
      weather.windDirectionText,
      windDirectionDegrees
    );


  // =======================================================
  // RENDER
  // =======================================================

  return (

    <div className="weather">

      {/* =================================================
          WINDKRACHT
          ================================================= */}

      <p>

        💨 Windkracht:{" "}

        <strong>
          {beaufort} Beaufort
        </strong>

      </p>


      {/* =================================================
          WINDSNELHEID
          ================================================= */}

      <p>

        🌬 Windsnelheid:{" "}

        <strong>
          {windSpeedKmh.toFixed(1)} km/u
        </strong>{" "}

        (
        {windSpeedMs.toFixed(1)} m/s
        )

      </p>


      {/* =================================================
          WINDRICHTING
          ================================================= */}

      <p>

        🧭 Windrichting:{" "}

        <strong>
          {windDirection}
        </strong>

      </p>


      {/* =================================================
          TEMPERATUUR
          ================================================= */}

      <p>

        🌡 Temperatuur:{" "}

        <strong>
          {weather.temperature} °C
        </strong>

      </p>


      {/* =================================================
          MEETTIJD
          ================================================= */}

      <p>

        🕒 Meting:{" "}

        <strong>
          {weather.measurementTime}
        </strong>

      </p>


      {/* =================================================
          BRON
          ================================================= */}

      <small>
        Bron: Open-Meteo
      </small>

    </div>

  );
}


export default WeatherPanel;