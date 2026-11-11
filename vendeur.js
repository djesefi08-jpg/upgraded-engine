// ---- Connexion obligatoire avant d'entrer dans la boutique, rayons (Motos, Téléphones, Accessoires),
// ---- menu des catégories pour le vendeur et boutons « Valider » / « Marquer comme livrée » ----
(function () {
  var RAYONS = [
    { cat: "Motos", icon: "🏍️", label: "Motos" },
    { cat: "Téléphones portables", icon: "📱", label: "Téléphones" },
    { cat: "Accessoires de téléphones", icon: "🎧", label: "Accessoires" }
  ];

  // ---- Page d'accueil : trois grandes cases « rayons » sous la barre de recherche ----
  var _home = home;
  home = function () {
    _home();
    var f = document.querySelector(".filters");
    if (!f) return;
    var tiles = document.createElement("div");
    tiles.id = "rayons";
    tiles.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 16px";
    tiles.innerHTML = RAYONS.map(function (r) {
      var on = F.cat === r.cat;
      return '<a href="#" data-rayon="' + esc(r.cat) + '" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;border:2px solid ' + (on ? "var(--acc)" : "var(--line)") +
        ';border-radius:14px;background:var(--card);color:var(--ink);text-decoration:none;' + (on ? "box-shadow:inset 0 0 0 2px var(--acc);" : "") + '">' +
        '<span style="font-size:2rem;line-height:1">' + r.icon + '</span><span style="font-weight:700;font-size:.8rem;text-align:center">' + r.label + '</span></a>';
    }).join("");
    f.after(tiles);
    if (F.cat) {
      // Un rayon est ouvert : on cache le logo et les nouveautés pour voir tout de suite les produits
      [".hero", "#app > h1", "#news"].forEach(function (sel) { var el = document.querySelector(sel); if (el) el.style.display = "none"; });
      var g = document.querySelector("#grid");
      if (g && !S.products.some(function (p) { return p.cat === F.cat; })) {
        g.innerHTML = '<p class="empty" style="grid-column:1/-1">Bientôt disponible : les produits de ce rayon arrivent. Revenez vite !</p>';
      }
    }
  };
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest("[data-rayon]");
    if (!a) return;
    ev.preventDefault();
    var c = a.getAttribute("data-rayon");
    F = F.cat === c ? { q: "", cat: "", min: "", max: "" } : { q: "", cat: c, min: "", max: "" };
    render();
    window.scrollTo(0, 0);
  });

  // ---- Porte d'entrée : le client doit se connecter ou créer son compte avant de voir la boutique ----
  var KEY = "stephy_client_token", LIBRES = ["compte", "connexion", "vendeur"];
  function connecte() { try { return !!localStorage.getItem(KEY); } catch (e) { return true; } }
  var _render = render;
  render = function () {
    var h = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (!connecte() && LIBRES.indexOf(h) < 0) { location.hash = "#/compte"; return; } // la page « Mon compte » s'affiche à la place
    _render();
    var t = document.querySelector("#app > h1");
    if (!connecte() && h !== "vendeur" && t && t.textContent === "Mon compte" && !document.getElementById("gate-note")) {
      t.insertAdjacentHTML("afterend", '<p id="gate-note" class="muted">👋 Bienvenue ! Connectez-vous ou créez votre compte pour accéder à la boutique.</p>');
    }
  };

  // ---- Espace vendeur : la catégorie d'un produit se choisit dans une liste ----
  function upgradeForm() {
    var inp = document.querySelector('#pf input[name="cat"]');
    if (!inp || inp.getAttribute("data-up")) return;
    var cur = inp.value, list = RAYONS.map(function (r) { return r.cat; });
    S.products.forEach(function (p) { if (list.indexOf(p.cat) < 0) list.push(p.cat); });
    if (cur && list.indexOf(cur) < 0) list.push(cur);
    var sel = document.createElement("select");
    sel.name = "cat"; sel.required = true; sel.setAttribute("data-up", "1");
    sel.innerHTML = '<option value="">Choisir une catégorie…</option>' +
      list.map(function (c) { return '<option' + (c === cur ? " selected" : "") + '>' + esc(c) + '</option>'; }).join("") +
      '<option value="__autre">➕ Autre catégorie…</option>';
    sel.onchange = function () {
      if (sel.value === "__autre") {
        var n = (prompt("Nom de la nouvelle catégorie ?") || "").trim();
        if (n) { var o = document.createElement("option"); o.textContent = n; sel.insertBefore(o, sel.lastChild); sel.value = n; }
        else sel.value = "";
      }
      var em = document.querySelector('#pf input[name="emoji"]'), r = RAYONS.filter(function (x) { return x.cat === sel.value; })[0];
      if (em && r && !em.value) em.value = r.icon; // l'icône du rayon est proposée si tu n'as pas mis de photo
    };
    inp.replaceWith(sel);
  }

  // ---- Espace vendeur, onglet « Commandes » : boutons « Valider » puis « Marquer comme livrée » ----
  function enhanceOrders() {
    Array.prototype.forEach.call(document.querySelectorAll("#app .row"), function (row) {
      var st = row.querySelector("strong");
      var m = st && /n°\s*([A-Za-z0-9]+)/.exec(st.textContent);
      if (!m || row.querySelector("[data-step],.step-done")) return;
      var tag = row.querySelector(".tag"), s = tag ? tag.textContent : "";
      var box = document.createElement("div");
      box.className = "actions";
      box.style.marginTop = "8px";
      if (/livrée/.test(s)) {
        box.innerHTML = '<span class="tag step-done">✅ Commande livrée</span>';
      } else {
        if (!/validée/.test(s)) box.innerHTML += '<button class="btn sm" data-step="validee" data-oid="' + m[1] + '">✅ Valider la commande</button>';
        box.innerHTML += '<button class="btn alt sm" data-step="livree" data-oid="' + m[1] + '">📦 Marquer comme livrée</button>';
      }
      row.appendChild(box);
    });
  }
  var _vendor = vendor;
  vendor = async function (tab) {
    await _vendor(tab);
    if (!TOKEN) return;
    upgradeForm();
    if (tab === "commandes") enhanceOrders();
  };
  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("[data-step]");
    if (!b) return;
    var step = b.getAttribute("data-step");
    if (step === "livree" && !confirm("Confirmer que cette commande a été livrée au client ?")) return;
    b.disabled = true;
    try {
      await api("/api/orders/" + b.getAttribute("data-oid") + "/step", "POST", { step: step });
      toast(step === "livree" ? "Commande marquée comme livrée" : "Commande validée");
      vendor("commandes");
    } catch (err) { toast(err.message); b.disabled = false; }
  });
})();