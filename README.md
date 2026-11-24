# ASP Rail

Appli web pour l'agent sécurité du personnel (ASP) et les annonceurs : se repérer sur le réseau (ligne et PK), calculer
le délai et la distance d'annonce, placer les points d'annonce et le dispositif, garder sa fiche et ses check-lists, et
réviser. Elle s'installe sur l'écran d'accueil (iPhone et Android) et marche sans réseau là où on est déjà passé.

Construite sur la base de [PK Rail](https://github.com/Mdbenjemaa/pk-rail) (repérage, suivi du PK, carte des voies),
avec en plus l'espace ASP.

**Adresse :** https://mdbenjemaa.github.io/asp-rail/ (accès par code, voir plus bas)

> Aide à la préparation, jamais une référence de sécurité. Le calcul suit les règles du support de formation
> « TES M – compétence ASP » (S2MIH, v1.3 du 30/05/2023). Il ne remplace ni les textes SNCF Réseau en vigueur, ni les
> consignes et particularités locales, ni le carnet CADA et l'AAn. PK, vitesses et signaux viennent de données
> ouvertes (SNCF Réseau, OpenStreetMap) : ils peuvent être faux, incomplets ou périmés. Vérifie toujours sur le
> terrain. L'ASP reste responsable de son dispositif.

## Comment l'appli est rangée

Quatre onglets en bas, comme les applis du téléphone : **Accueil**, **Carte**, **Calcul**, **Réviser**. Une seule
action principale par écran, en bas sous le pouce ; le bouton retour du téléphone ferme l'écran ouvert. L'affichage
suit le téléphone : clair le jour, sombre la nuit (réglable dans le menu).

| Écran | Ce qu'il fait |
| --- | --- |
| Accueil | « Mon chantier du jour » : délai d'annonce, distance et PK du point d'annonce pour chaque voie et chaque sens (un toucher : y aller sur la carte), état « Prêt » ou « à régler ». Gros bouton « Nouveau chantier », raccourcis (Où suis-je ?, calcul, mémo, quiz) et les autres chantiers. |
| Nouveau chantier, pas à pas | Une question par écran, de gros choix et des valeurs par défaut : lieu (position GPS en un toucher, ou ligne et PK), type et horaire, voies (plateformes types dessinées), vitesses (celle de la ligne proposée), outillage, délai de dégagement, cas particuliers. Puis le résultat : DD + MS = DA, distances, points d'annonce, alertes, et « Placer un annonceur par sens ». |
| Fiche chantier | Le résultat en haut ; ce qui reste à régler (avec la correction en un toucher quand l'interdiction de circulation est obligatoire) ; le dispositif (ASP, annonceurs, répétiteurs, sentinelles, chacun dans une feuille) ; check-lists ; équipe et notes ; chaque réglage rouvre son étape. En bas : Partager (fiche CADA en PDF, résumé par message) et Carte. |
| Carte | Le repérage de PK Rail, plus la zone de travail, les points d'annonce et les agents du chantier. |
| Calcul | Distance d'annonce selon la vitesse, le dégagement et la marge, avec le tableau complet (30 à 300 km/h, 5 à 60 s). |
| Réviser | Mémo des règles du support (avec recherche), quiz avec explications (série de 10, par thème, « mes erreurs »), et les 7 exercices « Terrain et CADA » corrigés par le même moteur de calcul. |

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
