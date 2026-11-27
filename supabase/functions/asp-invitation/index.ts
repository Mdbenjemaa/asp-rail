/**
 * ASP Rail — fin d'une invitation d'administrateur d'entreprise.
 *
 * L'administrateur d'ASP Rail crée une invitation (lien à usage unique, 7 jours). La personne invitée ouvre le lien,
 * choisit elle-même son mot de passe, et cette fonction :
 *  - crée son compte (adresse déjà confirmée : c'est le lien qui la prouve), ou
 *  - change le mot de passe d'un administrateur d'entreprise existant (le lien sert alors de « mot de passe oublié »),
 *  puis la rattache à l'entreprise.
 * Un compte de l'administrateur d'ASP Rail, ou un autre compte du projet, n'est jamais modifié : la personne doit se
 * connecter avec son propre mot de passe (l'appli accepte alors l'invitation par asp_accepter_invitation).
 *
 * Le jeton n'est jamais gardé en clair (empreinte SHA-256 en base). La clé de service reste sur le serveur.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

interface Invitation {
  ok: boolean;
  raison?: string;
  id?: string;
  email?: string;
  mode?: 'creer' | 'reinit' | 'connexion';
  user_id?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, raison: 'methode' }, 405);

  let body: { jeton?: unknown; mot_de_passe?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, raison: 'donnees' }, 400);
  }
  const jeton = typeof body.jeton === 'string' ? body.jeton.trim().toLowerCase() : '';
  const mdp = typeof body.mot_de_passe === 'string' ? body.mot_de_passe : '';
  if (!/^[a-f0-9]{48}$/.test(jeton)) return json({ ok: false, raison: 'inconnu' });
  if (mdp.length < 8 || mdp.length > 72) return json({ ok: false, raison: 'mot_de_passe' });

  const url = Deno.env.get('SUPABASE_URL');
  const cle = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !cle) return json({ ok: false, raison: 'serveur' }, 500);
  const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await sb.rpc('asp_svc_invitation', { p_jeton: jeton });
  const inv = data as Invitation | null;
  if (error || !inv) return json({ ok: false, raison: 'serveur' }, 500);
  if (!inv.ok || !inv.id || !inv.email) return json({ ok: false, raison: inv.raison ?? 'inconnu' });
  if (inv.mode === 'connexion') return json({ ok: false, raison: 'connexion', email: inv.email });

  if (inv.mode === 'creer') {
    const { error: e } = await sb.auth.admin.createUser({ email: inv.email, password: mdp, email_confirm: true });
    if (e) return json({ ok: false, raison: /password|weak|pwned/i.test(e.message) ? 'mot_de_passe' : 'compte' });
  } else if (inv.mode === 'reinit' && inv.user_id) {
    const { error: e } = await sb.auth.admin.updateUserById(inv.user_id, { password: mdp, email_confirm: true });
    if (e) return json({ ok: false, raison: /password|weak|pwned/i.test(e.message) ? 'mot_de_passe' : 'compte' });
  } else {
    return json({ ok: false, raison: 'compte' });
  }

  const { data: fin, error: e2 } = await sb.rpc('asp_svc_terminer', { p_id: inv.id });
  if (e2 || !(fin as { ok?: boolean } | null)?.ok) return json({ ok: false, raison: 'serveur' }, 500);
  return json({ ok: true, email: inv.email, entreprise: (fin as { entreprise?: string }).entreprise ?? '' });
});
