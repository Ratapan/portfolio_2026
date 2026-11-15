# Fase 0 — checklist en los dashboards

Estos son ajustes de tus cuentas, así que los haces tú. Avísame al terminar cada bloque y verifico desde aquí lo que se pueda comprobar por fuera.

## 1. Cloudflare — Image Transformations

1. En el dashboard: **Images → Transformations** → zona `javiersabando.lat` → **Enable for zone**.
2. No actives "resize from any origin": las fotos salen de `assets.javiersabando.lat`, que es de la misma zona.
3. Verificación (la corro yo): `https://assets.javiersabando.lat/cdn-cgi/image/width=480,format=auto/blog/images/260607_tricao/DSC02983.webp` debe responder 200 con la cabecera `cf-resized`. Un AVIF no sirve como origen (error 9520), así que `yo.avif` hay que volver a subirlo como JPG o WebP en la fase 2.

**Hecho** (verificado el 2026-11-15): esa URL responde un AVIF de ~14 KB con `cf-resized`.

## 2. Cloudflare — caché más larga para las imágenes (recomendado; ya mejora el sitio actual)

**Hecho** (verificado el 2026-11-15): las fotos, también las transformadas, salen con `Cache-Control: max-age=1209600` (14 días) y `cf-cache-status: HIT`.

- **Caching → Cache Rules → Create rule**, con la condición: hostname igual a `assets.javiersabando.lat`.
  - **Browser TTL**: sobrescribir el origen, 30 días.
  - Edge TTL: dejarlo como está.
- Ojo: si vuelves a subir una foto con el **mismo nombre**, quien ya la vio puede seguir viendo la versión vieja mientras dure esa caché (hoy 14 días). En v2 las URLs llevarán `?v=` para evitarlo, y entonces se puede subir a 1 año.

## 3. R2 — bucket privado de originales

1. **R2 → Create bucket** → `portfolio-originals`. **Sin** dominio propio y **sin** acceso público `r2.dev`.
2. **R2 → Manage API tokens**: el token que usa insta_bot (`PORTFOLIO_R2_*`) necesita *Object Read & Write* en el bucket público **y** en `portfolio-originals`. Puedes editar el token existente o crear uno nuevo con ambos buckets; si creas uno nuevo, actualiza el `.env` local de insta_bot (insta_bot solo corre en local).
3. Agrega `PORTFOLIO_ORIGINALS_BUCKET=portfolio-originals` al `.env` de insta_bot. Lo usará la fase 1.

**Hecho** (verificado el 2026-11-15): con el `.env` de insta_bot, el token accede a `useful-images` y a `portfolio-originals`. insta_bot solo corre en local, así que no hay otro entorno que configurar.

**Ojo con el orden:** hasta desplegar portfolio_2025 con el `select: false` de `originalKey` (`server/models/Image.ts`), no subas fotos desde el insta_bot local. Guardaría el `originalKey` en el Mongo de producción, y la versión desplegada lo devuelve en `/api/portfolio/photos` y `/api/images/by-url`: las dos consultas usan `.lean()` sin proyección.

## 4. MongoDB (Railway) — usuario de solo lectura para el build

**Hecho** (verificado el 2026-11-15 con la cuenta admin): existe `portfolio_build@rtp_blog`, con un solo rol: `read@rtp_blog`.

Tu Mongo corre en **Railway** (proxy TCP `*.proxy.rlwy.net`), no en Atlas. No hay una pantalla de usuarios: se crea con `mongosh`.

1. Conéctate con la URI de administrador (la misma de `PORTFOLIO_MONGODB_URI`): `mongosh "<esa URI>"`. Railway también la muestra en el servicio de Mongo → *Connect*.
2. Crea el usuario. `passwordPrompt()` te pide el password sin que quede en el historial; elige uno largo y aleatorio:
   ```js
   use rtp_blog
   db.createUser({
     user: "portfolio_build",
     pwd: passwordPrompt(),
     roles: [{ role: "read", db: "rtp_blog" }],
   })
   ```
3. El proxy TCP de Railway es público, así que el build de Cloudflare podrá conectar sin listas de IPs. Las credenciales de solo lectura limitan el riesgo.
4. La URI del build queda con el mismo host y puerto que la actual, pero autenticando contra `rtp_blog`: `mongodb://portfolio_build:<password>@<host>:<puerto>/rtp_blog?authSource=rtp_blog`. Irá como variable de build del Worker en la fase 2. **No la pegues en el chat.**

## 5. Correo para "Encargos" — decidir antes de tocar nada

**Hecho** (verificado el 2026-11-15): Email Routing activo, `encargos@` → Gmail verificado y catch-all desactivado. En el DNS público hay MX `route1`–`route3.mx.cloudflare.net`, SPF `v=spf1 include:_spf.mx.cloudflare.net ~all` y DKIM `cf2024-1._domainkey`. Los `eforward` y el SPF viejo ya no están. Falta el correo de prueba desde otra cuenta.

Namecheap es solo el registrador. Los nameservers son `jack.ns.cloudflare.com` y `ullis.ns.cloudflare.com` (Custom DNS), así que todos los registros, MX incluidos, se editan en **Cloudflare → DNS → Records**. Por eso Namecheap no muestra la sección *Redirect Email*: solo aparece cuando el dominio usa su propio DNS.

Estado del DNS público (2026-11-15):
- MX → reenvío gratis de Namecheap (`eforward1` a `eforward5.registrar-servers.com`) y SPF `v=spf1 include:spf.efwd.registrar-servers.com ~all`. Vienen de cuando el dominio usaba el DNS de Namecheap. Los alias ya no se pueden ver, y no es seguro que el reenvío siga funcionando.
- TXT `google-site-verification=…`: es de Search Console y se queda.
- Ni portfolio_2025 ni insta_bot publican una dirección `@javiersabando.lat`.

**No vuelvas los nameservers a Namecheap para ver los alias**, aunque su ayuda lo sugiera. Todo el DNS saldría de Cloudflare y dejarían de funcionar `assets.javiersabando.lat` (el dominio del bucket R2), las Transformations y la regla de caché.

1. Anota las direcciones del dominio que hayas dado a alguien y manda un correo de prueba a cada una desde tu correo personal. Si llega, hay que recrearla; si rebota, no hay nada que conservar.
2. En Cloudflare: **Email → Email Routing** → Enable.
   - Cloudflare pone sus MX (`route1` a `route3.mx.cloudflare.net`) y su SPF (`include:_spf.mx.cloudflare.net`).
   - Después revisa en **DNS → Records** que no queden MX `eforward*` ni el SPF de Namecheap: con dos registros SPF, ambos quedan inválidos.
   - Recrea las direcciones del paso 1.
   - Agrega `encargos@javiersabando.lat`.
   - Verifica tu correo personal como destino.
3. Repite la prueba con cada dirección antes de dar el paso por cerrado. Avísame y verifico los MX y el SPF desde aquí.

Si prefieres no tocar el correo todavía, este bloque puede esperar hasta la fase 6, que es cuando se usa.

## 6. GitHub + Workers Builds — en la fase 2

El Worker necesita un proyecto que compilar, así que se conecta al final de la fase 2. Antes te pido OK para crear el repo `portfolio_2026` en GitHub.
