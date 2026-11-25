/** Nom de l'agent et signatures au doigt, gardés sur le téléphone pour les exports PDF. */

const NOM = 'asp-agent-nom';
const SIGNATURES = 'asp-signatures';
/** Au-delà, les plus anciennes signatures sont oubliées (place limitée sur le téléphone). */
const MAX = 30;

export function nomAgent(): string {
  try {
    return localStorage.getItem(NOM) ?? '';
  } catch {
    return '';
  }
}

export function garderNomAgent(nom: string) {
  try {
    if (nom.trim()) localStorage.setItem(NOM, nom.trim());
    else localStorage.removeItem(NOM);
  } catch {
    /* stockage plein ou interdit : le nom servira pour cet export seulement */
  }
}

export interface Signature {
  png: string;
  t: number;
}

function toutes(): Record<string, Signature> {
  try {
    const v = JSON.parse(localStorage.getItem(SIGNATURES) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, Signature>) : {};
  } catch {
    return {};
  }
}

/** La signature déjà donnée pour ce document (mission, chantier), s'il y en a une. */
export function signatureDe(id: string): Signature | null {
  const s = toutes()[id];
  return s && typeof s.png === 'string' && s.png.startsWith('data:image/png') ? s : null;
}

export function garderSignature(id: string, png: string | null, t: number) {
  const all = toutes();
  if (png) all[id] = { png, t };
  else delete all[id];
  const garder = Object.entries(all)
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, MAX);
  try {
    localStorage.setItem(SIGNATURES, JSON.stringify(Object.fromEntries(garder)));
  } catch {
    /* stockage plein : la signature sert pour cet export seulement */
  }
}
