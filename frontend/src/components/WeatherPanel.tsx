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
        <p>💨 Beaufort: --</p>
        <p>🌡 Temperatuur: --</p>
      </div>
    );
  }


  return (
    <div className="weather">

      <p>
        🌬 Wind: <strong>{weather.windSpeed} km/u</strong>
      </p>

      <p>
        🧭 Richting: <strong>{weather.windDirectionText}</strong>
      </p>

      <p>
        💨 Windkracht: <strong>{getBeaufort(weather.windSpeed)} Beaufort</strong>
      </p>

      <p>
        🌡 Temperatuur: <strong>{weather.temperature} °C</strong>
      </p>

      <p>
        🕒 Meting: <strong>{weather.measurementTime}</strong>
      </p>

      <small>
        Bron: Open-Meteo
      </small>

    </div>
  );
}

export default WeatherPanel;