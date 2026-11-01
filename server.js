import express from "express";
import pg from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import nodemailer from "nodemailer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  ADMIN_PASSWORD, DATABASE_URL,
  CINETPAY_APIKEY, CINETPAY_SITE_ID,
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  SESSION_SECRET,
  GMAIL_USER, GMAIL_APP_PASSWORD,
  BASE_URL = "http://localhost:3000",
  PORT = 3000,
} = process.env;

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  console.error("Définis ADMIN_PASSWORD (8 caractères minimum) dans le fichier .env");
  process.exit(1);
}
if (!SESSION_SECRET || SESSION_SECRET.length < 16) {
  console.error("Définis SESSION_SECRET (16 caractères minimum) dans le fichier .env");
  process.exit(1);
}

// ---- Coordonnées affichées en bas de la boutique ----
const CONTACT = {
  email: "djesefi08@gmail.com",
  phone: "+2250585276093",
  whatsapp: "2250585276093",
  tiktok: "https://www.tiktok.com/@stephylamerveille08",
};
const FOOTER = `<footer><p>Une question ? Écrivez-nous :</p><p><a href="mailto:${CONTACT.email}">E-mail</a> · <a href="tel:${CONTACT.phone}">Appeler</a> · <a href="https://wa.me/${CONTACT.whatsapp}" target="_blank" rel="noopener">WhatsApp</a> · <a href="${CONTACT.tiktok}" target="_blank" rel="noopener">TikTok</a></p></footer>`;

const readScripts = () =>
  ["extras.js", "compte.js"]
    .map(n => { try { return fs.readFileSync(path.join(__dirname, n), "utf8"); } catch { return ""; } })
    .filter(Boolean)
    .map(x => "<script>" + x + "</script>")
    .join("");

const page = () => {
  const h = fs.readFileSync(path.join(__dirname, "index.html"), "utf8").replace(/<footer>[\s\S]*?<\/footer>/, () => FOOTER);
  const x = readScripts();
  return x ? h.replace("</body>", () => x + "</body>") : h;
};

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// ---- Configuration de l'envoi d'e-mail (Nodemailer) ----
const transporter = (GMAIL_USER && GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
    })
  : null;

async function envoyerEmailConfirmation(emailClient, commande) {
  if (!transporter || !emailClient) return;
  
  const listeProduits = commande.items.map(item => 
    `<li>${item.q} x ${item.name} : ${item.price * item.q} FCFA</li>`
  ).join("");

  try {
    await transporter.sendMail({
      from: `"Stephy La Merveille" <${GMAIL_USER}>`,
      to: emailClient,
      subject: `Confirmation de votre commande ${commande.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #6b21a8;">Merci pour votre commande !</h2>
          <p>Bonjour <b>${commande.nom}</b>,</p>
          <p>Nous avons bien reçu votre commande <b>${commande.id}</b>.</p>
          <p><b>Détails de votre commande :</b></p>
          <ul>${listeProduits}</ul>
          <p><b>Total à payer :</b> ${commande.total} FCFA</p>
          <p><b>Mode de paiement :</b> ${commande.status}</p>
          <br>
          <p>Nous vous contacterons très vite pour la livraison.</p>
          <p>L'équipe Stephy La Merveille.</p>
        </div>
      `
    });
    console.log(`✅ E-mail envoyé à ${emailClient} pour la commande ${commande.id}`);
  } catch (error) {
    console.error("❌ Erreur d'envoi d'e-mail :", error.message);
  }
}

// ---- Produits d'exemple (utilisés seulement la toute première fois) ----
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

// ---- Base de données ----
const DIR = path.join(__dirname, "data"), FILE = path.join(DIR, "db.json");
let pool = null;
if (DATABASE_URL) {
  try {
    const u = new URL(DATABASE_URL); u.search = "";
    pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false }, max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 20000 });
    pool.on("error", e => console.error("Base de données (connexion inactive) :", e.message));
  } catch (e) { console.error("DATABASE_URL n'est pas une adresse valide :", e.message); pool = null; }
}
async function q(sql, params) {
  try { return await pool.query(sql, params); }
  catch { await new Promise(r => setTimeout(r, 2000)); return await pool.query(sql, params); }
}
const last = {};
let db;
if (pool) try {
  await q("create table if not exists store (key text primary key, value jsonb not null, updated_at timestamptz not null default now())");
  const m = Object.fromEntries((await q("select key, value from store")).rows.map(r => [r.key, r.value]));
  db = { products: m.products, orders: m.orders || [], users: m.users || [], messages: m.messages || [], nid: m.meta?.nid };
  if (!db.products) { db.products = SEED; db.nid = SEED.length + 1; }
  if (!db.nid) db.nid = Math.max(0, ...db.products.map(p => p.id)) + 1;
  for (const [k, v] of Object.entries({ products: db.products, orders: db.orders, users: db.users, messages: db.messages })) if (m[k]) last[k] = JSON.stringify(v);
  if (m.meta) last.meta = JSON.stringify({ nid: db.nid });
  console.log("Base de données : PostgreSQL —", db.products.length, "produits,", db.orders.length, "commandes,", db.users.length, "comptes");
} catch (e) { console.error("Base de données injoignable, la boutique utilise un fichier local :", e.message); pool = null; }
if (!pool) {
  fs.mkdirSync(DIR, { recursive: true });
  db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { products: SEED, orders: [], nid: SEED.length + 1 };
  console.log("Base de données : fichier local (données perdues à chaque redémarrage sur l'offre gratuite)");
}
db.messages = db.messages || [];
db.users = db.users || [];

let chain = Promise.resolve();
function save() {
  if (!pool) { fs.writeFileSync(FILE + ".tmp", JSON.stringify(db)); fs.renameSync(FILE + ".tmp", FILE); return; }
  const snap = {
    products: JSON.stringify(db.products), orders: JSON.stringify(db.orders), users: JSON.stringify(db.users),
    messages: JSON.stringify(db.messages), meta: JSON.stringify({ nid: db.nid }),
  };
  const changed = Object.keys(snap).filter(k => last[k] !== snap[k]);
  if (!changed.length) return;
  chain = chain.then(async () => {
    for (let essai = 0; essai < 2; essai++) {
      let c;
      try {
        c = await pool.connect();
        await c.query("begin");
        for (const k of changed) await c.query("insert into store (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()", [k, snap[k]]);
        await c.query("commit");
        for (const k of changed) last[k] = snap[k];
        c.release();
        return;
      } catch (e) {
        if (c) { await c.query("rollback").catch(() => {}); c.release(); }
        console.error("Sauvegarde en base échouée (essai " + (essai + 1) + ") :", e.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  });
}
save();
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, async () => { try { await chain; } catch {} process.exit(0); });

// =========================================================
// ---- Helpers sécurité ----
// =========================================================
const sha = s => crypto.createHash("sha256").update(String(s)).digest();
const TKEY = crypto.createHash("sha256").update("clients:" + SESSION_SECRET).digest();
const AKEY = crypto.createHash("sha256").update("admin:" + SESSION_SECRET).digest();

const signToken = (payload, key, ttlMs) => {
  const p = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString("base64url");
  return p + "." + crypto.createHmac("sha256", key).update(p).digest("base64url");
};
const verifyToken = (t, key) => {
  const [p, s] = String(t || "").split(".");
  if (!p || !s) return null;
  const expected = crypto.createHmac("sha256", key).update(p).digest("base64url");
  if (s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
  try {
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
};

const isHttps = BASE_URL.startsWith("https://");
const COOKIE_BASE = { httpOnly: true, secure: isHttps, sameSite: "strict", path: "/" };
const setAdminCookie  = (res, t) => res.cookie("admin",  t, { ...COOKIE_BASE, maxAge: 12 * 3600e3 });
const setClientCookie = (res, t) => res.cookie("client", t, { ...COOKIE_BASE, sameSite: "lax", maxAge: 60 * 864e5 });

const fetchT = async (url, opts = {}, ms = 15000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
};

const imgOk = (dataUrl) => {
  if (typeof dataUrl !== "string" || dataUrl.length >= 600000) return false;
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return false;
  let buf;
  try { buf = Buffer.from(m[2], "base64"); } catch { return false; }
  if (buf.length < 12) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  return false;
};

// =========================================================
// ---- Application ----
// =========================================================
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cookieParser());

app.get("/api/health", async (req, res) => {
  let ok = true;
  if (pool) { try { await q("select 1"); } catch { ok = false; } }
  res.json({ ok });
});

app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.sendStatus(400);
  let ev;
  try { ev = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET); }
  catch { return res.sendStatus(400); }
  if (ev.type === "checkout.session.completed") {
    const o = db.orders.find(x => x.id === ev.data.object.metadata?.orderId);
    if (o) {
      o.status = "payée";
      save();
      await envoyerEmailConfirmation(o.email, o); // 👈 Envoi de l'e-mail Stripe
    }
  }
  res.sendStatus(200);
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// ---- Auth vendeur ----
const attempts = new Map();
const auth = (req, res, next) => {
  const t = req.cookies?.admin || (req.headers.authorization || "").replace("Bearer ", "");
  const d = verifyToken(t, AKEY);
  if (!d || d.role !== "admin") return res.status(401).json({ error: "Non autorisé" });
  req.admin = d;
  next();
};
app.post("/api/login", (req, res) => {
  const a = attempts.get(req.ip) || { n: 0, reset: Date.now() + 15 * 60e3 };
  if (Date.now() > a.reset) { a.n = 0; a.reset = Date.now() + 15 * 60e3; }
  if (++a.n > 10) { attempts.set(req.ip, a); return res.status(429).json({ error: "Trop d'essais, réessayez plus tard" }); }
  attempts.set(req.ip, a);
  if (!crypto.timingSafeEqual(sha(req.body?.password), sha(ADMIN_PASSWORD))) return res.status(401).json({ error: "Mot de passe incorrect" });
  a.n = 0; attempts.set(req.ip, a);
  const token = signToken({ role: "admin" }, AKEY, 12 * 3600e3);
  setAdminCookie(res, token);
  res.json({ token });
});
app.post("/api/logout", (req, res) => { res.clearCookie("admin", { path: "/" }); res.json({ ok: true }); });

// ---- Comptes clients ----
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const scrypt = (p, s) => new Promise((ok, no) => crypto.scrypt(String(p), s, 64, (e, k) => (e ? no(e) : ok(k))));
const makeTok = u => signToken({ uid: u.id, v: u.tv || 0 }, TKEY, 60 * 864e5);

const userOf = (req) => {
  const t = req.cookies?.client || req.headers["x-client-token"] || "";
  const k = verifyToken(t, TKEY);
  return k ? db.users.find(x => x.id === k.uid && (x.tv || 0) === (k.v || 0)) || null : null;
};

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
    const token = makeTok(user);
    setClientCookie(res, token);
    res.json({ token, user: pub(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur, réessayez" }); }
});

app.post("/api/client-login", async (req, res) => {
  try {
    if (tooMany(req)) return res.status(429).json({ error: "Trop d’essais, réessayez dans quelques minutes" });
    const b = req.body || {}, id = normIdent(b.ident), pw = String(b.password || "").slice(0, 200);
    const u = id && db.users.find(x => x.key === id.key);
    const ok = u && crypto.timingSafeEqual(await scrypt(pw, u.salt), Buffer.from(u.hash, "hex"));
    if (!ok) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
    const token = makeTok(u);
    setClientCookie(res, token);
    res.json({ token, user: pub(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur, réessayez" }); }
});

app.post("/api/client-logout", (req, res) => { res.clearCookie("client", { path: "/" }); res.json({ ok: true }); });

const clientAuth = (req, res, next) => {
  const u = userOf(req);
  if (!u) return res.status(401).json({ error: "Connectez-vous" });
  req.user = u; next();
};
app.get("/api/me", clientAuth, (req, res) => res.json(pub(req.user)));
app.get("/api/my-orders", clientAuth, (req, res) =>
  res.json(db.orders.filter(o => o.userId === req.user.id).map(o => ({ id: o.id, date: o.date, items: o.items, total: o.total, status: o.status }))));

app.post("/api/forgot", (req, res) => {
  try {
    if (tooMany(req)) return res.status(429).json({ error: "Trop d’essais, réessayez dans quelques minutes" });
    const id = normIdent(req.body?.ident), u = id && db.users.find(x => x.key === id.key);
    if (u && !u.resetRequested) {
      u.resetRequested = new Date().toISOString();
      db.messages.unshift({ id: crypto.randomBytes(4).toString("hex"), date: u.resetRequested, nom: u.nom, contact: u.ident, message: "🔑 Demande de nouveau mot de passe. Contactez ce client, puis allez dans Vendeur › Clients pour lui générer un mot de passe temporaire.", read: false });
      db.messages = db.messages.slice(0, 1000); save();
    }
    res.json({ ok: true });
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
    const token = makeTok(u);
    setClientCookie(res, token);
    res.json({ token, user: pub(u) });
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
  if (b.img !== undefined) {
    if (b.img === "") d.img = "";
    else if (imgOk(b.img)) d.img = b.img;
    else return null;
  }
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

const checkoutHits = new Map();
const checkoutLimit = req => {
  const now = Date.now(), r = (checkoutHits.get(req.ip) || []).filter(t => now - t < 3600e3);
  if (r.length >= 20) return true;
  r.push(now); checkoutHits.set(req.ip, r); return false;
};

app.post("/api/checkout", async (req, res) => {
  try {
    if (checkoutLimit(req)) return res.status(429).json({ error: "Trop de commandes, réessayez plus tard" });
    const b = req.body || {};
    const nom = str(b.nom, 100), adr = str(b.adr, 300), tel = str(b.tel, 30);
    const email = str(b.email, 150); // 👈 Récupération de l'e-mail client
    
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
    
    const user = userOf(req);
    
    const order = { 
        id: crypto.randomBytes(8).toString("hex").toUpperCase(), 
        date: new Date().toISOString(), 
        nom, adr, tel, email, // 👈 L'e-mail est enregistré dans la commande
        items, total, operator, 
        userId: user ? user.id : "", 
        status: mobile ? "en attente de paiement" + (operator ? " · " + operator : "") : "à payer à la livraison" 
    };
    
    if (mobile) {
      const [first, ...rest] = nom.split(" ");
      const r = await fetchT("https://api-checkout.cinetpay.com/v2/payment", {
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
    
    // Paiement à la livraison : on enregistre et on envoie l'e-mail immédiatement
    db.orders.unshift(order); 
    save();
    envoyerEmailConfirmation(email, order).catch(console.error); // 👈 Envoi de l'e-mail
    res.json({ id: order.id });
    
  } catch (e) { console.error(e); res.status(500).json({ error: "Erreur lors de la commande" }); }
});

// ---- Messages ----
const msgHits = new Map();
app.post("/api/messages", (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });
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

// ---- Mobile money (CinetPay) ----
async function cinetpayCheck(order) {
  const r = await fetchT("https://api-checkout.cinetpay.com/v2/payment/check", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "stephy-boutique/1.0" },
    body: JSON.stringify({ apikey: CINETPAY_APIKEY, site_id: CINETPAY_SITE_ID, transaction_id: order.id }),
  });
  const j = await r.json();
  if (j.code === "00" && j.data?.status === "ACCEPTED" && Number(j.data.amount) === order.total) {
    if (!String(order.status).startsWith("payée")) { 
        order.status = "payée" + (order.operator ? " · " + order.operator : ""); 
        save(); 
        await envoyerEmailConfirmation(order.email, order); // 👈 Envoi de l'e-mail CinetPay
    }
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

const retourHits = new Map();
app.all("/retour", async (req, res) => {
  const now = Date.now(), r = (retourHits.get(req.ip) || []).filter(t => now - t < 60e3);
  if (r.length >= 5) return res.redirect(303, "/#/panier");
  r.push(now); retourHits.set(req.ip, r);

  const id = String(req.query.order || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  const o = db.orders.find(x => x.id === id);
  let ok = false;
  try { if (o && CINETPAY_APIKEY) ok = await cinetpayCheck(o); } catch (e) { console.error(e); }
  res.redirect(303, ok ? `/#/ok/${id}` : "/#/panier");
});

// ---- Fichiers statiques ----
const PUBLIC = ["manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png", "maskable-192.png", "maskable-512.png"];
app.get(["/", "/index.html"], (req, res) => res.type("html").send(page()));
for (const f of PUBLIC) app.get("/" + f, (req, res) => res.sendFile(path.join(__dirname, f)));

app.use((err, req, res, next) => res.status(400).json({ error: "Requête invalide" }));

app.listen(PORT, () => console.log(`Boutique prête sur http://localhost:${PORT}`));