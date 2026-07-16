#!/usr/bin/env node
import https from "https";
import { createInterface } from "readline";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CLIENT_ID = "Iv23liXPi1d3Uy1iZmzD";
const SCOPE = "read:user,user:email";

function postForm(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = Object.entries(data).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "OpenCode-Evolved/1.0",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    let res = "";
    const req = https.request(opts, r => {
      r.on("data", c => res += c);
      r.on("end", () => {
        try { resolve(JSON.parse(res)); }
        catch { resolve({ error: "parse_error", error_description: res }); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function deviceFlow() {
  console.log("\n=== Autenticación GitHub OAuth para OpenCode ===\n");

  // Step 1: Request device code
  console.log("Solicitando código de dispositivo...");
  const device = await postForm("https://github.com/login/device/code", {
    client_id: CLIENT_ID,
    scope: SCOPE
  });

  if (device.error) {
    console.error("Error:", device.error_description || device.error);
    process.exit(1);
  }

  console.log(`\nCódigo: ${device.user_code}`);
  console.log(`\n1. Abre https://github.com/login/device en tu navegador`);
  console.log(`2. Ingresa el código: ${device.user_code}`);
  console.log(`3. Autoriza la aplicación "OpenCode"\n`);

  // Try to open browser
  try {
    const { execSync } = await import("child_process");
    execSync(`powershell.exe -Command "Start-Process 'https://github.com/login/device'"`, { timeout: 3000 });
    console.log("Navegador abierto automáticamente");
  } catch {}

  // Step 2: Poll for access token
  console.log("Esperando autorización...");
  let token = null;
  const interval = device.interval || 5;
  const maxAttempts = 120;
  let attempts = 0;

  while (!token && attempts < maxAttempts) {
    await sleep(interval * 1000);
    attempts++;

    const result = await postForm("https://github.com/login/oauth/access_token", {
      client_id: CLIENT_ID,
      device_code: device.device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    });

    if (result.access_token) {
      token = result.access_token;
    } else if (result.error === "authorization_pending") {
      continue;
    } else if (result.error === "slow_down") {
      await sleep(5000);
    } else if (result.error === "expired_token") {
      console.error("\nCódigo expirado. Ejecuta de nuevo.");
      process.exit(1);
    } else if (result.error === "access_denied") {
      console.error("\nAutorización denegada.");
      process.exit(1);
    }
  }

  if (!token) {
    console.error("\nTimeout esperando autorización.");
    process.exit(1);
  }

  return token;
}

async function main() {
  const token = await deviceFlow();
  console.log(`\nToken obtenido: ${token.substring(0, 10)}...`);

  // Save to auth.json
  const authDir = join(homedir(), ".local/share/opencode");
  const authFile = join(authDir, "auth.json");

  mkdirSync(authDir, { recursive: true });

  let auth = {};
  if (existsSync(authFile)) {
    try { auth = JSON.parse(readFileSync(authFile, "utf8")); } catch {}
  }

  auth["github-copilot"] = {
    type: "oauth",
    access: token,
    refresh: token,
    expires: Date.now() + 86400000
  };

  writeFileSync(authFile, JSON.stringify(auth, null, 2));
  console.log("Token guardado en ~/.local/share/opencode/auth.json");
  console.log("\n✓ Autenticación completada. Ya puedes usar modelos GitHub Copilot.");
}

main().catch(e => console.error(e));
