# env-backup/

Chiffre les 3 `.env` du projet (racine, `API/Mainapi`, `API/proxiesembed`) avec
`age`, sur le meme principe que `backups/README.md` pour la base de donnees.
Ces `.env` contiennent les vrais secrets (cles API, mots de passe DB, JWT...)
et sont gitignores — sans ca, un `git clone` sur un nouveau PC recupere tout
le code mais aucun `.env`, et rien ne demarre.

- **`.age` ici** — chiffres, safe a committer. C'est le seul moyen par
  lequel les secrets traversent git.
- **`.env` reels** (racine, `API/Mainapi/`, `API/proxiesembed/`) — jamais
  commites, jamais copies ici en clair.

## Cle privee

Meme cle age que `backups/` (voir `backups/README.md`) — generee une fois
avec `age-keygen`, stockee hors du repo (gestionnaire de mots de passe, etc).
Sans elle, ces `.age` sont definitivement illisibles.

Cle publique (sert uniquement a chiffrer, safe a partager) :
```
age1ndjrjdazg6prmdwmxmfp0agvfwuuttd7ltldycga3n8h2808hf5skex2v0
```

## Utilisation

**Apres avoir modifie un `.env`** (nouvelle cle API, etc.) — depuis la racine
du projet :
```
env-backup\backup-env.bat
git add env-backup\*.age
git commit -m "Update encrypted .env backups"
git push
```

**Sur un nouveau PC**, apres `git clone` :
```
env-backup\restore-env.bat
```
Le script cherche d'abord la cle privee a
`%USERPROFILE%\Desktop\dawger-backups-age-key.txt` et l'utilise
automatiquement si elle y est (copie le fichier de cle a cet endroit precis
avant de lancer le script pour eviter la saisie manuelle) ; sinon il demande
le chemin. Il recree ensuite les 3 `.env` a leur bon endroit. Lance ensuite
`start-dawger.bat` normalement (ou `setup-new-pc.bat` qui enchaine tout).
