// Démarrage sans cluster (compatibilité Node.js v24)
require('dotenv').config();
const { app, appReady } = require('./app');
const PORT = process.env.PORT || 25565;

appReady.then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT} (mode single-process)`);
  });
}).catch(err => {
  console.error('Erreur de démarrage:', err);
  process.exit(1);
});
