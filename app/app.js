const BLYNK_AUTH_TOKEN = "IMz1W97RnK2l9Y_cGsoBEzPGsKr1jQt-";
const BLYNK_API_BASE = "https://blynk.cloud/external/api";
const BLYNK_VIRTUAL_PINS = {
  pump: "V0",
  temperature: "V1",
  humidity: "V2",
  mode: "V5",
  season: "V6",
  cropProfile: "V7",
  customMoisture: "V8",
  soilMoisture: "V4",
};
const BLYNK_REQUEST_TIMEOUT_MS = 8000;
let refreshInProgress = false;
let pumpCommandInFlight = false;
let pumpCommandVersion = 0;

const translations = {
  en: {
    brandTitle: "SMART FARM",
    projectInfo: "PROJECT INFO",
    systemStatus: "SYSTEM STATUS",
    soilMoisture: "SOIL MOISTURE",
    humidity: "HUMIDITY",
    temperature: "TEMPERATURE",
    pumpStatus: "PUMP STATUS",
    waterSystem: "WATER SYSTEM",
    pumpControl: "PUMP CONTROL",
    automatic: "AUTOMATIC",
    manual: "MANUAL",
    season: "SEASON",
    cropProfile: "CROP PROFILE",
    soilMoistureTrend: "SOIL MOISTURE TREND",
    adaptiveIrrigation: "ADAPTIVE IRRIGATION",
    adaptiveDecision: "ADAPTIVE DECISION",
    irrigationRequired: "IRRIGATION REQUIRED?",
    moistureTrend: "MOISTURE TREND",
    requirement: "REQUIREMENT",
    componentStatus: "COMPONENT STATUS",
    soilSensor: "SOIL SENSOR",
    relay: "RELAY",
    pump: "PUMP",
    pumpOn: "PUMP ON",
    pumpOff: "PUMP OFF",
    pumpNotConnected: "NOT CONNECTED",
    offline: "OFFLINE",
    online: "ONLINE",
    noSensorData: "NO SENSOR DATA",
    systemOnline: "SYSTEM ONLINE",
    systemOffline: "SYSTEM OFFLINE",
    irrigation: "IRRIGATION",
    automaticShort: "AUTO",
    manualShort: "MANUAL",
  },
  hi: {
    brandTitle: "स्मार्ट फार्म",
    projectInfo: "प्रोजेक्ट जानकारी",
    systemStatus: "सिस्टम स्थिति",
    soilMoisture: "मिट्टी की नमी",
    humidity: "आर्द्रता",
    temperature: "तापमान",
    pumpStatus: "पंप स्थिति",
    waterSystem: "जल प्रणाली",
    pumpControl: "पंप नियंत्रण",
    automatic: "स्वचालित",
    manual: "मैनुअल",
    season: "मौसम",
    cropProfile: "फसल प्रोफ़ाइल",
    soilMoistureTrend: "मिट्टी की नमी ट्रेंड",
    adaptiveIrrigation: "अनुकूली सिंचाई",
    adaptiveDecision: "अनुकूली निर्णय",
    irrigationRequired: "सिंचाई आवश्यक?",
    moistureTrend: "नमी ट्रेंड",
    requirement: "आवश्यकता",
    componentStatus: "घटक स्थिति",
    soilSensor: "मिट्टी सेंसर",
    relay: "रिले",
    pump: "पंप",
    pumpOn: "पंप चालू",
    pumpOff: "पंप बंद",
    pumpNotConnected: "कनेक्ट नहीं",
    offline: "ऑफलाइन",
    online: "ऑनलाइन",
    noSensorData: "सेंसर डेटा उपलब्ध नहीं",
    systemOnline: "सिस्टम ऑनलाइन",
    systemOffline: "सिस्टम ऑफलाइन",
    irrigation: "सिंचाई",
    automaticShort: "स्वचालित",
    manualShort: "मैनुअल",
  },
};

const componentInfo = {
  esp32: {
    en: "Controls the irrigation logic and maintains the secure Blynk connection.",
    hi: "सिंचाई तर्क को नियंत्रित करता है और सुरक्षित Blynk कनेक्शन बनाए रखता है।",
  },
  soilSensor: {
    en: "Measures moisture in the root zone and feeds live soil conditions to the ESP32.",
    hi: "जड़ क्षेत्र की नमी को मापता है और ESP32 को वास्तविक मिट्टी की स्थिति देता है।",
  },
  dht11: {
    en: "Tracks ambient humidity and temperature during irrigation decision checks.",
    hi: "सिंचाई निर्णय परीक्षण के दौरान परिवेश की आर्द्रता और तापमान को मापता है।",
  },
  oled: {
    en: "Displays local system status and quick operational readouts for the field controller.",
    hi: "फ़ील्ड नियंत्रक के लिए स्थानीय सिस्टम स्थिति और त्वरित परिचालन पढ़ने वाले प्रदर्शित करता है।",
  },
  relay: {
    en: "Switches the irrigation circuit safely based on the control decision and hardware state.",
    hi: "नियंत्रण निर्णय और हार्डवेयर स्थिति के आधार पर सिंचाई सर्किट को सुरक्षित रूप से स्विच करता है।",
  },
  pump: {
    en: "Moves water through the irrigation line when the relay and schedule allow activation.",
    hi: "जब रिले और अनुसूची सक्रिय करने की अनुमति देती है, तो जल को सिंचाई लाइन में ले जाता है।",
  },
};

const systemState = {
  esp32Online: false,
  wifiConnected: false,
  cloudConnected: false,
  soilMoisture: null,
  temperature: null,
  humidity: null,
  irrigationMode: "AUTO",
  moistureTrend: null,
  irrigationRequirement: null,
  season: "SUMMER",
  cropProfile: "GENERAL CROPS",
  customMoisture: null,
  statusState: "CHECKING",
  pumpCommand: "OFF",
  language: localStorage.getItem("smartFarmLang") || "en",
};

const sensorHistory = {
  temperature: [],
  humidity: [],
  soilMoisture: [],
};

const elements = {
  connectionLabel: document.querySelector("[data-connection-label]"),
  connectionBadge: document.querySelector("[data-connection-badge]"),
  heroStatus: document.querySelector("[data-hero-status]"),
  heroStatusText: document.querySelector("[data-esp32-status-text]"),
  heroStatusMeta: document.querySelector("[data-esp32-status-meta]"),
  commandMessage: document.querySelector("[data-command-message]"),
  pumpButton: document.querySelector("[data-pump-command]"),
  pumpState: document.querySelector("[data-pump-state]"),
  pumpReadout: document.querySelector("[data-pump-readout]"),
  requirement: document.querySelector("[data-requirement]"),
  requirementCopy: document.querySelector("[data-requirement-copy]"),
  trend: document.querySelector("[data-trend]"),
  componentInfoName: document.getElementById("componentInfoName"),
  componentInfoStatus: document.getElementById("componentInfoStatus"),
  componentInfoText: document.getElementById("componentInfoText"),
};

function t(key, fallback = key) {
  const selected = translations[systemState.language] || translations.en;
  return selected[key] || fallback;
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function assertBlynkToken() {
  if (!BLYNK_AUTH_TOKEN || BLYNK_AUTH_TOKEN.includes("YOUR_")) {
    throw new Error("Blynk auth token is not configured for direct client access.");
  }
}

async function blynkRequest(path, options = {}) {
  assertBlynkToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BLYNK_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BLYNK_API_BASE}${path}`, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Blynk API returned HTTP ${response.status}.`);
    }
    return text.trim();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Blynk request timed out.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getBlynkValue(pin) {
  const text = await blynkRequest(`/get?token=${encodeURIComponent(BLYNK_AUTH_TOKEN)}&${pin}`);
  if (!text || text === "null" || text === "undefined") {
    throw new Error(`Blynk returned no value for ${pin}.`);
  }

  const valueText = String(text).replace(/[\[\]"]/g, "").split(",")[0].trim();
  if (!valueText) throw new Error(`Blynk returned an invalid value for ${pin}.`);
  const value = Number(valueText);
  if (!Number.isFinite(value)) throw new Error(`Blynk returned an invalid value for ${pin}.`);
  return value;
}

async function setBlynkValue(pin, value) {
  const text = await blynkRequest(`/update?token=${encodeURIComponent(BLYNK_AUTH_TOKEN)}&${pin}=${encodeURIComponent(value)}`);
  if (text && !["ok", "200", "200 ok", "{}"].includes(text.toLowerCase())) {
    throw new Error(`Blynk rejected the update for ${pin}.`);
  }
  return value;
}

const GAUGE_GEOMETRY = {
  centerX: 120,
  centerY: 142,
  tickRadius: 88,
  tickCount: 11,
};

function initializeGaugeGeometry() {
  document.querySelectorAll(".gauge").forEach((gauge) => {
    const tickGroup = gauge.querySelector(".gauge-ticks");
    if (!tickGroup || tickGroup.childElementCount) return;

    for (let index = 0; index < GAUGE_GEOMETRY.tickCount; index += 1) {
      const ratio = index / (GAUGE_GEOMETRY.tickCount - 1);
      const angle = Math.PI + (ratio * Math.PI);
      const outerRadius = GAUGE_GEOMETRY.tickRadius + 7;
      const innerRadius = GAUGE_GEOMETRY.tickRadius - (index % 5 === 0 ? 7 : 4);
      const x1 = GAUGE_GEOMETRY.centerX + (Math.cos(angle) * innerRadius);
      const y1 = GAUGE_GEOMETRY.centerY + (Math.sin(angle) * innerRadius);
      const x2 = GAUGE_GEOMETRY.centerX + (Math.cos(angle) * outerRadius);
      const y2 = GAUGE_GEOMETRY.centerY + (Math.sin(angle) * outerRadius);
      const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
      tick.setAttribute("x1", x1.toFixed(2));
      tick.setAttribute("y1", y1.toFixed(2));
      tick.setAttribute("x2", x2.toFixed(2));
      tick.setAttribute("y2", y2.toFixed(2));
      if (index % 5 === 0) tick.classList.add("major");
      tickGroup.appendChild(tick);
    }
  });
}

function renderGauge(selector, value, min, max, hasValue = true) {
  const meter = document.querySelector(selector);
  if (!meter) return;

  const progressArc = meter.querySelector(".gauge-progress");
  const needle = meter.querySelector(".gauge-needle");
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  const visible = hasValue && numericValue !== null;
  const safeValue = visible ? Math.min(Math.max(numericValue, min), max) : min;
  const ratio = visible ? (safeValue - min) / (max - min) : 0;
  const percentage = ratio * 100;

  meter.style.setProperty("--progress", percentage);
  if (progressArc) progressArc.style.strokeDashoffset = `${100 - percentage}`;
  if (needle) {
    needle.style.opacity = visible ? "1" : "0";
    needle.style.transform = `rotate(${ratio * 180}deg)`;
  }
}

function updateMeterProgress() {
  const soilValue = typeof systemState.soilMoisture === "number" ? systemState.soilMoisture : null;
  const humidityValue = typeof systemState.humidity === "number" ? systemState.humidity : null;
  const temperatureValue = typeof systemState.temperature === "number" ? systemState.temperature : null;

  renderGauge(".dial-soil", soilValue, 0, 100, soilValue !== null);
  renderGauge(".dial-humidity", humidityValue, 0, 100, humidityValue !== null);
  renderGauge(".dial-temperature", temperatureValue, 0, 60, temperatureValue !== null);
  renderGauge(".dial-pump", systemState.pumpCommand === "ON" ? 100 : 0, 0, 100, systemState.esp32Online);
}

function updateTrendHistory() {
  Object.entries({
    temperature: systemState.temperature,
    humidity: systemState.humidity,
    soilMoisture: systemState.soilMoisture,
  }).forEach(([key, value]) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    sensorHistory[key].push(value);
    if (sensorHistory[key].length > 24) sensorHistory[key].shift();
  });
}

function renderTrendCharts() {
  const chartRanges = {
    temperature: [0, 60],
    humidity: [0, 100],
    soilMoisture: [0, 100],
  };

  Object.entries(chartRanges).forEach(([key, [min, max]]) => {
    const chart = document.querySelector(`[data-chart="${key}"]`);
    if (!chart) return;

    const values = sensorHistory[key];
    if (!values.length) {
      chart.innerHTML = '<span class="trend-placeholder">WAITING FOR SENSOR DATA</span>';
      return;
    }

    chart.innerHTML = values.map((value, index) => {
      const height = Math.max(12, ((value - min) / (max - min)) * 100);
      const activeClass = index === values.length - 1 ? " is-active" : "";
      return `<span class="chart-bar${activeClass}" style="--h: ${height}%" title="${value}"></span>`;
    }).join("");
  });
}

function updateLanguage() {
  const selectedLang = systemState.language === "hi" ? "hi" : "en";
  systemState.language = selectedLang;
  document.documentElement.lang = selectedLang;
  localStorage.setItem("smartFarmLang", selectedLang);

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key && translations[selectedLang][key]) {
      element.textContent = translations[selectedLang][key];
    }
  });

  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lang === selectedLang);
  });

  const componentName = document.querySelector(".component-item.is-selected .component-name");
  const currentComponent = document.querySelector(".component-item.is-selected")?.dataset.component || "esp32";
  if (componentName && currentComponent === "soilSensor") {
    componentName.textContent = t("soilSensor", "SOIL SENSOR");
  }
  if (componentName && currentComponent === "relay") {
    componentName.textContent = t("relay", "RELAY");
  }
  if (componentName && currentComponent === "pump") {
    componentName.textContent = t("pump", "PUMP");
  }

  renderSystemState();
}

function updateComponentInfo(componentKey) {
  const info = componentInfo[componentKey] || componentInfo.esp32;
  const statusText = componentKey === "pump"
    ? (systemState.esp32Online && systemState.pumpCommand === "ON" ? t("pumpOn", "PUMP ON") : (systemState.esp32Online ? t("pumpOff", "PUMP OFF") : t("offline", "OFFLINE")))
    : componentKey === "soilSensor"
      ? (systemState.soilMoisture === null ? t("noSensorData", "NO SENSOR DATA") : `${systemState.soilMoisture}%`)
      : componentKey === "dht11"
        ? (systemState.temperature === null && systemState.humidity === null ? t("noSensorData", "NO SENSOR DATA") : `${systemState.temperature ?? "--"}°C / ${systemState.humidity ?? "--"}%`)
        : componentKey === "relay"
          ? (systemState.esp32Online ? t("online", "ONLINE") : t("offline", "OFFLINE"))
          : (systemState.esp32Online ? t("systemOnline", "SYSTEM ONLINE") : t("systemOffline", "SYSTEM OFFLINE"));

  if (elements.componentInfoName) {
    const label = componentKey === "soilSensor" ? t("soilSensor", "SOIL SENSOR") :
      componentKey === "relay" ? t("relay", "RELAY") :
      componentKey === "pump" ? t("pump", "PUMP") :
      componentKey === "dht11" ? "DHT11" : "ESP32";
    elements.componentInfoName.textContent = label;
  }
  if (elements.componentInfoStatus) elements.componentInfoStatus.textContent = statusText;
  if (elements.componentInfoText) elements.componentInfoText.textContent = info[systemState.language] || info.en;
}

function renderSystemState() {
  const isChecking = systemState.statusState === "CHECKING";
  const isConnectionError = systemState.statusState === "CONNECTION ERROR";
  const esp32Label = isChecking ? "CHECKING" : isConnectionError ? "ERROR" : systemState.esp32Online ? t("online", "ONLINE") : t("offline", "OFFLINE");
  const wifiLabel = isChecking ? "CHECKING" : isConnectionError ? "ERROR" : systemState.wifiConnected ? t("online", "ONLINE") : t("offline", "OFFLINE");
  const cloudLabel = isChecking ? "CHECKING" : isConnectionError ? "ERROR" : systemState.cloudConnected ? t("online", "ONLINE") : t("offline", "OFFLINE");

  const soilStatus = systemState.soilMoisture === null ? t("noSensorData", "NO SENSOR DATA") : `${systemState.soilMoisture}%`;
  const humidityStatus = systemState.humidity === null ? t("noSensorData", "NO SENSOR DATA") : systemState.esp32Online ? "LIVE DATA" : "ESP32 OFFLINE";
  const temperatureStatus = systemState.temperature === null ? t("noSensorData", "NO SENSOR DATA") : systemState.esp32Online ? "LIVE DATA" : "ESP32 OFFLINE";
  const soilStatusText = systemState.soilMoisture === null ? t("noSensorData", "NO SENSOR DATA") : systemState.esp32Online ? "SENSOR OK" : "ESP32 OFFLINE";

  const valueLabels = {
    soilMoisture: systemState.soilMoisture === null ? "--" : `${systemState.soilMoisture}`,
    humidity: systemState.humidity === null ? "--" : `${systemState.humidity}`,
    temperature: systemState.temperature === null ? "--" : `${systemState.temperature}`,
  };

  console.log("[GAUGE] updating temperature:", valueLabels.temperature, "status:", temperatureStatus);
  console.log("[GAUGE] updating humidity:", valueLabels.humidity, "status:", humidityStatus);

  Object.entries(valueLabels).forEach(([key, value]) => setText(`[data-value="${key}"]`, value));

  setText("[data-status=soilMoisture]", soilStatusText);
  setText("[data-status=humidity]", humidityStatus);
  setText("[data-status=temperature]", temperatureStatus);

  if (elements.connectionLabel) {
    elements.connectionLabel.textContent = isChecking ? "CHECKING..." : isConnectionError ? "CONNECTION ERROR" : `ESP32 ${esp32Label}`;
  }
  if (elements.heroStatusText) {
    elements.heroStatusText.textContent = isChecking ? "ESP32 CHECKING" : isConnectionError ? "CONNECTION ERROR" : `ESP32 ${esp32Label}`;
  }
  if (elements.heroStatusMeta) {
    elements.heroStatusMeta.textContent = isChecking ? "CHECKING..." : isConnectionError ? "BLYNK REQUEST FAILED" : systemState.esp32Online ? "LIVE DATA ACTIVE" : "COMMANDS LOCKED";
  }

  if (elements.heroStatus) {
    const online = !isChecking && !isConnectionError && systemState.esp32Online;
    const offline = !isChecking && !isConnectionError && !systemState.esp32Online;
    elements.heroStatus.classList.toggle("is-online", online);
    elements.heroStatus.classList.toggle("is-offline", offline);
    elements.heroStatus.classList.toggle("is-server-error", isConnectionError);
  }
  if (elements.connectionBadge) {
    const online = !isChecking && !isConnectionError && systemState.esp32Online;
    const offline = !isChecking && !isConnectionError && !systemState.esp32Online;
    elements.connectionBadge.classList.toggle("is-online", online);
    elements.connectionBadge.classList.toggle("is-offline", offline);
    elements.connectionBadge.classList.toggle("is-server-error", isConnectionError);
  }

  const statuses = [
    ["ESP32", esp32Label],
    ["WI-FI", wifiLabel],
    ["CLOUD", cloudLabel],
    ["SENSORS", systemState.soilMoisture === null && systemState.temperature === null && systemState.humidity === null ? t("noSensorData", "NO SENSOR DATA") : "OK"],
    ["PUMP", systemState.esp32Online ? (systemState.pumpCommand === "ON" ? t("pumpOn", "PUMP ON") : t("pumpOff", "PUMP OFF")) : t("offline", "OFFLINE")],
  ];

  const strip = document.querySelector("[data-status-strip]");
  if (strip) {
    strip.innerHTML = statuses.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("");
  }

  Object.entries({
    esp32: esp32Label,
    wifi: wifiLabel,
    cloud: cloudLabel,
    soilSensor: systemState.soilMoisture === null ? t("noSensorData", "NO SENSOR DATA") : "OK",
    dht11: systemState.humidity === null && systemState.temperature === null ? t("noSensorData", "NO SENSOR DATA") : "OK",
    pump: systemState.esp32Online ? (systemState.pumpCommand === "ON" ? t("pumpOn", "PUMP ON") : t("pumpOff", "PUMP OFF")) : t("offline", "OFFLINE"),
    oled: systemState.esp32Online ? "READY" : "STANDBY",
    relay: systemState.esp32Online ? "READY" : "READY",
  }).forEach(([key, value]) => {
    const item = document.querySelector(`[data-component-status="${key}"]`);
    if (item) item.textContent = value;
  });

  const pumpStatus = systemState.esp32Online ? (systemState.pumpCommand === "ON" ? t("pumpOn", "PUMP ON") : t("pumpOff", "PUMP OFF")) : t("pumpNotConnected", "NOT CONNECTED");
  if (elements.pumpState) {
    elements.pumpState.textContent = systemState.esp32Online ? (systemState.pumpCommand === "ON" ? "ON" : "OFF") : "OFF";
    elements.pumpState.classList.remove("state-off", "state-on", "state-neutral");
    elements.pumpState.classList.add(systemState.esp32Online && systemState.pumpCommand === "ON" ? "state-on" : "state-off");
  }
  if (elements.pumpReadout) elements.pumpReadout.textContent = systemState.esp32Online ? (systemState.pumpCommand === "ON" ? "PUMP ACTIVE" : "PUMP READY") : "SYSTEM OFFLINE";

  const pumpDisabled = !systemState.esp32Online || isChecking || isConnectionError || pumpCommandInFlight || systemState.irrigationMode !== "MANUAL";
  if (elements.pumpButton) {
    elements.pumpButton.disabled = pumpDisabled;
    elements.pumpButton.textContent = isChecking ? "CHECKING..." : isConnectionError ? "CONNECTION ERROR" : systemState.esp32Online ? (systemState.pumpCommand === "ON" ? "PUMP ON" : "PUMP OFF") : "PUMP CONTROL UNAVAILABLE";
  }

  const pumpButtons = document.querySelectorAll("[data-pump-toggle]");
  pumpButtons.forEach((button) => {
    const isSelected = button.dataset.pumpToggle === systemState.pumpCommand;
    button.classList.toggle("is-selected", isSelected);
    button.disabled = pumpDisabled;
  });

  if (elements.commandMessage) {
    elements.commandMessage.textContent = isChecking
      ? "Checking the real Blynk ESP32 connection status..."
      : isConnectionError
        ? "Blynk request failed. Connection error — not ESP32 offline."
        : systemState.esp32Online
          ? `${systemState.irrigationMode} selected locally. Hardware is online and ready.`
          : "ESP32 is offline. Pump controls are disabled.";
    elements.commandMessage.style.color = isChecking ? "#75daf3" : isConnectionError ? "#f28c87" : systemState.esp32Online ? "#7ae0ab" : "#f0c77b";
  }

  if (elements.requirement) {
    const requirementText = systemState.irrigationRequirement || t("noSensorData", "NO SENSOR DATA");
    elements.requirement.textContent = requirementText;
    elements.requirement.classList.toggle("state-on", Boolean(systemState.irrigationRequirement));
    elements.requirement.classList.toggle("state-off", !systemState.irrigationRequirement && !isChecking);
  }

  if (elements.requirementCopy) elements.requirementCopy.textContent = systemState.irrigationRequirement || t("noSensorData", "NO SENSOR DATA");
  if (elements.trend) elements.trend.textContent = systemState.moistureTrend || t("noSensorData", "NO SENSOR DATA");

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.mode === systemState.irrigationMode);
    button.disabled = !systemState.esp32Online || isChecking || isConnectionError;
  });

  document.querySelectorAll("[data-setting]").forEach((group) => {
    const targetKey = group.dataset.setting;
    const activeValue = targetKey === "season" ? systemState.season : systemState.cropProfile;
    group.querySelectorAll("[data-choice]").forEach((button) => {
      const isSelected = targetKey === "season"
        ? button.dataset.choice === activeValue
        : cropChoiceToPin(button.dataset.choice) === cropProfileToPin(activeValue);
      button.classList.toggle("is-selected", isSelected);
      button.disabled = !systemState.esp32Online || isChecking || isConnectionError;
    });
  });

  const selectedComponent = document.querySelector(".component-item.is-selected")?.dataset.component || "esp32";
  updateComponentInfo(selectedComponent);
  updateMeterProgress();
  renderTrendCharts();
}

async function getSystemStatus() {
  const text = await blynkRequest(`/isHardwareConnected?token=${encodeURIComponent(BLYNK_AUTH_TOKEN)}`);
  const normalized = String(text).trim();
  const online = normalized === "1" || normalized === "true" || normalized.toLowerCase() === "online";

  return {
    online,
    wifiConnected: online,
    cloudConnected: online,
  };
}

const CROP_PROFILE_VALUES = {
  "GENERAL CROPS": 0,
  "LEAFY PLANTS": 1,
  "VEGETABLES": 2,
  CUSTOM: 3,
  "VEGETABLE": 4,
};

function cropChoiceToPin(choice) {
  return CROP_PROFILE_VALUES[choice] ?? 0;
}

function cropProfileToPin(profile) {
  return cropChoiceToPin(profile);
}

function pinToCropProfile(value) {
  return value === 1 ? "LEAFY PLANTS" : value === 2 || value === 4 ? "VEGETABLES" : value === 3 ? "CUSTOM" : "GENERAL CROPS";
}

async function updateAllBlynkValues() {
  const values = await Promise.all(Object.entries(BLYNK_VIRTUAL_PINS).map(async ([name, pin]) => [name, await getBlynkValue(pin)]));
  return Object.fromEntries(values);
}

async function setIrrigationMode(mode) {
  await setBlynkValue(BLYNK_VIRTUAL_PINS.mode, mode === "AUTO" ? 1 : 0);
  const confirmedMode = await getBlynkValue(BLYNK_VIRTUAL_PINS.mode);
  systemState.irrigationMode = confirmedMode === 1 ? "AUTO" : "MANUAL";
  console.log(systemState.irrigationMode === "AUTO" ? "MODE -> AUTOMATIC" : "MODE -> MANUAL");
  renderSystemState();
  return systemState.irrigationMode;
}

async function setPumpCommand(command) {
  if (systemState.irrigationMode !== "MANUAL") {
    console.log("IGNORED: manual pump control is disabled in automatic mode");
    return false;
  }
  pumpCommandInFlight = true;
  const commandVersion = ++pumpCommandVersion;
  renderSystemState();
  try {
    await setBlynkValue(BLYNK_VIRTUAL_PINS.pump, command === "ON" ? 1 : 0);
    const confirmedPump = await getBlynkValue(BLYNK_VIRTUAL_PINS.pump);
    if (commandVersion === pumpCommandVersion) {
      systemState.pumpCommand = confirmedPump === 1 ? "ON" : "OFF";
      console.log(`PUMP COMMAND -> ${systemState.pumpCommand}`);
      renderSystemState();
    }
    return systemState.pumpCommand;
  } finally {
    pumpCommandInFlight = false;
  }
}

async function refreshHardwareStatus() {
  if (refreshInProgress || pumpCommandInFlight) return;
  refreshInProgress = true;
  const refreshPumpVersion = pumpCommandVersion;
  systemState.statusState = "CHECKING";
  renderSystemState();

  try {
    const [status, values] = await Promise.all([getSystemStatus(), updateAllBlynkValues()]);

    const connected = Boolean(status && status.online);
    systemState.esp32Online = connected;
    systemState.wifiConnected = connected || Boolean(status && status.wifiConnected);
    systemState.cloudConnected = connected || Boolean(status && status.cloudConnected);
    systemState.statusState = connected ? "ONLINE" : "OFFLINE";

    if (!connected) {
      systemState.soilMoisture = null;
      systemState.temperature = null;
      systemState.humidity = null;
    } else {
      systemState.temperature = values.temperature;
      systemState.humidity = values.humidity;
      systemState.soilMoisture = values.soilMoisture;
      if (refreshPumpVersion === pumpCommandVersion) {
        systemState.pumpCommand = values.pump === 1 ? "ON" : "OFF";
      }
      systemState.irrigationMode = values.mode === 1 ? "AUTO" : "MANUAL";
      systemState.season = values.season === 1 ? "WINTER" : "SUMMER";
      systemState.cropProfile = pinToCropProfile(values.cropProfile);
      systemState.customMoisture = values.customMoisture;
      updateTrendHistory();
    }

    renderSystemState();
  } catch (error) {
    console.error("[BLYNK] refresh failed:", error);
    systemState.esp32Online = false;
    systemState.wifiConnected = false;
    systemState.cloudConnected = false;
    systemState.soilMoisture = null;
    systemState.temperature = null;
    systemState.humidity = null;
    systemState.irrigationRequirement = null;
    systemState.moistureTrend = null;
    systemState.statusState = "CONNECTION ERROR";
    renderSystemState();
  } finally {
    refreshInProgress = false;
  }
}

function beginHardwareStatusPolling() {
  refreshHardwareStatus();
  setInterval(refreshHardwareStatus, 2000);
}

function bindControls() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", async () => {
      const mode = button.dataset.mode;
      if (!systemState.esp32Online) return;
      try {
        await setIrrigationMode(mode);
        if (elements.commandMessage) elements.commandMessage.textContent = `${mode} synchronized with ESP32.`;
      } catch (error) {
        console.error("[BLYNK] mode update failed:", error);
        systemState.statusState = "CONNECTION ERROR";
        renderSystemState();
      }
    });
  });

  document.querySelectorAll("[data-pump-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const command = button.dataset.pumpToggle;
      if (systemState.irrigationMode !== "MANUAL") {
        console.log("IGNORED: manual pump control is disabled in automatic mode");
        return;
      }
      if (!systemState.esp32Online) {
        if (elements.commandMessage) elements.commandMessage.textContent = "ESP32 is offline. Pump controls are disabled.";
        return;
      }
      try {
        await setPumpCommand(command);
        if (elements.commandMessage) elements.commandMessage.textContent = `Pump set to ${command}. ESP32 state confirmed.`;
      } catch (error) {
        console.error("[BLYNK] pump update failed:", error);
        systemState.statusState = "CONNECTION ERROR";
        renderSystemState();
      }
    });
  });

  document.querySelectorAll("[data-pump-command]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (systemState.irrigationMode !== "MANUAL") {
        console.log("IGNORED: manual pump control is disabled in automatic mode");
        return;
      }
      if (!systemState.esp32Online) {
        if (elements.commandMessage) elements.commandMessage.textContent = "ESP32 is offline. Pump controls are disabled.";
        return;
      }
      const nextCommand = systemState.pumpCommand === "ON" ? "OFF" : "ON";
      try {
        await setPumpCommand(nextCommand);
        if (elements.commandMessage) elements.commandMessage.textContent = `Pump toggled to ${nextCommand}. ESP32 state confirmed.`;
      } catch (error) {
        console.error("[BLYNK] pump update failed:", error);
        systemState.statusState = "CONNECTION ERROR";
        renderSystemState();
      }
    });
  });

  document.querySelectorAll("[data-setting]").forEach((group) => {
    group.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!systemState.esp32Online) return;
        const nextValue = button.dataset.choice;
        const pin = group.dataset.setting === "season" ? BLYNK_VIRTUAL_PINS.season : BLYNK_VIRTUAL_PINS.cropProfile;
        const value = group.dataset.setting === "season"
          ? nextValue === "WINTER" ? 1 : 0
          : cropChoiceToPin(nextValue);
        try {
          await setBlynkValue(pin, value);
          await refreshHardwareStatus();
          if (elements.commandMessage) elements.commandMessage.textContent = "Setting synchronized with ESP32.";
        } catch (error) {
          console.error("[BLYNK] setting update failed:", error);
          systemState.statusState = "CONNECTION ERROR";
          renderSystemState();
        }
      });
    });
  });

  document.querySelectorAll("[data-component]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".component-item").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      updateComponentInfo(button.dataset.component);
    });
  });

  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.addEventListener("click", () => {
      systemState.language = button.dataset.lang;
      updateLanguage();
    });
  });
}

function initializeUi() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key && translations[systemState.language][key]) {
      element.textContent = translations[systemState.language][key];
    }
  });

  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lang === systemState.language);
  });

  initializeGaugeGeometry();
  renderSystemState();
  updateComponentInfo("esp32");
  bindControls();
  beginHardwareStatusPolling();
}

initializeUi();
