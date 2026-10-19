import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import Stripe from "stripe";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { ADMIN_PASSWORD, CINETPAY_APIKEY, CINETPAY_SITE_ID, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BASE_URL = "http://localhost:3000", PORT = 3000 } = process.env;
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  console.error("Définis ADMIN_PASSWORD (8 caractères minimum) dans le fichier .env");
  process.exit(1);
}

// ---- Coordonnées affichées en bas de la boutique (modifie ici si elles changent) ----
const CONTACT = {
  email: "djesefi08@gmail.com",
  phone: "+2250585276093",
  whatsapp: "2250585276093",
  tiktok: "https://www.tiktok.com/@stephylamerveille08",
};
const FOOTER = `<footer><p>Une question ? Écrivez-nous :</p><p><a href="mailto:${CONTACT.email}">E-mail</a> · <a href="tel:${CONTACT.phone}">Appeler</a> · <a href="https://wa.me/${CONTACT.whatsapp}" target="_blank" rel="noopener">WhatsApp</a> · <a href="${CONTACT.tiktok}" target="_blank" rel="noopener">TikTok</a></p></footer>`;
// ---- Section "Nouveautés" sur la page d'accueil (les 4 derniers produits ajoutés) ----
const EXTRAS = `(function () {
  var _home = home;
  home = function () {
    _home();
    var f = document.querySelector(".filters");
    if (!f || S.products.length <= 4) return;
    var latest = S.products.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 4);
    var s = document.createElement("section");
    s.id = "news";
    s.innerHTML = '<h2 style="margin:.2em 0 .6em;font-size:1.4rem">Nouveautés</h2><div class="grid">' + grid(latest) + '</div><h2 style="margin:1.4em 0 .6em;font-size:1.4rem">Tous les produits</h2>';
    f.before(s);
  };
})();`;
const page = () => fs.readFileSync(path.join(__dirname, "index.html"), "utf8").replace(/<footer>[\s\S]*?<\/footer>/, () => FOOTER).replace("</body>", () => "<script>" + EXTRAS + "</script></body>");

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// ---- Données (fichier JSON : suffisant pour une petite boutique) ----
const SEED = [
  ["Bol en grès", 12000, "Maison", "🥣", "Bol tourné à la main, émail bleu nuit."],
  ["Bougie au figuier", 16000, "Maison", "🕯️", "Cire de soja, 40 h de combustion."],
  ["Tote bag en lin", 19000, "Mode", "👜", "Lin lavé, poche intérieure zippée."],
  ["Écharpe en laine", 30000, "Mode", "🧣", "Laine mérinos douce, coloris sauge."],
  ["Miel de fleurs", 6000, "Épicerie", "🍯", "Pot de 250 g, apiculteur local."],
  ["Café en grains", 8000, "Épicerie", "☕", "Torréfaction artisanale, 500 g."],
  ["Carnet cousu main", 9000, "Papeterie", "📓", "96 pages unies, papier recyclé."],
  ["Set de 3 crayons", 4500, "Papeterie", "✏️", "Bois certifié FSC, gomme intégrée."],
].map(([name, price, cat, emoji, desc], i) => ({ id: i + 1, name, price, cat, emoji, desc, img: "" }));
const DIR = path.join(__dirname, "data"), FILE = path.join(DIR, "db.json");
fs.mkdirSync(DIR, { recursive: true });
let db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { products: SEED, orders: [], nid: SEED.length + 1 };
const save = () => { fs.writeFileSync(FILE + ".tmp", JSON.stringify(db)); fs.renameSync(FILE + ".tmp", FILE); };
save();

const app = express();
app.disable("x-powered-by");

// ---- Webhook Stripe (corps brut, avant express.json) ----
app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.sendStatus(400);
  let ev;
  try { ev = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET); }
  catch { return res.sendStatus(400); }
  if (ev.type === "checkout.session.completed") {
    const o = db.orders.find(x => x.id === ev.data.object.metadata?.orderId);
    if (o) { o.status = "payée"; save(); }
  }
  res.sendStatus(200);
});
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// ---- Authentification vendeur ----
const sessions = new Map(), attempts = new Map();
const sha = s => crypto.createHash("sha256").update(String(s)).digest();
const auth = (req, res, next) => {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  if ((sessions.get(t) || 0) < Date.now()) return res.status(401).json({ error: "Non autorisé" });
  next();
};
app.post("/api/login", (req, res) => {
  const a = attempts.get(req.ip) || { n: 0, reset: Date.now() + 15 * 60e3 };
  if (Date.now() > a.reset) { a.n = 0; a.reset = Date.now() + 15 * 60e3; }
  if (++a.n > 10) { attempts.set(req.ip, a); return res.status(429).json({ error: "Trop d'essais, réessayez plus tard" }); }
  attempts.set(req.ip, a);
  if (!crypto.timingSafeEqual(sha(req.body?.password), sha(ADMIN_PASSWORD))) return res.status(401).json({ error: "Mot de passe incorrect" });
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + 12 * 3600e3);
  res.json({ token });
});

// ---- Produits ----
const str = (v, max) => String(v ?? "").trim().slice(0, max);
function clean(b) {
  const price = Number(b.price);
  if (!str(b.name, 80) || !str(b.cat, 40) || !(price >= 0 && price <= 100000)) return null;
  const d = { name: str(b.name, 80), price: Math.round(price / 5) * 5, cat: str(b.cat, 40), emoji: str(b.emoji, 4) || "📦", desc: str(b.desc, 500) };
  if (typeof b.img === "string" && b.img.startsWith("data:image/") && b.img.length < 600000) d.img = b.img;
  return d;
}
app.get("/api/products", (req, res) => res.json(db.products));
app.post("/api/products", auth, (req, res) => {
  const d = clean(req.body); if (!d) return res.status(400).json({ error: "Champs invalides" });
  const p = { id: db.nid++, img: "", ...d }; db.products.push(p); save(); res.json(p);
});
app.put("/api/products/:id", auth, (req, res) => {
  const p = db.products.find(x => x.id === +req.params.id); if (!p) return res.status(404).json({ error: "Introuvable" });
  const d = clean(req.body); if (!d) return res.status(400).json({ error: "Champs invalides" });
  Object.assign(p, d); save(); res.json(p);
});
app.delete("/api/products/:id", auth, (req, res) => {
  db.products = db.products.filter(x => x.id !== +req.params.id); save(); res.json({ ok: true });
});

// ---- Commandes ----
app.get("/api/orders", auth, (req, res) => res.json(db.orders));
app.post("/api/checkout", async (req, res) => {
  try {
    const b = req.body || {}, nom = str(b.nom, 100), adr = str(b.adr, 300), tel = str(b.tel, 30);
    if (!nom || !adr || tel.length < 6) return res.status(400).json({ error: "Complétez le formulaire" });
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 50).map(i => {
      const p = db.products.find(x => x.id === +i.id), q = Math.floor(+i.q);
      return p && q >= 1 && q <= 99 ? { name: p.name, price: p.price, q } : null;
    }).filter(Boolean);
    if (!items.length) return res.status(400).json({ error: "Panier vide" });
    const total = Math.round(items.reduce((a, i) => a + i.price * i.q, 0));
    const order = { id: crypto.randomBytes(3).toString("hex").toUpperCase(), date: new Date().toISOString(), nom, adr, tel, items, total, status: (stripe || CINETPAY_APIKEY) ? "en attente de paiement" : "à payer à la livraison" };
    if (CINETPAY_APIKEY && CINETPAY_SITE_ID) {
      const [first, ...rest] = nom.split(" ");
      const r = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "stephy-boutique/1.0" },
        body: JSON.stringify({
          apikey: CINETPAY_APIKEY, site_id: CINETPAY_SITE_ID, transaction_id: order.id,
          amount: total, currency: "XOF", description: "Commande " + order.id, lang: "fr",
          channels: "MOBILE_MONEY",
          notify_url: `${BASE_URL}/api/cinetpay-notify`, return_url: `${BASE_URL}/retour?order=${order.id}`,
          customer_name: first, customer_surname: rest.join(" ") || first, customer_phone_number: tel,
          customer_address: adr, customer_city: "CI", customer_country: "CI", customer_state: "CI", customer_zip_code: "00225",
        }),
      });
      const j = await r.json();
      if (j.code !== "201" || !j.data?.payment_url) { console.error("CinetPay:", j); return res.status(502).json({ error: "Paiement indisponible, réessayez plus tard" }); }
      db.orders.unshift(order); save();
      return res.json({ id: order.id, url: j.data.payment_url });
    }
    if (stripe) {
      const s = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: items.map(i => ({ quantity: i.q, price_data: { currency: "xof", unit_amount: Math.round(i.price), product_data: { name: i.name } } })),
        success_url: `${BASE_URL}/#/ok/${order.id}`, cancel_url: `${BASE_URL}/#/panier`,
        metadata: { orderId: order.id },
      });
      db.orders.unshift(order); save();
      return res.json({ id: order.id, url: s.url });
    }
    db.orders.unshift(order); save();
    res.json({ id: order.id });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur lors de la commande" }); }
});

// ---- Mobile money (CinetPay : Orange Money, MTN, Moov, Wave) ----
async function cinetpayCheck(order) {
  const r = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "stephy-boutique/1.0" },
    body: JSON.stringify({ apikey: CINETPAY_APIKEY, site_id: CINETPAY_SITE_ID, transaction_id: order.id }),
  });
  const j = await r.json();
  if (j.code === "00" && j.data?.status === "ACCEPTED" && Number(j.data.amount) === order.total) {
    if (order.status !== "payée") { order.status = "payée"; save(); }
    return true;
  }
  if (j.data?.status === "REFUSED" && order.status !== "payée") { order.status = "paiement refusé"; save(); }
  return false;
}
app.get("/api/cinetpay-notify", (req, res) => res.sendStatus(200));
app.post("/api/cinetpay-notify", async (req, res) => {
  try {
    const o = db.orders.find(x => x.id === String(req.body?.cpm_trans_id || ""));
    if (o && CINETPAY_APIKEY) await cinetpayCheck(o);
  } catch (e) { console.error(e); }
  res.sendStatus(200);
});
app.all("/retour", async (req, res) => {
  const id = String(req.query.order || "").replace(/[^A-Za-z0-9]/g, "");
  const o = db.orders.find(x => x.id === id);
  let ok = false;
  try { if (o && CINETPAY_APIKEY) ok = await cinetpayCheck(o); } catch (e) { console.error(e); }
  res.redirect(303, ok ? `/#/ok/${id}` : "/#/panier");
});

const PUBLIC = ["manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png", "maskable-192.png", "maskable-512.png"];
app.get(["/", "/index.html"], (req, res) => res.type("html").send(page()));
for (const f of PUBLIC) app.get("/" + f, (req, res) => res.sendFile(path.join(__dirname, f)));
app.use((err, req, res, next) => res.status(400).json({ error: "Requête invalide" }));
app.listen(PORT, () => console.log(`Boutique prête sur http://localhost:${PORT}`));