import { getBeaufort } from "../services/weatherService";
import type { WeatherResult } from "../services/weatherService";

interface WeatherPanelProps {
  weather: WeatherResult | null;
}

function WeatherPanel({ weather }: WeatherPanelProps) {
  if (!weather) {
    return (
      <div className="weather">
        <p>🌬 Wind: nog geen gegevens</p>
        <p>🧭 Richting: --</p>
        <p>💨 Windkracht: --</p>
        <p>🌡 Temperatuur: --</p>
      </div>
    );
  }

  const windSpeedMs = weather.windSpeed / 3.6;

  return (
    <div className="weather">

      <p>
        🌬 Wind:{" "}
        <strong>{weather.windSpeed.toFixed(1)} km/u</strong>{" "}
        ({windSpeedMs.toFixed(1)} m/s)
      </p>

      <p>
        🧭 Richting:{" "}
        <strong>{weather.windDirectionText}</strong>
      </p>

      <p>
        💨 Windkracht:{" "}
        <strong>{getBeaufort(weather.windSpeed)} Beaufort</strong>
      </p>

      <p>
        🌡 Temperatuur:{" "}
        <strong>{weather.temperature} °C</strong>
      </p>

      <p>
        🕒 Meting:{" "}
        <strong>{weather.measurementTime}</strong>
      </p>

      <small>
        Bron: Open-Meteo
      </small>

    </div>
  );
}

export default WeatherPanel;