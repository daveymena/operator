import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { promptBase } from "./promptBase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', 'config', '.env') });
dotenv.config();

export async function responderGroq(pregunta) {
  const promptFinal = `${promptBase}\n\nCliente: ${pregunta}\nTú:`;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Eres un agente de ventas profesional y amable." },
          { role: "user", content: promptFinal },
        ],
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("❌ Error al conectar con Groq:", error.message);
    return "Disculpa, estoy teniendo un pequeño problema para responder ahora 😅.";
  }
}