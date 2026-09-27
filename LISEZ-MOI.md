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

## Comptes des éducateurs (version 2.1)

Le serveur du club (Supabase) est déjà réglé dans l'appli (`js/config.js`). Personne n'a besoin de le configurer.

**Le responsable, une seule fois :**

1. Ouvre l'appli, puis touche **Première connexion**, puis **Je suis le responsable du club**.
2. Entre ton nom, ton prénom, le **code responsable** et un mot de passe.
   - Le code se trouve dans **Réglages → Serveur du club → Code responsable**, sur l'appareil où le serveur a été configuré.
   - Si tu l'as perdu, touche **J'ai perdu le code responsable**. L'appli te donne un script à coller dans Supabase (SQL Editor → Run), puis affiche le nouveau code. Note-le sur papier.
3. Recharge le fichier des licenciés (**Réglages → Recevoir un fichier**). Il part sur le serveur pour tous les éducateurs.
4. Va dans **Réglages → Serveur du club → Inviter les éducateurs** et envoie le lien par WhatsApp.

**Les éducateurs :** ils ouvrent le lien d'invitation, choisissent leur nom et créent leur mot de passe. Ensuite, ils se connectent sur n'importe quel appareil avec leur **nom, prénom et mot de passe**.

**Mot de passe oublié :** le responsable va dans **Réglages → Comptes des dirigeants → Réinitialiser**. L'éducateur touche ensuite **Première connexion** et crée un nouveau mot de passe.

La messagerie, le planning du terrain et les effectifs sont partagés par le serveur. L'appli marche aussi sans internet et envoie les changements au retour du réseau.

Tu peux toujours envoyer un fichier à la main : **Réglages → Envoyer toutes mes données**, ou **Envoyer** sur un entraînement ou un schéma (AirDrop, WhatsApp ou mail).

## Mettre à jour l'appli

Remplace les fichiers sur GitHub. Augmente ensuite le même numéro partout :

- `sw.js` : `raincy-coach-v25` devient `raincy-coach-v26` ;
- `index.html` : `?v=25` devient `?v=26` ;
- `js/app.js` : `BUILD = 25` devient `BUILD = 26` ;
- `version.json` : `"build": 25` devient `"build": 26`.

Change aussi le numéro affiché dans `js/help.js` (`VERSION = '2.5.2'`).

Au retour sur l'appli, elle compare son numéro à `version.json`. Si le site est plus récent, elle se met à jour toute seule. Sinon, touche **Mettre à jour l'appli** en bas de l'écran de connexion ou des Réglages.
