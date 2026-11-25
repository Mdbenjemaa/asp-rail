/**
 * « Mes accès » : listes importées (fichier KML/KMZ/GeoJSON ou lien Google My Maps), gardées sur ce téléphone,
 * rattachées aux lignes avec leur PK, et recalculées quand les données PK changent.
 */
import { useState } from 'react';
import type { ImportStatus } from '../components/Sheets';
import { loadAcces, readAccesSource, saveAcces, snapAcces, type AccesSet } from '../lib/acces';
import type { Manifest } from '../lib/data';

export function useAcces(onImporte: () => void) {
  const [acces, setAcces] = useState<AccesSet[]>(() => loadAcces());
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);

  /**
   * Accès importés avec une autre version des données (ou sans réseau) : on recalcule leur ligne et leur PK,
   * pour qu'ils restent justes quand les PK sont recalés.
   */
  const resnapAcces = async (m: Manifest) => {
    for (const set of loadAcces()) {
      if (set.v === m.version || !set.items.length) continue;
      try {
        const { items, complete, version } = await snapAcces(set.items);
        if (!complete) continue;
        setAcces((cur) => {
          const next = cur.map((s) => (s.id === set.id ? { ...s, items, v: version } : s));
          saveAcces(next);
          return next;
        });
      } catch {
        /* pas de réseau : ce sera pour la prochaine ouverture */
      }
    }
  };

  const importAcces = async (src: File | string) => {
    setImportStatus({ busy: true, text: '' });
    try {
      const { title, points } = await readAccesSource(src);
      if (!points.length) throw new Error('Aucun point trouvé dans ce fichier.');
      const { items, complete, version } = await snapAcces(points);
      const name = title || (typeof src === 'string' ? 'Carte Google My Maps' : src.name.replace(/\.(kml|kmz|geojson|json)$/i, ''));
      const set: AccesSet = { id: String(Date.now()), name, imported: Date.now(), items, v: complete ? version : undefined };
      const next = [...acces, set];
      if (!saveAcces(next)) throw new Error('Le téléphone a refusé l’enregistrement (stockage plein ?).');
      setAcces(next);
      onImporte();
      const snapped = items.filter((a) => a.code).length;
      setImportStatus({
        busy: false,
        text:
          `${items.length} accès importés, dont ${snapped} rattachés à une ligne avec leur PK.` +
          (complete ? '' : ' Sans réseau, certains n’ont pas encore leur PK : il sera calculé au prochain lancement avec du réseau.'),
      });
    } catch (e) {
      setImportStatus({ busy: false, error: true, text: e instanceof Error ? e.message : 'Import impossible.' });
    }
  };

  const deleteSet = (id: string) => {
    const next = acces.filter((s) => s.id !== id);
    saveAcces(next);
    setAcces(next);
    setImportStatus(null);
  };

  /** Active ou désactive une liste d'accès (gardé sur le téléphone). */
  const toggleSet = (id: string) => {
    const next = acces.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s));
    saveAcces(next);
    setAcces(next);
  };

  return { acces, importStatus, resnapAcces, importAcces, deleteSet, toggleSet };
}
