import { useState } from "react";
import { searchAddress } from "../services/pdokService";

interface SearchBarProps {
  onLocationFound: (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
}

function SearchBar({ onLocationFound }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSearch() {
    if (!query.trim()) {
      setMessage("Voer eerst een adres in.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const result = await searchAddress(query);

      if (!result) {
        setMessage("Adres niet gevonden.");
        return;
      }

      onLocationFound(result);
    } catch (error) {
      setMessage("Er ging iets mis bij het zoeken.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  }

  return (
    <div className="search-container">
      <input
        type="text"
        placeholder="Voer een Nederlands adres in..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button onClick={handleSearch} disabled={loading}>
        {loading ? "Zoeken..." : "Start scan"}
      </button>

      {message && (
        <p>{message}</p>
      )}
    </div>
  );
}

export default SearchBar;
