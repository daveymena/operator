import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { responderGroq } from "./groqClient.js";

export async function iniciarWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./session_whatsapp");
  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    browser: ["TecnovariedadesBot", "Chrome", "1.0.0"],
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });

    if (connection === "open") console.log("✅ Conectado a WhatsApp correctamente");
    else if (connection === "close") {
      const motivo = lastDisconnect?.error?.output?.statusCode;
      console.log("⚠️ Conexión cerrada. Motivo:", motivo);
      if (motivo !== DisconnectReason.loggedOut) {
        console.log("🔄 Intentando reconexión...");
        iniciarWhatsApp();
      } else {
        console.log("🔒 Sesión cerrada, escanea el QR nuevamente.");
      }
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      "";

    if (!text) return;

    console.log(`💬 Mensaje recibido (${sender}): ${text}`);

    const respuesta = await responderGroq(text);
    await sock.sendMessage(sender, { text: respuesta });
  });

  sock.ev.on("creds.update", saveCreds);
}