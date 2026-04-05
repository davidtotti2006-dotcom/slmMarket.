// ==========================================================================
// 🗼 S.M. EMPIRE - TOUR DE CONTRÔLE (SERVER.JS)
// ==========================================================================
require('dotenv').config();
const app = require('./app'); // Importe l'usine et les routes configurées dans app.js

const PORT = process.env.PORT || 5000;

// 1. Allumage du réacteur principal
const server = app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 S.L.M MARKET - SYSTÈME CENTRAL EN LIGNE`);
    console.log(`🌐 Le portail d'acquisition VIP est ouvert sur http://localhost:${PORT}`);
    console.log(`=================================================\n`);
});

// 2. Sécurité VIP : Gestion des erreurs réseau
// Si MongoDB plante ou si une erreur grave survient, on ferme proprement sans corrompre les données.
process.on('unhandledRejection', (err) => {
    console.log('❌ ERREUR FATALE DÉTECTÉE. Extinction sécurisée du serveur...');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});