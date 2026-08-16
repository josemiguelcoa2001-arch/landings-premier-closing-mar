// Proxy serverless para los registros de la landing.
//
// El navegador postea acá (mismo origen) y esta función reenvía el lead al
// webhook real, cuya URL vive únicamente en la variable de entorno
// N8N_WEBHOOK_URL. El cliente nunca la conoce.
//
// Mismo origen: no hacen falta headers de CORS.

const TIMEOUT_MS = 8000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    console.error("[lead] falta la variable de entorno N8N_WEBHOOK_URL");
    return res.status(500).json({ ok: false, error: "missing_webhook_url" });
  }

  // Vercel parsea el body cuando el Content-Type es JSON, pero puede llegar
  // como string o como Buffer segun el runtime: contemplamos los tres casos.
  let payload = req.body;
  if (Buffer.isBuffer(payload)) payload = payload.toString("utf8");
  if (typeof payload === "string") {
    try {
      payload = payload ? JSON.parse(payload) : {};
    } catch (e) {
      console.error("[lead] el body no es JSON valido:", e);
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    payload = {};
  }

  // Datos agregados del lado del servidor: el cliente no puede falsificarlos.
  const enriquecido = Object.assign({}, payload, {
    ip: req.headers["x-forwarded-for"] || null,
    user_agent: req.headers["user-agent"] || null
  });

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enriquecido),
      signal: control.signal
    });

    if (!upstream.ok) {
      console.error("[lead] el webhook respondio " + upstream.status + " " + upstream.statusText);
      return res.status(200).json({ ok: false, error: "upstream_" + upstream.status });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    // Nunca propagamos el fallo al usuario: el lead se pierde en el log,
    // pero la landing sigue mostrando su pantalla final.
    console.error("[lead] no se pudo reenviar el registro:", e);
    const motivo = e && e.name === "AbortError" ? "timeout" : "network_error";
    return res.status(200).json({ ok: false, error: motivo });
  } finally {
    clearTimeout(reloj);
  }
};
