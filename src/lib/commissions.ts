// Formulario de encargos: lo que comparten la página y la función
// api/encargos.ts. La función no importa este archivo (va sin dependencias para
// que Vercel la compile sola), así que estos valores están repetidos allá:
// si cambias algo aquí, cámbialo también en api/encargos.ts.

/** Tipos de sesión (valor enviado; las etiquetas están en i18n `commissions.types`). */
export const SESSION_TYPES = ["retrato", "evento", "concierto", "producto", "otro"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const LIMITS = { name: 100, email: 200, messageMin: 10, messageMax: 3000 } as const;

/** Dirección pública de encargos (Email Routing la reenvía al correo personal). */
export const COMMISSIONS_EMAIL = "encargos@javiersabando.lat";

/** Endpoint del formulario (con barra final: vercel.json usa trailingSlash). */
export const COMMISSIONS_ENDPOINT = "/api/encargos/";

/** Errores que devuelve la función (claves de i18n `commissions.errors`). */
export const ERROR_CODES = ["invalid", "captcha", "send", "network"] as const;
