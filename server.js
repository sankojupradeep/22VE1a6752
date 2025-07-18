const express = require("express");
const crypto = require("crypto");
const app = express();
const PORT = 3000;

app.use(express.json());

// --- Middleware: Custom Logging ---
app.use((req, res, next) => {
  const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`;
  // Replace with file/db logger if needed
  global.customLogs = global.customLogs || [];
  global.customLogs.push(logEntry);
  next();
});

// --- In-Memory Storage ---
const urls = {};
const clickStats = {};

// --- Helper: Generate Shortcode ---
function generateShortcode(length = 5) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

// --- Helper: Validate URL ---
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// --- POST /shorturls ---
app.post("/shorturls", (req, res) => {
  const { url, validity = 30, shortcode } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "Invalid or missing 'url'" });
  }

  let code = shortcode || generateShortcode();
  if (!/^[a-zA-Z0-9]+$/.test(code)) {
    return res.status(400).json({ error: "Shortcode must be alphanumeric" });
  }

  if (urls[code]) {
    return res.status(409).json({ error: "Shortcode already in use" });
  }

  const now = new Date();
  const expiry = new Date(now.getTime() + validity * 60000);

  urls[code] = {
    originalUrl: url,
    createdAt: now,
    expiry,
    clicks: 0,
  };
  clickStats[code] = [];

  return res.status(201).json({
    shortLink: `http://localhost:${PORT}/${code}`,
    expiry: expiry.toISOString(),
  });
});

// --- GET /shorturls/:shortcode ---
app.get("/shorturls/:shortcode", (req, res) => {
  const { shortcode } = req.params;
  const data = urls[shortcode];

  if (!data) {
    return res.status(404).json({ error: "Shortcode not found" });
  }

  const now = new Date();
  if (now > data.expiry) {
    return res.status(410).json({ error: "Shortlink has expired" });
  }

  return res.json({
    originalUrl: data.originalUrl,
    createdAt: data.createdAt.toISOString(),
    expiry: data.expiry.toISOString(),
    totalClicks: data.clicks,
    clicks: clickStats[shortcode],
  });
});

// --- Redirection Handler ---
app.get("/:shortcode", (req, res) => {
  const { shortcode } = req.params;
  const data = urls[shortcode];

  if (!data) {
    return res.status(404).json({ error: "Shortcode not found" });
  }

  const now = new Date();
  if (now > data.expiry) {
    return res.status(410).json({ error: "Shortlink has expired" });
  }

  // Collect click stats
  data.clicks++;
  clickStats[shortcode].push({
    timestamp: now.toISOString(),
    referrer: req.get("referer") || "direct",
    location: "India (simulated)",
  });

  res.redirect(data.originalUrl);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
