
  // Mot de passe oublié : code par e-mail, puis nouveau mot de passe
  function forgotPage() {
    $("#app").innerHTML =
      '<h1>Mot de passe oublié</h1>' +
      '<p class="muted">Entrez l’adresse e-mail associée à votre compte pour recevoir un code de vérification.</p>' +
      '<form class="f" id="ff">' +
      '<label>Adresse e-mail<input name="ident" type="email" required maxlength="120" autocomplete="email"></label>' +
      '<button class="btn" type="submit">Envoyer le code</button></form>' +
      '<p><a href="#" id="bk">Retour à la connexion</a></p>';

    $("#bk").onclick = function (e) {
      e.preventDefault();
      mode = "in";
      accountPage();
    };

    $("#ff").addEventListener("submit", async function (e) {
      e.preventDefault();

      var f = new FormData(e.target);
      var ident = String(f.get("ident") || "").trim().toLowerCase();
      var btn = e.target.querySelector('button[type="submit"]');

      btn.disabled = true;

      try {
        await capi("/api/forgot", "POST", { ident: ident });

        $("#app").innerHTML =
          '<h1>Vérifier votre e-mail</h1>' +
          '<p class="muted">Si votre compte utilise cette adresse, vous recevrez un code valable 10 minutes.</p>' +
          '<form class="f" id="fr">' +
          '<label>Adresse e-mail<input name="ident" type="email" required readonly value="' + esc(ident) + '"></label>' +
          '<label>Code à 6 chiffres<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></label>' +
          '<label>Nouveau mot de passe<input name="password" type="password" minlength="6" maxlength="200" required autocomplete="new-password"></label>' +
          '<button class="btn" type="submit">Réinitialiser mon mot de passe</button>' +
          '</form>' +
          '<p><a href="#" id="bk2">Retour à la connexion</a></p>';

        $("#bk2").onclick = function (ev) {
          ev.preventDefault();
          mode = "in";
          accountPage();
        };

        $("#fr").addEventListener("submit", async function (ev) {
          ev.preventDefault();

          var rf = new FormData(ev.target);
          var submit = ev.target.querySelector('button[type="submit"]');

          submit.disabled = true;

          try {
            var result = await capi("/api/reset-password", "POST", {
              ident: rf.get("ident"),
              code: String(rf.get("code") || "").trim(),
              password: rf.get("password")
            });

            mode = "in";
            accountPage();
            toast(result.message || "Mot de passe modifié. Connectez-vous.");
          } catch (err) {
            toast(err.message);
            submit.disabled = false;
          }
        });
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
      }
    });
  }
