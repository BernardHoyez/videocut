# VideoCut

**PWA – Éditeur vidéo minimal**  
Découpez une séquence dans un rush et exportez-la en MP4.  
Tout le traitement se fait **localement dans le navigateur** (FFmpeg.wasm). Aucune donnée n’est envoyée sur un serveur.

## Fonctionnalités

- Import vidéo : MP4, WebM, MOV, MKV, AVI…
- Sélection précise du début / fin (curseurs + saisie manuelle)
- Aperçu du segment sélectionné
- Export MP4 (copie de flux si possible, sinon ré-encodage H.264)
- Progressive Web App installable
- Service Worker avec **cache-busting** (brisage des anciens caches à chaque version)
- 100 % offline après le premier chargement (hors core FFmpeg CDN)

## Déploiement sur GitHub Pages

1. Créez un dépôt GitHub (ex. `videocut`).
2. Poussez le contenu de ce dossier à la racine du dépôt (ou dans le branch `gh-pages`).
3. Dans **Settings → Pages** :
   - Source : Deploy from a branch
   - Branch : `main` (ou `gh-pages`) / folder `/ (root)`
4. L’application sera disponible à  
   `https://<votre-user>.github.io/videocut/`

> **Note** : Si le dépôt n’est pas à la racine du domaine, le Service Worker et le manifest utilisent des chemins relatifs (`./`) et fonctionnent correctement en sous-dossier.

### Headers recommandés (optionnel)

Pour de meilleures performances multi-thread FFmpeg (non obligatoire ici, on utilise le core single-thread) :

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

GitHub Pages ne permet pas facilement de les définir ; le mode single-thread fonctionne sans.

## Développement local

Servez le dossier avec n’importe quel serveur statique (obligatoire pour le Service Worker et CORS des modules) :

```bash
npx serve .
# ou
python -m http.server 8080
```

Ouvrez `http://localhost:8080`.

## Structure

```
videocut/
├── index.html
├── style.css
├── app.js
├── sw.js              # Service Worker (brise caches)
├── manifest.json
├── icon.svg
├── icon-192.png
├── icon-512.png
└── README.md
```

## Limites

- Taille des fichiers limitée par la mémoire du navigateur (~1–2 Go selon l’appareil).
- Le premier export charge le core FFmpeg (~25 Mo) depuis le CDN.
- Certains conteneurs / codecs peuvent forcer un ré-encodage (plus lent).

## Licence

MIT – libre d’utilisation et de modification.
