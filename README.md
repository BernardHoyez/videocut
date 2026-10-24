# videocut — PWA

## Déploiement GitHub Pages
1. Décompresser l'archive.
2. Copier le contenu du dossier `videocut` à la racine du dépôt GitHub Pages (ou dans un sous-dossier).
3. Activer GitHub Pages dans Settings → Pages.
4. Ouvrir l'URL en HTTPS. Pour installer la PWA, utiliser le menu du navigateur.

## Fonctionnement
- Import par sélection ou glisser-déposer.
- Début/fin réglables par curseurs ou saisie `mm:ss.ms` (ex. `01:23.450`).
- Aperçu de la séquence sélectionnée.
- Export MP4 : essai `-c copy`, puis H.264 ultrafast en cas d'échec.
- Fichiers traités dans le navigateur ; FFmpeg.wasm et son cœur sont chargés depuis jsDelivr lors du premier export.

## Limites importantes
- Le support de MOV/MKV et autres conteneurs dépend de FFmpeg, mais l'aperçu dépend des codecs pris en charge par le navigateur.
- La coupe sans ré-encodage peut tomber sur une image clé et ne pas être à l'image exacte.
- Le ré-encodage peut être long et gourmand en mémoire. Les très gros rushes peuvent échouer.
- Le service worker met en cache les fichiers de l'application, pas FFmpeg ni les vidéos. Le premier export nécessite Internet.
- GitHub Pages ne permet pas de configurer librement les en-têtes COOP/COEP ; cette version utilise le cœur FFmpeg non multithread.

## Fichiers
- `index.html`, `style.css`, `app.js`
- `manifest.json`, `icon-192.png`, `icon-512.png`
- `brise-caches.js` (service worker)
