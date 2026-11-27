/**
 * Partage d'un chantier : résumé texte (WhatsApp, SMS, mail) et fiche PDF, par le partage du téléphone.
 * Rien ne passe par un serveur.
 */
import { fmtLine, fmtPk } from '../lib/format';
import { ROLE_LABEL, SENS_FLECHE, SENS_TEXTE, titreChantier, zoneTexte, effectifAnnonce, type Chantier } from './chantier';
import { durees, JALONS, trainsParSens } from './deroule';
import { codesAgents, controlesDispositif } from './dispositif';
import { duree, heureDans } from '../lib/temps';
import { outillageLabel, SITUATION_LABEL, type Resultat } from './rules';

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

/** Ce que surveille un agent, en clair : « V1 ▲, V2 ▼ ». */
export function surveilleTexte(c: Chantier, keys: string[]): string {
  return keys
    .map((k) => {
      const [id, sens] = k.split(':') as [string, 'croissant' | 'decroissant'];
      const v = c.voies.find((x) => x.id === id);
      return v ? `${v.nom} ${SENS_FLECHE[sens]}` : null;
    })
    .filter(Boolean)
    .join(', ');
}

/** Résumé lisible tel quel dans un message. */
export function resumeTexte(c: Chantier, r: Resultat): string {
  const l: string[] = [];
  l.push(`Fiche CADA · ${titreChantier(c)}`);
  const ligne = c.ligne ? `Ligne ${fmtLine(c.ligne)}${c.ligneNom ? ` (${c.ligneNom})` : ''}` : 'Ligne à préciser';
  l.push(`${ligne} · ${zoneTexte(c)}`);
  l.push(`${fmtDate(c.date)} · ${c.horaire === 'nuit' ? 'de nuit' : 'de jour'} · chantier ${c.type}`);
  l.push(`${SITUATION_LABEL[r.situation]} · ${outillageLabel(c.outillage)}`);
  l.push(`DD ${r.dd.retenu ?? '?'} s · MS ${r.ms.valeur} s · DA ${r.da ?? '?'} s`);
  if (r.exemption) l.push(`Annonce non obligatoire : ${r.exemption}`);
  if (r.voies.length) {
    l.push('', 'Annonce :');
    for (const v of r.voies) {
      l.push(
        `- ${v.voie} ${SENS_FLECHE[v.sens]} (${SENS_TEXTE[v.sens]}) ${v.vitesse || '?'} km/h, ${v.da} s : ${v.distance ? `${v.distance} m` : '?'}` +
          (v.pointAnnonce !== null ? ` → point d’annonce PK ${fmtPk(v.pointAnnonce)}` : ''),
      );
    }
  }
  const codes = codesAgents(c.agents);
  const listes = c.agents.filter((a) => a.role !== 'asp' || a.nom.trim() || a.surveille.length);
  if (listes.length) {
    l.push('', `Dispositif (${effectifAnnonce(c)}) :`);
    for (const a of listes) {
      const s = surveilleTexte(c, a.surveille);
      l.push(
        `- ${codes.get(a.id)} ${ROLE_LABEL[a.role].toLowerCase()}${a.nom.trim() ? ` ${a.nom.trim()}` : ''}` +
          (a.pk !== null ? ` · PK ${fmtPk(a.pk)}` : '') +
          (s ? ` · surveille ${s}` : ''),
      );
    }
  }
  const stop = [...r.alertes, ...controlesDispositif(c, r)].filter((a) => a.niveau === 'stop');
  if (stop.length) {
    l.push('', 'À régler :');
    for (const a of stop) l.push(`- ${a.texte}`);
  }
  l.push('', 'Calcul ASP Rail : aide à la préparation, à vérifier sur le terrain et dans les documents officiels.');
  return l.join('\n');
}

/** Compte rendu d'intervention, lisible tel quel dans un message. */
export function compteRenduTexte(c: Chantier, r: Resultat): string {
  const d = c.deroule;
  const h = (t: number) => heureDans(t, c.date);
  const l: string[] = [];
  l.push(`Compte rendu d’intervention · ${titreChantier(c)}`);
  l.push(`${c.ligne ? `Ligne ${fmtLine(c.ligne)} · ` : ''}${zoneTexte(c)} · ${fmtDate(c.date)} ${c.horaire === 'nuit' ? 'de nuit' : 'de jour'}`);
  const qui = [c.asp && `ASP : ${c.asp}`, c.responsable && `Responsable : ${c.responsable}`, c.entreprise].filter(Boolean);
  if (qui.length) l.push(qui.join(' · '));
  l.push('', 'Horaires :');
  for (const j of JALONS) l.push(`- ${j.titre} : ${d.jalons[j.id] ? h(d.jalons[j.id]!) : 'non noté'}`);
  const ds = durees(d);
  if (ds.length) l.push(`Durée : ${ds.map((x) => `${x.titre.toLowerCase()} ${duree(x.ms)}`).join(' · ')}`);
  const parSens = trainsParSens(c, r, d);
  l.push('', `Trains annoncés : ${d.trains.length}${parSens.length ? ` (${parSens.map((x) => `${x.nom} : ${x.heures.length}`).join(' · ')})` : ''}`);
  l.push('', 'Incidents et observations :');
  if (d.evenements.length) for (const e of d.evenements) l.push(`- ${h(e.t)} ${e.type === 'incident' ? 'Incident' : 'Observation'} : ${e.texte}`);
  else l.push('- Aucun');
  l.push('', `Dispositif (${effectifAnnonce(c)}) :`);
  const codes = codesAgents(c.agents);
  for (const a of c.agents) {
    l.push(`- ${codes.get(a.id)} ${ROLE_LABEL[a.role].toLowerCase()}${a.nom.trim() ? ` ${a.nom.trim()}` : ''}${a.pk !== null ? ` · PK ${fmtPk(a.pk)}` : ''}`);
  }
  return l.join('\n');
}

export type Envoi = 'partage' | 'copie' | 'telecharge' | 'annule';

/** Envoi du résumé par le partage du téléphone, sinon copie dans le presse-papiers. */
export async function partagerTexte(title: string, text: string): Promise<Envoi> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'partage';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'annule';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copie';
  } catch {
    return 'annule';
  }
}

/** Message après l'envoi d'un PDF. */
export const messageEnvoi = (e: Envoi) =>
  e === 'partage' ? 'PDF envoyé.' : e === 'telecharge' ? 'PDF enregistré dans les téléchargements.' : e === 'copie' ? 'PDF prêt.' : 'Envoi annulé.';

/** Envoi d'un fichier (PDF) par le partage du téléphone, sinon téléchargement. */
export async function partagerFichier(file: File, title: string): Promise<Envoi> {
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'partage';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'annule';
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'telecharge';
}
