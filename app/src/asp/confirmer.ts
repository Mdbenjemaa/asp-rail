/** Confirmation avant d'annuler une étape faite d'une mission : la trace reste, mais on ne le fait pas par erreur. */
export function confirmerAnnulation(etape: string, faiteA: string): boolean {
  return window.confirm(`Annuler « ${etape} », faite à ${faiteA} ?\n\nL’heure d’origine reste au journal, marquée annulée.`);
}
