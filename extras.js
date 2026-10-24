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

  // Logos des moyens de paiement (petites images intégrées)
  var LOGOS = {
    "Orange Money": "data:image/webp;base64,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",
    "MTN Money": "data:image/webp;base64,UklGRuAEAABXRUJQVlA4INQEAABQGQCdASpUAFQAPm0wlUckIqIhKdop6IANiWoAy2UVfxA2c/n34veyBVn6h9+smv6W5wHmAfpr/heoj+QHsG/U//af2z3jfQr/hPUA/uP+k6wn0APLS/aP4Qf3A/bv2grv4/IcryftfjPKzvT2mt34yNxIcBn4N8YfoK6LN/9uT/j/QgSfdXfkYgxFlfhqmoT2LmSlQ9Hy9b1WLFL89w2YeqoMBFx8eCUPqTYpYCwpUSwKjdt79pXLjV4qovwr/JocSgrztcLV954H5TFZTan4onSgAP71oP08X8bT/G0/G097WKe/qAACFwr+m/IWBOqOJHWa2bopJPfJNHRrv4+19aqmpXJtBezW4t310B3Bwgnd+9XKEYog7LSyIxrPqUqPITPWPzJrKFaAs5OEVFYZgxvS3ST9/kWRO05S3K+gfvdK5xdSmVaIxf2joUBtVQ/Gzz3SMTCj6VrfhXcQhCt57cszhzNnCi7pDXhehXvSOt482tsy/3qb4LbN4ZtsPv9CjdAsN3yVPtuS2avm/NDr8x7JRuCG+oSkEAtnEx8dPcrAP9Q6bp0rYUzSo8Gv8r/8LDC+XgQal9sSmw6IxQYBoNoRjfw0DAWOhKucj/dKAUfDFPhIa1CCK7BeddoNt8BI9v1VNMNhNF1j9qBQJM2fWKvPgXPzx2ADVIq64vdtgtZQ+GxXpev6SelqmlzdAAGLZmHeHNUS4xofM/x07CyLzPeKy25x4VpJzvAQm1DoJbe6xut8Jnpn4PVnr3kBVh+Q/0SW6eZsWtowp+HrGglwU7NZ47zt3XtfPz4yXyq0grzPlidJ9hMnoCYzccujm9c/ZD4YUrDygbIY7257U5ye4+i9dujmIIShh/EmTS8s+h+jhwtQK02svuTYvlvnnUnW+eKOtn9LxprUf04wwSUKGJ93EX+W5fim0sHARXKfYn2k1Ic6pKluMnmubvWAnPbRvK9gS8s7QMZwmnzI494Ftey+7dCbqiI2ToutO7ulY48zwWCLxWf3Qw+apNtXP/SCpbL8btHiA+FUPlxzvXCHDL5PRCNnf/3xluX+nXegdhT2asDdHRUrEkKcSCSMbOwRrZMW7cGaOrNa1ul6FhNfqHMRRKvF2veFixkH64YvqPXRfOnIG9/mVD2trYzktvMHFP8WO7UvDq+fAvVkSa9RcHW1IbUFdsJ4pvMh3XSfqDyb8QbLjcDXOb5ovfbVA8CYnuL5thkmJ0v0nQ7vfL4l3D+Of4cixVEG/BL/BLVV/mwis/rFOAl4Q5zcDf2R/D+g/SGopDq9Uayov86vi3BtULTduhFzpAQXmnFiLbhWYZY61ceB3LUGBMuVZ1/uhM6LL2hDnNbZupfxC7p4QY4cwK7Aj5K0WcyD49/K+vVytBo5AgHUERzQFcPongwYVgurAyJGIUkGstbm2PQnhqY/z0CKCOgfdCMaPESq+JWexUsdFZdEQUxMX4647NYB3NWfrnPc/aew5MYn8pJd63hA7FK/2R/sVaFL3T26kwOd7Ekn0erKpi3goQ53zOkPEBGLP/D2xifXeXuhQs41Q/OivNrqZ9CjAz0AOQkVfqu+L8rXvO2WsUBFsbTUkQ2z18tta0/L1icWCxCHsmnzwAAQKjbi8dPJ8tADH96C61/2nlygAAA=",
    "Moov Money": "data:image/webp;base64,UklGRqoFAABXRUJQVlA4IJ4FAABwHQCdASpUAFQAPm0ulUakIiIhKrqqAIANiWwAzBBCeofkZ7Q1Xfon40/nmUV8xc4D7dPcA/TLpQ/yb0AfaB2CfQA/rXnHewB+xXsAdJF+2f7r+1h1AEylpV4C5gLAfSpzUPIf9W+wMrfSm7OVTSgWVXftBG3i81mo2+b6p1JC54VJ/+Oa7e4cLdBZvnmuXAz01TmewN1PJqydum2cPIUdxz3VytSMXv3vWFctsTO52rPcmS9/YgCDQxpnKC8Nk+v/88yWMaC82tDmhYtMdRTajR0ssImziPweZOgdSyxkYwwrXjoVPnYj5cNpsczI/83nLCAAAP7+EQsmhIXAscKSX+wMFhMEDsKrY3+lhSQc5edp2jWBeD5bdwaRtCr7t8hL/BbG0BbuAV3/Sxhn164zYvzEWgxBCmGHCM0r6DgpiWcGMyBKwclLPbwIIZB2jW4I1K1a0QjjS2GWqNejV06o3g2Xkbh7vg1Ci7+X4aaHLxZZRATb0ktTc5UR72xhQVxzZtyDU/oYbUNJxp/+nbFHeHNlcO68+ftKM8XPcGH/894sztkLIf9686F/kjJJ/LT6Vn9Uwwpt4QvuVbTrM7IEr8saI8GzaK4IFD6FCZWxg/MP32u/TxcZ/dol4fo97CWab62Hpka343pEZa/h4cvrs4mjkfyNRlvAaPQi+0ABYID57e++7+Sb3O0LNe3R/mHjXzbBDe6E3GlMY7d7Sv3rdDMXfbDFrQP72K4OVZGMyoEbbIK84TMEe9Y07rZPcNLb1G5maaJF8mgj5Q99+J0RyUBhM3CNlD3p0Vrk7+aZ1FapHG5iRXDBhQKiV7feDYZTjoydOy7ZXFE8TZv+qgaRM77txTNLH/nPjoqtYwllHk2kjudu8Ij9SkSENZRWMARcIr7Tb5R5EYMdT4iws2cRaa8mLstQ9d7lizi7uO29zvI2OGEQT8ndP+u1rJh5r3AqdV/kttqnVDpFb+l4cTtf+nBxGkqnqiwAisjQoCR5Xk/4ugHbnU5lIyL75tNvJYR/kfooeSgmM1fYG2mHbOVYfOY6fLSUO4H6Ox2spcAB8yg8BrshvBrY08jXUp4aEgz8jreHzXbqLXtjOcoBbbUQ0Pq075DMThS2QOYePrLNE9VUqk97pBbDRWOYwXB5S3NP8s64fCwtHVSS8L+DVUYZuFBXHPdRt5qzrgPSR18omu9YTdkdfBCaZLlDT9wycI5lH+cO+ltPrLfs+HxPIyRcugrGe+/a3YKq+CMohHqZyQyQeec1/PXXRr68IY85hIs3jykWcBA2jNcMi7pb50bCiFoR62YWwiSJ6H9AHMgkhg0TruIsfxEcS+DOlNRVv1IiVvFHoMib8wuHIbyUu6OA+sEjFevCEnfWItu2TH//scAwV0jVe13pyVJpGsO3j5e/rb9Tn4jtA+vnDndGYC/BSf+XXFE2al+wCZoUN7UphoO/1+XVE6I655SifY2OMXOw8GU2yHNbDUmYzO0dpaa6Uuy/Ra0oaA0lEAuhjgRlwnYt1eDiKgSjXALfdJZGkkqBJrTR6kYu6NIl6E1dOJwmrm7u3U7YLZY2EMAFN/s8fu1xu9AVoMY7c4xlFb3ToznXW2TfZbRB3mRyoAkBaWKhefWfkraRtFagz2Y7jGYQBnCcDq9Z/9UZAYhJnMvNyA3ocVfTBjgrT/nzc2mXz8yQ6Eg4rh7yHdj04emjv7+FC5xapRNCP+F4IABQ+OXID/J97i3UYCgQgm448AxXPICJeL867yEqt9ea/KrGpdJjDrqKuML3JZ4zgk45QNt26wPqyQAjJWzWxG5USzLRgvCgkWfc+gWJvakWjbtJT+vndTZHrxc0JdQDsBlg7aVlvPWi9d1UMXSVdewTwpMAAAFEASeVmAgTTdoCo0Fy2/Va5gaSLkiSzfghRHS4AAAA",
    "Wave": "data:image/webp;base64,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"
  };

  // ---- Page « Paiement » : récapitulatif, livraison et choix du paiement (mobile money) ----
  function payPage() {
    if (!count()) { location.hash = "#/panier"; return; }
    var lines = cartItems().map(function (x) {
      return '<div class="row"><div class="grow"><strong>' + esc(x.p.name) + '</strong><div class="muted">' + x.q + ' × ' + eur(x.p.price) + '</div></div><strong>' + eur(x.p.price * x.q) + '</strong></div>';
    }).join("");
    var ops = ["Orange Money", "MTN Money", "Moov Money", "Wave"];
    var optsHtml = ops.map(function (o, i) {
      return '<label class="opt" aria-label="' + o + '"><input type="radio" name="op" value="' + o + '"' + (i === 0 ? " checked" : "") + '>' +
        '<img src="' + LOGOS[o] + '" alt="' + o + '" onerror="this.replaceWith(document.createTextNode(this.alt))"></label>';
    }).join("") + '<label class="opt cash"><input type="radio" name="op" value="livraison">💵 Payer à la livraison</label>';
    if (!document.getElementById("pay-css")) {
      var st = document.createElement("style");
      st.id = "pay-css";
      st.textContent = ".opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
        ".opt{position:relative;display:flex!important;align-items:center;justify-content:center;gap:8px;min-height:84px;padding:10px;border:2px solid var(--line);border-radius:14px;background:#fff;color:#1d2a3a;font-weight:700;font-size:1rem;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
        ".opt input{position:absolute;opacity:0;width:1px!important;height:1px;padding:0!important;pointer-events:none}" +
        ".opt img{max-height:60px;max-width:100%;object-fit:contain;display:block}" +
        ".opt.sel{border-color:var(--acc);box-shadow:inset 0 0 0 2px var(--acc)}" +
        ".opt.sel::after{content:'✓';position:absolute;top:4px;right:8px;color:var(--acc);font-weight:800}" +
        ".opt.cash{grid-column:1/-1;min-height:56px;background:var(--card);color:var(--ink)}";
      document.head.appendChild(st);
    }
    $("#app").innerHTML = '<h1>Paiement</h1><h2>Votre commande</h2>' + lines +
      '<div class="total"><span>Total à payer</span><span>' + eur(total()) + '</span></div>' +
      '<form class="f" id="pf2"><h2>Livraison</h2>' +
      '<label>Nom complet<input name="nom" required autocomplete="name"></label>' +
      '<label>Adresse de livraison<textarea name="adr" rows="3" required autocomplete="street-address"></textarea></label>' +
      '<label>Numéro de téléphone<input name="tel" type="tel" required autocomplete="tel" pattern="[0-9 +().-]{6,}"></label>' +
      '<h2>Mode de paiement</h2><div class="opts">' + optsHtml + '</div>' +
      '<p class="muted">Pour le mobile money, vous serez dirigé vers la page sécurisée de paiement pour valider avec votre code.</p>' +
      '<button class="btn" type="submit">Payer ' + eur(total()) + '</button></form>';
    var labels = $("#pf2").querySelectorAll(".opt");
    function syncOpts() { Array.prototype.forEach.call(labels, function (l) { l.classList.toggle("sel", l.querySelector("input").checked); }); }
    Array.prototype.forEach.call(labels, function (l) { l.querySelector("input").addEventListener("change", syncOpts); });
    syncOpts();
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

// ---- Pied de page : logos cliquables (E-mail, Appeler, WhatsApp, TikTok) à la place des mots ----
(function () {
  var PHONE = '<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>';
  var ICONS = {
    "E-mail": { bg: "#c9a45c", svg: '<path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>' },
    "Appeler": { bg: "#1b7f55", svg: PHONE },
    "WhatsApp": { bg: "#25D366", svg: '<path d="M12 3.2a8.8 8.8 0 0 0-7.5 13.4L3.2 20.8l4.3-1.2A8.8 8.8 0 1 0 12 3.2z" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/><g transform="translate(7.2 7.2) scale(.4)">' + PHONE + '</g>' },
    "TikTok": { bg: "#000000", svg: '<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>' }
  };
  var f = document.querySelector("footer");
  if (!f) return;
  var ps = f.querySelectorAll("p"), p = ps[ps.length - 1];
  if (!p) return;
  var anchors = Array.prototype.slice.call(p.querySelectorAll("a"));
  p.innerHTML = "";
  p.style.cssText = "display:flex;justify-content:center;gap:14px;flex-wrap:wrap";
  anchors.forEach(function (a) {
    var k = a.textContent.trim(), ic = ICONS[k];
    if (ic) {
      a.setAttribute("aria-label", k); a.setAttribute("title", k);
      a.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:" + ic.bg + ";text-decoration:none";
      a.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff" aria-hidden="true">' + ic.svg + '</svg>';
    }
    p.appendChild(a);
  });
})();
