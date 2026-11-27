/** Compte rendu de poste (annonceur, répétiteur, sentinelle), en PDF : poste, horaires, trains annoncés, incidents, signatures. */
import { creerPdf, nomPdf, type InfoExport } from '../lib/pdfKit';
import { fmtLine, fmtPk } from '../lib/format';
import { dateHeure, duree, heureDans } from '../lib/temps';
import { metres } from '../asp/dispositif';
import { ecartPa, ROLE_CHAINE, titrePoste, trainsParPa, type Poste } from './poste';

const signeLe = (t: number | null) => (t ? dateHeure(t) : null);
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export function compteRenduPostePdf(p: Poste, info: InfoExport): File {
  const h = (t: number) => heureDans(t, p.date);
  const k = creerPdf({
    titre: 'Compte rendu de poste',
    sousTitre: titrePoste(p),
    ligne3: [p.ligne ? `Ligne ${fmtLine(p.ligne)}` : null, p.pk !== null ? `PK ${fmtPk(p.pk)}` : null, `${fmtDate(p.date)} ${p.horaire === 'nuit' ? 'de nuit' : 'de jour'}`].filter(Boolean).join(' · '),
    info,
    pied: 'Compte rendu établi sur le téléphone de l’agent avec les heures notées pendant le poste. Les consignes de l’ASP et la fiche CADA font foi.',
  });

  k.titre('Poste');
  k.kv([
    ['Rôle', `${ROLE_CHAINE[p.role]} ${p.code}`],
    ['Chantier', p.chantier || '—'],
    ['Ligne', p.ligne ? `${fmtLine(p.ligne)}${p.ligneNom ? ` · ${p.ligneNom}` : ''}` : '—'],
    ['Mon PK', p.pk === null ? '—' : fmtPk(p.pk)],
    ['Surveille', p.surveille || '—'],
    ['Agent', info.agent || '—'],
    ['ASP', info.second?.nom || p.asp || '—'],
    ['Date', `${fmtDate(p.date)} · ${p.horaire === 'nuit' ? 'de nuit' : 'de jour'}`],
  ]);
  if (p.pas.length) {
    k.table(
      ['Point d’annonce', 'PK', 'À voir'],
      p.pas.map((pa) => {
        const e = ecartPa(p, pa);
        return [pa.titre, fmtPk(pa.pk), e === null ? '—' : e <= 5 ? 'au point' : metres(e)];
      }),
    );
  }

  k.titre('Horaires');
  k.kv([
    ['Prise de poste', p.prise ? h(p.prise) : 'Non notée'],
    ['Fin de poste', p.fin ? h(p.fin) : 'Non notée'],
    ...(p.prise && p.fin && p.fin >= p.prise ? [['Durée', duree(p.fin - p.prise)] as [string, string]] : []),
  ]);

  const parPa = trainsParPa(p);
  k.titre(`Trains annoncés : ${p.trains.length}`);
  if (parPa.length) k.table(['Annonce', 'Nombre', 'Heures'], parPa.map((x) => [x.nom, String(x.heures.length), x.heures.map(h).join(', ')]), { widths: { 1: 22 } });
  else k.note('Aucun train noté pendant le poste.');

  const incidents = p.evenements.filter((e) => e.type === 'incident').length;
  k.titre(incidents ? `Incidents et observations (${incidents} incident${incidents > 1 ? 's' : ''})` : 'Incidents et observations');
  if (p.evenements.length) {
    k.table(['Heure', 'Type', 'Description'], p.evenements.map((e) => [h(e.t), e.type === 'incident' ? 'Incident' : 'Observation', e.texte]), { widths: { 0: 24, 1: 28 } });
  } else {
    k.note('Aucun incident ni observation noté.');
  }
  if (p.notes.trim()) {
    k.titre('Notes');
    k.note(p.notes.trim());
  }

  k.titre('Signatures', 56);
  k.signatures([
    { titre: ROLE_CHAINE[p.role], nom: info.agent, png: info.signature, quand: signeLe(info.signeA) },
    { titre: 'ASP', nom: info.second?.nom || p.asp, png: info.second?.signature ?? null, quand: signeLe(info.second?.signeA ?? null) },
  ]);
  return k.fichier(nomPdf('Compte-rendu-poste', titrePoste(p), info.cree));
}
