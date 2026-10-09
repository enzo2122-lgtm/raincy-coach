# Fiche Play Store — FA Le Raincy (mise à jour 9 octobre 2026, appli 5.29)

Tout est à copier-coller dans Play Console → Présence sur le Play Store → Fiche principale.
Le plan complet (compte, PWABuilder, test fermé, questionnaires) est dans `PUBLIER-PLAY-STORE.md`, à côté.

| Champ | À mettre |
|---|---|
| Nom de l'appli (30 max) | FA Le Raincy |
| Description courte (80 max) | L'appli du club : convocations, matchs, chat, vidéos, résultats et pronos. |
| Catégorie | Sports |
| E-mail de contact | l'adresse e-mail du club |
| Règles de confidentialité | https://enzo2122-lgtm.github.io/raincy-coach/confidentialite.html |
| Icône 512 × 512 | https://enzo2122-lgtm.github.io/raincy-coach/icons/icon-512.png |
| Image de présentation 1024 × 500 | https://enzo2122-lgtm.github.io/raincy-coach/store/banniere-1024x500.png |
| Captures téléphone (1080 × 1920, dans l'ordre) | store/1-matchs.png · 2-chat.png · 3-saison.png · 5-badges.png · 6-autorisations.png · 4-code.png |
| Adresse de l'appli pour PWABuilder | https://enzo2122-lgtm.github.io/raincy-coach/moi.html |
| Package ID (définitif) | fr.falraincy.app |
| Fichier assetlinks.json | dossier `enzo2122-lgtm.github.io` sur le bureau (dépôt prêt à pousser, voir son LISEZMOI) |

## Description complète (3 300 caractères, maximum 4 000)

```
L'appli officielle du FA Le Raincy, pour les joueurs, les parents et les éducateurs du club. Sans compte, sans publicité : chaque licencié entre avec le code personnel remis par le club.

POUR LES JOUEURS ET LES PARENTS
• Les convocations et les prochains matchs : lieu, heure de rendez-vous, réponse Présent ou Absent en un geste, ajout à l'agenda du téléphone.
• Le programme de la semaine : entraînements et matchs, avec le mot du coach.
• Le chat de la catégorie : chat des parents avec les coachs jusqu'aux U15, chat des joueurs à partir des U16, protégé (mots grossiers bloqués, signalement aux coachs, pas de notification la nuit).
• Les réactions et les commentaires sous chaque séance et chaque match.
• La saison du joueur : matchs, temps de jeu, buts, passes, badges, classements de sa catégorie.
• Les vidéos : les temps forts des matchs choisis par le coach, à regarder dans l'appli.
• Les conseils perso du coach : exercices, vidéos, fiches.
• Le jeu des pronos sur la Ligue des champions, entre joueurs et coachs, avec un club de cœur.
• Le profil et la santé : poids, taille, pied fort, points forts ; signaler une blessure en touchant la zone sur un corps humain ; questionnaire de forme.
• Les résultats du club, à partager en image sur les réseaux.
• Les notifications : convocation, changement d'horaire, message, vidéo.

POUR LES ÉDUCATEURS
• L'équipe : effectif, codes personnels, convocations, présences, qui a vu la convocation.
• Les séances : bibliothèque d'exercices, schémas tactiques animés, groupes de course d'après les VMA, équipes équilibrées en un geste.
• Les matchs : feuille de match, saisie en direct, score, buteurs, temps de jeu, statistiques, compte-rendu PDF.
• La vidéo : analyse, tableau tactique sur l'image, temps forts automatiques envoyés aux joueurs.
• La santé : infirmerie, suivi des blessés, bien-être et charge d'entraînement.
• Les résultats et classements officiels de la FFF, mis à jour tout seuls.
• La vie du club : bénévoles, covoiturage, anniversaires, messages, modération du chat.

CONFIDENTIALITÉ
Les données restent au club, hébergées en France. Pas de publicité, pas de revente. Chacun ne voit que ce qui le concerne et sa catégorie. Les détails : https://enzo2122-lgtm.github.io/raincy-coach/confidentialite.html
```

## Questionnaires (inchangés, voir le doc) — rappels

- Accès à l'appli pour Google : un joueur fictif « Test Google » dans une catégorie U13, son code personnel + la consigne « Taper ce code sur le premier écran puis Entrer ».
- Publicité : non. Achats : non. Public cible : 13-15, 16-17, 18 et plus (pas « moins de 13 ans »).
- Classification : réseaux sociaux et communication ; les utilisateurs peuvent échanger : oui.
- Sécurité des données : collecte oui ; partage avec des tiers non ; chiffré oui ; suppression sur demande oui (URL de la page confidentialité). Types : infos personnelles (nom ; e-mail et téléphone facultatifs ; date de naissance), santé (facultatif), messages, photos et vidéos, identifiants de l'appareil (notifications). Depuis 4.54 : si un coach utilise l'option « analyse par IA (Gemini) », la vidéo du match part chez Google avec la clé du coach — à mentionner dans « partage avec des tiers » si tu actives cette option au club.

## Vérifié le 8 octobre 2026
Les fichiers que Google et PWABuilder vont chercher répondent bien en ligne (manifeste `famille.webmanifest`, `moi.html`, `sw.js`, icônes, captures, bannière, page confidentialité).
