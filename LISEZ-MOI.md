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

## Partager entre éducateurs

Chaque éducateur installe l'appli avec la même adresse. Pour partager, va dans **Réglages**, puis **Envoyer toutes mes données**, ou utilise **Envoyer** sur un entraînement ou un schéma. Le fichier part par AirDrop, WhatsApp ou mail. L'autre éducateur l'ouvre avec **Recevoir un fichier**.

Les données restent sur chaque appareil. Envoie régulièrement une copie de sauvegarde.

## Messagerie et planning du terrain (serveur du club)

La messagerie et le planning sont partagés par tous les éducateurs grâce à un serveur gratuit Supabase.

1. Crée un compte sur https://supabase.com, puis un projet (région Europe).
2. Dans l'appli, connecté en responsable, va dans **Réglages → Serveur du club → Configurer le serveur**.
3. Suis les 3 étapes : copie le script dans Supabase (SQL Editor → Run), puis colle la Project URL et la clé publique (anon ou publishable). N'utilise jamais la clé secrète.
4. Envoie le fichier du club aux éducateurs (Réglages → Envoyer toutes mes données) : leur appli se connecte toute seule.

Le **code responsable** (Réglages → Code responsable) sert à fixer les créneaux disponibles. Il reste sur ton appareil.

## Mettre à jour l'appli

Remplace les fichiers sur GitHub. Augmente ensuite le numéro de version dans `sw.js` (par exemple `raincy-coach-v9` devient `raincy-coach-v10`) et dans `index.html` (`?v=9` devient `?v=10`). Les iPad récupèrent la nouvelle version à la prochaine ouverture avec internet.
