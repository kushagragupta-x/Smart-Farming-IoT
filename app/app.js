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
};

const elements = {
  connectionLabel: document.querySelector("[data-connection-label]"),
  connectionBadge: document.querySelector("[data-connection-badge]"),
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

  const statuses = [
    ["ESP32", systemState.esp32Online ? "ONLINE" : "OFFLINE"],
    ["WI-FI", systemState.wifiConnected ? "CONNECTED" : "UNAVAILABLE"],
    ["CLOUD", systemState.cloudConnected ? "CONNECTED" : "UNAVAILABLE"],
    ["SENSORS", systemState.sensorsActive ? "ACTIVE" : "DATA UNAVAILABLE"],
    ["PUMP", systemState.pumpState === null ? "OFFLINE" : systemState.pumpState ? "ON" : "OFF"],
  ];
  const strip = document.querySelector("[data-status-strip]");
  if (strip) strip.innerHTML = statuses.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("");

  Object.entries({
    esp32: systemState.esp32Online ? "ONLINE" : "OFFLINE",
    wifi: systemState.wifiConnected ? "CONNECTED" : "UNAVAILABLE",
    cloud: systemState.cloudConnected ? "CONNECTED" : "UNAVAILABLE",
    soilSensor: systemState.sensorsActive ? "ACTIVE" : "DATA UNAVAILABLE",
    dht11: systemState.sensorsActive ? "ACTIVE" : "DATA UNAVAILABLE",
    pump: systemState.pumpState === null ? "OFFLINE" : systemState.pumpState ? "ON" : "OFF",
  }).forEach(([key, value]) => setText(`[data-system-status="${key}"]`, value));

  const pumpLabel = systemState.pumpState === null ? "OFFLINE" : systemState.pumpState ? "ON" : "OFF";
  if (elements.pumpState) {
    elements.pumpState.textContent = pumpLabel;
    elements.pumpState.classList.toggle("state-off", systemState.pumpState !== false);
  }
  if (elements.pumpButton) elements.pumpButton.disabled = !systemState.esp32Online;
  if (elements.requirement) elements.requirement.textContent = systemState.irrigationRequirement || "UNAVAILABLE";
  if (elements.requirementCopy) elements.requirementCopy.textContent = systemState.irrigationRequirement || "UNAVAILABLE";
  if (elements.trend) elements.trend.textContent = systemState.moistureTrend || "UNAVAILABLE";
}

// These functions are the future secure API boundary. They intentionally return unavailable state today.
async function getSystemStatus() { return null; }
async function getSensorData() { return null; }
async function getPumpStatus() { return null; }
async function setPumpState() { throw new Error("ESP32 is offline. Command not sent."); }
async function setIrrigationMode(mode) { systemState.irrigationMode = mode; renderSystemState(); return mode; }

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
