# STEPHY LA MERVEILLE@ – boutique avec serveur

## Lancer chez toi (test)
1. Installe Node.js 20.6 ou plus : nodejs.org
2. Dans ce dossier : `npm install`
3. Copie `.env.example` en `.env` et remplis au moins `ADMIN_PASSWORD`
4. `npm start` puis ouvre http://localhost:3000
   Espace vendeur : onglet « Vendeur », avec ton mot de passe.

## Paiement par MTN Money et Wave(Stripe)
1. Crée un compte sur stripe.com, copie la clé secrète dans `STRIPE_SECRET_KEY` (commence par `sk_test_` pour tester).
2. Stripe > Développeurs > Webhooks : ajoute `https://ton-domaine.com/api/webhook`, événement `checkout.session.completed`, puis copie le secret dans `STRIPE_WEBHOOK_SECRET`.
3. Les prix sont en FCFA (monnaie Stripe « xof ») : vérifie dans ton compte Stripe que ce paiement est accepté pour ton pays.
4. Sans clé Stripe, les commandes passent en « à payer à la livraison ».

## Mettre en ligne
Render, Railway ou Fly.io conviennent : envoie ce dossier, commande de démarrage `npm start`, ajoute les variables du `.env` dans leur interface, et mets ton adresse dans `BASE_URL`.
Important : garde un disque persistant pour le dossier `data/` (il contient produits et commandes), sinon tout est effacé à chaque redémarrage.

## Ensuite : Google Play
Ton site sert alors la page et l'API sur le même domaine : suis `pwabuilder.com` avec cette adresse pour obtenir le fichier .aab.

## Limites à connaître
- Les données sont dans un fichier JSON : très bien pour une petite boutique, à remplacer par une vraie base si les commandes se multiplient.
- Pas d'e-mail de confirmation ni de comptes clients pour l'instant.
