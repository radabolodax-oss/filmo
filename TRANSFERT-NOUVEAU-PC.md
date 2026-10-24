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

**Important** : copie aussi le fichier de la cle privee lui-meme sur le
Bureau du nouveau PC, sous le nom exact `dawger-backups-age-key.txt`
(`%USERPROFILE%\Desktop\dawger-backups-age-key.txt`). `restore-env.bat` le
detecte automatiquement a cet endroit et n'a rien a demander ; sinon il
retombe sur une saisie manuelle du chemin.

## Sur le nouveau PC

Prerequis (le seul qui ne s'automatise pas) :
[Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)
installe et lance (WSL2 + redemarrage requis, ne peut pas se faire
silencieusement). `setup-new-pc.bat` ouvre ce lien tout seul si Docker
manque.

```
git clone https://github.com/radabolodax-oss/filmo.git
cd filmo
setup-new-pc.bat
```

`setup-new-pc.bat` verifie/installe `age` et Node.js (winget), verifie Docker
(et ouvre la page d'installation si absent), puis enchaine automatiquement
`env-backup\restore-env.bat` (cle recuperee automatiquement depuis le Bureau,
voir plus haut) et `start-dawger.bat`.

Pour ne faire qu'une etape a la fois (ou si tu preferes tout controler a la
main), les scripts individuels marchent aussi :

```
env-backup\restore-env.bat      REM cle auto-detectee sur le Bureau, sinon demandee
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
