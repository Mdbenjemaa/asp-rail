/**
 * PDF partagés vers l'appli (menu « Partager » d'Android, depuis Gmail) : le service worker les garde dans le cache
 * « asp-partage » (public/partage-sw.js) puis ouvre l'appli avec « ?partage=planning ».
 */
export const partageEnAttente = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('partage') === 'planning';

/** Retire « ?partage=planning » de l'adresse (un rechargement ne réimporte pas). */
export function oublierPartage() {
  const u = new URL(location.href);
  u.searchParams.delete('partage');
  history.replaceState(history.state, '', u.href);
}

/** Les PDF partagés, retirés du cache au passage. */
export async function recupererPartage(): Promise<File[]> {
  if (typeof caches === 'undefined') return [];
  const cache = await caches.open('asp-partage');
  const cles = [...(await cache.keys())].sort((a, b) => a.url.localeCompare(b.url));
  const fichiers: File[] = [];
  for (const cle of cles) {
    const rep = await cache.match(cle);
    await cache.delete(cle);
    if (!rep) continue;
    const nom = decodeURIComponent(rep.headers.get('X-Nom') ?? 'planning.pdf');
    fichiers.push(new File([await rep.blob()], nom, { type: 'application/pdf' }));
  }
  return fichiers;
}
