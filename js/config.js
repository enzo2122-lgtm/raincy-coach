/* The club's server (Supabase), built into the app so nobody has to connect it by hand.
   The key is the « publishable » key, made to be public: the tables are closed and every SQL function
   checks a dirigeant's login (or the club code) before giving anything. */
const CLUB_SERVER = {
  url: 'https://zpfxdscskpvccgdrqwxd.supabase.co',
  key: 'sb_publishable_i_9Yletg4IQxs2MuxiYiTA_r0uKfwYz',
};
