const cp = require("child_process");

async function getOpenRouterKey() {
  const direct = process.env.OPENROUTER_API_KEY || "";
  if (direct) return direct;
  try {
    const r = cp.execSync(`powershell -Command "[Environment]::GetEnvironmentVariable('OPENROUTER_API_KEY', 'User')"`, { timeout: 5000, encoding: "utf8" });
    const k = (r || "").trim();
    if (k) return k;
  } catch (e) {}
  try {
    const r = cp.execSync(`powershell -Command "[Environment]::GetEnvironmentVariable('OPENROUTER_API_KEY', 'Machine')"`, { timeout: 5000, encoding: "utf8" });
    const k = (r || "").trim();
    if (k) return k;
  } catch (e) {}
  return "";
}

(async () => {
  const apiKey = await getOpenRouterKey();
  console.log("API key found:", !!apiKey);
  if (!apiKey) { console.log("No key"); return; }

  const https = require('https');

  // Test simple chat first
  const data = JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [{ role: "user", content: "Say the word 'HELLO' and nothing else" }],
    max_tokens: 10
  });

  const result = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "openrouter.ai",
      path: "/api/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(data)
      },
      timeout: 15000
    }, (res) => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });

  console.log("Status:", result.status);
  console.log("Body:", result.body.substring(0, 500));
})();
