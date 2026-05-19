#!/usr/bin/env node
/**
 * ProwlX Patcher
 * Lance ce script UNE FOIS après avoir cloné le repo Movix :
 *   node prowlx-patch.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const changes = [];

// ══════════════════════════════════════════
// 1. Renommer "Movix" → "ProwlX" dans index.html
// ══════════════════════════════════════════
const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  const before = content;
  content = content
    .replace(/<title>.*?<\/title>/i, '<title>ProwlX - Movie</title>')
    .replace(/Movix/g, 'ProwlX')
    .replace(/movix/g, 'prowlx');
  if (content !== before) {
    fs.writeFileSync(indexPath, content);
    changes.push('✅ index.html — titre mis à jour → ProwlX - Movie');
  }
}

// ══════════════════════════════════════════
// 2. Injecter le thème dans src/main.tsx
// ══════════════════════════════════════════
const mainTsx = path.join(ROOT, 'src', 'main.tsx');
if (fs.existsSync(mainTsx)) {
  let content = fs.readFileSync(mainTsx, 'utf8');
  if (!content.includes('prowlx-theme')) {
    content = `import './config/prowlx-theme.css';\n` + content;
    fs.writeFileSync(mainTsx, content);
    changes.push('✅ src/main.tsx — import thème ProwlX ajouté');
  } else {
    changes.push('⏭️  src/main.tsx — thème déjà importé');
  }
}

// ══════════════════════════════════════════
// 3. Créer src/config/ si absent et copier le CSS
// ══════════════════════════════════════════
const configDir = path.join(ROOT, 'src', 'config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
  changes.push('✅ src/config/ créé');
}

const themeSrc = path.join(ROOT, 'prowlx-theme.css');
const themeDest = path.join(configDir, 'prowlx-theme.css');
if (fs.existsSync(themeSrc) && !fs.existsSync(themeDest)) {
  fs.copyFileSync(themeSrc, themeDest);
  changes.push('✅ prowlx-theme.css copié dans src/config/');
}

// ══════════════════════════════════════════
// 4. Supprimer "Explorer" et "Connexion" du nav
//    Cherche dans les composants nav
// ══════════════════════════════════════════
function findFiles(dir, ext = '.tsx') {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) results.push(...findFiles(full, ext));
    else if (f.name.endsWith(ext) || f.name.endsWith('.ts') || f.name.endsWith('.jsx')) results.push(full);
  }
  return results;
}

const srcFiles = findFiles(path.join(ROOT, 'src'));
const navKeywords = ['Explorer', 'Connexion', 'Login', 'Register', 'SignIn', 'Sign in', 'Se connecter'];

for (const file of srcFiles) {
  const name = path.basename(file).toLowerCase();
  if (!name.includes('nav') && !name.includes('header') && !name.includes('sidebar') && !name.includes('app')) continue;

  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Supprimer les liens Explorer/Connexion (lignes JSX contenant ces mots)
  const lines = content.split('\n');
  const filtered = lines.map(line => {
    const lower = line.toLowerCase();
    if (navKeywords.some(k => line.includes(k))) {
      if (lower.includes('href') || lower.includes('to=') || lower.includes('link') || lower.includes('navitem')) {
        return `{/* ProwlX: removed - ${line.trim().substring(0, 60)} */}`;
      }
    }
    return line;
  });

  content = filtered.join('\n');
  if (content !== original) {
    fs.writeFileSync(file, content);
    changes.push(`✅ ${path.relative(ROOT, file)} — liens Explorer/Connexion supprimés`);
  }
}

// ══════════════════════════════════════════
// 5. Remplacer "Movix" → "ProwlX" partout dans src/
// ══════════════════════════════════════════
let renamedCount = 0;
for (const file of srcFiles) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('Movix') || content.includes('MOVIX')) {
    content = content
      .replace(/\bMovix\b/g, 'ProwlX')
      .replace(/\bMOVIX\b/g, 'ProwlX');
    fs.writeFileSync(file, content);
    renamedCount++;
  }
}
if (renamedCount > 0) changes.push(`✅ ${renamedCount} fichiers — "Movix" renommé en "ProwlX"`);

// ══════════════════════════════════════════
// 6. Rapport final
// ══════════════════════════════════════════
console.log('\n╔══════════════════════════════════════╗');
console.log('║        ProwlX Patcher — Résultat     ║');
console.log('╚══════════════════════════════════════╝\n');
changes.forEach(c => console.log(c));
if (changes.length === 0) console.log('ℹ️  Aucun changement effectué.');

console.log('\n📋 PROCHAINES ÉTAPES :');
console.log('  1. cp .env.example .env  (puis remplis VITE_TMDB_API_KEY)');
console.log('  2. npm install');
console.log('  3. npm run dev');
console.log('  4. Ouvre http://localhost:3000\n');
console.log('🎬 ProwlX est prêt !\n');
