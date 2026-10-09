# Publier FA Le Raincy sur le Play Store

Doc écrit le 8 octobre 2026 sur claude.ai, recopié ici le 9 octobre pour tout garder dans le dépôt.

> **Point au 9 octobre 2026** : compte Play Console créé (en attente de la validation d'identité par Google) · dépôt `enzo2122-lgtm.github.io` en ligne avec `assetlinks.json` et l'empreinte PWABuilder · paquet PWABuilder fait (garder le zip : `.aab`, `signing.keystore`, `signing-key-info.txt`). Reste : joueur « Test Google », création de l'appli dans la Play Console, test fermé, empreinte Google à ajouter dans assetlinks. **La fiche à jour (6 captures, description 5.29) est dans `FICHE-PLAY-STORE.md`** ; la section « fiche » ci-dessous est l'ancienne.

## En bref

L'appli est prête techniquement pour le Play Store : il reste les étapes qui demandent ton compte, environ 1 h de travail, puis 14 jours de test avec 12 personnes du club.

**Où on en est (8 octobre)**

| Étape | État |
| --- | --- |
| 1. Compte Play Console (personnel) | Créé ; Google vérifie l'identité, le numéro de téléphone se valide après |
| 2. Paquet PWABuilder | Fait, identifiant `fr.falraincy.app`, clé de signature à garder sur un cloud privé |
| 3. Lien appli ↔ site | Fait : dépôt `enzo2122-lgtm.github.io` avec `.well-known/assetlinks.json` |
| Joueur fictif Test GOOGLE | SQL prêt, à coller dans Supabase |
| 4. Créer l'appli dans la Play Console | Bloqué jusqu'à l'e-mail de validation de Google |
| 5. Test fermé (12 testeurs, 14 jours) | Recruter les testeurs dès maintenant |
| Après le 1er envoi | Me donner l'empreinte SHA-256 de la clé de signature Google (Intégrité de l'appli) |

**Déjà fait dans l'appli (version 4.72)**

- Une seule appli « FA Le Raincy » pour tout le club : elle s'ouvre sur l'écran du code (joueurs et parents), avec un lien « Coach ou dirigeant ? » vers l'appli des coachs. Le choix est retenu.
- Le manifeste complet : nom, description, catégorie Sports, icône adaptée aux formes Android, raccourcis, captures.
- 5 captures d'écran au format accepté (1080 × 1920) et la bannière 1024 × 500, dans le dossier `store/` du dépôt raincy-coach.
- La page confidentialité en ligne : https://enzo2122-lgtm.github.io/raincy-coach/confidentialite.html

**Ce qu'il te faut**

| Quoi | Coût | Temps |
| --- | --- | --- |
| Compte développeur Google Play | 25 $, une seule fois | 15 min + vérification d'identité (quelques jours) |
| Paquet Android fait avec PWABuilder | gratuit | 15 min |
| Un petit dépôt GitHub pour lier l'appli au site | gratuit | 10 min |
| Test fermé : 12 testeurs du club pendant 14 jours | gratuit | 14 jours d'attente |
| Fiche du Play Store (textes ci-dessous) | gratuit | 20 min |

Calendrier réaliste : mise en ligne 3 semaines après la création du compte.

## Étape par étape

Six étapes, dans cet ordre. Les étapes 1 à 4 se font en une soirée ; l'étape 5 impose 14 jours d'attente.

1. **Créer le compte Google Play Console** sur play.google.com/console avec un compte Google dédié au club (pas ton compte perso).
   - Type de compte : « Personnel » est le plus rapide. « Organisation » met l'appli au nom de l'association, mais demande un numéro D-U-N-S (gratuit, quelques jours d'attente) ; il dispense en principe du test à 12 personnes.
   - Payer les 25 $ et faire la vérification d'identité.
2. **Fabriquer le paquet Android avec PWABuilder** sur pwabuilder.com.
   - Entrer l'adresse : https://enzo2122-lgtm.github.io/raincy-coach/moi.html puis « Package for stores » → Android.
   - Package ID : `fr.falraincy.app` (définitif, il ne pourra plus changer). Nom : FA Le Raincy.
   - Signing key : « Create new ». Télécharger le zip.
   - **Garder précieusement** `signing.keystore` et `signing-key-info.txt` (copie sur un cloud privé). Sans eux, plus aucune mise à jour possible.
3. **Lier l'appli au site**, pour qu'elle s'ouvre en plein écran sans barre d'adresse.
   - Sur GitHub, créer un dépôt public nommé exactement `enzo2122-lgtm.github.io` et activer Pages (branche main).
   - Y déposer le fichier `assetlinks.json` du zip PWABuilder dans un dossier `.well-known`, plus un fichier vide `.nojekyll`. Je peux le faire pour toi dès que le dépôt existe.
   - Vérifier que https://enzo2122-lgtm.github.io/.well-known/assetlinks.json s'ouvre.
4. **Créer l'appli dans la Play Console** et remplir la fiche (section suivante), la sécurité des données et le public cible (section d'après).
   - Après le premier envoi, Google re-signe l'appli : copier l'empreinte SHA-256 affichée dans Test et publication → Intégrité de l'appli, et l'ajouter dans `assetlinks.json` à côté de celle de PWABuilder.
5. **Test fermé** (compte personnel) : Test → Test fermé → envoyer le fichier `.aab`, ajouter au moins 12 adresses Gmail (coachs, dirigeants, quelques parents).
   - Chacun ouvre le lien d'inscription et installe l'appli. Ils doivent rester inscrits 14 jours d'affilée.
6. **Demander l'accès à la production** (questionnaire court sur le test), puis publier. La validation prend en général quelques jours.

Mises à jour ensuite : rien à refaire. L'appli du store affiche le site, donc chaque nouvelle version publiée sur GitHub arrive automatiquement chez tout le monde.

[Règle des 12 testeurs](https://primetestlab.com/fr/blog/google-play-changed-20-to-12-testers) · [Une PWA dans une appli Android](https://web.dev/articles/using-a-pwa-in-your-android-app)

## La fiche du Play Store

Tout est prêt à copier-coller dans Présence sur le Play Store → Fiche principale.

| Champ | À mettre |
| --- | --- |
| Nom de l'appli (30 caractères max) | FA Le Raincy |
| Description courte (80 max) | L'appli du club : convocations, matchs, chat des parents, résultats et badges. |
| Catégorie | Sports |
| E-mail de contact | l'adresse e-mail du club |
| Règles de confidentialité | https://enzo2122-lgtm.github.io/raincy-coach/confidentialite.html |
| Icône 512 × 512 | https://enzo2122-lgtm.github.io/raincy-coach/icons/icon-512.png |
| Image de présentation 1024 × 500 | https://enzo2122-lgtm.github.io/raincy-coach/store/banniere-1024x500.png |
| Captures téléphone (dans l'ordre) | store/1-matchs.png, 2-chat.png, 3-saison.png, 5-badges.png, 4-code.png |

Les images sont en ligne dès la version 4.72 publiée : ouvre chaque lien sur ton téléphone et enregistre l'image.

**Description complète**

```
L'appli officielle du FA Le Raincy, pour les joueurs, les parents et les éducateurs du club.

POUR LES PARENTS ET LES JOUEURS
• Les convocations et les prochains matchs : lieu, heure de rendez-vous, réponse Présent ou Absent en un geste.
• Les entraînements de la semaine, à ajouter à l'agenda du téléphone.
• Le chat des parents de la catégorie avec les coachs (jusqu'aux U15) : covoiturage, organisation, sondages.
• Le chat des joueurs à partir des U16, protégé : mots grossiers bloqués, signalement aux coachs.
• La saison du joueur : matchs, temps de jeu, buts, passes, badges à gagner.
• Les résultats du club, à partager en image sur les réseaux.
• Les notifications : convocation, changement d'horaire, nouveau message.

POUR LES ÉDUCATEURS
• La gestion de l'équipe : effectif, convocations, présences, compositions.
• Les séances : bibliothèque d'exercices, schémas tactiques, vidéo.
• Les matchs : score, buteurs, temps de jeu, statistiques.
• La vie du club : bénévoles, covoiturage, chat de la catégorie avec modération.

SANS COMPTE, SANS PUBLICITÉ
Chaque licencié entre avec le code personnel remis par le club. Pas de publicité, pas de revente de données. Les données restent au club.
```

## Questionnaires de la Play Console

Ces réponses suivent la page confidentialité de l'appli ; Google les compare à elle, elles doivent rester cohérentes.

**Accès à l'appli** (Google doit pouvoir tester) : créer dans l'appli coach un joueur fictif « Test Google » dans une catégorie U13, et donner son code personnel dans la Play Console avec cette consigne : « Taper ce code sur le premier écran puis Entrer ».

**Publicité** : non. **Achats dans l'appli** : non.

**Public cible** : 13-15 ans, 16-17 ans, 18 ans et plus. Ne pas cocher les moins de 13 ans : l'espace des plus jeunes est ouvert par leurs parents, et cocher « moins de 13 ans » impose les règles Familles de Google, beaucoup plus lourdes.

**Classification du contenu** : catégorie Réseaux sociaux et communication ; les utilisateurs peuvent échanger (chat) : oui ; contenus violents, sexuels, jeux d'argent, achats : non.

**Sécurité des données**

| Question | Réponse |
| --- | --- |
| L'appli collecte des données ? | Oui |
| Données partagées avec des tiers ? | Non (l'hébergeur est un prestataire, pas un tiers) |
| Chiffrées pendant le transfert ? | Oui |
| Suppression sur demande ? | Oui, URL : https://enzo2122-lgtm.github.io/raincy-coach/confidentialite.html |
| Infos personnelles | Nom ; e-mail et téléphone (facultatifs, coachs et parents) ; autres infos (date de naissance) |
| Santé et remise en forme | Infos de santé (blessures, facultatif) ; infos de remise en forme (temps de jeu, tests) |
| Messages | Autres messages dans l'appli (chat) |
| Photos et vidéos | Photos (chat, matchs) |
| Identifiants de l'appareil | Oui (abonnement aux notifications) |
| Finalité pour tous ces types | Fonctionnement de l'appli ; communications pour les notifications |
| Collecte facultative ? | Santé, photos, e-mail, téléphone : facultatif. Le reste : obligatoire |

## Et l'App Store (iPhone) ?

Recommandation : pas tout de suite. Commence par Android, et garde l'appli installée depuis Safari sur iPhone, qui reçoit déjà les notifications.

- Il faut un Mac avec Xcode pour fabriquer l'appli, et un compte Apple Developer à 99 $ par an.
- Apple refuse souvent les applis qui affichent seulement un site (règle 4.2, « fonctionnalités minimales »). Il faudrait ajouter du natif pour être accepté.
- Dans une appli iPhone emballée, les notifications web ne marchent pas : il faudrait les refaire avec le système d'Apple, côté serveur aussi.

À revoir si beaucoup de parents iPhone n'arrivent pas à installer l'appli malgré le guide « Installe l'appli ».
