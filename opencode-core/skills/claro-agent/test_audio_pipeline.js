/*
 * test_audio_pipeline.js
 * ======================
 * Prueba el pipeline de transcripción de audio captcha contra todos
 * los audios guardados (.mp3 / .wav). Reporta qué método produce qué
 * resultado y si hay números claros al final.
 *
 * Uso:
 *   node test_audio_pipeline.js
 *   node test_audio_pipeline.js "ruta/a/audio.mp3"
 */

const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const os = require("os");

const DIR = __dirname;

function getGroqKey() {
  const direct = process.env.GROQ_API_KEY;
  if (direct) return direct;
  try {
    const r1 = cp.execSync(
      "powershell -NoProfile -Command \"[Environment]::GetEnvironmentVariable('GROQ_API_KEY','User')\"",
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    if (r1) return r1;
    const r2 = cp.execSync(
      "powershell -NoProfile -Command \"[Environment]::GetEnvironmentVariable('GROQ_API_KEY','Machine')\"",
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    if (r2) return r2;
  } catch (e) {}
  return "";
}

async function transcribeGroq(file) {
  const apiKey = getGroqKey();
  if (!apiKey) return { ok: false, error: "no key" };
  try {
    const buf = fs.readFileSync(file);
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/wav" }), "audio.wav");
    form.append("model", "whisper-large-v3");
    form.append("language", "es");
    form.append("response_format", "json");
    const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey },
      body: form,
      signal: AbortSignal.timeout(60000)
    });
    if (resp.ok) {
      const data = await resp.json();
      const text = (data.text || "").trim();
      return { ok: !!text, text, method: "groq-whisper-large-v3" };
    }
    return { ok: false, error: "HTTP " + resp.status };
  } catch (e) {
    return { ok: false, error: e.message.substring(0, 60) };
  }
}

async function transcribeWhisperLocal(file) {
  try {
    const out = cp.execSync(
      `python "${path.join(DIR, "local_transcribe.py")}" "${file}"`,
      { encoding: "utf8", timeout: 180000 }
    );
    for (const line of out.trim().split("\n")) {
      try {
        const parsed = JSON.parse(line);
        return {
          ok: true,
          text: parsed.texto || parsed.raw_text || "",
          numeros: parsed.numeros || "",
          method: parsed.metodo || "local"
        };
      } catch (e) {}
    }
    return { ok: false, error: "parse fail" };
  } catch (e) {
    return { ok: false, error: e.message.substring(0, 60) };
  }
}

function hasNumbers(s) { return /[0-9]/.test(s || ""); }

async function main() {
  const targets = process.argv.slice(2);
  const files = targets.length > 0
    ? targets
    : fs.readdirSync(DIR)
        .filter(f => /^_captcha_.*\.(mp3|wav)$/.test(f))
        .map(f => path.join(DIR, f))
        .sort();

  if (files.length === 0) {
    console.log("No hay audios para probar. Pasa rutas como argumento.");
    return;
  }

  console.log("=".repeat(70));
  console.log("  TEST DE PIPELINE DE AUDIO CAPTCHA  (" + files.length + " audios)");
  console.log("=".repeat(70));

  let groqOk = 0, groqWithNums = 0, localOk = 0, localWithNums = 0;

  for (const file of files) {
    console.log("\n--- " + path.basename(file) + " ---");
    const groq = await transcribeGroq(file);
    if (groq.ok) {
      groqOk++;
      const nums = hasNumbers(groq.text);
      if (nums) groqWithNums++;
      console.log("  [Groq]     \"" + (groq.text || "").substring(0, 80) + "\"  " + (nums ? "✓ números" : "✗ sin números"));
    } else {
      console.log("  [Groq]     FAIL: " + (groq.error || ""));
    }

    const local = await transcribeWhisperLocal(file);
    if (local.ok) {
      localOk++;
      const nums = hasNumbers(local.numeros);
      if (nums) localWithNums++;
      console.log("  [Whisper]  \"" + (local.text || "").substring(0, 80) + "\"  nums=\"" + local.numeros + "\"  (" + local.method + ")  " + (nums ? "✓" : "✗"));
    } else {
      console.log("  [Whisper]  FAIL: " + (local.error || ""));
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("  RESUMEN");
  console.log("=".repeat(70));
  console.log("  Groq:    " + groqOk + "/" + files.length + " transcritos, " + groqWithNums + " con números");
  console.log("  Whisper: " + localOk + "/" + files.length + " transcritos, " + localWithNums + " con números");
  console.log("  (El pipeline usa Groq primero; si no hay números, intenta AI refine)");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
