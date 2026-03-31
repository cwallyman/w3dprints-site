const STATIONS = {
  marketEast: {
    label: "Market East",
    apiName: "Market East",
  },
  paoli: {
    label: "Paoli",
    apiName: "Paoli",
  },
};

const originSelect = document.querySelector("#origin");
const destinationSelect = document.querySelector("#destination");
const tripForm = document.querySelector("#trip-form");
const swapButton = document.querySelector("#swap-button");
const autoRefreshButton = document.querySelector("#auto-refresh");
const routeSummary = document.querySelector("#route-summary");
const lastUpdated = document.querySelector("#last-updated");
const statusMessage = document.querySelector("#status-message");
const results = document.querySelector("#results");
const trainCardTemplate = document.querySelector("#train-card-template");

let autoRefreshEnabled = true;
let refreshTimer = null;
function ensureDifferentStations(changedField) {
  if (originSelect.value === destinationSelect.value) {
    if (changedField === "origin") {
      destinationSelect.value = originSelect.value === "marketEast" ? "paoli" : "marketEast";
    } else {
      originSelect.value = destinationSelect.value === "marketEast" ? "paoli" : "marketEast";
    }
  }
}

function updateRouteSummary() {
  const origin = STATIONS[originSelect.value].label;
  const destination = STATIONS[destinationSelect.value].label;
  routeSummary.textContent = `${origin} to ${destination}`;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function normalizeErrorMessage(message) {
  const text = `${message || ""}`.trim();

  if (!text) {
    return "Could not load train data.";
  }

  if (text.startsWith("<!DOCTYPE HTML>") || text.startsWith("<html")) {
    return "The app is not running through server.py yet. Start it with `python3 server.py` and reload the page.";
  }

  return text;
}

function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function classifyStatus(status) {
  const value = `${status || ""}`.toLowerCase();
  if (value.includes("on time")) {
    return "is-on-time";
  }
  if (value.includes("late") || value.includes("delay") || value.includes("mins")) {
    return "is-late";
  }
  return "";
}

function formatDelay(delay) {
  if (!delay || delay === "0 mins") {
    return "On time";
  }

  if (delay.toLowerCase().includes("late") || delay.toLowerCase().includes("delay")) {
    return delay;
  }

  return `${delay} late`;
}

function renderResults(trains) {
  results.innerHTML = "";

  if (!Array.isArray(trains) || trains.length === 0) {
    setStatus("No upcoming trains were returned for this route.");
    return;
  }

  setStatus("");

  trains.slice(0, 3).forEach((train) => {
    const fragment = trainCardTemplate.content.cloneNode(true);
    const statusText = formatDelay(train.orig_delay);
    const statusClass = classifyStatus(statusText);
    const trackValue = train.orig_track || train.track || "TBD";

    fragment.querySelector(".train-number").textContent = train.orig_train || train.trainno || "Unknown";
    fragment.querySelector(".train-time").textContent = `${train.orig_departure_time || "--"} -> ${train.orig_arrival_time || "--"}`;
    fragment.querySelector(".departure-time").textContent = train.orig_departure_time || "--";
    fragment.querySelector(".arrival-time").textContent = train.orig_arrival_time || "--";

    const statusNode = fragment.querySelector(".status-text");
    statusNode.textContent = statusText;
    if (statusClass) {
      statusNode.classList.add(statusClass);
    }

    fragment.querySelector(".track-text").textContent = trackValue;
    results.appendChild(fragment);
  });
}

function fetchNextToArrive(origin, destination) {
  const params = new URLSearchParams({
    origin,
    destination,
  });

  return fetch(`/api/next-trains?${params.toString()}`).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(normalizeErrorMessage(errorText));
    }

    return response.json();
  });
}

async function refreshTrains() {
  const origin = STATIONS[originSelect.value];
  const destination = STATIONS[destinationSelect.value];

  updateRouteSummary();
  setStatus("Loading live train data...");
  lastUpdated.textContent = "Checking SEPTA live feed...";

  try {
    const trains = await fetchNextToArrive(origin.apiName, destination.apiName);
    renderResults(trains);
    lastUpdated.textContent = `Last updated ${formatTimestamp()}`;
  } catch (error) {
    results.innerHTML = "";
    setStatus(normalizeErrorMessage(error.message));
    lastUpdated.textContent = "Live feed unavailable";
  }
}

function restartAutoRefresh() {
  window.clearInterval(refreshTimer);
  if (!autoRefreshEnabled) {
    return;
  }

  refreshTimer = window.setInterval(() => {
    refreshTrains();
  }, 30000);
}

originSelect.addEventListener("change", () => {
  ensureDifferentStations("origin");
  updateRouteSummary();
});

destinationSelect.addEventListener("change", () => {
  ensureDifferentStations("destination");
  updateRouteSummary();
});

tripForm.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshTrains();
  restartAutoRefresh();
});

swapButton.addEventListener("click", () => {
  const nextOrigin = destinationSelect.value;
  const nextDestination = originSelect.value;

  originSelect.value = nextOrigin;
  destinationSelect.value = nextDestination;

  updateRouteSummary();
  refreshTrains();
  restartAutoRefresh();
});

autoRefreshButton.addEventListener("click", () => {
  autoRefreshEnabled = !autoRefreshEnabled;
  autoRefreshButton.textContent = `Auto-refresh: ${autoRefreshEnabled ? "on" : "off"}`;
  restartAutoRefresh();
});

updateRouteSummary();
refreshTrains();
restartAutoRefresh();
