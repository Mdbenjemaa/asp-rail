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

## Espace ASP (bouton « ASP » sur la carte, ou Menu)

| Fonction | Ce qu'elle fait |
| --- | --- |
| Mes chantiers | Un chantier part de ta position (ligne, PK, vitesse de la ligne proposée) ou se remplit à la main. Fixe, mobile (longueur sous annonce, PK de l'équipe) ou itinérant ; de jour ou de nuit. Gardé uniquement sur le téléphone. |
| Annonce | Plateforme (double voie, voie unique, banalisées, 4 voies…), sens des circulations par rapport aux PK, place de chaque voie (travail, contiguë, à traverser, hors annonce), vitesse, voie interdite. Outillage (aucun, 1re, 2e, 3e catégorie), délai de dégagement, particularités (nuit, soudage/meulage, obstacle masquant, annonceur pour 2 sens, ASP qui annonce lui-même, clôtures, bruit…). |
| Résultat | DD + MS = DA, avec les raisons de la marge ; 10 s au moins au-delà de 160 km/h ; distance arrondie à la dizaine de mètres supérieure ; point d'annonce (PK) pour chaque voie et chaque sens ; alertes (DFV obligatoire, exemptions, LGV, agent seul, bruit, rupture de vitesse sur la ligne…). |
| Dispositif | ASP, annonceurs, répétiteurs, sentinelles : position (PK), voies et sens surveillés, distance à voir jusqu'au point d'annonce. « Un annonceur par sens » en un toucher. Contrôles : voie non surveillée, annonceur 2 sens, ASP annonceur (chantier mobile, plus de 3 agents), mixité d'entreprises… |
| Carte | Zone de travail, points d'annonce et agents dessinés sur la carte des voies ; « Y aller » vers un point d'annonce. |
| Fiches | Fiche CADA en PDF et résumé par message (WhatsApp, SMS, mail…), check-lists (documents, ligne, avant de commencer, briefing, pendant, fin de chantier). |
| Calcul rapide | Distance d'annonce selon la vitesse et le délai, et le tableau complet (30 à 300 km/h, 5 à 60 s). |
| Mémo ASP | Les règles du support, reformulées : rôle de l'ASP, documents, outillage, DFV, DD, MS, DA, placement et chaîne d'annonce, bruit, cumul, agent seul, chantier mobile, PN, AAn, briefing, DMVC, zone dangereuse, signaux, sigles. |
| Quiz et cas pratiques | Questions avec explications (série de 10, par thème, « mes erreurs ») et les 7 exercices « Terrain et CADA » du support, corrigés par le même moteur de calcul. |

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
accepté, gardé, coupé, lien reçu), espace administrateur, chantier depuis la position (vitesse de la ligne, délai,
points d'annonce, dispositif, check-list, résumé, PDF, carte), calcul rapide, mémo, quiz, cas pratique, petit écran.
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
