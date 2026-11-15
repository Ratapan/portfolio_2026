// /data/photos.json: todas las fotos visibles en formato público. Se genera en
// el build; la galería lo pide una vez y filtra/ordena en el navegador.
import type { APIRoute } from "astro";
import { galleryPhotos } from "../../lib/gallery";

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await galleryPhotos()), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
