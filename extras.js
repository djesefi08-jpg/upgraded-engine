(function () {
  // ---- Lien « Contact » dans le menu ----
  var nav = document.querySelector(".nav");
  if (nav) { var link = document.createElement("a"); link.href = "#/contact"; link.textContent = "Contact"; nav.appendChild(link); }

  // ---- Classement du catalogue par catégorie (ordre alphabétique, produits de A à Z) ----
  var _grid = grid;
  grid = function (list) {
    if (!list.length) return _grid(list);
    var groups = {};
    list.forEach(function (p) { var c = p.cat || "Autres"; (groups[c] = groups[c] || []).push(p); });
    return Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, "fr"); }).map(function (c) {
      var items = groups[c].slice().sort(function (a, b) { return a.name.localeCompare(b.name, "fr"); });
      return '<h2 style="grid-column:1/-1;margin:.9em 0 .1em;font-size:1.3rem;border-bottom:2px solid var(--sun);padding-bottom:4px">' + esc(c) +
        ' <span class="muted" style="font-weight:400;font-size:.9rem">(' + items.length + ')</span></h2>' + _grid(items);
    }).join("");
  };

  // ---- Section « Nouveautés » sur la page d’accueil (4 derniers produits) ----
  var _home = home;
  home = function () {
    _home();
    var f = document.querySelector(".filters");
    if (!f || S.products.length <= 4) return;
    var latest = S.products.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 4);
    var s = document.createElement("section");
    s.id = "news";
    s.innerHTML = '<h2 style="margin:.2em 0 .6em;font-size:1.4rem">Nouveautés</h2><div class="grid">' + _grid(latest) + '</div><h2 style="margin:1.4em 0 .6em;font-size:1.4rem">Tous les produits</h2>';
    f.before(s);
  };

  // ---- Page « Contact » : formulaire pour écrire au vendeur ----
  function contactPage() {
    $("#app").innerHTML = '<h1>Contact</h1><p class="muted">Écrivez-nous, nous vous répondons dès que possible.</p>' +
      '<form class="f" id="mf">' +
      '<label>Votre nom<input name="nom" required maxlength="100" autocomplete="name"></label>' +
      '<label>Téléphone ou e-mail (pour vous répondre)<input name="contact" required maxlength="120"></label>' +
      '<label>Message<textarea name="message" rows="5" required maxlength="2000"></textarea></label>' +
      '<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">' +
      '<button class="btn" type="submit">Envoyer le message</button></form>';
    $("#mf").addEventListener("submit", async function (e) {
      e.preventDefault();
      var f = new FormData(e.target), btn = e.target.querySelector("button");
      btn.disabled = true;
      try {
        await api("/api/messages", "POST", { nom: f.get("nom"), contact: f.get("contact"), message: f.get("message"), website: f.get("website") });
        $("#app").innerHTML = '<div class="ok"><h1>Message envoyé</h1><p>Merci ! Nous vous répondrons dès que possible.</p><a class="btn" href="#/">Retour à la boutique</a></div>';
      } catch (err) { toast(err.message); btn.disabled = false; }
    });
  }
  var _render = render;
  render = function () {
    var h = location.hash.replace(/^#\/?/, "").split("/");
    if (h[0] === "contact") { document.querySelector("#cnt").textContent = count(); contactPage(); }
    else _render();
  };

  // ---- Espace vendeur : onglet « Messages » (réservé au vendeur connecté) ----
  function contactLink(c) {
    var v = String(c).trim();
    if (v.indexOf("@") > -1) return '<a href="mailto:' + esc(v) + '">' + esc(v) + '</a>';
    var d = v.replace(/[^0-9+]/g, "");
    return d.length >= 6 ? '<a href="tel:' + esc(d) + '">' + esc(v) + '</a>' : esc(v);
  }
  function msgCard(m) {
    return '<div class="row" style="display:block"><strong>' + esc(m.nom) + '</strong> ' + (m.read ? "" : '<span class="tag">Nouveau</span>') +
      '<br><span class="muted">' + new Date(m.date).toLocaleString("fr-FR") + '</span><br>' + contactLink(m.contact) +
      '<p style="white-space:pre-wrap;margin:.6em 0">' + esc(m.message) + '</p>' +
      '<div class="actions"><button class="btn alt sm" data-mread="' + m.id + '" data-to="' + (m.read ? "0" : "1") + '">' + (m.read ? "Marquer non lu" : "Marquer comme lu") + '</button>' +
      '<button class="btn del sm" data-mdel="' + m.id + '">Supprimer</button></div></div>';
  }
  async function messagesPage() {
    var list = [];
    try { list = await api("/api/messages"); } catch (err) { TOKEN = ""; toast("Session expirée"); return vendor(); }
    var unread = list.filter(function (m) { return !m.read; }).length;
    var tabs = '<div class="tabs"><button class="btn alt" data-tab="produits">Produits (' + S.products.length + ')</button>' +
      '<button class="btn alt" data-tab="commandes">Commandes</button>' +
      '<button class="btn" data-tab="messages">Messages' + (unread ? " (" + unread + ")" : "") + '</button></div>';
    $("#app").innerHTML = '<h1>Messages</h1>' + tabs + (list.length ? list.map(msgCard).join("") : '<p class="empty">Aucun message pour l’instant.</p>');
  }
  function addMsgTab() {
    var t = document.querySelector(".tabs");
    if (!t || t.querySelector("[data-tab=messages]")) return;
    var b = document.createElement("button");
    b.className = "btn alt"; b.setAttribute("data-tab", "messages"); b.textContent = "Messages";
    t.appendChild(b);
    api("/api/messages").then(function (l) {
      var n = l.filter(function (m) { return !m.read; }).length;
      b.textContent = "Messages" + (n ? " (" + n + ")" : "");
    }).catch(function () {});
  }
  var _vendor = vendor;
  vendor = async function (tab) {
    if (tab === "messages" && TOKEN) return messagesPage();
    await _vendor(tab);
    if (TOKEN) addMsgTab();
  };
  document.addEventListener("click", async function (ev) {
    var t = ev.target.closest("[data-mread],[data-mdel]");
    if (!t) return;
    try {
      if (t.dataset.mread) await api("/api/messages/" + t.dataset.mread + "/read", "PUT", { read: t.dataset.to === "1" });
      else if (confirm("Supprimer ce message ?")) await api("/api/messages/" + t.dataset.mdel, "DELETE");
      else return;
      messagesPage();
    } catch (err) { toast(err.message); }
  });
})();