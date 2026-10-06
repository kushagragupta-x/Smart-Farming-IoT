(() => {
  const elements = {
    button: document.querySelector("[data-weather-location-button]"),
    message: document.querySelector("[data-weather-message]"),
    location: document.querySelector("[data-weather-location]"),
    content: document.querySelector("[data-weather-content]"),
    icon: document.querySelector("[data-weather-icon]"),
    temperature: document.querySelector("[data-weather-temperature]"),
    condition: document.querySelector("[data-weather-condition]"),
    feels: document.querySelector("[data-weather-feels]"),
    humidity: document.querySelector("[data-weather-humidity]"),
    rain: document.querySelector("[data-weather-rain]"),
    wind: document.querySelector("[data-weather-wind]"),
    updated: document.querySelector("[data-weather-updated]"),
  };

  if (Object.values(elements).some((element) => !element)) return;

  const weatherCodes = {
    0: ["Clear sky", "☀"],
    1: ["Mainly clear", "🌤"],
    2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁"],
    45: ["Fog", "🌫"],
    48: ["Depositing rime fog", "🌫"],
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

  function requestPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not available in this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        (error) => {
          const message = error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Allow it in your browser settings, then try again."
            : error.code === error.POSITION_UNAVAILABLE
              ? "Your location could not be determined. Check your device location settings and try again."
              : "The location request timed out. Please try again.";
          reject(new Error(message));
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
      );
    });
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

  function describeWeather(code) {
    return weatherCodes[code] || ["Current conditions", "☁"];
  }

  async function loadWeather({ latitude, longitude }) {
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
      hourly: "precipitation_probability",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      precipitation_unit: "mm",
      timezone: "auto",
      forecast_days: "1",
    }).toString();
    const reverseGeocodeUrl = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    reverseGeocodeUrl.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "en",
    }).toString();

    const [weather, place] = await Promise.all([
      fetchJson(weatherUrl, "Open-Meteo"),
      fetchJson(reverseGeocodeUrl, "Location lookup").catch((error) => {
        console.warn("[LOCAL WEATHER] City lookup unavailable:", error);
        return null;
      }),
    ]);
    const current = weather.current;
    if (!current || typeof current.temperature_2m !== "number") {
      throw new Error("Weather data is unavailable for this location.");
    }

    const condition = describeWeather(current.weather_code);
    const hourIndex = weather.hourly?.time?.findIndex((time) => time.slice(0, 13) === current.time.slice(0, 13)) ?? -1;
    const rainChance = hourIndex >= 0 ? weather.hourly.precipitation_probability?.[hourIndex] : null;
    const placeName = place && (
      place.city || place.locality || place.localityInfo?.administrative?.[0]?.name ||
      place.principalSubdivision || place.countryName
    );
    const updatedAt = new Date();

    elements.location.textContent = placeName || "Nearby";
    elements.icon.textContent = condition[1];
    elements.temperature.textContent = `${Math.round(current.temperature_2m)}°C`;
    elements.condition.textContent = condition[0];
    elements.feels.textContent = typeof current.apparent_temperature === "number"
      ? `Feels like ${Math.round(current.apparent_temperature)}°C`
      : "";
    elements.humidity.textContent = `${current.relative_humidity_2m}%`;
    elements.rain.textContent = typeof rainChance === "number"
      ? `${rainChance}%${current.precipitation > 0 ? ` · ${current.precipitation} mm now` : ""}`
      : `${current.precipitation} mm`;
    elements.wind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    elements.updated.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(updatedAt);
    elements.updated.dateTime = updatedAt.toISOString();
    elements.content.hidden = false;
    elements.message.textContent = "Current conditions from Open-Meteo. Location lookup by BigDataCloud.";
    elements.message.classList.remove("is-error");
    elements.button.textContent = "Refresh weather";
  }

  elements.button.addEventListener("click", async () => {
    elements.button.disabled = true;
    elements.button.textContent = "Getting weather...";
    elements.message.classList.remove("is-error");
    elements.message.textContent = "Requesting your location. Weather lookup starts only after permission is granted.";
    let locationGranted = false;
    try {
      const position = await requestPosition();
      locationGranted = true;
      await loadWeather(position);
    } catch (error) {
      console.error("[LOCAL WEATHER]", error);
      elements.location.textContent = locationGranted ? "Weather unavailable" : "Location not available";
      elements.content.hidden = true;
      elements.message.textContent = error.message || "Weather could not be loaded. Please try again.";
      elements.message.classList.add("is-error");
      elements.button.textContent = "Try again";
    } finally {
      elements.button.disabled = false;
    }
  });
})();
