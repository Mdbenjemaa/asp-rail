/**
 * ASP Rail — dépôt d'un dossier de fin de mission (PDF) dans l'espace de l'entreprise de l'agent.
 *
 * L'appli envoie le dossier créé à la clôture, avec le code d'accès de l'agent : le code dit à quelle entreprise il
 * va. Le PDF est rangé dans un espace de stockage privé (<entreprise>/<AAAA-MM>/<réf>.pdf), lisible seulement par les
 * administrateurs de cette entreprise. Un envoi répété (réseau coupé au mauvais moment) ne crée pas de doublon.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MAX = 10 * 1024 * 1024;
const TYPES = new Set(['asp', 'pn', 'lam', 'chaine']);
const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');

function decoder(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, raison: 'methode' }, 405);
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, raison: 'donnees' }, 400);
  }

  const code = texte(b.code, 20);
  const ref = texte(b.ref, 60);
  const type = texte(b.type, 10);
  const titre = texte(b.titre, 160);
  const agent = texte(b.agent, 80);
  const date = texte(b.date, 10);
  const nom = texte(b.nom_fichier, 160).replace(/[^A-Za-z0-9._-]/g, '-');
  const cloture = typeof b.cloture_le === 'number' && Number.isFinite(b.cloture_le) ? new Date(b.cloture_le) : null;
  if (!code || !/^[A-Za-z0-9_-]{6,60}$/.test(ref) || !TYPES.has(type) || !titre || !cloture || !/\.pdf$/i.test(nom) || nom.length < 5) {
    return json({ ok: false, raison: 'donnees' }, 400);
  }
  if (typeof b.pdf !== 'string' || b.pdf.length > Math.ceil((MAX * 4) / 3) + 8) return json({ ok: false, raison: 'taille' }, 413);
  const pdf = decoder(b.pdf);
  if (!pdf || pdf.length < 100 || pdf.length > MAX) return json({ ok: false, raison: 'taille' }, 413);
  if (String.fromCharCode(...pdf.subarray(0, 5)) !== '%PDF-') return json({ ok: false, raison: 'donnees' }, 400);

  const url = Deno.env.get('SUPABASE_URL');
  const cle = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !cle) return json({ ok: false, raison: 'serveur' }, 500);
  const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await sb.rpc('asp_svc_archive', { p_code: code, p_ref: ref });
  const v = data as { ok: boolean; raison?: string; deja?: boolean; entreprise_id?: string; code_id?: string; code_nom?: string; entreprise?: string } | null;
  if (error || !v) return json({ ok: false, raison: 'serveur' }, 500);
  if (!v.ok) return json({ ok: false, raison: v.raison ?? 'acces' });
  if (v.deja) return json({ ok: true, deja: true });

  const mois = new Date().toISOString().slice(0, 7);
  const chemin = `${v.entreprise_id}/${mois}/${ref}.pdf`;
  const up = await sb.storage.from('asp-archives').upload(chemin, pdf, { contentType: 'application/pdf', upsert: true });
  if (up.error) return json({ ok: false, raison: 'serveur' }, 500);

  const ins = await sb.from('asp_archives').insert({
    entreprise_id: v.entreprise_id,
    code_id: v.code_id,
    ref,
    type,
    titre,
    date_mission: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    agent,
    code_nom: (v.code_nom ?? '').slice(0, 60),
    nom_fichier: nom,
    taille: pdf.length,
    chemin,
    cloture_le: cloture.toISOString(),
  });
  // Déjà reçu entre-temps (deux envois en même temps) : le fichier est le même, on garde la première ligne.
  if (ins.error && ins.error.code !== '23505') {
    await sb.storage.from('asp-archives').remove([chemin]);
    return json({ ok: false, raison: 'serveur' }, 500);
  }
  return json({ ok: true, entreprise: v.entreprise ?? '' });
});
