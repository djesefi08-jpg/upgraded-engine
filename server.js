
import express from "express";
import Stripe from "stripe";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

app.disable("x-powered-by");
app.use(express.static(__dirname));

const products = [
  {
    id: "article-1",
    name: "Article de démonstration",
    description: "Bienvenue chez STEPHY LA MERVEILLE",
    price: 5000,
    stock: 10
  }
];

const orders = [];

function requireAdmin(req, res, next) {
  const password =
    req.get("x-admin-password") ||
    req.body?.adminPassword ||
    "";

  if (!ADMIN_PASSWORD) {
    return res.status(503).json({
      error: "Configure ADMIN_PASSWORD sur ton hébergement."
    });
  }

  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({
      error: "Mot de passe incorrect."
    });
  }

  next();
}

app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    boutique: "STEPHY LA MERVEILLE@",
    monnaie: "XOF"
  });
});

app.get("/api/products", (req, res) => {
  res.json(products);
});

app.post("/api/orders", (req, res) => {
  const { customerName, phone, address, items } = req.body || {};

  if (!customerName || !phone || !address ||
      !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "Nom, téléphone, adresse et articles obligatoires."
    });
  }

  const lines = [];

  for (const item of items) {
    const product = products.find(p => p.id === item.id);
    const quantity = Number(item.quantity);

    if (!product || !Number.isInteger(quantity) ||
        quantity < 1 || quantity > product.stock) {
      return res.status(400).json({
        error: "Article ou quantité invalide."
      });
    }

    lines.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity
    });
  }

  const total = lines.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const order = {
    id: crypto.randomUUID(),
    customerName: String(customerName).slice(0, 100),
    phone: String(phone).slice(0, 30),
    address: String(address).slice(0, 300),
    items: lines,
    total,
    currency: "XOF",
    payment: "Paiement à la livraison",
    status: "Reçue",
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  res.status(201).json({
    message: "Commande enregistrée.",
    orderId: order.id,
    total,
    currency: "XOF",
    payment: order.payment
  });
});

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  res.json(orders);
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const { name, description = "", price, stock = 0 } = req.body || {};
  const amount = Number(price);
  const quantity = Number(stock);

  if (!name || !Number.isSafeInteger(amount) || amount < 1 ||
      !Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({
      error: "Vérifie le nom, le prix et le stock."
    });
  }

  const product = {
    id: crypto.randomUUID(),
    name: String(name).slice(0, 120),
    description: String(description).slice(0, 500),
    price: amount,
    stock: quantity
  };

  products.push(product);
  res.status(201).json(product);
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Route API introuvable." });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`STEPHY LA MERVEILLE@ fonctionne sur le port ${PORT}`);
});
