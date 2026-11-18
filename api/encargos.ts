// Formulario de encargos (Vercel Function, runtime Node). Valida los campos,
// verifica Turnstile y envía el correo con Resend. Es el único código del sitio
// que corre en el servidor; el resto es HTML estático.
//
// Sin imports a propósito: Vercel compila este archivo solo. Los valores
// compartidos con la página están repetidos de src/lib/commissions.ts
// (si cambias uno, cambia el otro).
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY        API key de Resend (solo permiso de envío)
//   TURNSTILE_SECRET_KEY  secret del widget de Turnstile
//   ENCARGOS_FROM         remitente verificado en Resend, p. ej. "Rapics <web@javiersabando.lat>"
//   ENCARGOS_TO           destino; por defecto encargos@javiersabando.lat (Email Routing lo reenvía)
//
// Vercel revisa los tipos con su propia config (sin ES2022 ni tipos de Node),
// así que este archivo declara los que usa: `process` y Object.hasOwn.
// En runtime Node 22 tiene ambos; esto es solo para el chequeo.
/// <reference types="node" />
/// <reference lib="es2022.object" />

const SESSION_TYPES: Record<string, string> = {
  retrato: "Retrato",
  evento: "Evento",
  concierto: "Concierto o banda",
  producto: "Producto",
  otro: "Otro",
};
const LIMITS = { name: 100, email: 200, messageMin: 10, messageMax: 3000 };
const PAGES = { es: "/encargos/", en: "/en/commissions/" };
const DEFAULT_TO = "encargos@javiersabando.lat";
const MAX_BODY = 32_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ErrorCode = "invalid" | "captcha" | "send";

export async function POST(request: Request): Promise<Response> {
  // Con JS la página pide JSON; sin JS (envío nativo) se redirige de vuelta.
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  let lang: "es" | "en" = "es";
  const reply = (status: number, error?: ErrorCode): Response => {
    if (wantsJson) return Response.json(error ? { ok: false, error } : { ok: true }, { status });
    const query = error ? `?error=${error}` : "?enviado=1";
    return Response.redirect(new URL(PAGES[lang] + query, request.url), 303);
  };

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return reply(413, "invalid");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, "invalid");
  }
  const field = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  lang = field("lang") === "en" ? "en" : "es";

  // Honeypot: si un bot llenó el campo oculto, se responde como si nada.
  if (field("website")) return reply(200);

  const name = field("name").replace(/\s+/g, " ");
  const email = field("email");
  const type = field("type");
  const date = field("date");
  const message = field("message");
  const valid =
    name.length > 0 &&
    name.length <= LIMITS.name &&
    email.length <= LIMITS.email &&
    EMAIL_RE.test(email) &&
    Object.hasOwn(SESSION_TYPES, type) &&
    (date === "" || DATE_RE.test(date)) &&
    message.length >= LIMITS.messageMin &&
    message.length <= LIMITS.messageMax;
  if (!valid) return reply(400, "invalid");

  const { RESEND_API_KEY, TURNSTILE_SECRET_KEY, ENCARGOS_FROM, ENCARGOS_TO } = process.env;
  if (!RESEND_API_KEY || !TURNSTILE_SECRET_KEY || !ENCARGOS_FROM) {
    console.error("encargos: faltan variables de entorno (RESEND_API_KEY, TURNSTILE_SECRET_KEY o ENCARGOS_FROM)");
    return reply(500, "send");
  }

  // Turnstile: el token es de un solo uso y se valida contra Cloudflare.
  const token = field("cf-turnstile-response");
  if (!token) return reply(400, "captcha");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    const params = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
    if (ip) params.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: params,
    });
    const result = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!result.success) {
      console.warn("encargos: Turnstile rechazó el token", result["error-codes"]);
      return reply(400, "captcha");
    }
  } catch (err) {
    console.error("encargos: no se pudo verificar Turnstile", err);
    return reply(502, "captcha");
  }

  const typeLabel = SESSION_TYPES[type];
  const text = [
    `Nombre: ${name}`,
    `Correo: ${email}`,
    `Tipo de sesión: ${typeLabel}`,
    `Fecha tentativa: ${date || "sin fecha"}`,
    `Idioma del formulario: ${lang === "en" ? "inglés" : "español"}`,
    "",
    message,
    "",
    "—",
    "Enviado desde el formulario de encargos de javiersabando.lat. Responde a este correo para contestarle.",
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: ENCARGOS_FROM,
        to: [ENCARGOS_TO || DEFAULT_TO],
        reply_to: email,
        subject: `Encargo: ${typeLabel} · ${name}`,
        text,
      }),
    });
    if (!res.ok) {
      console.error("encargos: Resend respondió", res.status, await res.text().catch(() => ""));
      return reply(502, "send");
    }
  } catch (err) {
    console.error("encargos: no se pudo contactar a Resend", err);
    return reply(502, "send");
  }

  return reply(200);
}
