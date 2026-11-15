interface ImportMetaEnv {
  /** URI de solo lectura (portfolio_build). Solo existe en el build. */
  readonly MONGODB_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
