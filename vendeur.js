// ---- Espace vendeur, onglet « Commandes » : boutons « Valider » puis « Marquer comme livrée » ----
(function () {
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
    if (TOKEN && tab === "commandes") enhanceOrders();
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