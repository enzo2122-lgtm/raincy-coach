/* Raincy Coach : l'appli de FA Le Raincy, fabriquée à partir de Clubbo (club/fabrication.json) et réglée ici pour ce club.
   Le serveur est celui de Clubbo (FA Le Raincy y est le club « fa-le-raincy », depuis la version 3.70). La clé est la clé
   « publishable », faite pour être publique : les tables sont fermées et chaque fonction du serveur vérifie la connexion.
   store / db : les noms de la mémoire du téléphone depuis toujours (ne pas les changer : les téléphones perdraient leurs données).
   defaults : les réglages du club, mis une fois s'ils manquent (ensuite, ils se changent dans Réglages → Le club). */
const CLUB_SERVER = {
  url: 'https://mgdyurgsftkjvgbmmgdt.supabase.co',
  key: 'sb_publishable_f5HrqpfY5qT_veYfnFRDWQ_zmyq7kYx',
  club: 'fa-le-raincy',
  app: 'Raincy Coach',
  store: 'raincy',
  db: 'raincy-coach',
  crest: 'icons/crest.png',
  defaults: {
    name: 'FA Le Raincy',
    short: 'Raincy',
    slogan: "Plus d'un siècle de passion, d'effort et de victoires : Notre Club, Notre Histoire, Notre Fierté.",
    city: 'Le Raincy', lat: 48.8993, lon: 2.5183,
    fffUrl: 'https://epreuves.fff.fr/competition/club/552176-f-association-le-raincy/equipes.html',
    homeBib: 'bordeaux', awayBib: 'blanc',
  },
};
