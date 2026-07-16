import axios from "axios";
import dotenv from "dotenv";
import { promptBase } from "./promptBase.js";

dotenv.config();

export async function responderGroq(pregunta) {
  const promptFinal = `${promptBase}\n\nCliente: ${pregunta}\nTú:`;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "mixtral-8x7b-32768",
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