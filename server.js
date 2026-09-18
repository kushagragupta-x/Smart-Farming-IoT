const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const AUTH_TOKEN = process.env.BLYNK_AUTH_TOKEN || '';
const appRoot = __dirname;
const appDir = path.join(appRoot, 'app');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function getBlynkStatus() {
  if (!AUTH_TOKEN) {
    return {
      online: false,
      wifiConnected: false,
      cloudConnected: false,
      sensorsActive: false,
      error: 'Blynk auth token is not configured on the server.'
    };
  }

  const statusUrl = `https://blynk.cloud/external/api/isHardwareConnected?token=${encodeURIComponent(AUTH_TOKEN)}`;

  try {
    const response = await fetch(statusUrl, { headers: { Accept: 'text/plain' } });
    const text = await response.text();
    const normalized = String(text).trim();
    const online = normalized === '1' || normalized === 'true' || normalized.toLowerCase() === 'online';

    return {
      online,
      wifiConnected: online,
      cloudConnected: online,
      sensorsActive: online,
      deviceState: normalized,
    };
  } catch (error) {
    console.error('Blynk status request failed:', error.message);
    return {
      online: false,
      wifiConnected: false,
      cloudConnected: false,
      sensorsActive: false,
      error: 'Blynk request failed',
    };
  }
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/api/esp32-status') {
    const status = await getBlynkStatus();
    sendJson(res, 200, status);
    return;
  }

  if (pathname === '/api' || pathname === '/api/') {
    sendJson(res, 200, { ok: true, message: 'Smart Farming API is running.' });
    return;
  }

  let targetPath = null;

  if (pathname === '/' || pathname === '/index.html') {
    targetPath = path.join(appDir, 'index.html');
  } else if (pathname === '/app.js' || pathname === '/style.css') {
    targetPath = path.join(appDir, pathname.replace(/^\//, ''));
  } else if (pathname.startsWith('/app/')) {
    targetPath = path.join(appDir, pathname.slice('/app/'.length));
    if (!targetPath.startsWith(appDir)) {
      targetPath = path.join(appDir, 'index.html');
    }
  } else if (pathname.startsWith('/')) {
    targetPath = path.join(appDir, pathname.replace(/^\/+/, ''));
    if (!targetPath.startsWith(appDir)) {
      targetPath = path.join(appDir, 'index.html');
    }
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    targetPath = path.join(appDir, 'index.html');
  }

  serveFile(targetPath, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Smart Farming app running at http://localhost:${PORT}`);
  console.log('ESP32 status API available at http://localhost:3000/api/esp32-status');
});
