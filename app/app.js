const API_BASE_URL = "/api";

const systemState = {
  connected: false,
  esp32Online: false,
  wifiConnected: false,
  cloudConnected: false,
  sensorsActive: false,
  soilMoisture: null,
  temperature: null,
  humidity: null,
  pumpState: null,
  irrigationMode: "AUTO",
  moistureTrend: null,
  irrigationRequirement: null,
  season: "SUMMER",
  cropProfile: "GENERAL CROPS",
  statusState: "CHECKING",
};

const elements = {
  connectionLabel: document.querySelector("[data-connection-label]"),
  connectionBadge: document.querySelector("[data-connection-badge]"),
  heroStatus: document.querySelector(".hero-status"),
  heroStatusText: document.querySelector("[data-esp32-status-text]"),
  heroStatusMeta: document.querySelector("[data-esp32-status-meta]"),
  commandMessage: document.querySelector("[data-command-message]"),
  pumpButton: document.querySelector("[data-pump-command]"),
  pumpState: document.querySelector("[data-pump-state]"),
  requirement: document.querySelector("[data-requirement]"),
  requirementCopy: document.querySelector("[data-requirement-copy]"),
  trend: document.querySelector("[data-trend]"),
};

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function renderSystemState() {
  const valueLabels = {
    soilMoisture: systemState.soilMoisture === null ? "--" : `${systemState.soilMoisture}`,
    temperature: systemState.temperature === null ? "--" : `${systemState.temperature}`,
    humidity: systemState.humidity === null ? "--" : `${systemState.humidity}`,
  };

  Object.entries(valueLabels).forEach(([key, value]) => setText(`[data-value="${key}"]`, value));
  setText("[data-status=soilMoisture]", systemState.soilMoisture === null ? "DATA UNAVAILABLE" : "SENSOR OK");
  setText("[data-status=temperature]", systemState.temperature === null ? "DATA UNAVAILABLE" : "SENSOR OK");
  setText("[data-status=humidity]", systemState.humidity === null ? "DATA UNAVAILABLE" : "SENSOR OK");

  const isChecking = systemState.statusState === "CHECKING";
  const isServerError = systemState.statusState === "SERVER OFFLINE / CONNECTION ERROR";
  const esp32Label = isChecking ? "CHECKING" : systemState.esp32Online ? "ONLINE" : "OFFLINE";
  const wifiLabel = isChecking ? "CHECKING" : systemState.wifiConnected ? "CONNECTED" : "UNAVAILABLE";
  const cloudLabel = isChecking ? "CHECKING" : systemState.cloudConnected ? "CONNECTED" : "UNAVAILABLE";
  const sensorLabel = isChecking ? "CHECKING" : systemState.sensorsActive ? "ACTIVE" : "DATA UNAVAILABLE";
  const pumpLabel = isChecking ? "CHECKING" : systemState.pumpState === null ? "OFFLINE" : systemState.pumpState ? "ON" : "OFF";

  if (elements.connectionLabel) {
    elements.connectionLabel.textContent = isChecking ? "CHECKING..." : isServerError ? "SERVER OFFLINE / CONNECTION ERROR" : `ESP32 ${esp32Label}`;
  }
  if (elements.heroStatusText) {
    elements.heroStatusText.textContent = isChecking ? "ESP32 CHECKING" : isServerError ? "SERVER OFFLINE" : `ESP32 ${esp32Label}`;
  }
  if (elements.heroStatusMeta) {
    elements.heroStatusMeta.textContent = isChecking ? "CHECKING..." : isServerError ? "CONNECTION ERROR" : systemState.esp32Online ? "LIVE DATA ACTIVE" : "COMMANDS LOCKED";
  }
  if (elements.heroStatus) {
    const online = !isChecking && !isServerError && systemState.esp32Online;
    elements.heroStatus.classList.toggle("is-online", online);
    elements.heroStatus.classList.toggle("is-offline", !online && !isChecking && !isServerError);
    elements.heroStatus.classList.toggle("is-server-error", isServerError);
  }
  if (elements.connectionBadge) {
    const online = !isChecking && !isServerError && systemState.esp32Online;
    elements.connectionBadge.classList.toggle("is-online", online);
    elements.connectionBadge.classList.toggle("is-offline", !online && !isChecking && !isServerError);
  }

  const statuses = [
    ["ESP32", esp32Label],
    ["WI-FI", wifiLabel],
    ["CLOUD", cloudLabel],
    ["SENSORS", sensorLabel],
    ["PUMP", pumpLabel],
  ];
  const strip = document.querySelector("[data-status-strip]");
  if (strip) strip.innerHTML = statuses.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("");

  Object.entries({
    esp32: esp32Label,
    wifi: wifiLabel,
    cloud: cloudLabel,
    soilSensor: sensorLabel,
    dht11: sensorLabel,
    pump: pumpLabel,
  }).forEach(([key, value]) => setText(`[data-system-status="${key}"]`, value));

  if (elements.pumpState) {
    elements.pumpState.textContent = pumpLabel;
    elements.pumpState.classList.toggle("state-off", systemState.pumpState !== false);
  }
  if (elements.pumpButton) elements.pumpButton.disabled = isChecking || isServerError || !systemState.esp32Online;
  if (elements.pumpButton) elements.pumpButton.textContent = isChecking ? "CHECKING..." : isServerError ? "SERVER OFFLINE" : systemState.esp32Online ? "PUMP CONTROL" : "PUMP CONTROL UNAVAILABLE";
  if (elements.commandMessage) {
    elements.commandMessage.textContent = isChecking
      ? "Checking the real Blynk ESP32 connection status..."
      : isServerError
        ? "Backend unavailable. Server offline / connection error."
        : systemState.esp32Online
          ? "ESP32 is online. Commands can be sent when the secure backend allows it."
          : "ESP32 is offline. Pump controls are disabled.";
    elements.commandMessage.style.color = isChecking ? "#76dff2" : isServerError ? "#f28f8c" : systemState.esp32Online ? "#73e0ac" : "#e8c078";
  }
  if (elements.requirement) elements.requirement.textContent = systemState.irrigationRequirement || "UNAVAILABLE";
  if (elements.requirementCopy) elements.requirementCopy.textContent = systemState.irrigationRequirement || "UNAVAILABLE";
  if (elements.trend) elements.trend.textContent = systemState.moistureTrend || "UNAVAILABLE";
}

async function getSystemStatus() {
  const response = await fetch(`${API_BASE_URL}/esp32-status`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to reach Blynk status endpoint.");
  }
  return response.json();
}

async function getSensorData() { return null; }
async function getPumpStatus() { return null; }
async function setPumpState(nextState) {
  if (!systemState.esp32Online) {
    throw new Error("ESP32 is offline. Command not sent.");
  }
  systemState.pumpState = nextState;
  renderSystemState();
  return nextState;
}
async function setIrrigationMode(mode) { systemState.irrigationMode = mode; renderSystemState(); return mode; }

async function refreshHardwareStatus() {
  systemState.statusState = "CHECKING";
  renderSystemState();

  try {
    const status = await getSystemStatus();
    const connected = Boolean(status && status.online);
    systemState.esp32Online = connected;
    systemState.wifiConnected = connected || Boolean(status && status.wifiConnected);
    systemState.cloudConnected = connected || Boolean(status && status.cloudConnected);
    systemState.sensorsActive = connected && Boolean(status && status.sensorsActive);
    systemState.statusState = connected ? "ONLINE" : "OFFLINE";
    if (status && typeof status.pumpState !== "undefined") systemState.pumpState = Boolean(status.pumpState);
    if (status && typeof status.soilMoisture !== "undefined") systemState.soilMoisture = status.soilMoisture;
    if (status && typeof status.temperature !== "undefined") systemState.temperature = status.temperature;
    if (status && typeof status.humidity !== "undefined") systemState.humidity = status.humidity;
    renderSystemState();
  } catch (error) {
    systemState.esp32Online = false;
    systemState.wifiConnected = false;
    systemState.cloudConnected = false;
    systemState.sensorsActive = false;
    systemState.soilMoisture = null;
    systemState.temperature = null;
    systemState.humidity = null;
    systemState.pumpState = null;
    systemState.irrigationRequirement = null;
    systemState.moistureTrend = null;
    systemState.statusState = "SERVER OFFLINE / CONNECTION ERROR";
    renderSystemState();
  }
}

function beginHardwareStatusPolling() {
  refreshHardwareStatus();
  setInterval(refreshHardwareStatus, 5000);
}

function bindControls() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll("[data-mode]").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      await setIrrigationMode(button.dataset.mode);
      if (elements.commandMessage) elements.commandMessage.textContent = `${button.dataset.mode} selected locally. Secure backend connection required.`;
    });
  });

  document.querySelectorAll("[data-setting]").forEach((group) => {
    group.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        group.querySelectorAll("[data-choice]").forEach((item) => item.classList.remove("is-selected"));
        button.classList.add("is-selected");
        systemState[group.dataset.setting === "season" ? "season" : "cropProfile"] = button.dataset.choice;
      });
    });
  });

  elements.pumpButton?.addEventListener("click", async () => {
    try { await setPumpState(!systemState.pumpState); } catch (error) { elements.commandMessage.textContent = error.message; }
  });

  document.querySelectorAll(".bottom-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".bottom-nav a").forEach((item) => item.classList.remove("is-active"));
      link.classList.add("is-active");
    });
  });
}

renderSystemState();
bindControls();
beginHardwareStatusPolling();
