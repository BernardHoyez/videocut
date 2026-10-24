# VideoCut

**PWA d'édition vidéo** — découpe rapide d'une séquence dans un rush, 100 % dans le navigateur.

## Fonctionnalités

- Glisser-déposer ou sélection de fichiers vidéo (MP4, WebM, MOV, MKV…)
- Lecteur du rush intégral (lecture / pause / stop + temps `mm:ss.ms`)
- Point de début et de fin du cut :
  - Aperçu image fixe
  - Curseur temporel
  - Boutons **−1 image** / **+1 image**
  - « Utiliser position actuelle » du lecteur principal
- Aperçu du segment sélectionné
- Export en **`nomfichier_cut.mp4`** (H.264 + AAC) via FFmpeg.wasm
- Aucune donnée envoyée à un serveur

## Déploiement GitHub Pages

1. Créer un dépôt GitHub (ex. `videocut`)
2. Pousser le contenu de ce dossier à la racine (ou dans `/docs`)
3. Settings → Pages → Source : **Deploy from a branch** → `main` / root (ou `/docs`)
4. L'URL sera du type : `https://<user>.github.io/videocut/`

> **Important** : le service worker utilise un nom de cache horodaté (`Date.now()`) pour **briser les caches** à chaque nouveau déploiement. Les visiteurs récupèrent automatiquement la dernière version.

### Commandes rapides

```bash
# Depuis la racine du projet cloné
git init
git add .
git commit -m "VideoCut PWA"
git branch -M main
git remote add origin https://github.com/<user>/videocut.git
git push -u origin main
```

Puis activer GitHub Pages dans les réglages du dépôt.

## Développement local

Servir en HTTP (les modules et le service worker exigent un contexte sécurisé) :

```bash
npx serve .
# ou
python3 -m http.server 8080
```

Ouvrir `http://localhost:8080`.

## Structure

```
videocut/
├── index.html
├── manifest.json
├── sw.js                 # Service Worker (cache-bust)
├── css/styles.css
├── js/
│   ├── app.js
│   └── ffmpeg.min.js     # @ffmpeg/ffmpeg UMD
└── icons/
    ├── icon.svg
    ├── icon-192.png
    └── icon-512.png
```

## Licence

MIT — libre d'usage.
