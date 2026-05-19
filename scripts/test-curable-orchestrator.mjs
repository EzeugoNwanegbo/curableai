import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const [patientEmail, password, baseUrl = "http://127.0.0.1:5174"] = process.argv.slice(2);

if (!patientEmail || !password) {
  throw new Error("Usage: node scripts/test-curable-orchestrator.mjs <patientEmail> <password> [baseUrl]");
}

function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    env[trimmed.slice(0, separator)] = trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, "");
  }
  return env;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

const env = parseEnv(await fs.readFile(new URL("../.env", import.meta.url), "utf8"));
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY in .env.");
}

const { data: authData, error: authError } = await createClient(supabaseUrl, supabaseAnonKey).auth.signInWithPassword({
  email: patientEmail,
  password,
});

if (authError || !authData.session) {
  throw authError || new Error("Could not create a Supabase session for the test patient.");
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const supabaseStorageKey = `sb-${projectRef}-auth-token`;
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath = (await Promise.all(chromeCandidates.map(async (candidate) => ((await exists(candidate)) ? candidate : null)))).find(Boolean);

if (!chromePath) throw new Error("Could not find Chrome or Edge for headless browser testing.");

const remotePort = 9323;
const userDataDir = path.join(os.tmpdir(), `curable-chrome-${Date.now()}`);
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    `--remote-debugging-port=${remotePort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

class CdpSession {
  constructor(wsUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
      this.ws.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (!message.id) {
          this.events.push(message);
          this.events = this.events.slice(-12);
          return;
        }
        const callback = this.pending.get(message.id);
        if (!callback) return;
        this.pending.delete(message.id);
        if (message.error) callback.reject(new Error(message.error.message));
        else callback.resolve(message.result);
      });
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return result;
  }

  close() {
    this.ws.close();
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, timeoutMs = 15000, options = {}) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
    } catch (err) {
      lastError = err;
    }
    await wait(250);
  }
  throw lastError || new Error(`Timed out fetching ${url}`);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.exception?.value ||
        result.exceptionDetails.text ||
        "Browser evaluation failed."
    );
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, timeoutMs = 30000, label = expression) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await wait(350);
  }
  const bodyText = await evaluate(cdp, "document.body?.innerText?.slice(0, 1200) || ''");
  const events = JSON.stringify(cdp.events || [], null, 2).slice(0, 1600);
  throw new Error(`Timed out waiting for ${label}. Current page text: ${bodyText}\nRecent browser events: ${events}`);
}

async function elementCenter(cdp, selector) {
  return evaluate(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Missing element: ' + ${JSON.stringify(selector)});
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  );
}

async function clickSelector(cdp, selector) {
  const point = await elementCenter(cdp, selector);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function typeInto(cdp, selector, text) {
  await clickSelector(cdp, selector);
  await cdp.send("Input.insertText", { text });
}

async function clickText(cdp, text) {
  const point = await evaluate(
    cdp,
    `(() => {
      const elements = [...document.querySelectorAll('button, a')];
      const el = elements.find((item) => item.textContent && item.textContent.includes(${JSON.stringify(text)}) && !item.disabled);
      if (!el) throw new Error('Missing clickable text: ' + ${JSON.stringify(text)});
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  );
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function screenshot(cdp, fileName) {
  const capture = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const outputPath = path.resolve(fileName);
  await fs.writeFile(outputPath, Buffer.from(capture.data, "base64"));
  return outputPath;
}

let cdp;

try {
  const target = await fetchJson(`http://127.0.0.1:${remotePort}/json/new?${encodeURIComponent(`${baseUrl}/auth`)}`, 15000, {
    method: "PUT",
  });
  cdp = new CdpSession(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable").catch(() => {});
  await cdp
    .send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    })
    .catch(() => {});

  await waitFor(cdp, "location.href.includes('/auth')", 15000, "auth URL");
  await evaluate(
    cdp,
    `(() => {
      localStorage.setItem(${JSON.stringify(supabaseStorageKey)}, ${JSON.stringify(JSON.stringify(authData.session))});
      location.href = ${JSON.stringify(`${baseUrl}/chat`)};
      return true;
    })()`
  );

  await waitFor(cdp, "location.pathname === '/chat' && document.body.innerText.includes('AI Follow-up')", 30000, "patient chat");
  await waitFor(
    cdp,
    "document.body.innerText.includes('No validating doctor') && !document.body.innerText.includes('Dr. Musa supervising')",
    20000,
    "chat starts without hardcoded doctor"
  );

  await cdp.send("Page.navigate", { url: `${baseUrl}/profile` });
  await waitFor(cdp, "location.pathname === '/profile'", 15000, "profile URL");
  await waitFor(cdp, "document.body.innerText.includes('Aisha Bello') && document.body.innerText.includes('Penicillin')", 20000, "seeded profile context");

  await cdp.send("Page.navigate", { url: `${baseUrl}/notifications` });
  await waitFor(cdp, "location.pathname === '/notifications'", 15000, "notifications URL");
  await waitFor(
    cdp,
    "document.body.innerText.includes('No notifications yet') && !document.body.innerText.includes('Time to take') && !document.body.innerText.includes('scheduled for Tuesday')",
    20000,
    "no fake notifications"
  );

  await cdp.send("Page.navigate", { url: `${baseUrl}/consultation` });
  await waitFor(cdp, "location.pathname === '/consultation'", 15000, "consultation URL");
  await waitFor(
    cdp,
    "document.body.innerText.toLowerCase().includes('validating doctor') && document.body.innerText.includes('Add your doctor')",
    20000,
    "doctor connection card"
  );
  await typeInto(cdp, "input[placeholder='Doctor name']", "Dr. Ada Okafor");
  await typeInto(cdp, "input[placeholder='Doctor email']", "ada.okafor@curable.test");
  await typeInto(cdp, "input[placeholder='Clinic or hospital name']", "Garki Hospital");
  await clickText(cdp, "Save doctor");
  await waitFor(
    cdp,
    "document.body.innerText.includes('Validating doctor saved') && document.body.innerText.includes('Dr. Ada Okafor')",
    30000,
    "doctor connection saved"
  );
  const doctorConnectionScreenshot = await screenshot(cdp, "curable-doctor-connection.png");

  await cdp.send("Page.navigate", { url: `${baseUrl}/chat` });
  await waitFor(cdp, "location.pathname === '/chat'", 15000, "chat URL");
  await waitFor(
    cdp,
    "document.body.innerText.includes('Dr. Ada Okafor supervising') && !document.body.innerText.includes('Dr. Musa supervising')",
    20000,
    "chat uses selected doctor"
  );
  await waitFor(cdp, "Boolean(document.querySelector(\"input[placeholder*='Describe']\"))", 15000, "chat input");
  await typeInto(cdp, "input[placeholder*='Describe']", "I have fever headache and body pain since yesterday evening");
  await clickSelector(cdp, "form button[type=submit]");
  await waitFor(
    cdp,
    "document.body.innerText.toLowerCase().includes('current mode') && !document.body.innerText.includes('curable_reasoning')",
    90000,
    "AI reasoning response"
  );
  await waitFor(
    cdp,
    "!document.body.innerText.includes('Doctor review available') && !document.body.innerText.includes('What do you want the doctor to validate?')",
    5000,
    "removed inline doctor review card"
  );

  await clickText(cdp, "View reasoning in chat");
  await waitFor(
    cdp,
    "document.body.innerText.toLowerCase().includes('timeline') && document.body.innerText.toLowerCase().includes('what weakens it')",
    15000,
    "expanded reasoning details"
  );
  const chatScreenshot = await screenshot(cdp, "curable-orchestrator-chat.png");

  await clickText(cdp, "Request doctor review");
  await waitFor(
    cdp,
    "document.body.innerText.toLowerCase().includes('doctor report preview') && document.body.innerText.toLowerCase().includes('frozen reasoning snapshot')",
    90000,
    "doctor report preview"
  );
  const reportScreenshot = await screenshot(cdp, "curable-orchestrator-report.png");
  await clickText(cdp, "Send to doctor");
  await waitFor(cdp, "document.body.innerText.toLowerCase().includes('sent to doctor')", 30000, "report sent confirmation");
  const visibleSummary = await evaluate(cdp, "document.body.innerText.slice(0, 1800)");

  console.log(JSON.stringify({ ok: true, doctorConnectionScreenshot, chatScreenshot, reportScreenshot, visibleSummary }, null, 2));
} finally {
  if (cdp) cdp.close();
  chrome.kill();
  await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}
