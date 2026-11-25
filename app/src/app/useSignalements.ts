/**
 * Mes signalements (erreur de PK, accès, danger…) : gardés sur le téléphone, envoyés par le partage du téléphone.
 * L'envoi part directement du toucher (sinon le téléphone refuse le partage).
 */
import { useEffect, useState } from 'react';
import { deleteSignalement, listSignalements, saveSignalement, shareSignalement, type Envoi, type Signalement } from '../lib/signalements';

export function useSignalements(p: { onToast: (t: string) => void; onCree: () => void }) {
  const [signals, setSignals] = useState<Signalement[]>([]);
  const [openSignal, setOpenSignal] = useState<Signalement | null>(null);
  useEffect(() => {
    void listSignalements().then(setSignals);
  }, []);

  const envoiToast = (r: Envoi) =>
    p.onToast(
      r === 'copie'
        ? 'Partage indisponible ici : le texte du signalement est copié, colle-le dans un message.'
        : r === 'annule'
          ? 'Signalement enregistré sur le téléphone, pas envoyé.'
          : 'Signalement envoyé.',
    );

  const sendSignal = (s: Signalement) => {
    const sending = shareSignalement(s);
    void sending.then(async (r) => {
      envoiToast(r);
      if (r === 'annule') return;
      const done = { ...s, sent: Date.now() };
      await saveSignalement(done).catch(() => undefined);
      setSignals((cur) => cur.map((x) => (x.id === s.id ? done : x)));
      setOpenSignal((o) => (o && o.id === s.id ? done : o));
    });
  };

  const newSignal = async (draft: Omit<Signalement, 'id' | 'created'>, send: boolean) => {
    const s: Signalement = { ...draft, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, created: Date.now() };
    if (send) sendSignal(s);
    await saveSignalement(s);
    setSignals((cur) => [s, ...cur.filter((x) => x.id !== s.id)]);
    p.onCree();
    if (!send) p.onToast('Signalement enregistré sur le téléphone.');
  };

  const removeSignal = (id: string) => void deleteSignalement(id).then(() => setSignals((cur) => cur.filter((x) => x.id !== id)));

  return { signals, openSignal, setOpenSignal, sendSignal, newSignal, removeSignal };
}
