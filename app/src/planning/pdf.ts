/**
 * Lit le texte placé d'un PDF sur le téléphone (pdf.js, chargé seulement à l'import). Rien ne sort du téléphone.
 */
import type { Morceau } from './lire';

export async function morceauxDuPdf(donnees: ArrayBuffer): Promise<Morceau[][]> {
  // Version « legacy » : marche aussi sur les téléphones un peu anciens (iPhone, Android).
  const [pdfjs, travailleur] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = travailleur.default;
  const tache = pdfjs.getDocument({ data: new Uint8Array(donnees), verbosity: 0 });
  const doc = await tache.promise;
  try {
    const pages: Morceau[][] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const contenu = await page.getTextContent();
      const ms: Morceau[] = [];
      for (const it of contenu.items) {
        if (!('str' in it) || !it.str.trim()) continue;
        ms.push({ s: it.str, x: it.transform[4], y: it.transform[5], l: it.width, h: it.height || Math.abs(it.transform[3]) });
      }
      pages.push(ms);
      page.cleanup();
    }
    return pages;
  } finally {
    void tache.destroy();
  }
}
