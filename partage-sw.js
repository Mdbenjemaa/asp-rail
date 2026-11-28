/*
 * Partage vers ASP Rail (Android) : le PDF du planning partagé depuis Gmail arrive ici (POST), il est gardé un instant
 * dans le cache « asp-partage », puis l'appli s'ouvre sur « Mon planning » qui l'importe et le retire du cache.
 * Chargé par le service worker de l'appli (workbox importScripts).
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'POST' || !new URL(req.url).pathname.endsWith('/partage-planning')) return;
  event.respondWith(
    (async () => {
      const base = self.registration.scope;
      try {
        const donnees = await req.formData();
        const fichiers = donnees.getAll('pdf').filter((f) => f && typeof f !== 'string');
        const cache = await caches.open('asp-partage');
        for (const cle of await cache.keys()) await cache.delete(cle);
        let i = 0;
        for (const f of fichiers) {
          const entetes = { 'Content-Type': f.type || 'application/pdf', 'X-Nom': encodeURIComponent(f.name || 'planning.pdf') };
          await cache.put(new Request(new URL(`partage-planning/${i++}`, base).href), new Response(f, { headers: entetes }));
        }
      } catch {
        // Rien de lisible : l'appli dira qu'aucun PDF n'est arrivé.
      }
      return Response.redirect(new URL('./?partage=planning', base).href, 303);
    })(),
  );
});
