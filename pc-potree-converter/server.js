const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = Number(process.env.PORT || 8787);
const ROOT = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "docs");
const DATA_DIR = path.join(__dirname, "data");
const CLOUDS_DIR = path.join(DATA_DIR, "pointclouds");
const POTREE_CONVERTER = process.env.POTREE_CONVERTER || "PotreeConverter";

fs.mkdirSync(CLOUDS_DIR, { recursive: true });

const jobs = new Map();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      sendHtml(res, homePage());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/convert") {
      const body = await readJson(req);
      const job = startConversion(body.inputPath, body.name);
      sendJson(res, job);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/jobs") {
      sendJson(res, [...jobs.values()].reverse());
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/pointclouds/")) {
      serveStatic(res, CLOUDS_DIR, url.pathname.replace("/pointclouds/", ""));
      return;
    }

    if (req.method === "GET") {
      serveStatic(res, DOCS_DIR, url.pathname.replace(/^\/+/, "") || "index.html");
      return;
    }

    sendText(res, 405, "Method not allowed");
  } catch (error) {
    console.error(error);
    sendJson(res, { error: error.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`PC Potree Converter running at http://localhost:${PORT}`);
});

function startConversion(inputPath, requestedName) {
  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("Enter a full LAS/LAZ file path.");
  }

  const resolvedInput = path.resolve(inputPath.trim().replace(/^"|"$/g, ""));
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`File not found: ${resolvedInput}`);
  }

  const ext = path.extname(resolvedInput).toLowerCase();
  if (ext !== ".las" && ext !== ".laz") {
    throw new Error("Choose a .las or .laz file.");
  }

  const id = `${Date.now()}-${slug(requestedName || path.basename(resolvedInput, ext))}`;
  const outDir = path.join(CLOUDS_DIR, id);
  fs.mkdirSync(outDir, { recursive: true });

  const job = {
    id,
    inputPath: resolvedInput,
    outDir,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    log: "",
    cloudUrl: `/pointclouds/${id}/metadata.json`,
    viewerUrl: `/apps/PointCloudViewer/potree.html?cloud=${encodeURIComponent(`/pointclouds/${id}/metadata.json`)}`,
  };
  jobs.set(id, job);

  const child = spawn(POTREE_CONVERTER, [resolvedInput, "-o", outDir], {
    windowsHide: true,
  });

  child.stdout.on("data", chunk => appendLog(job, chunk));
  child.stderr.on("data", chunk => appendLog(job, chunk));
  child.on("error", error => {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    appendLog(job, `\n${error.message}\n`);
  });
  child.on("close", code => {
    job.finishedAt = new Date().toISOString();
    const metadataPath = path.join(outDir, "metadata.json");
    const cloudPath = path.join(outDir, "cloud.js");

    if (code === 0 && (fs.existsSync(metadataPath) || fs.existsSync(cloudPath))) {
      job.status = "done";
      if (!fs.existsSync(metadataPath) && fs.existsSync(cloudPath)) {
        job.cloudUrl = `/pointclouds/${id}/cloud.js`;
        job.viewerUrl = `/apps/PointCloudViewer/potree.html?cloud=${encodeURIComponent(job.cloudUrl)}`;
      }
    } else {
      job.status = "failed";
      appendLog(job, `\nPotreeConverter exited with code ${code}.\n`);
    }
  });

  return job;
}

function appendLog(job, chunk) {
  job.log += chunk.toString();
  if (job.log.length > 12000) job.log = job.log.slice(-12000);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "cloud";
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) reject(new Error("Request body too large."));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(res, root, relativePath) {
  const cleanPath = decodeURIComponent(relativePath.split("?")[0]);
  const filePath = path.resolve(root, cleanPath);
  if (!filePath.startsWith(path.resolve(root))) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let target = filePath;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentType(target),
    "Cache-Control": "no-store",
  });
  fs.createReadStream(target).pipe(res);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".bin": "application/octet-stream",
    ".hrc": "application/octet-stream",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  }[ext] || "application/octet-stream";
}

function sendHtml(res, html) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function homePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PC Potree Converter</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0d1117;color:#e6edf3;font-family:system-ui,Segoe UI,Arial,sans-serif}
    main{max-width:980px;margin:0 auto;padding:32px 18px}
    h1{margin:0 0 6px;font-size:28px}.muted{color:#8b949e}
    form,.job{border:1px solid #30363d;background:#161b22;border-radius:8px;padding:16px;margin-top:18px}
    label{display:block;font-size:13px;color:#8b949e;margin-bottom:8px}
    input{width:100%;padding:11px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#e6edf3}
    button,a.button{display:inline-flex;margin-top:12px;margin-right:8px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;border-radius:6px;padding:9px 12px;text-decoration:none;cursor:pointer}
    button:hover,a.button:hover{border-color:#58a6ff;color:#58a6ff}
    pre{max-height:220px;overflow:auto;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:10px;color:#c9d1d9;white-space:pre-wrap}
    .status{font-weight:700}.done{color:#3fb950}.failed{color:#f85149}.running{color:#d29922}
  </style>
</head>
<body>
  <main>
    <h1>PC Potree Converter</h1>
    <p class="muted">Convert local LAS/LAZ files into Potree clouds on this PC, then open them in the Potree viewer.</p>
    <form id="convert-form">
      <label for="inputPath">Full LAS/LAZ file path</label>
      <input id="inputPath" placeholder="C:\\Users\\you\\Desktop\\train.laz" autocomplete="off">
      <label for="name" style="margin-top:12px">Optional cloud name</label>
      <input id="name" placeholder="train">
      <button type="submit">Convert to Potree</button>
      <a class="button" href="/apps/PointCloudViewer/potree.html">Open Potree Viewer</a>
    </form>
    <section id="jobs"></section>
  </main>
  <script>
    const form = document.getElementById("convert-form");
    const jobsEl = document.getElementById("jobs");

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputPath: document.getElementById("inputPath").value,
          name: document.getElementById("name").value,
        }),
      });
      const result = await response.json();
      if (!response.ok) alert(result.error || "Conversion failed to start.");
      loadJobs();
    });

    async function loadJobs() {
      const jobs = await fetch("/api/jobs").then(r => r.json());
      jobsEl.innerHTML = jobs.map(job => \`
        <article class="job">
          <div><span class="status \${job.status}">\${job.status.toUpperCase()}</span> - \${job.id}</div>
          <p class="muted">\${job.inputPath}</p>
          \${job.status === "done" ? \`<a class="button" href="\${job.viewerUrl}">Open in Potree Viewer</a>\` : ""}
          <pre>\${escapeHtml(job.log || "Waiting for converter output...")}</pre>
        </article>
      \`).join("");
    }

    function escapeHtml(value) {
      return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }

    loadJobs();
    setInterval(loadJobs, 2000);
  </script>
</body>
</html>`;
}
