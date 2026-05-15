const CATALYST_KEYWORDS = [
  "Positive Endpoint",
  "Phase III",
  "Phase II",
  "Phase I",
  "Positive",
  "Top-Line",
  "Significant",
  "Demonstrates",
  "Treatment",
  "Drug Trial",
  "Drug Trials",
  "Receives",
  "FDA",
  "Approval",
  "Benefit",
  "Benefits",
  "Beneficial",
  "Fast Track",
  "Grants",
  "Any Large Sum of Money",
  "Investors",
  "Accepted",
  "New",
  "Positive CEO",
  "Agreement",
  "Cancer",
  "Partnership",
  "Collaboration",
  "Improvements",
  "Successful",
  "Billionaire",
  "Carl Icahn",
  "Carl Ichan",
  "Increase",
  "Awarded",
  "Primary",
  "Breakout",
  "Acquire",
  "Acquires",
  "Acquisition",
  "Expand",
  "Expansion",
  "Contract",
  "Completes",
  "Promising",
  "Achieve",
  "Achieves",
  "Achievement",
  "Achievements",
  "Launches",
  "Signs",
  "Merger",
  "Gain",
];

const NEWS_WINDOW_HOURS = 24;
const REQUEST_DELAY_MS = 1000;
let nextRequestAt = 0;

const DEMO_RESULTS = [
  {
    symbol: "ONCT",
    name: "Oncternal Therapeutics",
    publishedAt: Date.now() - 2 * 36e5,
    news: {
      title:
        "Oncternal Announces Positive Phase II Top-Line Data in Cancer Treatment Study",
      url: "#",
      source: "GlobeNewswire",
      summary: "Demo article with multiple catalyst phrases from the last 24 hours.",
    },
    keywords: ["Positive", "Phase II", "Top-Line", "Cancer", "Treatment"],
  },
  {
    symbol: "ONCT",
    name: "Oncternal Therapeutics",
    publishedAt: Date.now() - 7 * 36e5,
    news: {
      title:
        "Oncternal Receives FDA Fast Track Designation for New Drug Trial Program",
      url: "#",
      source: "PR Newswire",
      summary: "Demo article showing the ticker-specific news scan format.",
    },
    keywords: ["Receives", "FDA", "Fast Track", "New", "Drug Trial"],
  },
  {
    symbol: "ONCT",
    name: "Oncternal Therapeutics",
    publishedAt: Date.now() - 14 * 36e5,
    news: {
      title:
        "Oncternal Signs Collaboration Agreement and Receives $25 Million Investment",
      url: "#",
      source: "Business Wire",
      summary: "Demo article for the large money phrase matcher.",
    },
    keywords: ["Signs", "Collaboration", "Agreement", "Any Large Sum of Money"],
  },
];

const els = {
  apiKey: document.querySelector("#apiKey"),
  ticker: document.querySelector("#ticker"),
  minKeywords: document.querySelector("#minKeywords"),
  scanBtn: document.querySelector("#scanBtn"),
  runStatus: document.querySelector("#runStatus"),
  lastUpdated: document.querySelector("#lastUpdated"),
  pulse: document.querySelector(".pulse"),
  resultsBody: document.querySelector("#resultsBody"),
  resultTemplate: document.querySelector("#resultTemplate"),
  matchCount: document.querySelector("#matchCount"),
  candidateCount: document.querySelector("#candidateCount"),
  keywordHitCount: document.querySelector("#keywordHitCount"),
  newsWindow: document.querySelector("#newsWindow"),
  keywordCloud: document.querySelector("#keywordCloud"),
};

const savedKey = localStorage.getItem("avApiKey");
if (savedKey) els.apiKey.value = savedKey;
els.ticker.value = localStorage.getItem("lastTicker") || "ONCT";

renderKeywordCloud();
renderResults([], { checked: 0 });

els.scanBtn.addEventListener("click", () => {
  const apiKey = els.apiKey.value.trim();
  const ticker = normalizeTicker(els.ticker.value);

  if (!ticker) {
    setStatus("Ticker required", "Enter a symbol like NVDA or ONCT", "error");
    els.ticker.focus();
    return;
  }

  localStorage.setItem("lastTicker", ticker);
  els.ticker.value = ticker;

  if (!apiKey) {
    renderResults(getDemoResults(ticker), { checked: DEMO_RESULTS.length });
    setStatus("Demo ticker scan loaded", "Enter an API key for live news");
    return;
  }

  localStorage.setItem("avApiKey", apiKey);
  runTickerNewsScan(apiKey, ticker).catch((error) => {
    console.error(error);
    setBusy(false);
    setStatus(error.message || "Live scan failed", "Check the key or rate limit", "error");
  });
});

els.ticker.addEventListener("keydown", (event) => {
  if (event.key === "Enter") els.scanBtn.click();
});

async function runTickerNewsScan(apiKey, ticker) {
  const filters = getFilters();
  setBusy(true);
  setStatus(`Scanning ${ticker}`, `Checking news from the last ${NEWS_WINDOW_HOURS} hours`);

  const result = await getTickerCatalysts(ticker, apiKey, filters.minKeywords);
  renderResults(result.matches, { checked: result.checked });
  setStatus(
    `${result.matches.length} match${result.matches.length === 1 ? "" : "es"} found`,
    new Date().toLocaleString(),
  );
  setBusy(false);
}

function getFilters() {
  return {
    minKeywords: Number(els.minKeywords.value) || 2,
  };
}

function normalizeTicker(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function getDemoResults(ticker) {
  return DEMO_RESULTS.map((result) => ({
    ...result,
    symbol: ticker,
    name: ticker,
    news: {
      ...result.news,
      title: result.news.title.replaceAll("Oncternal", ticker),
    },
  }));
}

async function fetchAlphaVantage(functionName, apiKey, params = {}) {
  await throttleRequest();

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", functionName);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Alpha Vantage returned ${response.status}`);
  const data = await response.json();
  const message = data.Information || data.Note || data["Error Message"];
  if (message) throw new Error(message);
  return data;
}

async function throttleRequest() {
  const waitMs = Math.max(0, nextRequestAt - Date.now());
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  nextRequestAt = Date.now() + REQUEST_DELAY_MS;
}

async function getTickerCatalysts(symbol, apiKey, minKeywords) {
  const data = await fetchAlphaVantage("NEWS_SENTIMENT", apiKey, {
    tickers: symbol,
    sort: "LATEST",
    limit: "50",
  });
  const items = data.feed || [];
  let checked = 0;
  const matches = [];

  for (const item of items) {
    const text = `${item.title || ""} ${item.summary || ""}`;
    const publishedAt = parseAlphaVantageTime(item.time_published);

    if (!isFreshNews(publishedAt)) continue;
    checked += 1;

    const keywords = findKeywordHits(text);
    if (keywords.length >= minKeywords) {
      matches.push({
        symbol,
        name: symbol,
        publishedAt,
        news: {
          title: item.title || `${symbol} press release`,
          url: item.url || "#",
          source: item.source || "Unknown source",
          summary: item.summary || "",
        },
        keywords,
      });
    }
  }

  return { checked, matches };
}

function findKeywordHits(text) {
  const normalized = text.toLowerCase();
  const hits = CATALYST_KEYWORDS.filter((keyword) => {
    if (keyword === "Any Large Sum of Money") return hasLargeMoneyPhrase(text);
    const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
  });

  return [...new Set(hits)];
}

function hasLargeMoneyPhrase(text) {
  return /(\$|usd\s*)\s?\d+(\.\d+)?\s?(million|billion|m|bn)\b/i.test(text)
    || /\b(million|billion)\s?(dollar|financing|funding|grant|award|investment|contract)s?\b/i.test(text);
}

function parseAlphaVantageTime(alphaVantageTimestamp) {
  if (!alphaVantageTimestamp) return null;
  const stamp = alphaVantageTimestamp.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
    "$1-$2-$3T$4:$5:$6Z",
  );
  const publishedAt = Date.parse(stamp);
  return Number.isNaN(publishedAt) ? null : publishedAt;
}

function isFreshNews(publishedAt) {
  if (!publishedAt) return false;
  const ageHours = (Date.now() - publishedAt) / 36e5;
  return ageHours >= 0 && ageHours <= NEWS_WINDOW_HOURS;
}

function renderResults(results, stats) {
  els.resultsBody.replaceChildren();

  if (!results.length) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    row.innerHTML = `<td colspan="5">No ticker news matched the keyword rule in this scan.</td>`;
    els.resultsBody.append(row);
  }

  results.forEach((result) => {
    const row = els.resultTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('[data-field="symbol"]').textContent = result.symbol;
    row.querySelector('[data-field="name"]').textContent = result.name || "";
    row.querySelector('[data-field="published"]').textContent = formatPublished(result.publishedAt);
    row.querySelector('[data-field="source"]').textContent = result.news.source;
    row.querySelector('[data-field="headline"]').textContent = result.news.title;
    row.querySelector('[data-field="headline"]').href = result.news.url;
    row.querySelector('[data-field="summary"]').textContent = result.news.summary;

    const keywordCell = row.querySelector('[data-field="keywords"]');
    result.keywords.forEach((keyword) => {
      const tag = document.createElement("span");
      tag.className = "hit";
      tag.textContent = keyword;
      keywordCell.append(tag);
    });

    els.resultsBody.append(row);
  });

  const totalKeywordHits = results.reduce(
    (sum, result) => sum + result.keywords.length,
    0,
  );

  els.matchCount.textContent = results.length;
  els.candidateCount.textContent = stats.checked;
  els.keywordHitCount.textContent = totalKeywordHits;
  els.newsWindow.textContent = `${NEWS_WINDOW_HOURS}h`;
}

function renderKeywordCloud() {
  CATALYST_KEYWORDS.forEach((keyword) => {
    const tag = document.createElement("span");
    tag.textContent = keyword;
    els.keywordCloud.append(tag);
  });
}

function setBusy(isBusy) {
  els.scanBtn.disabled = isBusy;
  els.pulse.classList.toggle("busy", isBusy);
  if (isBusy) els.pulse.classList.remove("error");
}

function setStatus(message, detail, type = "ok") {
  els.runStatus.textContent = message;
  els.lastUpdated.textContent = detail;
  if (type === "error") {
    els.scanBtn.disabled = false;
    els.pulse.classList.remove("busy");
    els.pulse.classList.add("error");
    return;
  }
  els.pulse.classList.remove("error");
}

function formatPublished(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
