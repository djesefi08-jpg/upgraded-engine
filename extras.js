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

  // ---- Accueil : recherche tout en haut, filtres pliables, section « Nouveautés » ----
  var _home = home;
  home = function () {
    _home();
    var app = document.querySelector("#app"), f = document.querySelector(".filters"), g = document.querySelector("#grid");
    if (!app || !f || !g) return;
    // Barre de recherche au tout début de la page ; catégorie et prix dans un volet « Filtres »
    var det = document.createElement("details");
    det.style.cssText = "grid-column:1/-1";
    det.innerHTML = '<summary style="cursor:pointer;font-weight:600;padding:4px 0">Filtres : catégorie et prix</summary><div class="fbox" style="display:grid;gap:8px;margin-top:8px"></div>';
    var box = det.querySelector(".fbox");
    ["fc", "fmin", "fmax"].forEach(function (id) { var el = document.getElementById(id); if (el) box.appendChild(el); });
    f.appendChild(det);
    f.style.gridTemplateColumns = "1fr";
    app.prepend(f);
    // Section « Nouveautés » (4 derniers produits) juste avant le catalogue
    if (S.products.length > 4) {
      var latest = S.products.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 4);
      var s = document.createElement("section");
      s.id = "news";
      s.innerHTML = '<h2 style="margin:.2em 0 .6em;font-size:1.4rem">Nouveautés</h2><div class="grid">' + _grid(latest) + '</div><h2 style="margin:1.4em 0 .6em;font-size:1.4rem">Tous les produits</h2>';
      g.before(s);
    }
    // Pendant une recherche ou un filtre, on cache le logo et les nouveautés pour voir les résultats tout de suite
    function toggle() {
      var active = ["fq", "fc", "fmin", "fmax"].some(function (id) { var el = document.getElementById(id); return el && el.value; });
      var fc = document.getElementById("fc");
      det.open = !!(fc && (fc.value || document.getElementById("fmin").value || document.getElementById("fmax").value));
      [".hero", "#app > h1", "#news"].forEach(function (sel) { var el = document.querySelector(sel); if (el) el.style.display = active ? "none" : ""; });
    }
    ["fq", "fc", "fmin", "fmax"].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener("input", toggle); });
    toggle();
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

  // ---- Page « Paiement » : récapitulatif, livraison et choix du paiement (mobile money) ----
  function payPage() {
    if (!count()) { location.hash = "#/panier"; return; }
    var lines = cartItems().map(function (x) {
      return '<div class="row"><div class="grow"><strong>' + esc(x.p.name) + '</strong><div class="muted">' + x.q + ' × ' + eur(x.p.price) + '</div></div><strong>' + eur(x.p.price * x.q) + '</strong></div>';
    }).join("");
    var ops = [["Orange Money", "#ff7900"], ["MTN Money", "#f5b800"], ["Moov Money", "#0072bc"], ["Wave", "#1dc8ff"]];
    var optStyle = 'display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);font-size:1rem;font-weight:600';
    var radios = ops.map(function (o, i) {
      return '<label style="' + optStyle + '"><input type="radio" name="op" value="' + o[0] + '"' + (i === 0 ? " checked" : "") + ' style="width:auto;padding:0">' +
        '<span style="width:14px;height:14px;border-radius:50%;background:' + o[1] + ';display:inline-block"></span>' + o[0] + '</label>';
    }).join("");
    $("#app").innerHTML = '<h1>Paiement</h1><h2>Votre commande</h2>' + lines +
      '<div class="total"><span>Total à payer</span><span>' + eur(total()) + '</span></div>' +
      '<form class="f" id="pf2"><h2>Livraison</h2>' +
      '<label>Nom complet<input name="nom" required autocomplete="name"></label>' +
      '<label>Adresse de livraison<textarea name="adr" rows="3" required autocomplete="street-address"></textarea></label>' +
      '<label>Numéro de téléphone<input name="tel" type="tel" required autocomplete="tel" pattern="[0-9 +().-]{6,}"></label>' +
      '<h2>Mode de paiement</h2>' + radios +
      '<label style="' + optStyle + '"><input type="radio" name="op" value="livraison" style="width:auto;padding:0">Payer à la livraison</label>' +
      '<p class="muted">Pour le mobile money, vous serez dirigé vers la page sécurisée de paiement pour valider avec votre code.</p>' +
      '<button class="btn" type="submit">Payer ' + eur(total()) + '</button></form>';
    $("#pf2").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var f = new FormData(ev.target), btn = ev.target.querySelector("button[type=submit]");
      var op = f.get("op"), cash = op === "livraison";
      btn.disabled = true; btn.textContent = "Veuillez patienter…";
      try {
        var d = await api("/api/checkout", "POST", {
          nom: f.get("nom"), adr: f.get("adr"), tel: f.get("tel"),
          method: cash ? "livraison" : "mobile", operator: cash ? "" : op,
          items: Object.entries(S.cart).map(function (kv) { return { id: +kv[0], q: kv[1] }; })
        });
        if (d.url) location.href = d.url; else location.hash = "#/ok/" + d.id;
      } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = "Payer " + eur(total()); }
    });
  }
  var _render = render;
  render = function () {
    var h = location.hash.replace(/^#\/?/, "").split("/");
    if (h[0] === "contact") { document.querySelector("#cnt").textContent = count(); contactPage(); }
    else if (h[0] === "commande") { document.querySelector("#cnt").textContent = count(); payPage(); }
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