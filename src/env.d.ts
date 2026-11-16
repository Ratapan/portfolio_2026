interface ImportMetaEnv {
  /** URI de solo lectura (portfolio_build). Solo existe en el build. */
  readonly MONGODB_URI?: string;
  /** Clave pública del widget de Turnstile (formulario de encargos). */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  /** Token público de Cloudflare Web Analytics. */
  readonly PUBLIC_CF_BEACON_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
