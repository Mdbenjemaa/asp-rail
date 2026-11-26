/**
 * Une case du planning ETF, comprise : chantier entre guillemets, poste entre crochets ([ANN], [APLAM/S9]…), lieu,
 * prise de service (« PS : … »), horaire (21h00-04h00), OTP. Une case sans chantier porte un code (RH, Z, AMO…).
 * Le texte d'origine reste gardé tel quel : c'est lui qu'on montre, le reste sert au résumé et à préremplir.
 */
import { jourDe } from '../lib/temps';

export interface JourPlanning {
  /** AAAA-MM-JJ. */
  date: string;
  /** Texte de la case, ligne par ligne, tel qu'écrit dans le planning. */
  lignes: string[];
  /** Case sans chantier : RH, Z, AMO, CP… */
  code: string | null;
  chantier: string;
  /** Sans crochets : « ANN », « APLAM/S9 », « Doublon APN ». */
  poste: string;
  lieu: string;
  /** Prise de service. */
  ps: string;
  otp: string;
  debut: string | null;
  fin: string | null;
  nuit: boolean;
}

/** Ce que veulent dire les codes (d'après l'agent) ; les autres codes sont montrés tels quels. */
export const CODES: Record<string, string> = {
  RH: 'Repos hebdomadaire',
  Z: 'Fin de la nuit du vendredi, comptée en grand déplacement',
  AMO: 'Attente de mission',
  CP: 'Congés payés',
  JF: 'Jour férié',
  'FIN CONTRAT': 'Fin de contrat',
};

const HORAIRE = /(\d{1,2})\s*[hH:]\s*(\d{2})?\s*[-–à]\s*(\d{1,2})\s*[hH:]\s*(\d{2})?/;
const PS = /^p\.?\s?s\.?\s*:?\s*(.*)$/i;
const OTP = /\bOTP\s*:?\s*([\w-]+)/i;
const POSTE = /\[([^\]]+)\]/;
/** Lignes d'information (pas un lieu). */
const INFO = /^(nuit|jour|topo|sondage|dapr|epi\b.*|avec .*pause.*|.*pause.*)$/i;

const deux = (n: number) => String(n).padStart(2, '0');

export function interpreter(lignes: string[], date: string): JourPlanning {
  const l = lignes.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const j: JourPlanning = { date, lignes: l, code: null, chantier: '', poste: '', lieu: '', ps: '', otp: '', debut: null, fin: null, nuit: false };
  if (!l.length) return j;
  const tout = l.join(' ');
  if (l.length === 1 && !/\d/.test(l[0]) && !/["[\]]/.test(l[0]) && l[0].length <= 14) {
    j.code = l[0].toUpperCase() === l[0] || l[0].length <= 3 ? l[0].toUpperCase() : l[0];
    return j;
  }
  const h = HORAIRE.exec(tout);
  if (h) {
    j.debut = `${deux(Number(h[1]))}:${h[2] ?? '00'}`;
    j.fin = `${deux(Number(h[3]))}:${h[4] ?? '00'}`;
  }
  const p = POSTE.exec(tout);
  if (p) j.poste = p[1].replace(/\s+/g, ' ').trim();
  const o = OTP.exec(tout);
  if (o) j.otp = o[1];
  const utilisees = new Set<number>();
  l.forEach((x, i) => {
    const ps = PS.exec(x);
    if (ps && ps[1]) {
      j.ps = ps[1].trim();
      utilisees.add(i);
    }
    if (POSTE.test(x) || OTP.test(x) || (HORAIRE.test(x) && x.replace(HORAIRE, '').trim().length < 3)) utilisees.add(i);
  });
  // Chantier : la ligne entre guillemets, sinon la première ligne (« Formation », « RDV Beauchamp »…).
  const iq = l.findIndex((x) => /"[^"]+"?/.test(x) || /^"/.test(x));
  const ic = iq >= 0 ? iq : l.findIndex((_, i) => !utilisees.has(i));
  if (ic >= 0) {
    j.chantier = l[ic]
      .replace(/["²]/g, '')
      .replace(HORAIRE, '')
      .replace(/\s+/g, ' ')
      .trim();
    utilisees.add(ic);
  }
  // Lieu : la première ligne restante après le chantier, si ce n'est pas une information (NUIT, EPI…).
  const il = l.findIndex((x, i) => i > ic && !utilisees.has(i) && !INFO.test(x));
  if (il >= 0) j.lieu = l[il];
  if (j.debut && j.fin) {
    const d = Number(j.debut.slice(0, 2));
    const f = Number(j.fin.slice(0, 2));
    j.nuit = d >= 20 || f < d || (d >= 18 && f <= 8);
  }
  if (/\bnuit\b/i.test(tout)) j.nuit = true;
  return j;
}

/** Jour de travail (un horaire ou un chantier), pas un repos ni une attente. */
export const travaille = (j: JourPlanning | null | undefined): j is JourPlanning => !!j && !j.code && (!!j.chantier || !!j.debut);

/** Titre d'une case : le chantier, ou le code expliqué. */
export function titreJour(j: JourPlanning): string {
  if (j.code) return CODES[j.code] ? `${CODES[j.code]} (${j.code})` : j.code;
  if (!j.lignes.length) return 'Rien de prévu';
  return j.chantier || j.lignes[0];
}

export const horaireTexte = (j: JourPlanning) => (j.debut && j.fin ? `${j.debut.replace(':', 'h')}-${j.fin.replace(':', 'h')}` : '');

/** « RGI EXEMPLE · ANN · 21h00-04h00 · Melun » : pour les notes d'une mission. */
export function resume(j: JourPlanning): string {
  if (j.code) return CODES[j.code] ? `${j.code} (${CODES[j.code]})` : j.code;
  return [j.chantier, j.poste, horaireTexte(j), j.lieu, j.ps && `PS ${j.ps}`, j.otp && `OTP ${j.otp}`].filter(Boolean).join(' · ');
}

/** Quelle activité de l'appli pour ce poste : annonceur → chantier ASP, APN → mission PN, LAM / S9 → mission LAM / S9. */
export function activitesDuPoste(poste: string): ('asp' | 'pn' | 'lam')[] {
  const p = poste.toUpperCase();
  const r: { a: 'asp' | 'pn' | 'lam'; i: number }[] = [];
  const ou = (re: RegExp) => {
    const m = re.exec(p);
    return m ? m.index : -1;
  };
  const asp = ou(/\b(ANN|ANNONCEUR|ASP|SENTINELLE)\b/);
  const pn = ou(/\b(APN|PN)\b/);
  const lam = ou(/(LAM|S9)/);
  if (asp >= 0) r.push({ a: 'asp', i: asp });
  if (pn >= 0) r.push({ a: 'pn', i: pn });
  if (lam >= 0) r.push({ a: 'lam', i: lam });
  return r.sort((x, y) => x.i - y.i).map((x) => x.a);
}

const decaler = (date: string, n: number) => {
  const [a, m, d] = date.split('-').map(Number);
  return jourDe(new Date(a, m - 1, d + n).getTime());
};

/**
 * Le service du moment : la nuit d'hier tant qu'elle n'est pas finie, sinon la case d'aujourd'hui.
 * Les jours sont pris dans toutes les semaines importées.
 */
export function serviceDuMoment(jours: (date: string) => JourPlanning | null, maintenant = Date.now()): JourPlanning | null {
  const auj = jourDe(maintenant);
  const hier = jours(decaler(auj, -1));
  if (hier && travaille(hier) && hier.nuit && hier.fin) {
    const [hh, mm] = hier.fin.split(':').map(Number);
    const d = new Date(maintenant);
    if (d.getHours() * 60 + d.getMinutes() < hh * 60 + mm + 30) return hier;
  }
  return jours(auj);
}

/** Le prochain jour travaillé après aujourd'hui (dans les 14 jours qui viennent). */
export function prochainService(jours: (date: string) => JourPlanning | null, maintenant = Date.now()): JourPlanning | null {
  const auj = jourDe(maintenant);
  for (let i = 1; i <= 14; i++) {
    const j = jours(decaler(auj, i));
    if (travaille(j)) return j;
  }
  return null;
}
