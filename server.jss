const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour lire le JSON et les formulaires
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'messages.json');

// Mot de passe secret du vendeur (À changer par le vôtre)
const SELLER_PASSWORD = "MonMotDePasseSecret123";

// 1. Route pour ENREGISTRER un message (Formulaire)
app.post('/api/messages', (req, res) => {
    const { nom, email, message } = req.body;
    
    if (!nom || !message) {
        return res.status(400).json({ error: "Le nom et le message sont obligatoires." });
    }

    const newMessage = {
        id: Date.now(),
        nom,
        email: email || "Non renseigné",
        message,
        date: new Date().toLocaleString()
    };

    // Lire les messages existants
    let messages = [];
    if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        try {
            messages = JSON.parse(data);
        } catch (err) {
            messages = [];
        }
    }

    // Ajouter le nouveau message et sauvegarder
    messages.unshift(newMessage); // Ajoute en haut de la liste
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), 'utf8');

    res.status(201).json({ success: true, message: "Message envoyé avec succès !" });
});

// 2. Route pour LIRE les messages (PROTÉGÉE par mot de passe)
app.get('/api/messages', (req, res) => {
    const password = req.headers['x-seller-password'];

    // Vérification de la protection
    if (password !== SELLER_PASSWORD) {
        return res.status(403).json({ error: "Accès refusé. Réservé au vendeur." });
    }

    // Lire et renvoyer les messages
    if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } else {
        res.json([]);
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
