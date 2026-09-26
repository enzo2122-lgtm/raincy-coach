/* Help: first-use tour, contextual help on every page, and reports (bugs, ideas, questions) sent to the club's responsable.
   Errors are caught and kept so a coach can attach them to a report. */
const Help = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const VERSION = '2.1.1';
  const TOUR_KEY = 'raincy-tour-seen', ERR_KEY = 'raincy-errors';

  /* ---------- error log ---------- */
  function errors() { try { return JSON.parse(localStorage.getItem(ERR_KEY)) || []; } catch (e) { return []; } }
  function logError(msg, src) {
    const list = errors(); list.push({ at: new Date().toISOString(), msg: String(msg).slice(0, 300), src: String(src || '').slice(0, 120), page: location.hash });
    try { localStorage.setItem(ERR_KEY, JSON.stringify(list.slice(-15))); } catch (e) {}
  }
  let lastToast = 0;
  function onCrash(msg, src) {
    logError(msg, src);
    if (Date.now() - lastToast < 8000) return; lastToast = Date.now();
    const t = document.getElementById('toast');
    t.innerHTML = `Oups, quelque chose n'a pas marché. <button class="toast-btn" id="crashReport">Signaler</button>`;
    t.className = 'toast show err';
    const b = document.getElementById('crashReport'); if (b) b.onclick = () => { t.className = 'toast'; report('bug'); };
    setTimeout(() => { t.className = 'toast'; }, 7000);
  }
  function watch() {
    window.addEventListener('error', e => onCrash(e.message, (e.filename || '').split('/').pop() + ':' + e.lineno));
    window.addEventListener('unhandledrejection', e => onCrash(e.reason && (e.reason.message || e.reason), 'promesse'));
  }

  /* ---------- first-use tour ---------- */
  const SLIDES = [
    ['crest', 'Bienvenue !', "Raincy Coach, c'est l'appli des éducateurs du club : tableau tactique animé, effectifs, séances, matchs et statistiques. Elle marche aussi sans internet."],
    ['whistle', 'Ton compte', "Première fois : ouvre le lien d'invitation du responsable, choisis ton nom et crée ton mot de passe. Ensuite, connecte-toi sur n'importe quel téléphone, tablette ou ordinateur avec ton nom, ton prénom et ton mot de passe : tes données te suivent."],
    ['team', 'Équipes et joueurs', "Dans Équipes, retrouve chaque catégorie avec ses joueurs et dirigeants. Pour charger les licenciés : Réglages → Recevoir un fichier. Touche un joueur pour ajouter son numéro et le téléphone des parents."],
    ['board', 'Le tableau tactique', "Dans Schémas : choisis un outil (joueur, ballon, flèche, zone) puis touche le terrain. Touche « + Étape », déplace les joueurs : la flèche se dessine toute seule. « Jouer » lance l'animation."],
    ['training', 'Séances et matchs', "Prépare tes exercices, coche les présents, note les joueurs avec les étoiles, ajoute photos et vidéos. Pour un match : convocation, composition, score, buteurs… et les smileys !"],
    ['calendar', 'Planning et messages', "Réserve le terrain (grand ou demi-terrain) sans chevauchement, et discute avec les autres éducateurs dans Messages : tout le club, ta catégorie ou en privé."],
    ['video', 'Vidéos et PDF', "Dans la Bibliothèque, importe une vidéo, un montage ou un PDF venant d'une autre appli : dessine dessus ou transforme un PDF en séance."],
    ['share', 'Imprimer et partager', "Chaque schéma, séance ou match se partage en image, vidéo ou PDF à imprimer. « Envoyer toutes mes données » transmet tout à un autre éducateur."],
    ['help', "Besoin d'aide ?", "Le bouton « ? » est présent sur chaque page : il explique la page et permet de signaler un problème ou de proposer une idée au responsable."],
  ];
  function tour(onDone) {
    let i = 0;
    const el = document.createElement('div'); el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Guide de démarrage');
    document.body.appendChild(el);
    const render = () => {
      const [ic, title, text] = SLIDES[i], last = i === SLIDES.length - 1;
      el.innerHTML = `<div class="tour-card">
        <div class="tour-ic">${ic === 'crest' ? '<img src="icons/crest.png" alt="">' : I[ic]}</div>
        <p class="eyebrow">Guide · ${i + 1} sur ${SLIDES.length}</p><h2>${esc(title)}</h2><p class="tour-text">${esc(text)}</p>
        <div class="tour-dots">${SLIDES.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
        <div class="tour-nav"><button class="btn" data-t="skip">${last ? 'Fermer' : 'Passer'}</button>
          <span class="grow"></span>${i ? `<button class="btn" data-t="prev">${I.back}<span>Retour</span></button>` : ''}
          <button class="btn primary" data-t="${last ? 'end' : 'next'}"><span>${last ? "C'est parti !" : 'Suivant'}</span>${last ? '' : I.next}</button></div></div>`;
    };
    const close = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) {} el.remove(); onDone && onDone(); };
    el.onclick = e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      if (b.dataset.t === 'next') { i++; render(); }
      else if (b.dataset.t === 'prev') { i--; render(); }
      else close();
    };
    let x0 = null;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (dx < -50 && i < SLIDES.length - 1) { i++; render(); } else if (dx > 50 && i > 0) { i--; render(); } });
    render();
  }
  const tourSeen = () => { try { return !!localStorage.getItem(TOUR_KEY); } catch (e) { return true; } };

  /* ---------- help per page ---------- */
  const PAGES = {
    '': ['Accueil', ['Les gros boutons ouvrent les actions les plus courantes : dessiner un exercice, préparer une séance, ajouter un match, importer une vidéo ou un PDF.', 'Choisis une équipe en haut pour ne voir que ses séances et ses matchs.', 'Touche le prochain match ou la prochaine séance pour l\'ouvrir.']],
    equipes: ['Équipes', ['Chaque carte est une catégorie (U11, Seniors…). Touche-la pour voir ses joueurs et ses dirigeants.', '« Tous les joueurs » montre tout le club, avec une recherche et un filtre par catégorie.', '« Nouvelle catégorie » : choisis le format foot à 11, à 8 ou à 5.']],
    equipe: ['Une catégorie', ['Touche un joueur pour ouvrir sa fiche : numéro, poste, téléphone, parents, infos santé, et ses notes.', 'Le menu « Ajouter un joueur d\'une autre catégorie » permet de mettre un joueur dans plusieurs catégories.', 'La croix retire le joueur de la catégorie seulement : il reste dans le club.']],
    joueurs: ['Tous les joueurs', ['Cherche un nom ou filtre par catégorie.', '« Coller une liste » : colle des lignes copiées depuis Footclubs, les joueurs sont rangés tout seuls dans leur catégorie.', 'Pour charger le fichier des licenciés : Réglages → Recevoir un fichier.']],
    dirigeants: ['Dirigeants', ['Ajoute chaque dirigeant avec son rôle, son téléphone et ses catégories.', 'À sa première connexion (lien d\'invitation : Réglages → Inviter les éducateurs), le dirigeant choisit son nom et crée son mot de passe.']],
    schemas: ['Schémas', ['Un schéma est un exercice ou une tactique animée. « Nouveau schéma » : foot à 11, à 8, à 5 ou zone libre.', 'La Bibliothèque permet de dessiner sur une vidéo, un PDF ou une image.', '« Recevoir » ouvre un schéma envoyé par un autre éducateur.']],
    schema: ['Le tableau tactique', ['1. Choisis un outil à gauche (ou en haut sur téléphone), puis touche le terrain.', '2. « Bouger » : fais glisser un joueur. Touche-le pour changer son numéro, sa couleur ou son nom.', '3. Flèche : glisse ton doigt. Zone : dessine un rectangle et donne-lui un nom.', '4. « + Étape » copie la position : déplace les joueurs et le ballon, la flèche du mouvement se dessine toute seule.', '5. « Jouer » lance l\'animation. « Exporter » : image, vidéo, PDF à imprimer.', 'Sur téléphone, le bouton en forme de pile ouvre les options (couloirs, zones de jeu, formations…).']],
    entrainements: ['Séances', ['Une fiche AssistCoachAI (PDF) : Bibliothèque → Importer → ouvre le PDF → Créer une séance. Chaque exercice est repris avec sa durée, ses consignes et son matériel.', '« Nouvel entraînement » : un thème, une date, une équipe.', 'Tu peux aussi créer une séance d\'un coup à partir d\'un PDF : Bibliothèque → ouvre le PDF → Créer une séance.']],
    entrainement: ['Une séance', ['Ajoute les exercices, avec la durée, l\'organisation, les consignes et un schéma.', 'Coche les présents, puis note-les avec les étoiles.', 'Joins des documents et des photos. Le bouton PDF fait la fiche à imprimer.']],
    matchs: ['Matchs', ['« Importer » : colle le calendrier copié sur le site de la FFF ou du District 93 (mois par mois), ou choisis un fichier d\'agenda (.ics) ou un tableur (.csv). La catégorie est trouvée toute seule et le terrain peut être réservé pour les matchs à domicile.', '« Nouveau match » : adversaire, date, domicile ou extérieur.', 'Les résultats s\'affichent avec leur smiley.']],
    match: ['Un match', ['Coche les convoqués et choisis les encadrants.', '« Faire la composition » place les joueurs sur le terrain.', 'Coche « Le match est joué », règle le score, les buteurs et les passeurs, puis note les joueurs.', '« Feuille de match » fait le PDF à imprimer.']],
    stats: ['Statistiques', ['Bilan de l\'équipe : victoires, nuls, défaites, buts et points.', 'Tableau des joueurs : touche un titre de colonne pour trier (buts, passes, présences, notes).']],
    planning: ['Planning du terrain', ['« Chaque semaine » réserve ton créneau d\'entraînement toutes les semaines jusqu\'au 30 juin, en une fois. Les semaines déjà prises sont listées.', 'Touche une case vide du planning (ou « Réserver ») pour prendre un créneau : date, heure de début et de fin, grand terrain ou demi-terrain, entraînement ou match.', 'Pas besoin de connaître l\'adversaire : il suffit de l\'horaire.', 'Un grand terrain bloque tout le terrain. Deux demi-terrains peuvent être utilisés en même temps (A et B).', 'L\'appli refuse tout chevauchement, même si deux coachs réservent en même temps.', 'Touche une réservation pour la libérer ou préparer la séance ou la fiche match.', 'Le responsable fixe les créneaux disponibles de la semaine.']],
    messages: ['Messages', ['« Tout le club » : pour tous les éducateurs.', 'Chaque catégorie a sa conversation.', '« Écrire à un éducateur » ouvre une conversation privée.', 'Les nouveaux messages arrivent tout seuls ; le chiffre rouge dans le menu indique ceux que tu n\'as pas lus.']],
    reglages: ['Réglages', ['Recevoir un fichier : licenciés ou données d\'un autre éducateur.', 'Les données se partagent toutes seules par le serveur du club. « Envoyer toutes mes données » fait une sauvegarde.', 'Inviter les éducateurs : un lien à envoyer par WhatsApp pour leur première connexion.', 'Le responsable gère les comptes des dirigeants et l\'e-mail qui reçoit les signalements.']],
    bibliotheque: ['Bibliothèque', ['« Importer » : choisis une vidéo, un montage, un PDF ou une image (Fichiers, Photos…).', 'Vidéo : mets sur pause puis « Dessiner sur cette image ».', 'PDF : « Créer une séance » ou « Dessiner sur cette page ».', '« Joindre… » ajoute le fichier à une séance ou à un match.']],
  };
  const pageKey = () => (location.hash || '#/').split('/')[1] || '';
  function open(key = pageKey()) {
    const [title, tips] = PAGES[key] || PAGES[''];
    modal({ title: `Aide · ${title}`, noFocus: true,
      body: `<ul class="help-list">${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="help-actions">
          <button class="big-act" data-h="tour">${I.help}<b>Revoir le guide</b><span>Les bases en 8 écrans</span></button>
          <button class="big-act" data-h="bug">🐞<b>Signaler un problème</b><span>Quelque chose ne marche pas</span></button>
          <button class="big-act" data-h="idea">💡<b>Proposer une idée</b><span>Une amélioration, une demande</span></button>
        </div>`,
      onOpen: (r, close) => $$('[data-h]', r).forEach(b => b.onclick = () => { close(); const h = b.dataset.h; setTimeout(() => h === 'tour' ? tour() : report(h), 60); }) });
  }
  function button() {
    let b = document.getElementById('helpFab');
    if (!b) { b = document.createElement('button'); b.id = 'helpFab'; b.className = 'help-fab'; b.setAttribute('aria-label', 'Aide'); b.innerHTML = `${I.help}<span>Aide</span>`; b.onclick = () => open(); document.body.appendChild(b); }
    b.hidden = document.body.classList.contains('editing') || !Auth.current() || location.hash.startsWith('#/messages/');
  }

  /* ---------- reports ---------- */
  const TYPES = { bug: ['🐞', 'Problème'], idea: ['💡', 'Idée'], question: ['❓', 'Question'] };
  function diagnostics() {
    const u = Auth.current();
    return { version: VERSION, page: location.hash || '#/', device: navigator.userAgent, screen: `${screen.width}×${screen.height} (${innerWidth}×${innerHeight})`,
      standalone: matchMedia('(display-mode: standalone)').matches || !!navigator.standalone, by: u ? Store.fullName(u) : '', role: u ? u.role || '' : '', errors: errors().slice(-5) };
  }
  function textOf(rep) {
    const d = rep.diag || {};
    return [`${TYPES[rep.type][0]} ${TYPES[rep.type][1]} – Raincy Coach`, `De : ${rep.byName || '?'}${d.role ? ' (' + d.role + ')' : ''}`, `Date : ${new Date(rep.at).toLocaleString('fr-FR')}`, '',
      rep.text, rep.context ? `\nCe que je faisais : ${rep.context}` : '',
      rep.withDiag ? `\n--- Infos techniques ---\nVersion ${d.version} · page ${d.page}\nÉcran ${d.screen} · appli installée : ${d.standalone ? 'oui' : 'non'}\n${d.device}${(d.errors || []).length ? '\nErreurs récentes :\n' + d.errors.map(e => `- ${e.at.slice(0, 16)} ${e.msg} (${e.src} ${e.page})`).join('\n') : ''}` : ''].join('\n');
  }
  function report(type = 'bug') {
    const email = Store.state.club.reportEmail || '';
    modal({ title: 'Signaler ou proposer', body: `
      <div class="chips" id="repType">${Object.entries(TYPES).map(([k, [e, l]]) => `<button class="chip ${k === type ? 'on' : ''}" data-v="${k}">${e} ${l}</button>`).join('')}</div>
      <label class="fld" style="margin-top:12px"><span>Explique en quelques mots</span><textarea id="repText" rows="5" placeholder="ex : quand je touche « Jouer », les joueurs ne bougent pas"></textarea></label>
      <label class="fld"><span>Ce que tu faisais juste avant (facultatif)</span><input id="repCtx" placeholder="ex : j'étais sur le schéma de la séance U13"></label>
      <label class="switch"><input type="checkbox" id="repDiag" checked><span>Joindre les infos techniques (version, appareil, erreurs)</span></label>
      <p class="tip">${email ? `Le message part vers <b>${esc(email)}</b>. Tu peux aussi l'envoyer par WhatsApp ou SMS avec « Partager ».` : "Le responsable n'a pas encore indiqué d'e-mail dans Réglages : envoie le message avec « Partager » (WhatsApp, SMS…). Il est aussi gardé dans l'appli."}</p>`,
      onOpen: r => $$('#repType .chip', r).forEach(b => b.onclick = () => { $$('#repType .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); }),
      actions: [
        { label: 'Partager', icon: I.share, onClick: (c, r) => send(r, 'share') },
        { label: email ? 'Envoyer par e-mail' : 'Enregistrer', kind: 'primary', icon: email ? I.upload : I.check, onClick: (c, r) => send(r, email ? 'mail' : 'save') },
      ] });
  }
  function send(r, how) {
    const text = $('#repText', r).value.trim();
    if (!text) { toast('Écris d\'abord ton message', 'err'); return false; }
    const u = Auth.current();
    const rep = { id: Store.uid(), type: $('#repType .on', r).dataset.v, text, context: $('#repCtx', r).value.trim(), withDiag: $('#repDiag', r).checked, diag: diagnostics(),
      at: Date.now(), by: u ? u.id : null, byName: u ? Store.fullName(u) : '', status: 'new' };
    Store.upsert('reports', rep);
    const body = textOf(rep), subject = `[Raincy Coach] ${TYPES[rep.type][1]} de ${rep.byName || 'un éducateur'}`;
    if (how === 'mail') location.href = `mailto:${encodeURIComponent(Store.state.club.reportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
    else if (how === 'share') {
      if (navigator.share) navigator.share({ title: subject, text: body }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(body).then(() => toast('Message copié : colle-le dans WhatsApp ou un mail')).catch(() => {});
    }
    toast('Merci ! Ton message est enregistré');
  }

  /* ---------- settings: report e-mail + received reports ---------- */
  function settingsSection() {
    const c = Store.state.club, admin = Auth.isAdmin(), reps = Store.state.reports.slice().sort((a, b) => b.at - a.at);
    return `<section class="card"><h2>${I.help}Aide et signalements</h2>
      <div class="chips"><button class="btn" data-help="tour">${I.help}<span>Revoir le guide</span></button>
      <button class="btn" data-help="bug">🐞<span>Signaler un problème</span></button><button class="btn" data-help="idea">💡<span>Proposer une idée</span></button></div>
      ${admin ? `<label class="fld" style="margin-top:14px"><span>E-mail qui reçoit les signalements des éducateurs</span><input id="repEmail" type="email" inputmode="email" value="${esc(c.reportEmail || '')}" placeholder="ton.adresse@exemple.fr"></label>
        <p class="muted small">Cet e-mail est transmis aux autres éducateurs avec « Envoyer toutes mes données ». Les messages enregistrés sur leur appareil te reviennent aussi quand ils t'envoient leurs données.</p>
        <h3 class="sub-h">Messages reçus (${reps.length})</h3>
        ${reps.length ? `<div class="rep-list">${reps.map(x => `<details class="rep ${x.status === 'done' ? 'done' : ''}"><summary><span>${TYPES[x.type][0]}</span><b>${esc(x.text.slice(0, 70))}${x.text.length > 70 ? '…' : ''}</b><span class="muted small">${esc(x.byName || '?')} · ${new Date(x.at).toLocaleDateString('fr-FR')}</span></summary>
          <pre>${esc(textOf(x))}</pre><button class="btn" data-repdone="${x.id}">${x.status === 'done' ? 'Marquer à traiter' : 'Marquer comme traité'}</button></details>`).join('')}</div>` : '<p class="muted">Aucun message pour l\'instant.</p>'}` : ''}
    </section>`;
  }
  function onSettings(root, rerender) {
    const inp = $('#repEmail', root); if (inp) inp.onchange = () => { Store.state.club.reportEmail = inp.value.trim(); Store.save(); toast('E-mail enregistré'); };
    $$('[data-help]', root).forEach(b => b.onclick = e => { e.stopPropagation(); b.dataset.help === 'tour' ? tour() : report(b.dataset.help); });
    $$('[data-repdone]', root).forEach(b => b.onclick = e => { e.stopPropagation(); const x = Store.get('reports', b.dataset.repdone); x.status = x.status === 'done' ? 'new' : 'done'; Store.upsert('reports', x); rerender(); });
  }

  return { watch, tour, tourSeen, open, button, report, settingsSection, onSettings, VERSION };
})();
Help.watch();
