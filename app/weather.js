(() => {
  const elements = {
    locationButton: document.querySelector("[data-weather-location-button]"),
    searchForm: document.querySelector("[data-weather-search-form]"),
    searchInput: document.querySelector("[data-weather-search-input]"),
    searchButton: document.querySelector("[data-weather-search-button]"),
    resultsWrap: document.querySelector("[data-weather-results-wrap]"),
    results: document.querySelector("[data-weather-results]"),
    selectButton: document.querySelector("[data-weather-select-button]"),
    message: document.querySelector("[data-weather-message]"),
    location: document.querySelector("[data-weather-location]"),
    content: document.querySelector("[data-weather-content]"),
    icon: document.querySelector("[data-weather-icon]"),
    condition: document.querySelector("[data-weather-condition]"),
    rainTotal: document.querySelector("[data-weather-rain-total]"),
    rainChance: document.querySelector("[data-weather-rain-chance]"),
    wind: document.querySelector("[data-weather-wind]"),
    windDirection: document.querySelector("[data-weather-wind-direction]"),
    alerts: document.querySelector("[data-weather-alerts]"),
    updated: document.querySelector("[data-weather-updated]"),
  };

  if (Object.values(elements).some((element) => !element)) {
    console.error("[WEATHER] Weather dashboard markup is incomplete.");
    return;
  }

  const LOCATION_STORAGE_KEY = "smartFarmWeatherLocation";
  const FORECAST_HOURS = 24;
  const weatherCodes = {
    0: ["Clear sky", "☀"],
    1: ["Mainly clear", "🌤"],
    2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁"],
    45: ["Fog", "🌫"],
    48: ["Rime fog", "🌫"],
    51: ["Light drizzle", "🌦"],
    53: ["Moderate drizzle", "🌦"],
    55: ["Dense drizzle", "🌧"],
    56: ["Light freezing drizzle", "🌧"],
    57: ["Dense freezing drizzle", "🌧"],
    61: ["Slight rain", "🌧"],
    63: ["Moderate rain", "🌧"],
    65: ["Heavy rain", "🌧"],
    66: ["Light freezing rain", "🌧"],
    67: ["Heavy freezing rain", "🌧"],
    71: ["Slight snowfall", "🌨"],
    73: ["Moderate snowfall", "🌨"],
    75: ["Heavy snowfall", "❄"],
    77: ["Snow grains", "🌨"],
    80: ["Slight rain showers", "🌦"],
    81: ["Moderate rain showers", "🌧"],
    82: ["Violent rain showers", "🌧"],
    85: ["Slight snow showers", "🌨"],
    86: ["Heavy snow showers", "🌨"],
    95: ["Thunderstorm", "⛈"],
    96: ["Thunderstorm with hail", "⛈"],
    99: ["Thunderstorm with heavy hail", "⛈"],
  };

  function setMessage(message, isError = false) {
    elements.message.textContent = message;
    elements.message.classList.toggle("is-error", isError);
  }

  function setControlsDisabled(disabled) {
    [
      elements.locationButton,
      elements.searchInput,
      elements.searchButton,
      elements.results,
      elements.selectButton,
    ].forEach((control) => {
      control.disabled = disabled;
    });
  }

  function isValidLocation(location) {
    return location &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 && location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 && location.longitude <= 180 &&
      typeof location.name === "string" && location.name.trim();
  }

  function readSavedLocation() {
    try {
      const saved = sessionStorage.getItem(LOCATION_STORAGE_KEY);
      if (!saved) return null;
      const location = JSON.parse(saved);
      if (isValidLocation(location)) return location;
      console.warn("[WEATHER] Ignoring invalid saved farm location.");
      sessionStorage.removeItem(LOCATION_STORAGE_KEY);
      return null;
    } catch (error) {
      console.error("[WEATHER] Could not read the saved farm location:", error);
      return null;
    }
  }

  function saveLocation(location) {
    try {
      sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
      return true;
    } catch (error) {
      console.error("[WEATHER] Could not save the farm location for this session:", error);
      return false;
    }
  }

  async function fetchJson(url, serviceName) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`${serviceName} returned HTTP ${response.status}.`);
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw new Error(`${serviceName} request timed out.`);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function locationLabel(place) {
    return [
      place.name,
      place.admin1,
      place.country,
    ].filter(Boolean).join(", ");
  }

  function renderLocationResults(places) {
    elements.results.replaceChildren();
    places.forEach((place) => {
      const option = document.createElement("option");
      option.value = JSON.stringify({
        latitude: place.latitude,
        longitude: place.longitude,
        name: locationLabel(place),
      });
      option.textContent = locationLabel(place);
      elements.results.append(option);
    });
    elements.resultsWrap.hidden = places.length === 0;
  }

  function requestPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location access is not available in this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        (error) => {
          const message = error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Allow it in browser settings, then try again."
            : error.code === error.POSITION_UNAVAILABLE
              ? "Your location could not be determined. Check your device location settings."
              : "The location request timed out. Please try again.";
          reject(new Error(message));
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
      );
    });
  }

  async function reverseGeocode({ latitude, longitude }) {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "en",
    }).toString();
    const place = await fetchJson(url, "Location lookup");
    return place.city || place.locality ||
      place.localityInfo?.administrative?.[0]?.name ||
      place.principalSubdivision || place.countryName || "Selected farm area";
  }

  function describeWeather(code) {
    return weatherCodes[code] || ["Conditions unavailable", "☁"];
  }

  function formatDirection(degrees) {
    if (typeof degrees !== "number" || !Number.isFinite(degrees)) return "Unavailable";
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const compass = directions[Math.round(degrees / 45) % directions.length];
    return `${compass} · ${Math.round(degrees)}°`;
  }

  function addWatch(watches, key, text, time) {
    if (watches.has(key)) return;
    watches.set(key, `${text} · ${time}`);
  }

  function getForecastWatches(weather, startIndex, endIndex) {
    // These are model-derived watches, not official alerts from a warning service.
    const watches = new Map();
    const hourly = weather.hourly;
    for (let index = startIndex; index < endIndex; index += 1) {
      const code = hourly.weather_code[index];
      const precipitation = hourly.precipitation[index];
      const gust = hourly.wind_gusts_10m[index];
      const time = hourly.time[index]?.slice(11, 16) || "time unavailable";
      const description = weatherCodes[code]?.[0];

      if (typeof code === "number" && code >= 95) {
        addWatch(watches, "storm", `${description || "Thunderstorm"} forecast`, time);
      }
      if (code === 65 || code === 67 || code === 82 ||
          (typeof precipitation === "number" && precipitation >= 10)) {
        addWatch(watches, "heavy-rain", "Heavy rainfall forecast", time);
      }
      if (code === 75 || code === 86) {
        addWatch(watches, "heavy-snow", "Heavy snowfall forecast", time);
      }
      if (typeof gust === "number" && gust >= 70) {
        addWatch(watches, "very-strong-wind", `Very strong gusts · ${Math.round(gust)} km/h`, time);
      } else if (typeof gust === "number" && gust >= 50) {
        addWatch(watches, "strong-wind", `Strong gusts · ${Math.round(gust)} km/h`, time);
      }
    }
    return [...watches.values()];
  }

  function renderWatches(watches) {
    elements.alerts.replaceChildren();
    const items = watches.length > 0
      ? watches
      : ["No significant weather alerts in the next 24 hours."];
    items.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      if (watches.length > 0) item.classList.add("is-alert");
      elements.alerts.append(item);
    });
  }

  async function loadWeather(location, { save = true } = {}) {
    const saved = save ? saveLocation(location) : true;
    elements.location.textContent = location.name;
    elements.content.hidden = true;
    elements.resultsWrap.hidden = true;
    setMessage("Loading the regional outdoor forecast…");
    setControlsDisabled(true);

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
      hourly: "precipitation_probability,precipitation,weather_code,wind_gusts_10m",
      wind_speed_unit: "kmh",
      precipitation_unit: "mm",
      timezone: "auto",
      forecast_days: "2",
    }).toString();

    try {
      const weather = await fetchJson(url, "Open-Meteo");
      const current = weather.current;
      const hourly = weather.hourly;
      if (!current || !hourly || !Array.isArray(hourly.time) ||
          !Array.isArray(hourly.precipitation_probability) ||
          !Array.isArray(hourly.precipitation) ||
          !Array.isArray(hourly.weather_code) ||
          !Array.isArray(hourly.wind_gusts_10m)) {
        throw new Error("Forecast data is incomplete for this location.");
      }

      const startIndex = hourly.time.findIndex((time) => time >= current.time);
      if (startIndex < 0) throw new Error("The 24-hour forecast is unavailable for this location.");
      const endIndex = Math.min(startIndex + FORECAST_HOURS, hourly.time.length);
      const rainValues = hourly.precipitation.slice(startIndex, endIndex)
        .filter((value) => typeof value === "number" && Number.isFinite(value));
      const probabilityValues = hourly.precipitation_probability.slice(startIndex, endIndex)
        .filter((value) => typeof value === "number" && Number.isFinite(value));
      const condition = describeWeather(current.weather_code);
      const rainTotal = rainValues.length
        ? `${rainValues.reduce((total, value) => total + value, 0).toFixed(1)} mm`
        : "Unavailable";
      const maxRainChance = probabilityValues.length
        ? `${Math.max(...probabilityValues)}%`
        : "Unavailable";
      const windSpeed = typeof current.wind_speed_10m === "number"
        ? `${Math.round(current.wind_speed_10m)} km/h`
        : "Unavailable";
      const watches = getForecastWatches(weather, startIndex, endIndex);
      const updatedAt = new Date();

      elements.icon.textContent = condition[1];
      elements.condition.textContent = condition[0];
      elements.rainTotal.textContent = rainTotal;
      elements.rainChance.textContent = maxRainChance;
      elements.wind.textContent = windSpeed;
      elements.windDirection.textContent = formatDirection(current.wind_direction_10m);
      renderWatches(watches);
      elements.updated.textContent = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(updatedAt);
      elements.updated.dateTime = updatedAt.toISOString();
      elements.content.hidden = false;
      setMessage(saved
        ? "Regional outdoor forecast from Open-Meteo. Not measured by the ESP32."
        : "Forecast loaded, but this location could not be saved for the current session.");
    } catch (error) {
      console.error("[WEATHER]", error);
      setMessage(error.message || "Weather could not be loaded. Please try again.", true);
    } finally {
      setControlsDisabled(false);
    }
  }

  elements.searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = elements.searchInput.value.trim();
    if (query.length < 2) {
      setMessage("Enter at least two characters to search for a location.", true);
      return;
    }

    setControlsDisabled(true);
    elements.resultsWrap.hidden = true;
    setMessage("Searching locations…");
    try {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.search = new URLSearchParams({
        name: query,
        count: "6",
        language: "en",
        format: "json",
      }).toString();
      const data = await fetchJson(url, "Location search");
      const places = Array.isArray(data.results) ? data.results : [];
      if (places.length === 0) {
        setMessage("No matching locations found. Try a nearby town or region.", true);
        return;
      }
      renderLocationResults(places);
      setMessage("Choose the matching town or region, then use that location.");
    } catch (error) {
      console.error("[WEATHER] Location search failed:", error);
      setMessage(error.message || "Location search failed. Please try again.", true);
    } finally {
      setControlsDisabled(false);
    }
  });

  elements.selectButton.addEventListener("click", async () => {
    if (!elements.results.value) {
      setMessage("Select a location from the search results first.", true);
      return;
    }
    try {
      const location = JSON.parse(elements.results.value);
      if (!isValidLocation(location)) throw new Error("The selected location is invalid.");
      await loadWeather(location);
    } catch (error) {
      console.error("[WEATHER] Could not use the selected location:", error);
      setMessage(error.message || "The selected location could not be used.", true);
    }
  });

  elements.locationButton.addEventListener("click", async () => {
    setControlsDisabled(true);
    setMessage("Requesting browser location permission…");
    try {
      const coordinates = await requestPosition();
      let name = "Selected farm area";
      try {
        name = await reverseGeocode(coordinates);
      } catch (error) {
        console.warn("[WEATHER] Place name lookup unavailable:", error);
      }
      await loadWeather({ ...coordinates, name });
    } catch (error) {
      console.error("[WEATHER] Could not use browser location:", error);
      setMessage(error.message || "Location could not be determined.", true);
      setControlsDisabled(false);
    }
  });

  const savedLocation = readSavedLocation();
  if (savedLocation) {
    elements.location.textContent = savedLocation.name;
    loadWeather(savedLocation, { save: false });
  }
})();
