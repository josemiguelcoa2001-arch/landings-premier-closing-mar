// Configuración pública de la landing.
//
// Devuelve el link del grupo de WhatsApp, que vive únicamente en la variable de
// entorno WHATSAPP_GROUP_URL. No hay ningún link hardcodeado en el repo: ni acá,
// ni en el HTML, ni como fallback.
//
// A diferencia de /api/lead, este valor SÍ es público — el navegador lo necesita
// para armar el href y el usuario lo va a ver igual al tocar el botón. Lo que
// gana la env var no es secreto sino poder cambiar el grupo sin tocar el código.
//
// Si la variable no está cargada, el campo viaja vacío y el endpoint responde
// 200 igual. El que decide qué hacer con eso es el cliente, que deja el botón
// deshabilitado y visible como error. Responder 500 acá haría que un fallo de
// configuración se vea igual que un fallo de red.

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  var url = process.env.WHATSAPP_GROUP_URL || "";
  if (!url) {
    console.error("[config] falta la variable de entorno WHATSAPP_GROUP_URL");
  }

  // 60s: suficiente para no pegarle en cada visita, corto para que cambiar el
  // grupo en Vercel se refleje enseguida sin purgar nada.
  res.setHeader("Cache-Control", "public, max-age=60");
  return res.status(200).json({ whatsappGroupUrl: url });
};
