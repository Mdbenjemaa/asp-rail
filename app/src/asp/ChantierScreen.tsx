/** Fiche d'un chantier : quatre onglets (Chantier, Annonce, Dispositif, Fiches) et le résultat toujours visible en bas. */
import { useMemo, useState } from 'react';
import { Icon } from '../components/parts';
import type { Manifest } from '../lib/data';
import { fmtLine, fmtPk } from '../lib/format';
import { TabAnnonce } from './Annonce';
import { calculChantier, newId, SENS_FLECHE, titreChantier, zoneTexte, type Chantier } from './chantier';
import { CHECKLISTS, progression } from './checklists';
import { TabDispositif } from './Dispositif';
import { controlesDispositif } from './dispositif';
import { proposerVitesses, useLigne } from './lignes';
import { nomFichier, partagerFichier, partagerTexte, resumeTexte, type Envoi } from './partage';
import { enregistrer, supprimer, useChantiers } from './store';
import { Bloc, Champ, Choix, Nombre, PkInput, ScreenHead } from './ui';
import type { Here } from './AspScreen';

type Tab = 'chantier' | 'annonce' | 'dispositif' | 'fiches';
const TABS: [Tab, string][] = [
  ['chantier', 'Chantier'],
  ['annonce', 'Annonce'],
  ['dispositif', 'Dispositif'],
  ['fiches', 'Fiches'],
];

export interface ChantierProps {
  id: string;
  manifest: Manifest | null;
  here: Here | null;
  locating: boolean;
  onLocate: () => void;
  onShowMap: (c: Chantier) => void;
  onGoPk: (code: string, pk: number) => void;
  onBack: () => void;
  onToast: (t: string) => void;
}

export function ChantierScreen(p: ChantierProps) {
  const list = useChantiers();
  const c = list.find((x) => x.id === p.id) ?? null;
  const [tab, setTab] = useState<Tab>(() => (c && c.ligne ? 'annonce' : 'chantier'));
  const r = useMemo(() => (c ? calculChantier(c) : null), [c]);
  const { doc } = useLigne(c?.ligne ?? null);

  if (!c || !r) {
    return (
      <div className="screen" role="dialog" aria-label="Chantier">
        <ScreenHead title="Chantier introuvable" onBack={p.onBack} />
        <div className="screen-body">
          <p>Ce chantier a été supprimé.</p>
        </div>
      </div>
    );
  }

  const set = (patch: Partial<Chantier>) => {
    if (!enregistrer({ ...c, ...patch })) p.onToast('Le téléphone a refusé l’enregistrement (stockage plein ?).');
  };
  const stopsAnnonce = r.dd.erreurs.length + r.alertes.filter((a) => a.niveau === 'stop').length;
  const stopsDispositif = controlesDispositif(c, r).filter((a) => a.niveau === 'stop').length;
  const stops = stopsAnnonce + stopsDispositif;
  const goPk = (pk: number) => c.ligne && p.onGoPk(c.ligne, pk);

  return (
    <div className="screen asp-screen" role="dialog" aria-label={`Fiche chantier · ${titreChantier(c)}`}>
      <ScreenHead
        title={titreChantier(c)}
        sub={`${c.ligne ? `Ligne ${fmtLine(c.ligne)} · ` : ''}${zoneTexte(c)}`}
        onBack={p.onBack}
        backLabel="Retour à mes chantiers"
        right={
          <button className="asp-head-btn" onClick={() => p.onShowMap(c)} disabled={!c.ligne || c.pkDebut === null} aria-label="Voir le chantier sur la carte">
            <Icon name="pin" size={20} />
            <span>Carte</span>
          </button>
        }
      />
      <div className="seg asp-tabs" role="tablist" aria-label="Parties de la fiche">
        {TABS.map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`seg-btn ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      <div className="screen-body asp-body">
        {tab === 'chantier' && <TabChantier c={c} p={p} set={set} />}
        {tab === 'annonce' && <TabAnnonce c={c} r={r} doc={doc} set={set} onGoPk={goPk} onMap={() => p.onShowMap(c)} />}
        {tab === 'dispositif' && <TabDispositif c={c} r={r} herePk={p.here && p.here.code === c.ligne ? p.here.pk : null} set={set} />}
        {tab === 'fiches' && <TabFiches c={c} set={set} onToast={p.onToast} />}
      </div>
      <button
        className={`asp-bar ${stops ? 'has-stop' : ''}`}
        onClick={() => {
          // Seul le dispositif est à régler : on y va ; sinon, le résultat du calcul.
          const versDispositif = !stopsAnnonce && stopsDispositif > 0;
          setTab(versDispositif ? 'dispositif' : 'annonce');
          setTimeout(() => document.getElementById(versDispositif ? 'asp-controles' : 'asp-resultat')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }}
        aria-label="Voir le résultat du calcul"
      >
        <span className="asp-bar-da">
          <small>Délai d’annonce</small>
          <b>{r.da === null ? '—' : `${r.da} s`}</b>
        </span>
        <span className="asp-bar-voies">
          {r.voies.length
            ? r.voies.map((v) => (
                <span key={`${v.voieId}-${v.sens}`}>
                  {v.voie} {SENS_FLECHE[v.sens]} <b>{v.distance ? `${v.distance} m` : '—'}</b>
                  {v.pointAnnonce !== null && <small> PK {fmtPk(v.pointAnnonce)}</small>}
                </span>
              ))
            : 'Aucune voie annoncée'}
        </span>
        {stops > 0 && (
          <span className="asp-bar-stop">
            {stops}
            <span className="asp-bar-stop-txt"> à régler</span>
          </span>
        )}
      </button>
    </div>
  );
}

function TabChantier({ c, p, set }: { c: Chantier; p: ChantierProps; set: (patch: Partial<Chantier>) => void }) {
  const lineName = c.ligne ? (p.manifest?.lines[c.ligne]?.n ?? null) : null;
  const here = p.here;
  const longueur = c.pkDebut !== null && c.pkFin !== null ? Math.round(Math.abs(c.pkFin - c.pkDebut) * 1000) : null;
  const prendrePosition = () => {
    if (!here) return p.onLocate();
    const pk = Math.round(here.pk * 1000) / 1000;
    set({
      ligne: here.code,
      ligneNom: here.ligneNom,
      pkDebut: pk,
      pkFin: c.pkFin !== null && c.ligne === here.code ? c.pkFin : Math.round((pk + 0.05) * 1000) / 1000,
    });
    void proposerVitesses(c.id);
    p.onToast(`Ligne ${fmtLine(here.code)}, PK ${fmtPk(pk)} : vérifie le PK sur les bornes du terrain.`);
  };
  return (
    <>
      <Bloc title="Chantier">
        <Champ label="Nom du chantier" value={c.nom} placeholder="Ex. : remplacement de traverses" onChange={(nom) => set({ nom })} />
        <Champ label="Date" type="date" value={c.date} onChange={(date) => set({ date })} />
        <div className="asp-mini-label">Horaire</div>
        <Choix label="Horaire" value={c.horaire} options={[['jour', 'De jour'], ['nuit', 'De nuit']]} onChange={(horaire) => set({ horaire })} />
        <div className="asp-mini-label">Type de chantier</div>
        <Choix
          label="Type de chantier"
          value={c.type}
          options={[
            ['fixe', 'Fixe'],
            ['mobile', 'Mobile'],
            ['itinerant', 'Itinérant'],
          ]}
          onChange={(type) => set({ type })}
        />
        <p className="asp-hint">
          {c.type === 'mobile'
            ? 'Mobile : chantier d’étendue constante qui avance sans interrompre l’annonce (ex. débroussaillage).'
            : c.type === 'itinerant'
              ? 'Itinérant : petits chantiers successifs ; l’annonce est interrompue entre deux (ex. prospection d’attaches).'
              : 'Fixe : la zone de travail ne bouge pas.'}
        </p>
      </Bloc>

      <Bloc title="Ligne et zone de travail">
        <button className="btn primary wide" onClick={prendrePosition} disabled={p.locating}>
          {p.locating ? 'Repérage GPS en cours…' : here ? `Prendre ma position (ligne ${fmtLine(here.code)}, PK ${fmtPk(here.pk)})` : 'Me repérer pour remplir la ligne et le PK'}
        </button>
        <Champ
          label="Code de la ligne"
          value={c.ligne ?? ''}
          placeholder="830000"
          inputMode="numeric"
          onChange={(v) => {
            const code = v.replace(/\D/g, '').slice(0, 6);
            set({ ligne: code || null, ligneNom: (code && p.manifest?.lines[code]?.n) || null });
          }}
        />
        {c.ligne && c.ligne.length === 6 && (
          <p className={lineName ? 'asp-hint' : 'error small'}>{lineName ?? 'Ligne inconnue dans les données : vérifie le code.'}</p>
        )}
        <div className="asp-two">
          <PkInput label="PK de début" value={c.pkDebut} onChange={(pkDebut) => set({ pkDebut })} />
          <PkInput label="PK de fin" value={c.pkFin} onChange={(pkFin) => set({ pkFin })} />
        </div>
        {longueur !== null && <p className="asp-hint">Longueur de la zone : {longueur} m.</p>}
        {c.type === 'mobile' && (
          <>
            <Nombre label="Longueur sous annonce" unit="m" value={c.longueurAnnonce} placeholder="50" onChange={(longueurAnnonce) => set({ longueurAnnonce })} />
            <PkInput label="PK actuel de l’équipe" value={c.pkEquipe} onChange={(pkEquipe) => set({ pkEquipe })} />
            <button
              className="btn btn-small"
              disabled={!here || here.code !== c.ligne}
              onClick={() => here && set({ pkEquipe: Math.round(here.pk * 1000) / 1000 })}
            >
              L’équipe est à ma position
            </button>
            <p className="asp-hint">Les points d’annonce sont calculés depuis la portion sous annonce, et avancent avec l’équipe.</p>
          </>
        )}
        <button className="btn wide" onClick={() => p.onShowMap(c)} disabled={!c.ligne || c.pkDebut === null}>
          Voir la zone sur la carte
        </button>
      </Bloc>

      <Bloc title="Équipe">
        <Champ label="Entreprise" value={c.entreprise} onChange={(entreprise) => set({ entreprise, agents: c.agents.map((a) => (a.entreprise === c.entreprise ? { ...a, entreprise } : a)) })} />
        <Champ
          label="ASP"
          value={c.asp}
          placeholder="Ton nom"
          onChange={(asp) => set({ asp, agents: c.agents.map((a) => (a.role === 'asp' && (a.nom === c.asp || !a.nom) ? { ...a, nom: asp } : a)) })}
        />
        <Champ label="Responsable du chantier (RCE, chef de chantier)" value={c.responsable} onChange={(responsable) => set({ responsable })} />
        <Nombre label="Effectif travaux" value={c.effectif} placeholder="6" onChange={(effectif) => set({ effectif })} max={500} />
      </Bloc>

      <Bloc title="Notes">
        <textarea className="sig-comment" rows={3} value={c.notes} placeholder="Particularités locales, garages, accès…" onChange={(e) => set({ notes: e.target.value })} />
      </Bloc>

      <div className="asp-add-row">
        <button
          className="btn"
          onClick={() => {
            const copie: Chantier = { ...structuredClone(c), id: newId(), created: Date.now(), nom: `${titreChantier(c)} (copie)`, checks: {} };
            enregistrer(copie);
            p.onToast('Chantier dupliqué : il est dans « Mes chantiers ».');
          }}
        >
          Dupliquer
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (!window.confirm('Supprimer ce chantier du téléphone ?')) return;
            supprimer(c.id);
            p.onBack();
          }}
        >
          Supprimer
        </button>
      </div>
    </>
  );
}

function TabFiches({ c, set, onToast }: { c: Chantier; set: (patch: Partial<Chantier>) => void; onToast: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const resultat = (e: Envoi, quoi: string) =>
    onToast(
      e === 'partage'
        ? `${quoi} envoyé.`
        : e === 'telecharge'
          ? `${quoi} enregistré dans les téléchargements.`
          : e === 'copie'
            ? 'Partage indisponible ici : le résumé est copié, colle-le dans un message.'
            : 'Envoi annulé.',
    );

  // Le partage doit partir directement du toucher (sinon le téléphone le refuse) : le PDF est fait juste avant.
  const pdf = async () => {
    setBusy(true);
    try {
      const { fichePdf } = await import('./pdf');
      const blob = fichePdf(c, calculChantier(c));
      const file = new File([blob], nomFichier(c), { type: 'application/pdf' });
      resultat(await partagerFichier(file, `Fiche CADA · ${titreChantier(c)}`), 'PDF');
    } catch (e) {
      onToast(e instanceof Error ? `PDF impossible : ${e.message}` : 'PDF impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Bloc title="Partager">
        <button className="btn primary wide" onClick={() => void pdf()} disabled={busy}>
          {busy ? 'Préparation du PDF…' : 'Fiche CADA en PDF'}
        </button>
        <button
          className="btn wide"
          onClick={() => void partagerTexte(`Fiche CADA · ${titreChantier(c)}`, resumeTexte(c, calculChantier(c))).then((e) => resultat(e, 'Résumé'))}
        >
          Résumé par message (WhatsApp, SMS…)
        </button>
        <p className="muted small">Le PDF et le résumé sont une aide : le carnet CADA et l’AAn restent les documents officiels.</p>
      </Bloc>
      {CHECKLISTS.map((l) => {
        const [n, total] = progression(c.checks, l);
        return (
          <Bloc key={l.id} title={l.title} className="asp-check">
            <div className="asp-check-head">
              <span className="muted small">{l.when}</span>
              <span className={`asp-check-count ${n === total ? 'done' : ''}`}>
                {n}/{total}
              </span>
            </div>
            <ul className="asp-check-list">
              {l.items.map((i) => (
                <li key={i.id}>
                  <label className={`asp-check-item ${c.checks[i.id] ? 'on' : ''}`}>
                    <input type="checkbox" checked={!!c.checks[i.id]} onChange={(e) => set({ checks: { ...c.checks, [i.id]: e.target.checked } })} />
                    <span>
                      {i.text}
                      {i.hint && <small>{i.hint}</small>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </Bloc>
        );
      })}
      <button
        className="btn wide"
        onClick={() => {
          if (window.confirm('Décocher toutes les cases de ce chantier ?')) set({ checks: {} });
        }}
      >
        Tout décocher
      </button>
    </>
  );
}
