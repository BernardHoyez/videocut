# videocut ✂️

PWA d'édition et de découpe de séquences vidéo directement dans le navigateur client-side avec rendu fluide.

## Déploiement GitHub Pages
1. Décompressez l'archive ZIP.
2. Créez un dépôt GitHub nommé `videocut`.
3. Poussez tous les fichiers (`index.html`, `app.js`, `sw.js`, `manifest.json`) à la racine de la branche `main` ou `gh-pages`.
4. Activez GitHub Pages dans les paramètres du dépôt (Settings -> Pages -> Source: Deploy from a branch).

## Fonctionnalités
- Glisser-déposer / sélection vidéo (MP4, WebM, MOV, MKV...).
- Découpe millimétrée (+1 / -1 image).
- Prévisualisations temps réel des images de début (IN) et de fin (OUT).
- Aperçu en lecture restreinte du cut.
- Exportation fluide à 30 IPS et débit 5 Mbps (`*_cut.mp4`).
- PWA autonome avec Service Worker brise-cache.
