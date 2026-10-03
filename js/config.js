/* The club's server (Supabase), built into the app so nobody has to connect it by hand.
   Since 3.70, FA Le Raincy is a club of the Clubbo server (« club » : its code there).
   The key is the « publishable » key, made to be public: the tables are closed and every SQL function
   checks a dirigeant's login (or the club code) before giving anything. */
const CLUB_SERVER = {
  url: 'https://mgdyurgsftkjvgbmmgdt.supabase.co',
  key: 'sb_publishable_f5HrqpfY5qT_veYfnFRDWQ_zmyq7kYx',
  club: 'fa-le-raincy',
};
