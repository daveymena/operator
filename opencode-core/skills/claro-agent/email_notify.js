const nodemailer = require("nodemailer");

const {
  SMTP_HOST = "smtp.gmail.com",
  SMTP_PORT = "587",
  SMTP_USER = "daveymena16@gmail.com",
  SMTP_PASS = process.env.EMAIL_PASS || "",
  EMAIL_FROM = "daveymena16@gmail.com",
  EMAIL_TO = "daveymena16@gmail.com",
} = process.env;

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT, 10),
      secure: SMTP_PORT === "465",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

async function sendCertification(order) {
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `Certificacion OT ${order.ot || order.orden || ""} - ${order.cuenta || ""}`,
      html: `
        <h2>Certificacion de Envio</h2>
        <table border="1" cellpadding="6" style="border-collapse:collapse;font-family:Arial">
          <tr><td><b>OT</b></td><td>${order.ot || order.orden || "N/A"}</td></tr>
          <tr><td><b>Cuenta</b></td><td>${order.cuenta || "N/A"}</td></tr>
          <tr><td><b>Cliente</b></td><td>${order.nombre || "N/A"}</td></tr>
          <tr><td><b>Direccion</b></td><td>${order.direccion || "N/A"}</td></tr>
          <tr><td><b>Ciudad</b></td><td>${order.ciudad || "N/A"}</td></tr>
          <tr><td><b>Nodo</b></td><td>${order.nodo || "N/A"}</td></tr>
          <tr><td><b>Tipo</b></td><td>${order.tipo || "N/A"}</td></tr>
          <tr><td><b>Tecnico</b></td><td>${order.nombre_tecnico || "N/A"}</td></tr>
          <tr><td><b>Serial ONT</b></td><td>${order.serial_ont || "N/A"}</td></tr>
          <tr><td><b>Serial Deco</b></td><td>${order.serial_deco || "N/A"}</td></tr>
          <tr><td><b>Estado</b></td><td style="color:green;font-weight:bold">ENVIADO</td></tr>
          <tr><td><b>Fecha</b></td><td>${new Date().toLocaleString("es-CO")}</td></tr>
        </table>
        <p>Formulario enviado correctamente.</p>
      `,
    });
    console.log(`  [EMAIL] Certificacion enviada: ${info.messageId}`);
    return true;
  } catch (e) {
    console.log(`  [EMAIL] Error al enviar certificacion: ${e.message.substring(0, 80)}`);
    return false;
  }
}

module.exports = { sendCertification };
