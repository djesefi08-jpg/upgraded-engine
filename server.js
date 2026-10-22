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
// extras.js et compte.js sont ajoutés à la page ; s'ils manquent, la boutique marche quand même
const readScripts = () => ["extras.js", "compte.js"].map(n => { try { return fs.readFileSync(path.join(__dirname, n), "utf8"); } catch { return ""; } })
  .filter(Boolean).map(x => "<script>" + x + "</script>").join("");
const page = () => {
  const h = fs.readFileSync(path.join(__dirname, "index.html"), "utf8").replace(/<footer>[\s\S]*?<\/footer>/, () => FOOTER);
  const x = readScripts();
  return x ? h.replace("</body>", () => x + "</body>") : h;
};

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
db.messages = db.messages || [];
db.users = db.users || [];
const save = () => { fs.writeFileSync(FILE + ".tmp", JSON.stringify(db)); fs.renameSync(FILE + ".tmp", FILE); };
save();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

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

// ---- Comptes clients : inscription, connexion, mes commandes ----
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const scrypt = (p, s) => new Promise((ok, no) => crypto.scrypt(String(p), s, 64, (e, k) => (e ? no(e) : ok(k))));
const TKEY = crypto.createHash("sha256").update("clients:" + (process.env.SESSION_SECRET || ADMIN_PASSWORD)).digest();
const makeTok = u => {
  const p = Buffer.from(JSON.stringify({ uid: u.id, v: u.tv || 0, exp: Date.now() + 60 * 864e5 })).toString("base64url");
  return p + "." + crypto.createHmac("sha256", TKEY).update(p).digest("base64url");
};
const readTok = t => {
  const [p, s] = String(t || "").split(".");
  if (!p || !s) return null;
  const ok = crypto.createHmac("sha256", TKEY).update(p).digest("base64url");
  if (s.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(ok))) return null;
  try { const d = JSON.parse(Buffer.from(p, "base64url").toString()); return d.exp > Date.now() ? { uid: d.uid, v: d.v || 0 } : null; } catch { return null; }
};
const userOf = t => { const k = readTok(t); return k ? db.users.find(x => x.id === k.uid && (x.tv || 0) === k.v) || null : null; };
const normIdent = v => {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? { key: s, mail: true, shown: s } : null;
  let d = s.replace(/\D/g, "");
  if (d.startsWith("225") && d.length === 13) d = d.slice(3);
  return d.length >= 8 && d.length <= 15 ? { key: d, mail: false, shown: d } : null;
};
const pub = u => ({ nom: u.nom, ident: u.ident, tel: u.mail ? "" : u.ident, mustChange: !!u.mustChange });
const authHits = new Map();
const tooMany = req => {
  const now = Date.now(), r = (authHits.get(req.ip) || []).filter(t => now - t < 900e3);
  if (r.length >= 20) return true;
  r.push(now); authHits.set(req.ip, r); return false;
};
app.post("/api/register", async (req, res) => {
  try {
    if (tooMany(req)) return res.status(429).json({ error: "Trop d’essais, réessayez dans quelques minutes" });
    const b = req.body || {}, nom = str(b.nom, 100), id = normIdent(b.ident), pw = String(b.password || "").slice(0, 200);
    if (!nom || !id) return res.status(400).json({ error: "Entrez votre nom et un numéro de téléphone ou un e-mail valide" });
    if (pw.length < 6) return res.status(400).json({ error: "Le mot de passe doit avoir au moins 6 caractères" });
    if (db.users.some(u => u.key === id.key)) return res.status(409).json({ error: "Ce numéro ou cet e-mail a déjà un compte. Connectez-vous." });
    const salt = crypto.randomBytes(16).toString("hex");
    const user = { id: crypto.randomBytes(6).toString("hex"), nom, key: id.key, ident: id.shown, mail: id.mail, salt, hash: (await scrypt(pw, salt)).toString("hex"), date: new Date().toISOString() };
    db.users.push(user); save();
    res.json({ token: makeTok(user), user: pub(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur, réessayez" }); }
});
app.post("/api/client-login", async (req, res) => {
  try {
    if (tooMany(req)) return res.status(429).json({ error: "Trop d’essais, réessayez dans quelques minutes" });
    const b = req.body || {}, id = normIdent(b.ident), pw = String(b.password || "").slice(0, 200);
    const u = id && db.users.find(x => x.key === id.key);
    const ok = u && crypto.timingSafeEqual(await scrypt(pw, u.salt), Buffer.from(u.hash, "hex"));
    if (!ok) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
    res.json({ token: makeTok(u), user: pub(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur, réessayez" }); }
});
const clientAuth = (req, res, next) => {
  const u = userOf(req.headers["x-client-token"]);
  if (!u) return res.status(401).json({ error: "Connectez-vous" });
  req.user = u; next();
};
app.get("/api/me", clientAuth, (req, res) => res.json(pub(req.user)));
app.get("/api/my-orders", clientAuth, (req, res) =>
  res.json(db.orders.filter(o => o.userId === req.user.id).map(o => ({ id: o.id, date: o.date, items: o.items, total: o.total, status: o.status }))));

// ---- Mot de passe oublié : le client fait une demande, le vendeur génère un mot de passe temporaire ----
app.post("/api/forgot", (req, res) => {
  try {
    if (tooMany(req)) return res.status(429).json({ error: "Trop d’essais, réessayez dans quelques minutes" });
    const id = normIdent(req.body?.ident), u = id && db.users.find(x => x.key === id.key);
    if (u && !u.resetRequested) {
      u.resetRequested = new Date().toISOString();
      db.messages.unshift({ id: crypto.randomBytes(4).toString("hex"), date: u.resetRequested, nom: u.nom, contact: u.ident, message: "🔑 Demande de nouveau mot de passe. Contactez ce client, puis allez dans Vendeur › Clients pour lui générer un mot de passe temporaire.", read: false });
      db.messages = db.messages.slice(0, 1000); save();
    }
    res.json({ ok: true }); // même réponse que le compte existe ou non
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur, réessayez" }); }
});
app.post("/api/change-password", clientAuth, async (req, res) => {
  try {
    if (tooMany(req)) return res.status(429).json({ error: "Trop d’essais, réessayez dans quelques minutes" });
    const b = req.body || {}, old = String(b.old || "").slice(0, 200), nw = String(b.next || "").slice(0, 200), u = req.user;
    if (nw.length < 6) return res.status(400).json({ error: "Le nouveau mot de passe doit avoir au moins 6 caractères" });
    if (!crypto.timingSafeEqual(await scrypt(old, u.salt), Buffer.from(u.hash, "hex"))) return res.status(401).json({ error: "Ancien mot de passe incorrect" });
    u.salt = crypto.randomBytes(16).toString("hex"); u.hash = (await scrypt(nw, u.salt)).toString("hex");
    u.mustChange = false; u.tv = (u.tv || 0) + 1; save();
    res.json({ token: makeTok(u), user: pub(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur, réessayez" }); }
});
app.get("/api/users", auth, (req, res) =>
  res.json(db.users.map(u => ({ id: u.id, nom: u.nom, ident: u.ident, mail: u.mail, date: u.date, resetRequested: !!u.resetRequested }))
    .sort((a, b) => (b.resetRequested - a.resetRequested) || b.date.localeCompare(a.date))));
app.post("/api/users/:id/reset", auth, async (req, res) => {
  try {
    const u = db.users.find(x => x.id === req.params.id);
    if (!u) return res.status(404).json({ error: "Introuvable" });
    const A = "abcdefghjkmnpqrstuvwxyz23456789";
    const temp = Array.from(crypto.randomBytes(8), x => A[x % A.length]).join("");
    u.salt = crypto.randomBytes(16).toString("hex"); u.hash = (await scrypt(temp, u.salt)).toString("hex");
    u.mustChange = true; u.resetRequested = ""; u.tv = (u.tv || 0) + 1;
    db.messages.forEach(m => { if (m.contact === u.ident && String(m.message).startsWith("🔑")) m.read = true; });
    save();
    res.json({ temp, nom: u.nom, ident: u.ident, mail: u.mail });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur, réessayez" }); }
});

// ---- Produits ----
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
    const mobile = b.method !== "livraison";
    const operator = ["Orange Money", "MTN Money", "Moov Money", "Wave"].includes(b.operator) ? b.operator : "";
    if (mobile && !(CINETPAY_APIKEY && CINETPAY_SITE_ID)) return res.status(503).json({ error: "Le paiement mobile n’est pas encore activé. Choisissez « Payer à la livraison »." });
    const user = userOf(b.ct);
    const order = { id: crypto.randomBytes(3).toString("hex").toUpperCase(), date: new Date().toISOString(), nom, adr, tel, items, total, operator, userId: user ? user.id : "", status: mobile ? "en attente de paiement" + (operator ? " · " + operator : "") : "à payer à la livraison" };
    if (mobile) {
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
    db.orders.unshift(order); save();
    res.json({ id: order.id });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur lors de la commande" }); }
});

// ---- Messages : tout le monde peut écrire, seul le vendeur connecté peut lire ----
const msgHits = new Map();
app.post("/api/messages", (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // champ piège pour les robots
  const now = Date.now(), recent = (msgHits.get(req.ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= 5) return res.status(429).json({ error: "Trop de messages, réessayez plus tard" });
  const nom = str(b.nom, 100), contact = str(b.contact, 120), message = str(b.message, 2000);
  if (!nom || !contact || message.length < 2) return res.status(400).json({ error: "Complétez le formulaire" });
  recent.push(now); msgHits.set(req.ip, recent);
  db.messages.unshift({ id: crypto.randomBytes(4).toString("hex"), date: new Date().toISOString(), nom, contact, message, read: false });
  db.messages = db.messages.slice(0, 1000);
  save(); res.json({ ok: true });
});
app.get("/api/messages", auth, (req, res) => res.json(db.messages));
app.put("/api/messages/:id/read", auth, (req, res) => {
  const m = db.messages.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: "Introuvable" });
  m.read = req.body?.read !== false; save(); res.json(m);
});
app.delete("/api/messages/:id", auth, (req, res) => {
  db.messages = db.messages.filter(x => x.id !== req.params.id); save(); res.json({ ok: true });
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
    if (!String(order.status).startsWith("payée")) { order.status = "payée" + (order.operator ? " · " + order.operator : ""); save(); }
    return true;
  }
  if (j.data?.status === "REFUSED" && !String(order.status).startsWith("payée")) { order.status = "paiement refusé"; save(); }
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