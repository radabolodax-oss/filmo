# Transferer Dawger sur un nouveau PC

Ce projet est fait pour voyager via **git**, pas via une copie de dossier :
`node_modules/`, `dist/` et les caches sont gitignores (des Go de bazar en
moins), et les seules choses qui ne passent pas par git normalement sont les
`.env` (secrets) — desormais couverts par `env-backup/`.

## Sur l'ancien PC (a faire maintenant, une fois)

```
env-backup\backup-env.bat
git add env-backup\*.age
git commit -m "Update encrypted .env backups"
git push
```

Refais ca a chaque fois qu'un `.env` change (nouvelle cle API, etc).

Note bien quelque part (gestionnaire de mots de passe) le chemin/contenu de
la **cle privee age** utilisee pour `backups/` — c'est la meme qui dechiffre
`env-backup/`. Sans elle, tout ce qui est chiffre est perdu pour de bon.

## Sur le nouveau PC

Prerequis : [Docker Desktop](https://www.docker.com/products/docker-desktop/)
installe et lance. Node.js n'est **pas** necessaire si tu lances l'appli
Electron deja compilee (voir plus bas) ; sinon installe-le aussi.

```
git clone https://github.com/radabolodax-oss/filmo.git
cd filmo
env-backup\restore-env.bat      REM demande le chemin de la cle privee age
start-dawger.bat                REM Docker + attend le site + ouvre l'appli
```

`start-dawger.bat` verifie desormais les `.env` avant de demarrer, et prefere
lancer un `.exe` deja compile (`pc-app\dist\PCDawger-portable.exe` ou
`pc-app\dist\win-unpacked\PC Dawger.exe`) plutot que `npm start` — ca evite
d'avoir besoin de Node.js juste pour ouvrir la fenetre Electron.

## Construire l'appli Electron autonome (a faire une fois, ou apres modif de `pc-app/main.js`)

```
cd pc-app
npm run build
```

Genere dans `pc-app\dist\` :
- `PC Dawger Setup 1.0.0.exe` — installeur classique (raccourci menu demarrer).
- `PCDawger-portable.exe` — **un seul fichier**, aucune installation, aucun
  Node.js requis. C'est celui a copier sur une cle USB / a mettre a cote du
  projet si tu veux la version la plus "transportable".

Ces `.exe` ne sont pas commites dans git (dossier `dist/` gitignore) — a
reconstruire sur chaque machine, ou a copier a la main en plus du `git clone`.

## Recuperer la base de donnees / le cache Redis

Deja gere par le systeme existant, voir `backups/README.md` (memes principes,
memes commandes, meme cle age).
