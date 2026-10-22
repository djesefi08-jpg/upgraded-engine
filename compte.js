// ---- Menu du bas, compte client (inscription, connexion, mot de passe oublié, mes commandes) et bouton « Installer » ----
(function () {
  var KEY = "stephy_client_token", token = "", me = null, deferred = null, mode = "in";
  try { token = localStorage.getItem(KEY) || ""; } catch (e) {}
  function save(t) {
    token = t || "";
    try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (e) {}
  }
  async function capi(url, method, body) {
    var r = await fetch(url, { method: method || "GET", headers: { "Content-Type": "application/json", "X-Client-Token": token }, body: body ? JSON.stringify(body) : undefined });
    var d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error(d.error || "Erreur serveur"); err.status = r.status; throw err; }
    return d;
  }

  // La commande envoie le jeton du client pour être rattachée à son compte
  var _api = api;
  api = function (url, method, body) {
    if (url === "/api/checkout" && token && body) body = Object.assign({}, body, { ct: token });
    return _api(url, method, body);
  };

  // ---- Menu propre : barre du bas façon application (Accueil, Panier, Contact, Compte) ----
  var st = document.createElement("style");
  st.textContent =
    ".nav{display:none!important}" +
    "body{padding-bottom:84px}" +
    ".toast{bottom:96px!important}" +
    "header,header *,#tabbar,#tabbar *,.btn{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}" +
    "#tabbar{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;background:var(--card);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom,0px)}" +
    "#tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px 6px;text-decoration:none;color:var(--mute);font-size:.72rem;font-weight:600;position:relative}" +
    "#tabbar a.on{color:var(--acc)}" +
    "#tabbar svg{width:24px;height:24px;fill:currentColor}" +
    "#tabbar .bdg{position:absolute;top:2px;left:calc(50% + 6px);min-width:18px;height:18px;border-radius:9px;background:var(--acc);color:var(--acc-ink);font-size:.7rem;align-items:center;justify-content:center;padding:0 4px;display:none}";
  document.head.appendChild(st);
  var ICON = {
    home: '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>',
    cart: '<path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>',
    chat: '<path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>',
    user: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    inst: '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>'
  };
  function tab(href, k, label) { return '<a href="' + href + '" data-k="' + k + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg><span>' + label + '</span></a>'; }
  var bar = document.createElement("div");
  bar.id = "tabbar";
  bar.innerHTML = tab("#/", "home", "Accueil") + tab("#/panier", "cart", "Panier") + tab("#/contact", "chat", "Contact") + tab("#/compte", "user", "Compte");
  document.body.appendChild(bar);
  var accLabel = bar.querySelector('[data-k="user"] span');
  var bdg = document.createElement("b");
  bdg.className = "bdg";
  bar.querySelector('[data-k="cart"]').appendChild(bdg);
  function syncTabs() {
    var h = location.hash.replace(/^#\/?/, "").split("/")[0];
    var k = h === "" || h === "p" || h === "ok" ? "home" : h === "panier" || h === "commande" ? "cart" : h === "contact" ? "chat" : h === "compte" || h === "connexion" ? "user" : "";
    Array.prototype.forEach.call(bar.querySelectorAll("a"), function (a) { a.classList.toggle("on", a.getAttribute("data-k") === k); });
    var n = count();
    bdg.textContent = n; bdg.style.display = n ? "flex" : "none";
  }
  function refreshNav() { if (accLabel) accLabel.textContent = me ? String(me.nom).split(" ")[0] : "Compte"; }
  refreshNav();
  // « Espace vendeur » : lien discret en bas de page (il n'est plus dans le menu des clients)
  var ft = document.querySelector("footer");
  if (ft) ft.insertAdjacentHTML("beforeend", '<p style="font-size:.85rem;margin-top:6px"><a href="#/vendeur" style="color:var(--mute);font-weight:400">Espace vendeur</a></p>');
  if (token) {
    capi("/api/me").then(function (u) { me = u; refreshNav(); })
      .catch(function (e) { if (e.status === 401) { save(""); refreshNav(); } });
  }

  syncTabs();

  // Page « Mon compte » : connexion, création de compte, mot de passe oublié
  function accountPage() {
    if (me) return profilePage();
    if (mode === "forgot") return forgotPage();
    var up = mode === "up";
    $("#app").innerHTML = '<h1>Mon compte</h1>' +
      '<div class="tabs"><button class="btn' + (up ? " alt" : "") + '" id="t-in">Connexion</button><button class="btn' + (up ? "" : " alt") + '" id="t-up">Créer un compte</button></div>' +
      '<form class="f" id="af">' +
      (up ? '<label>Nom complet<input name="nom" required maxlength="100" autocomplete="name"></label>' : "") +
      '<label>Téléphone ou e-mail<input name="ident" required maxlength="120" autocomplete="username"></label>' +
      '<label>Mot de passe' + (up ? " (6 caractères minimum)" : "") + '<input name="password" type="password" required autocomplete="' + (up ? "new-password" : "current-password") + '"></label>' +
      '<button class="btn" type="submit">' + (up ? "Créer mon compte" : "Se connecter") + '</button></form>' +
      (up ? '<p class="muted">Votre compte garde l’historique de vos commandes.</p>'
          : '<p><a href="#" id="fg">Mot de passe oublié ?</a></p><p class="muted">Pas encore de compte ? Appuyez sur « Créer un compte ».</p>');
    $("#t-in").onclick = function () { mode = "in"; accountPage(); };
    $("#t-up").onclick = function () { mode = "up"; accountPage(); };
    if ($("#fg")) $("#fg").onclick = function (e) { e.preventDefault(); mode = "forgot"; accountPage(); };
    $("#af").addEventListener("submit", async function (e) {
      e.preventDefault();
      var f = new FormData(e.target), btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        var d = await capi(up ? "/api/register" : "/api/client-login", "POST", { nom: f.get("nom"), ident: f.get("ident"), password: f.get("password") });
        save(d.token); me = d.user; refreshNav(); accountPage();
      } catch (err) { toast(err.message); btn.disabled = false; }
    });
  }

  // Mot de passe oublié : le client envoie une demande, le vendeur lui donne un mot de passe temporaire
  function forgotPage() {
    $("#app").innerHTML = '<h1>Mot de passe oublié</h1>' +
      '<p class="muted">Entrez le téléphone ou l’e-mail de votre compte. Le vendeur vous contactera pour vous donner un mot de passe temporaire.</p>' +
      '<form class="f" id="ff"><label>Téléphone ou e-mail<input name="ident" required maxlength="120" autocomplete="username"></label>' +
      '<button class="btn" type="submit">Envoyer la demande</button></form>' +
      '<p><a href="#" id="bk">Retour à la connexion</a></p>';
    $("#bk").onclick = function (e) { e.preventDefault(); mode = "in"; accountPage(); };
    $("#ff").addEventListener("submit", async function (e) {
      e.preventDefault();
      var ident = new FormData(e.target).get("ident"), btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await capi("/api/forgot", "POST", { ident: ident });
        var wa = document.querySelector('footer a[href*="wa.me"]');
        var link = wa ? '<p><a class="btn" target="_blank" rel="noopener" href="' + esc(wa.getAttribute("href").split("?")[0]) + '?text=' +
          encodeURIComponent("Bonjour, j’ai oublié mon mot de passe. Mon compte : " + ident) + '">Écrire au vendeur sur WhatsApp</a></p>' : "";
        $("#app").innerHTML = '<div class="ok"><h1>Demande envoyée</h1><p>Le vendeur va vous contacter pour vous donner un mot de passe temporaire. Vous pourrez ensuite le changer dans « Mon compte ».</p>' + link +
          '<p><a class="btn alt" href="#/" >Retour à la boutique</a></p></div>';
        mode = "in";
      } catch (err) { toast(err.message); btn.disabled = false; }
    });
  }

  async function profilePage() {
    $("#app").innerHTML = '<h1>Bonjour ' + esc(me.nom) + '</h1><p class="muted">' + esc(me.ident) + '</p>' +
      (me.mustChange ? '<p><span class="tag">Mot de passe temporaire</span> Changez-le dans la section « Mot de passe » ci-dessous.</p>' : "") +
      '<div class="actions"><a class="btn" href="#/">Continuer mes achats</a><button class="btn alt" id="lo">Se déconnecter</button></div>' +
      '<h2 style="margin-top:1.4em">Mes commandes</h2><div id="mo"><p class="muted">Chargement…</p></div>' +
      '<h2 style="margin-top:1.4em">Mot de passe</h2>' +
      '<form class="f" id="cp"><label>Mot de passe actuel<input name="old" type="password" required autocomplete="current-password"></label>' +
      '<label>Nouveau mot de passe (6 caractères minimum)<input name="next" type="password" required autocomplete="new-password"></label>' +
      '<button class="btn alt" type="submit">Changer mon mot de passe</button></form>';
    $("#lo").onclick = function () { save(""); me = null; refreshNav(); location.hash = "#/"; };
    $("#cp").addEventListener("submit", async function (e) {
      e.preventDefault();
      var f = new FormData(e.target), btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        var d = await capi("/api/change-password", "POST", { old: f.get("old"), next: f.get("next") });
        save(d.token); me = d.user; toast("Mot de passe changé"); profilePage();
      } catch (err) { toast(err.message); btn.disabled = false; }
    });
    try {
      var list = await capi("/api/my-orders");
      $("#mo").innerHTML = list.length ? list.map(function (o) {
        return '<div class="row" style="display:block"><strong>n° ' + esc(o.id) + '</strong> <span class="tag">' + esc(o.status) + '</span><br>' +
          '<span class="muted">' + new Date(o.date).toLocaleString("fr-FR") + '</span><ul>' +
          o.items.map(function (i) { return '<li>' + i.q + ' × ' + esc(i.name) + '</li>'; }).join("") + '</ul><strong>' + eur(o.total) + '</strong></div>';
      }).join("") : '<p class="empty">Aucune commande pour l’instant.</p>';
    } catch (err) {
      if (err.status === 401) { save(""); me = null; refreshNav(); accountPage(); }
      else $("#mo").innerHTML = '<p class="muted">Impossible de charger vos commandes.</p>';
    }
  }

  // Page de paiement : nom et téléphone pré-remplis si le client est connecté, sinon invitation à se connecter
  function afterPay() {
    var f = document.getElementById("pf2");
    if (!f) return;
    if (me) {
      if (f.elements["nom"] && !f.elements["nom"].value) f.elements["nom"].value = me.nom;
      if (f.elements["tel"] && !f.elements["tel"].value && me.tel) f.elements["tel"].value = me.tel;
    } else {
      f.insertAdjacentHTML("beforebegin", '<p class="muted">Déjà client ? <a href="#/compte">Connectez-vous</a> pour suivre vos commandes.</p>');
    }
  }
  var _render = render;
  render = function () {
    var h = location.hash.replace(/^#\/?/, "").split("/");
    if (h[0] === "compte" || h[0] === "connexion") { accountPage(); }
    else { _render(); if (h[0] === "commande") afterPay(); }
    syncTabs();
  };

  // ---- Espace vendeur : onglet « Clients » (comptes et mots de passe temporaires) ----
  function clientCard(u) {
    return '<div class="row" style="display:block"><strong>' + esc(u.nom) + '</strong> ' + (u.resetRequested ? '<span class="tag">Mot de passe oublié</span>' : "") +
      '<br><span class="muted">' + esc(u.ident) + ' · inscrit le ' + new Date(u.date).toLocaleDateString("fr-FR") + '</span>' +
      '<div class="actions" style="margin-top:8px"><button class="btn alt sm" data-reset="' + esc(u.id) + '">Générer un mot de passe temporaire</button></div><div class="tmp"></div></div>';
  }
  async function clientsPage() {
    var list = [];
    try { list = await api("/api/users"); } catch (err) { TOKEN = ""; toast("Session expirée"); return vendor(); }
    var pend = list.filter(function (u) { return u.resetRequested; }).length;
    var tabs = '<div class="tabs"><button class="btn alt" data-tab="produits">Produits</button><button class="btn alt" data-tab="commandes">Commandes</button>' +
      '<button class="btn alt" data-tab="messages">Messages</button><button class="btn" data-tab="clients">Clients' + (pend ? " (" + pend + ")" : "") + '</button></div>';
    $("#app").innerHTML = '<h1>Clients</h1>' + tabs +
      '<p class="muted">Quand un client a oublié son mot de passe, vérifiez son identité (appel ou WhatsApp), puis générez-lui un mot de passe temporaire et envoyez-le-lui.</p>' +
      (list.length ? list.map(clientCard).join("") : '<p class="empty">Aucun compte client pour l’instant.</p>');
  }
  function addClientsTab() {
    var t = document.querySelector(".tabs");
    if (!t || t.querySelector("[data-tab=clients]")) return;
    var b = document.createElement("button");
    b.className = "btn alt"; b.setAttribute("data-tab", "clients"); b.textContent = "Clients";
    t.appendChild(b);
    api("/api/users").then(function (l) {
      var n = l.filter(function (u) { return u.resetRequested; }).length;
      b.textContent = "Clients" + (n ? " (" + n + ")" : "");
    }).catch(function () {});
  }
  var _vendor = vendor;
  vendor = async function (tab) {
    if (tab === "clients" && TOKEN) return clientsPage();
    await _vendor(tab);
    if (TOKEN) addClientsTab();
  };
  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("[data-reset]");
    if (!b) return;
    if (!confirm("Générer un nouveau mot de passe pour ce client ? L’ancien ne marchera plus.")) return;
    try {
      var d = await api("/api/users/" + b.getAttribute("data-reset") + "/reset", "POST", {});
      var msg = "Bonjour " + d.nom + ", votre mot de passe temporaire est : " + d.temp + " . Connectez-vous puis changez-le dans Mon compte.";
      var wa = d.mail ? "" : '<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/225' + esc(d.ident) + '?text=' + encodeURIComponent(msg) + '">Envoyer par WhatsApp</a>';
      b.closest(".row").querySelector(".tmp").innerHTML = '<p style="margin:.6em 0">Mot de passe temporaire : <strong style="font-size:1.2rem;letter-spacing:.05em">' + esc(d.temp) + '</strong></p>' +
        '<p class="muted">Envoyez-le au client : il ne sera plus affiché après.</p>' + wa;
      b.remove();
    } catch (err) { toast(err.message); }
  });

  // Bouton « Installer l’application » (apparaît dans la barre du bas quand Chrome permet l’installation)
  function addInstall() {
    if (document.getElementById("inst")) return;
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return;
    var a = document.createElement("a");
    a.id = "inst"; a.href = "#"; a.setAttribute("data-k", "inst");
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON.inst + '</svg><span>Installer</span>';
    a.onclick = async function (ev) {
      ev.preventDefault();
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) {}
      deferred = null; a.remove();
    };
    bar.appendChild(a);
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; addInstall(); });
  window.addEventListener("appinstalled", function () { deferred = null; var b = document.getElementById("inst"); if (b) b.remove(); });
})();