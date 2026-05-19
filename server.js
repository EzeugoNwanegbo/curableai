import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dist/server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, "dist", "client");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(clientDir, normalizedPath);

  if (!filePath.startsWith(clientDir)) return null;
  return filePath;
}

async function serveStaticFile(req, res) {
  if (!req.url || req.url === "/" || req.url.startsWith("/_server")) return false;

  const filePath = getStaticPath(new URL(req.url, "http://localhost").pathname);
  if (!filePath) return false;

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return false;

    const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": contentType,
      "content-length": fileStat.size,
    });
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

function headersFromIncoming(req) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  return headers;
}

async function bodyFromIncoming(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function sendWorkerResponse(req, res) {
  const requestUrl = `http://${req.headers.host || "localhost"}${req.url || "/"}`;
  const request = new Request(requestUrl, {
    method: req.method,
    headers: headersFromIncoming(req),
    body: await bodyFromIncoming(req),
  });

  const response = await worker.fetch(request, process.env, {
    waitUntil() {},
    passThroughOnException() {},
  });

  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  res.writeHead(response.status, responseHeaders);

  if (response.body) {
    const body = Buffer.from(await response.arrayBuffer());
    res.end(body);
    return;
  }

  res.end();
}

createServer(async (req, res) => {
  try {
    if (await serveStaticFile(req, res)) return;
    await sendWorkerResponse(req, res);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Curable could not start this request.");
  }
}).listen(port, () => {
  console.log(`Curable server listening on port ${port}`);
});
