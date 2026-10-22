// ---- Compte client : inscription, connexion, mot de passe oublié, mes commandes, bouton « Installer » ----
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

  // Lien « Connexion » / prénom du client dans le menu
  var nav = document.querySelector(".nav"), acc = null;
  if (nav) { acc = document.createElement("a"); acc.href = "#/compte"; nav.appendChild(acc); }
  function refreshNav() { if (acc) acc.textContent = me ? "👤 " + String(me.nom).split(" ")[0] : "Connexion"; }
  refreshNav();
  if (token) {
    capi("/api/me").then(function (u) { me = u; refreshNav(); })
      .catch(function (e) { if (e.status === 401) { save(""); refreshNav(); } });
  }

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
    if (h[0] === "compte" || h[0] === "connexion") { document.querySelector("#cnt").textContent = count(); accountPage(); return; }
    _render();
    if (h[0] === "commande") afterPay();
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

  // Bouton « Installer l’application » (apparaît dans le menu quand Chrome permet l’installation)
  function addInstall() {
    if (document.getElementById("inst") || !nav) return;
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return;
    var a = document.createElement("a");
    a.id = "inst"; a.href = "#"; a.textContent = "📲 Installer";
    a.onclick = async function (ev) {
      ev.preventDefault();
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) {}
      deferred = null; a.remove();
    };
    nav.appendChild(a);
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; addInstall(); });
  window.addEventListener("appinstalled", function () { deferred = null; var b = document.getElementById("inst"); if (b) b.remove(); });
})();