// ---- Compte client : inscription, connexion, déconnexion, mes commandes, bouton « Installer » ----
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

  // Page « Mon compte »
  function accountPage() {
    if (me) return profilePage();
    var up = mode === "up";
    $("#app").innerHTML = '<h1>Mon compte</h1>' +
      '<div class="tabs"><button class="btn' + (up ? " alt" : "") + '" id="t-in">Connexion</button><button class="btn' + (up ? "" : " alt") + '" id="t-up">Créer un compte</button></div>' +
      '<form class="f" id="af">' +
      (up ? '<label>Nom complet<input name="nom" required maxlength="100" autocomplete="name"></label>' : "") +
      '<label>Téléphone ou e-mail<input name="ident" required maxlength="120" autocomplete="username"></label>' +
      '<label>Mot de passe' + (up ? " (6 caractères minimum)" : "") + '<input name="password" type="password" required autocomplete="' + (up ? "new-password" : "current-password") + '"></label>' +
      '<button class="btn" type="submit">' + (up ? "Créer mon compte" : "Se connecter") + '</button></form>' +
      '<p class="muted">' + (up ? "Votre compte garde l’historique de vos commandes." : "Pas encore de compte ? Appuyez sur « Créer un compte ».") + '</p>';
    $("#t-in").onclick = function () { mode = "in"; accountPage(); };
    $("#t-up").onclick = function () { mode = "up"; accountPage(); };
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
  async function profilePage() {
    $("#app").innerHTML = '<h1>Bonjour ' + esc(me.nom) + '</h1><p class="muted">' + esc(me.ident) + '</p>' +
      '<div class="actions"><a class="btn" href="#/">Continuer mes achats</a><button class="btn alt" id="lo">Se déconnecter</button></div>' +
      '<h2 style="margin-top:1.4em">Mes commandes</h2><div id="mo"><p class="muted">Chargement…</p></div>';
    $("#lo").onclick = function () { save(""); me = null; refreshNav(); location.hash = "#/"; };
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
