# ASP Rail

Appli web pour l'agent sécurité du personnel (ASP) et les annonceurs, l'agent PN, l'AP LAM et l'AP S9 : se repérer
sur le réseau (ligne et PK), calculer le délai et la distance d'annonce, placer les points d'annonce et le dispositif,
garder sa fiche et ses check-lists, suivre une mission PN, LAM ou S9 pas à pas avec son journal horodaté et son carnet
de dépêches, et réviser. Elle s'installe sur l'écran d'accueil (iPhone et Android) et marche sans réseau là où on est déjà passé.

Construite sur la base de [PK Rail](https://github.com/Mdbenjemaa/pk-rail) (repérage, suivi du PK, carte des voies),
avec en plus l'espace ASP.

**Adresse :** https://mdbenjemaa.github.io/asp-rail/ (accès par code, voir plus bas)

> Aide à la préparation, jamais une référence de sécurité. Le calcul suit les règles du support de formation
> « TES M – compétence ASP » (S2MIH, v1.3 du 30/05/2023) ; l'activité PN suit le support ETF « Formation TES F –
> intervenant PN » ; l'activité LAM / S9 suit le « Livret technique AP-LAM / AP-S9 » (version 2). La fiche de travail,
> la consigne PN ou LAM, la situation géographique et le livret de service du PN priment. Il ne remplace ni les textes SNCF Réseau en vigueur, ni les
> consignes et particularités locales, ni le carnet CADA et l'AAn. PK, vitesses et signaux viennent de données
> ouvertes (SNCF Réseau, OpenStreetMap) : ils peuvent être faux, incomplets ou périmés. Vérifie toujours sur le
> terrain. L'ASP reste responsable de son dispositif.

## Comment l'appli est rangée

Quatre onglets en bas, comme les applis du téléphone : **Accueil**, **Carte**, **Calcul**, **Réviser**. Une seule
action principale par écran, en bas sous le pouce ; le bouton retour du téléphone ferme l'écran ouvert. L'affichage
suit le téléphone : clair le jour, sombre la nuit (réglable dans le menu).

| Écran | Ce qu'il fait |
| --- | --- |
| Accueil | « Mon chantier du jour » : délai d'annonce, distance et PK du point d'annonce pour chaque voie et chaque sens (un toucher : y aller sur la carte), état « Prêt » ou « à régler ». Gros bouton « Nouveau chantier ». Cases « en direct » : ligne et PK de l'agent qui suivent ses pas (si la position est déjà autorisée ; le GPS s'arrête dès qu'on quitte l'accueil), distance d'annonce à la vitesse de la ligne là où il est, une règle du mémo qui défile, la progression au quiz ; puis la question du jour et les autres chantiers. |
| Nouveau chantier, pas à pas | Une question par écran, de gros choix et des valeurs par défaut : lieu (position GPS en un toucher, ou ligne et PK), type et horaire, voies (plateformes types dessinées), vitesses (celle de la ligne proposée), outillage, délai de dégagement, cas particuliers. Puis le résultat : DD + MS = DA, distances, points d'annonce, alertes, et « Placer un annonceur par sens ». |
| Fiche chantier | Le résultat en haut ; ce qui reste à régler (avec la correction en un toucher quand l'interdiction de circulation est obligatoire) ; le dispositif (ASP, annonceurs, répétiteurs, sentinelles, chacun dans une feuille) ; check-lists ; équipe et notes ; chaque réglage rouvre son étape. En bas : Partager (fiche CADA en PDF, résumé par message) et Carte. |
| Carte | Le repérage de PK Rail, plus la zone de travail, les points d'annonce et les agents du chantier. |
| Calcul | Distance d'annonce selon la vitesse, le dégagement et la marge, avec le tableau complet (30 à 300 km/h, 5 à 60 s). |
| Réviser | Mémo des règles du support (avec recherche), quiz avec explications (série de 10, par thème, « mes erreurs »), et les 7 exercices « Terrain et CADA » corrigés par le même moteur de calcul. |

### Trois activités : Annonce (TES M), Agent PN (TES F), LAM / S9

En haut de l'accueil, la bascule **Annonce / Agent PN / LAM / S9** choisit l'activité du jour (gardée sur le
téléphone). L'accueil, les cases en direct, le 3e onglet (Calcul, Dérangement ou Urgences) et « Réviser » suivent
l'activité.

| Écran (activité PN) | Ce qu'il fait |
| --- | --- |
| Accueil | « Ma mission PN » : l'étape à faire maintenant et l'avancement ; « Nouvelle mission PN » ; « Un PN ne marche pas ? Diagnostic ». Cases en direct : PN le plus proche sur la ligne (numéro, distance, sens), ligne et PK, une règle du mémo PN, la progression au quiz PN ; question du jour PN. |
| Nouvelle mission PN | Quatre écrans : mission (agent PN en travaux, ou agent franchissement mobile travaux) ; PN (les PN les plus proches trouvés par le GPS dans les données ouvertes, ou saisie numéro, ligne, PK, route) ; équipement (SAL 2, 2B, 4, FC, 0 ; boîtier de commutateurs ou commutateur Marche-Arrêt ; ligne BAL ; voies) ; chantier (horaire, contrat, indice, CCh, RPTx). |
| Mission PN | L'étape à faire en grand avec son bouton « Fait à 14:32 » (et le n° de dépêche quand il y en a une) ; les phases (avant, vérifications, prise en travaux selon le boîtier, le blocage BAL ou le Marche-Arrêt, fin de mission jusqu'à l'ARF) ; pendant les travaux, « Un mobile travaux arrive » et « Mettre en voie un LAM » ; le journal horodaté (étapes, dépêches, passages, dérangements, notes) à partager par message ou recopier dans le carnet du PN. |
| Mobile travaux, LAM | Les gestes numérotés dans l'ordre (SAM le plus éloigné retiré d'abord, le plus proche remis d'abord…), puis « Terminé : noter au journal » avec l'heure de début et de fin. |
| Dérangement (3e onglet) | Deux questions (quand, ce que tu vois) → raté d'ouverture, raté de fermeture ou pas de dérangement ; la conduite à tenir ; noté au journal de la mission si on vient d'une mission. |
| Réviser | Mémo PN (16 fiches), quiz PN avec explications, et 6 cas pratiques « remets les gestes dans l'ordre ». |

| Écran (activité LAM / S9) | Ce qu'il fait |
| --- | --- |
| Accueil | « Ma mission LAM / S9 », « Nouvelle mission », « Urgence ou aléa ? Fiches réflexes ». Cases en direct : contrôle de pose d'un DSh (LGV : interdit ; signal à moins de 30 m ou PN à moins de 3 km : à vérifier ; indicatif, le sens de la voie n'est pas dans les données), ligne et PK, une règle du mémo, la progression au quiz ; question du jour. |
| Nouvelle mission | AP LAM ou AP S9 ; lieu (position GPS ou ligne, PK, voie) ; LAM : nombre d'engins (3 au plus), agrément, mise en voie ou traversée de PN ; S9 : repère du bouclage et outils de la fiche de travail (DSh, SAM + pétard, commutateur de blocage, observation) ; chantier (consigne LAM ou fiche, CCh, RPTx). |
| Mission AP LAM | Avant (briefing, consigne LAM), vérifications de l'engin (agrément, agrès, limiteurs), mise en voie (5 minutes, ARF, PN, autorisation verbale), puis en voie : rappel du mode chantier et situations (SAM à franchir, appareil de voie, PN, traversée du personnel) notées au journal ; mise hors voie, stationnement, consigne rendue. |
| Mission AP S9 | Mise en place du bouclage sur ordre (dépêches), gestes selon les outils (emplacement du DSh, pose en 10 gestes, SAM et pétard, commutateur et cadenas), confirmation ; pendant : « Un train travaux doit passer » (pinces, pétard, SAM, dépêche… puis l'inverse) ; retrait et confirmation. |
| Carnet de dépêches | Chaque dépêche : avec qui, l'objet, le n° reçu et le n° donné, à l'heure ; l'appli propose un numéro à deux chiffres pris au hasard, sans suite avec les numéros déjà échangés (« Autre numéro » pour en tirer un autre). Le carnet et le journal se partagent par message. |
| Urgences (3e onglet) | Fiches réflexes du livret : conducteur défaillant, SAM franchi, gabarit ou point protégé engagé, dérive, vitesse excessive, conducteur électrique tombé ; aléas (consignes non respectées, panne, câble endommagé, changement de point de mise en voie ou d'organisation, aléa S9). Notées au journal si on vient d'une mission. |
| Réviser | Mémo LAM / S9 (20 fiches), quiz avec explications, et 7 cas pratiques « remets les gestes dans l'ordre ». |

### Export PDF des journaux et de la fiche CADA

Le bouton « Journal » d'une mission PN ou LAM / S9, et « Partager › Fiche CADA en PDF » d'un chantier, ouvrent la
feuille « Exporter en PDF » : nom de l'agent (gardé sur le téléphone), signature au doigt (facultative, gardée pour la
mission ou le chantier), puis « Créer le PDF et partager » (menu de partage du téléphone, sinon téléchargement).

Le PDF (A4, jsPDF) est fait sur le téléphone, même sans réseau. Il porte « Créé le JJ/MM/AAAA à HH:MM » dans le
bandeau, le pied de chaque page et le nom du fichier (`Journal-PN-PN26-2026-11-25-1025.pdf`,
`Journal-AP-S9-A3-…`, `CADA-…`). Contenu : la mission ou le chantier ; un plan de situation dessiné depuis la
géométrie de la ligne (voie tournée pour que les PK croissent vers la droite, gares, PN, signaux, repères de PK, nord,
échelle, coordonnées et lien « Ouvrir dans une carte » ; zone de travail, points d'annonce et agents pour la fiche
CADA) ; les étapes par phase avec leur heure et leur dépêche ; le carnet de dépêches (LAM / S9) ; les événements ; deux
cadres de signature (l'agent, avec sa signature au doigt, et le CCh, RPTx ou responsable du chantier à signer sur le
papier). Le journal en texte reste dans le menu « ⋯ » pour un message rapide.

## Repérage (repris de PK Rail)

| Fonction | Ce qu'elle fait |
| --- | --- |
| Me repérer | Rattache la position GPS à la ligne la plus proche : PK, vitesse, électrification, signaux, PN, gares autour. Appui long sur la carte : « me placer ici ». |
| Suivre le PK | Compteur PK au mètre qui défile en avançant, dans les deux sens. |
| Aller au PK | Taper un PK, le voir sur la carte, la distance depuis ta position et l'itinéraire. |
| Recherche, couches, mes accès, signalements | Comme dans PK Rail ; « Signaler une anomalie » est dans le Menu. |

## Code d'accès

L'appli s'ouvre avec un code personnel de 8 signes (par exemple `ABCD-EF23`). Il est vérifié en ligne au premier
lancement, puis gardé sur le téléphone : sans réseau, l'appli reste ouverte 30 jours après la dernière vérification.
Un code coupé ferme l'appli à la vérification suivante.

L'administrateur ouvre `https://mdbenjemaa.github.io/asp-rail/#admin` (lien « Espace administrateur » sous l'écran du
code), se connecte avec le même compte que l'administration de PK Rail, puis crée un code par personne, le partage
(le lien remplit le code tout seul), le coupe, le réactive ou le supprime.

Côté serveur (projet Supabase « repere-rail ») : tables `asp_codes` et `asp_admins` (lecture et écriture réservées aux
administrateurs connectés), fonctions `asp_verifier_code` (seule ouverte sans compte : répond juste oui/non et le nom
du code), `asp_creer_code` et `asp_est_admin`. Les chantiers, eux, ne quittent jamais le téléphone.

## Développement

```bash
cd app
npm ci
npm run dev      # http://localhost:5173
npm test         # tests unitaires (règles de l'annonce, 7 exercices du support, PK, GPS, recherche…)
npm run check    # tout : lint, tests unitaires, construction, puis tests dans un vrai navigateur
```

Le moteur de l'annonce est dans `app/src/asp/rules.ts` (testé dans `rules.test.ts` et `cas.test.ts`) ; les écrans de
l'ASP dans `app/src/asp/`, le code d'accès dans `app/src/access/` et l'administration dans `app/src/admin/`.

L'import d'un lien Google My Maps (« Mes accès ») passe par la fonction serveur `mymaps` du même projet Supabase :
le navigateur ne peut pas lire Google directement.

### Tests dans un navigateur

`npm run e2e` (après `npm run build`) ouvre l'appli construite dans Chrome, en téléphone simulé avec un GPS simulé
le long de la ligne 830 000 à Lieusaint. Repérage : premier lancement, Me repérer, suivi du PK, recherche, Aller au
PK, couches, mes accès, signalements, menu, GPS refusé, petit écran, sans réseau. ASP : code d'accès (refusé,
accepté, gardé, coupé, lien reçu), espace administrateur, nouveau chantier pas à pas (position, vitesse de la ligne,
résultat, annonceurs, fiche, modification d'une étape, check-list, résumé, PDF, carte, rechargement), interdiction
obligatoire corrigée en un toucher, bouton retour du téléphone, onglets Calcul et Réviser, petit écran.
Internet est coupé pendant les tests (le serveur du code est simulé). `SHOTS=1` enregistre des captures dans
`app/e2e-shots/`.

## Publication

```bash
bash scripts/deploy_pages.sh
```

Lance le lint et les tests unitaires, construit l'appli avec le bon chemin (`/asp-rail/`), la teste dans un
navigateur, puis la publie sur la branche `gh-pages` (GitHub Pages). Si un test échoue, rien n'est publié.

ASP Rail et PK Rail sont sur le même site (`mdbenjemaa.github.io`) : tout ce qu'ASP Rail garde sur le téléphone
porte le préfixe `asp-`, pour ne jamais se mélanger avec PK Rail.

## Licence

Code sous licence **GPL-3.0** (fichier `LICENSE`).

Les dessins de la signalisation viennent de la bibliothèque
[signalisation-rfn-svg](https://github.com/nicolaswurtz/signalisation-rfn-svg) de Nicolas Wurtz, sous licence GPL-3.0
(copie dans `app/public/signaux/LICENSE.txt`).

Données : © SNCF Réseau (open data), © contributeurs OpenStreetMap (ODbL), fond plan OpenFreeMap / OpenMapTiles,
photo aérienne © IGN. Règles de l'annonce : d'après le support « TES M – compétence ASP » (S2MIH).
