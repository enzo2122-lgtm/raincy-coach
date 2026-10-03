# Raincy Coach (FA Le Raincy)

Application pour iPad et iPhone : effectifs à 11 ou à 8, tableau tactique animé (joueurs, flèches, zones, couloirs, bloc), entraînements, matchs, statistiques, et exports en image, vidéo et PDF imprimable.

## Mettre l'appli en ligne (gratuit, une seule fois)

1. Crée un compte sur https://github.com.
2. Crée un dépôt : bouton **New repository**, nom `raincy-coach`, coche **Public**, puis **Create repository**.
3. Clique sur **uploading an existing file**. Glisse **tout le contenu** de ce dossier (index.html, app.css, sw.js, manifest.webmanifest et les dossiers js et icons). Clique sur **Commit changes**.
4. Va dans **Settings**, puis **Pages**. Dans **Branch**, choisis `main` et `/ (root)`, puis **Save**.
5. Après environ une minute, l'adresse s'affiche, par exemple `https://ton-pseudo.github.io/raincy-coach/`.

## Installer sur l'iPad ou l'iPhone

1. Ouvre l'adresse dans **Safari**.
2. Touche **Partager** (le carré avec une flèche vers le haut), puis **Sur l'écran d'accueil**.
3. Lance l'appli depuis son icône. Elle fonctionne ensuite sans internet.

## Charger les licenciés du club

Le fichier `FA-Le-Raincy-Effectif-2026-2027.raincy.json` est à part, sur le Bureau. Il contient 272 joueurs rangés en 9 catégories : Seniors, Vétérans, U19, U17, U15, U13, U11, U9 et U7.

1. Envoie-le sur l'iPad (AirDrop ou mail).
2. Dans l'appli, va dans **Réglages**, puis **Recevoir un fichier**, et choisis-le.
3. Pour enlever les exemples, va dans **Réglages**, puis **Supprimer les exemples**.

**Ne dépose jamais ce fichier sur GitHub.** Il contient les noms et dates de naissance de mineurs, et GitHub Pages est public.

Pour les prochains licenciés, va dans **Équipes**, puis **Tous les joueurs**, puis **Coller une liste**. Colle les lignes copiées depuis Footclubs : l'appli les range dans leur catégorie selon leur sous-catégorie.

## Comptes des éducateurs

Depuis la version 3.70, FA Le Raincy est un club du serveur **Clubbo** (code du club : `fa-le-raincy`, réglé dans `js/config.js`). Personne n'a rien à configurer, et il n'y a plus de « code responsable » : la connexion d'un responsable suffit.

**Les éducateurs :** le responsable envoie le lien d'invitation (**Réglages → Serveur du club → Inviter les éducateurs**, ou **📲 Envoyer son lien** sur la fiche d'un dirigeant). Chacun ouvre le lien, choisit son nom (ou s'inscrit s'il n'est pas dans la liste) et crée son mot de passe. Ensuite, il se connecte sur n'importe quel appareil avec son **nom, prénom et mot de passe**.

**Mot de passe oublié :** un responsable va dans **Réglages → Comptes des dirigeants → Réinitialiser**. L'éducateur ouvre ensuite le lien d'invitation et crée un nouveau mot de passe. Pour un responsable : un autre responsable du club le réinitialise.

**Le serveur** se met à jour avec Clubbo (fichier `supabase/ea-schema.sql` de l'appli Clubbo). Il n'y a plus de script à coller depuis Raincy.

La messagerie, le planning du terrain et les effectifs sont partagés par le serveur. L'appli marche aussi sans internet et envoie les changements au retour du réseau.

Pour envoyer une séance à un autre coach : **Envoyer → Envoyer le lien** sur la séance (WhatsApp, SMS…). En touchant le lien, il l'ouvre dans son appli. Tu peux aussi envoyer un fichier : **Réglages → Envoyer toutes mes données**, ou **Envoyer** sur un schéma.

## Nouveautés de la version 3.8

- **Schémas** : « Modèles » (rondo, 3 contre 2, conservation, sortie de balle, centre-tir, déjà animés), bouton copie pour dupliquer un schéma, « Tableau blanc » en plein écran sans enregistrement (« Garder » pour le transformer en schéma).
- **Joueurs** : présences d'un toucher avec le % de la saison, temps de jeu par match (rubrique « Temps de jeu » d'un match joué), fiche joueur complète (toucher un joueur).
- **Parents** : sur une catégorie, « Lien pour les parents ». Page en lecture seule (`parents.html`) : matchs, horaires, lieux, séances, covoiturage, et réponses présent / absent. Elle ne montre que le prénom et l'initiale du nom des enfants convoqués : jamais de date de naissance ni de téléphone. « Nouveau lien » annule l'ancien.
- **Covoiturage** : sur un match à l'extérieur, voitures des parents et enfants rangés dedans, à envoyer sur WhatsApp.
- **Tableau de bord** (responsables) : chiffres de la saison, détail par catégorie, points à surveiller.
- **Sauvegardes** : le serveur copie toutes les données chaque lundi à 3 h et garde 8 semaines (Tableau de bord → Sauvegardes). On peut aussi télécharger une copie. **Ces fichiers contiennent des données de mineurs : ne jamais les mettre sur GitHub.**

## Nouveautés de la version 3.10

- Composition selon les postes précis (DC, LD, AG…), remplaçants notés dans le schéma.
- Relance WhatsApp des parents qui n'ont pas répondu ; temps de jeu à surveiller (Stats et convocation).
- Séances types du club, et « Dupliquer » vers une autre catégorie.
- Licences, certificats, cotisations et droit à l'image (Tableau de bord → Licences et cotisations), ⚠️ dans les convocations.
- Exports Excel : présences et temps de jeu (Stats, Tableau de bord), licences.
- « Qui encadre ? » : encadrants de la semaine et absences des dirigeants.
- Page des parents : « Ajouter à mon agenda » et photos du match choisies par le coach (effacées après 90 jours).

## Vérifier avant de publier

1. **Les fichiers et le serveur** : `node tools/verifier.js`. Il contrôle la syntaxe, le fichier `js/app.bundle.js` (sinon : `node build.js`), les appels entre modules, les fichiers de l'appli hors ligne, le numéro de version partout, et chaque fonction du serveur appelée par l'appli (avec de faux codes : le serveur refuse tout, rien n'est écrit). Il doit afficher « ✅ Aucun problème trouvé ».
2. **Les pages et les boutons** : `node tools/serveur.js`, puis ouvre http://localhost:8790/tools/verif.html et touche **Lancer la vérification**. Un club inventé est chargé, chaque page est ouverte et ses boutons touchés (sauf supprimer, importer, se déconnecter…), en responsable et en coach, sur ordinateur et sur téléphone. Rien n'est envoyé au serveur. Cette page ne marche qu'en local : elle remplace les données de l'appli du navigateur.

## Mettre à jour l'appli

Augmente le même numéro partout, puis relance `node build.js` et `node tools/verifier.js` (il signale un numéro oublié) :

- `sw.js` : `raincy-coach-v115` devient `raincy-coach-v116` ;
- les pages `.html` : `?v=115` devient `?v=116` ;
- `js/app.js` : `BUILD = 115` devient `BUILD = 116` ;
- `version.json` : `"build": 115` devient `"build": 116`, avec la nouvelle version ;
- `js/help.js` : le numéro affiché (`VERSION = '3.75'`).

Au retour sur l'appli, elle compare son numéro à `version.json`. Si le site est plus récent, elle installe la nouvelle version puis se recharge toute seule. Sinon, touche **Mettre à jour l'appli** en bas de l'écran de connexion ou des Réglages.
