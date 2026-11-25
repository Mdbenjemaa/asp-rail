/**
 * Fiche CADA en PDF (A4), faite sur le téléphone avec jsPDF : chantier, plan de situation, plateforme, délais,
 * points d'annonce, dispositif, points à régler, check-lists et signatures. Chargé seulement quand on en a besoin.
 */
import type { LineDoc } from '../lib/data';
import { fmtLine, fmtPk } from '../lib/format';
import { creerPdf, nomPdf, type InfoExport } from '../lib/pdfKit';
import { planSituation, rayonPour, type MarquePlan } from '../lib/plan';
import { ROLE_LABEL, SENS_FLECHE, SENS_LABEL, titreChantier, zoneTexte, effectifAnnonce, type Chantier, zoneAnnonce } from './chantier';
import { CHECKLISTS } from './checklists';
import { codesAgents, controlesDispositif } from './dispositif';
import { surveilleTexte } from './partage';
import { outillageLabel, SITUATION_LABEL, type Particularites, type Resultat } from './rules';
import { PARTICULARITES } from './textes';

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

function particularitesTexte(p: Particularites): string {
  const on = PARTICULARITES.filter((x) => p[x.key]).map((x) => x.label);
  return on.length ? on.join(' ; ') : 'Aucune';
}

export function fichePdf(c: Chantier, r: Resultat, info: InfoExport, ligne: LineDoc | null): File {
  const z = zoneAnnonce(c);
  const k = creerPdf({
    titre: 'Fiche CADA',
    sousTitre: titreChantier(c),
    ligne3: [c.ligne ? `Ligne ${fmtLine(c.ligne)}` : null, zoneTexte(c), `${fmtDate(c.date)} ${c.horaire === 'nuit' ? 'de nuit' : 'de jour'}`].filter(Boolean).join(' · '),
    info,
    pied: 'Aide à la préparation : ne remplace ni le carnet CADA, ni l’AAn, ni les textes et consignes en vigueur. PK et vitesses à vérifier sur le terrain.',
  });

  // Chantier.
  k.titre('Chantier');
  k.kv([
    ['Ligne', c.ligne ? `${fmtLine(c.ligne)}${c.ligneNom ? ` · ${c.ligneNom}` : ''}` : 'À préciser'],
    ['Zone de travail', zoneTexte(c)],
    ...(c.type === 'mobile' && z.debut !== null ? ([['Zone sous annonce', `PK ${fmtPk(z.debut)} -> ${fmtPk(z.fin)} (${c.longueurAnnonce ?? '?'} m)`]] as [string, string][]) : []),
    ['Type de chantier', c.type === 'fixe' ? 'Fixe' : c.type === 'mobile' ? 'Mobile' : 'Itinérant'],
    ['Date', `${fmtDate(c.date)} · ${c.horaire === 'nuit' ? 'de nuit' : 'de jour'}`],
    ['Entreprise', c.entreprise || '—'],
    ['ASP', c.asp || '—'],
    ['Responsable du chantier', c.responsable || '—'],
    ['Effectif travaux', c.effectif === null ? '—' : String(c.effectif)],
    ['Effectif annonce', effectifAnnonce(c)],
  ]);

  // Plan de situation : zone de travail, points d'annonce et agents placés.
  const codes = codesAgents(c.agents);
  if (ligne && c.ligne && z.debut !== null) {
    const fin = z.fin ?? z.debut;
    const milieu = (z.debut + fin) / 2;
    const marques: MarquePlan[] = [
      ...r.voies.filter((v) => v.pointAnnonce !== null).map((v) => ({ pk: v.pointAnnonce!, label: `Annonce ${v.voie} ${SENS_FLECHE[v.sens]}`, genre: 'annonce' as const })),
      ...c.agents.filter((a) => a.pk !== null && a.role !== 'asp').map((a) => ({ pk: a.pk!, label: codes.get(a.id) ?? '', genre: 'agent' as const })),
    ];
    const p = planSituation(ligne, milieu, {
      rayon: rayonPour(milieu, [z.debut, fin, ...marques.map((m) => m.pk)]),
      zone: [z.debut, fin],
      marques: [{ pk: milieu, label: `Chantier · PK ${fmtPk(z.debut)}${fin !== z.debut ? ` à ${fmtPk(fin)}` : ''}`, genre: 'ici' }, ...marques],
    });
    if (p) {
      k.titre('Plan de situation', 100);
      k.plan(p, { ligne: fmtLine(c.ligne), pk: milieu });
    }
  }

  // Plateforme.
  k.titre('Plateforme');
  const place = { travail: 'Voie de travail', contigue: 'Contiguë', traversee: 'À traverser', hors: 'Hors annonce' } as const;
  k.table(
    ['Voie', 'Sens des circulations', 'Vitesse', 'Place', 'Statut'],
    c.voies.map((v) => [v.nom || '—', SENS_LABEL[v.sens], v.vitesse ? `${v.vitesse} km/h` : '?', place[v.role], v.interdite ? 'Interdite (DFV)' : 'Circulée']),
  );

  // Délais.
  k.titre('Délais');
  k.kv([
    ['Situation', SITUATION_LABEL[r.situation]],
    ['Outillage', outillageLabel(c.outillage)],
    ['Particularités', particularitesTexte({ ...c.p, nuit: c.horaire === 'nuit' })],
    ['Délai de dégagement', r.dd.retenu === null ? 'À saisir' : `${r.dd.retenu} s${r.dd.saisi !== r.dd.retenu ? ` (saisi : ${r.dd.saisi ?? '-'} s)` : ''}`],
    ['Marge de sécurité', `${r.ms.valeur} s · ${r.ms.raisons.join(' ')}`],
    ['Délai d’annonce', r.da === null ? 'À calculer' : `${r.da} s (DD + MS)`],
  ]);

  // Points d'annonce.
  k.titre('Distances et points d’annonce');
  if (r.exemption) k.note(`Annonce non obligatoire : ${r.exemption}`);
  if (r.voies.length) {
    k.table(
      ['Voie', 'Sens', 'Vitesse', 'Délai', 'Distance', 'Limite amont', 'Point d’annonce'],
      r.voies.map((v) => [
        v.voie,
        SENS_LABEL[v.sens],
        v.vitesse ? `${v.vitesse} km/h` : '?',
        `${v.da} s`,
        v.distance ? `${v.distance} m` : '?',
        v.limiteAmont === null ? '?' : `PK ${fmtPk(v.limiteAmont)}`,
        v.pointAnnonce === null ? '?' : `PK ${fmtPk(v.pointAnnonce)}`,
      ]),
    );
  } else {
    k.note('Aucune voie à annoncer.');
  }

  // Dispositif.
  k.titre(`Dispositif d’annonce (${effectifAnnonce(c)})`);
  k.table(
    ['', 'Rôle', 'Nom', 'Entreprise', 'Position', 'Surveille'],
    c.agents.map((a) => [codes.get(a.id) ?? '', ROLE_LABEL[a.role], a.nom || '—', a.entreprise || '—', a.pk === null ? '—' : `PK ${fmtPk(a.pk)}`, surveilleTexte(c, a.surveille) || '—']),
  );

  // Points à régler.
  const alertes = [...r.alertes, ...controlesDispositif(c, r)].filter((a) => a.niveau !== 'info');
  const erreursDd = r.dd.erreurs.map((t) => ({ niveau: 'stop' as const, texte: t }));
  const tout = [...erreursDd, ...alertes];
  if (tout.length) {
    k.titre('À régler et à vérifier');
    k.kv(tout.map((a) => [a.niveau === 'stop' ? 'À régler' : 'À vérifier', a.texte]));
  }

  // Check-lists.
  k.titre('Check-lists');
  k.table(
    null,
    CHECKLISTS.flatMap((l) => [[l.title, ''], ...l.items.map((i) => [c.checks[i.id] ? '[x]' : '[ ]', i.text])]),
    { widths: { 0: 14 } },
  );

  if (c.notes.trim()) {
    k.titre('Notes');
    k.note(c.notes.trim());
  }

  k.titre('Signatures', 56);
  k.signatures([
    {
      titre: 'ASP',
      nom: info.agent || c.asp,
      png: info.signature,
      quand: info.signeA ? `${new Date(info.signeA).toLocaleDateString('fr-FR')} à ${new Date(info.signeA).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : null,
    },
    { titre: 'Responsable du chantier', nom: c.responsable },
  ]);

  return k.fichier(nomPdf('CADA', titreChantier(c), info.cree));
}
