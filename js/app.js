/**
 * VideoCut — PWA éditeur de découpe vidéo
 * Traitement 100 % local via FFmpeg.wasm
 */

(() => {
  'use strict';

  // ---------- DOM refs ----------
  const $ = (sel) => document.querySelector(sel);
  const dropZone = $('#drop-zone');
  const fileInput = $('#file-input');
  const editor = $('#editor');
  const btnNew = $('#btn-new');

  const videoRush = $('#video-rush');
  const rushSeek = $('#rush-seek');
  const rushTime = $('#rush-time');
  const rushDuration = $('#rush-duration');
  const btnPlayRush = $('#btn-play-rush');
  const btnStopRush = $('#btn-stop-rush');
  const rushOverlay = $('#rush-overlay');

  const canvasStart = $('#canvas-start');
  const canvasEnd = $('#canvas-end');
  const startSeek = $('#start-seek');
  const endSeek = $('#end-seek');
  const startTimeEl = $('#start-time');
  const endTimeEl = $('#end-time');
  const btnStartMinus = $('#btn-start-minus');
  const btnStartPlus = $('#btn-start-plus');
  const btnEndMinus = $('#btn-end-minus');
  const btnEndPlus = $('#btn-end-plus');
  const btnSetStart = $('#btn-set-start');
  const btnSetEnd = $('#btn-set-end');

  const videoPreview = $('#video-preview');
  const cutDurationEl = $('#cut-duration');
  const btnPlayPreview = $('#btn-play-preview');
  const previewOverlay = $('#preview-overlay');
  const btnExport = $('#btn-export');
  const exportProgress = $('#export-progress');
  const progressBar = $('#progress-bar');
  const progressText = $('#progress-text');
  const toastEl = $('#toast');

  // ---------- State ----------
  let sourceFile = null;
  let sourceUrl = null;
  let duration = 0;
  let fps = 30; // estimation, affiné si possible
  let startTime = 0;
  let endTime = 0;
  let ffmpeg = null;
  let ffmpegLoaded = false;
  let isExporting = false;

  // ---------- Utils ----------
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  function showToast(msg, type = '') {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (type ? ` ${type}` : '');
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => { toastEl.hidden = true; }, 300);
    }, 3200);
  }

  function frameDuration() {
    return 1 / fps;
  }

  // ---------- File handling ----------
  function handleFile(file) {
    if (!file || !file.type.startsWith('video/') && !/\.(mkv|mov|avi|m4v|webm|mp4)$/i.test(file.name)) {
      showToast('Fichier non supporté. Choisissez une vidéo.', 'error');
      return;
    }
    reset();
    sourceFile = file;
    sourceUrl = URL.createObjectURL(file);
    videoRush.src = sourceUrl;
    videoPreview.src = sourceUrl;

    videoRush.onloadedmetadata = () => {
      duration = videoRush.duration;
      endTime = duration;
      rushSeek.max = Math.floor(duration * 1000);
      startSeek.max = Math.floor(duration * 1000);
      endSeek.max = Math.floor(duration * 1000);
      endSeek.value = Math.floor(duration * 1000);
      rushDuration.textContent = formatTime(duration);
      updateUI();
      captureFrame(canvasStart, 0);
      captureFrame(canvasEnd, duration);
      dropZone.hidden = true;
      editor.hidden = false;
      btnNew.hidden = false;
      btnExport.disabled = false;
      showToast(`Vidéo chargée : ${file.name}`);
      estimateFps();
      // Préchargement du moteur en arrière-plan (export plus rapide)
      loadFFmpeg().catch(() => {});
    };

    videoRush.onerror = () => {
      showToast('Impossible de lire cette vidéo dans le navigateur.', 'error');
      reset();
    };
  }

  function estimateFps() {
    // Approximation simple : beaucoup de vidéos sont 25/30/60
    // On utilise 30 par défaut ; le frame stepping reste utilisable
    fps = 30;
  }

  function reset() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceFile = null;
    sourceUrl = null;
    duration = 0;
    startTime = 0;
    endTime = 0;
    videoRush.removeAttribute('src');
    videoPreview.removeAttribute('src');
    videoRush.load();
    videoPreview.load();
    editor.hidden = true;
    dropZone.hidden = false;
    btnNew.hidden = true;
    btnExport.disabled = true;
    exportProgress.hidden = true;
    clearCanvas(canvasStart);
    clearCanvas(canvasEnd);
  }

  function clearCanvas(c) {
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width || 320, c.height || 180);
  }

  // ---------- Capture frame ----------
  let captureBusy = false;
  function captureFrame(canvas, time) {
    return new Promise((resolve) => {
      if (!sourceUrl || !videoRush.videoWidth) {
        clearCanvas(canvas);
        resolve();
        return;
      }
      // Utilise une vidéo temporaire pour ne pas perturber le lecteur principal
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = sourceUrl;

      const finish = () => {
        try {
          const w = v.videoWidth || 640;
          const h = v.videoHeight || 360;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(v, 0, 0, w, h);
        } catch (e) { console.warn(e); }
        v.removeAttribute('src');
        v.load();
        resolve();
      };

      v.addEventListener('seeked', finish, { once: true });
      v.addEventListener('error', () => { clearCanvas(canvas); resolve(); }, { once: true });
      v.addEventListener('loadeddata', () => {
        const t = Math.min(Math.max(0, time), (duration || v.duration || 0) - 0.001);
        if (Math.abs(v.currentTime - t) < 0.001) {
          finish();
        } else {
          v.currentTime = t;
        }
      }, { once: true });
    });
  }

  // ---------- UI updates ----------
  function updateUI() {
    startTimeEl.textContent = formatTime(startTime);
    endTimeEl.textContent = formatTime(endTime);
    cutDurationEl.textContent = formatTime(Math.max(0, endTime - startTime));
    startSeek.value = Math.floor(startTime * 1000);
    endSeek.value = Math.floor(endTime * 1000);
  }

  function setStart(t) {
    startTime = Math.max(0, Math.min(t, endTime - 0.04));
    updateUI();
    captureFrame(canvasStart, startTime);
  }

  function setEnd(t) {
    endTime = Math.min(duration, Math.max(t, startTime + 0.04));
    updateUI();
    captureFrame(canvasEnd, endTime);
  }

  // ---------- Rush player ----------
  function toggleRushPlay() {
    if (videoRush.paused) {
      videoRush.play();
      setPlayIcon(btnPlayRush, true);
    } else {
      videoRush.pause();
      setPlayIcon(btnPlayRush, false);
    }
  }

  function setPlayIcon(btn, playing) {
    const play = btn.querySelector('.icon-play');
    const pause = btn.querySelector('.icon-pause');
    if (play) play.hidden = playing;
    if (pause) pause.hidden = !playing;
  }

  videoRush.addEventListener('timeupdate', () => {
    rushTime.textContent = formatTime(videoRush.currentTime);
    if (!rushSeek.matches(':active')) {
      rushSeek.value = Math.floor(videoRush.currentTime * 1000);
    }
  });

  videoRush.addEventListener('play', () => setPlayIcon(btnPlayRush, true));
  videoRush.addEventListener('pause', () => setPlayIcon(btnPlayRush, false));
  videoRush.addEventListener('ended', () => setPlayIcon(btnPlayRush, false));

  rushSeek.addEventListener('input', () => {
    const t = rushSeek.value / 1000;
    videoRush.currentTime = t;
    rushTime.textContent = formatTime(t);
  });

  btnPlayRush.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleRushPlay();
  });
  rushOverlay.addEventListener('click', toggleRushPlay);
  btnStopRush.addEventListener('click', () => {
    videoRush.pause();
    videoRush.currentTime = 0;
    setPlayIcon(btnPlayRush, false);
  });

  // ---------- Start / End controls ----------
  startSeek.addEventListener('input', () => {
    setStart(startSeek.value / 1000);
  });
  endSeek.addEventListener('input', () => {
    setEnd(endSeek.value / 1000);
  });

  btnStartMinus.addEventListener('click', () => setStart(startTime - frameDuration()));
  btnStartPlus.addEventListener('click', () => setStart(startTime + frameDuration()));
  btnEndMinus.addEventListener('click', () => setEnd(endTime - frameDuration()));
  btnEndPlus.addEventListener('click', () => setEnd(endTime + frameDuration()));

  btnSetStart.addEventListener('click', () => setStart(videoRush.currentTime));
  btnSetEnd.addEventListener('click', () => setEnd(videoRush.currentTime));

  // ---------- Preview segment ----------
  let previewPlaying = false;

  function playPreviewSegment() {
    if (!sourceUrl) return;
    videoPreview.currentTime = startTime;
    videoPreview.play();
    previewPlaying = true;
    setPlayIcon(btnPlayPreview, true);

    const check = () => {
      if (!previewPlaying) return;
      if (videoPreview.currentTime >= endTime - 0.05) {
        videoPreview.pause();
        previewPlaying = false;
        setPlayIcon(btnPlayPreview, false);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  function stopPreview() {
    videoPreview.pause();
    previewPlaying = false;
    setPlayIcon(btnPlayPreview, false);
  }

  btnPlayPreview.addEventListener('click', (e) => {
    e.stopPropagation();
    if (previewPlaying) stopPreview();
    else playPreviewSegment();
  });
  previewOverlay.addEventListener('click', () => {
    if (previewPlaying) stopPreview();
    else playPreviewSegment();
  });

  videoPreview.addEventListener('ended', () => {
    previewPlaying = false;
    setPlayIcon(btnPlayPreview, false);
  });

  // ---------- FFmpeg export ----------
  async function loadFFmpeg() {
    if (ffmpegLoaded) return ffmpeg;

    const overlay = document.createElement('div');
    overlay.className = 'loading-ffmpeg';
    overlay.innerHTML = `
      <div class="spinner"></div>
      <p id="ffmpeg-load-msg" style="color:var(--text-muted);max-width:280px;text-align:center">
        Chargement du moteur vidéo…<br>
        <small style="opacity:0.7">~30 Mo — une seule fois</small>
      </p>
      <div style="width:220px;height:6px;background:var(--border);border-radius:3px;margin-top:8px;overflow:hidden">
        <div id="ffmpeg-load-bar" style="height:100%;width:0%;background:var(--accent);transition:width 0.3s"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const msgEl = overlay.querySelector('#ffmpeg-load-msg');
    const barEl = overlay.querySelector('#ffmpeg-load-bar');

    const setProgress = (pct, text) => {
      barEl.style.width = Math.min(100, pct) + '%';
      if (text) msgEl.innerHTML = text;
    };

    try {
      if (typeof FFmpegWASM === 'undefined' || !FFmpegWASM.FFmpeg) {
        throw new Error('FFmpegWASM non chargé — rechargez la page (Ctrl+Shift+R)');
      }
      const { FFmpeg } = FFmpegWASM;

      // toBlobURL local (évite la dépendance FFmpegUtil)
      async function toBlobURL(url, mime) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Impossible de charger ' + url + ' (' + res.status + ')');
        const buf = await res.arrayBuffer();
        return URL.createObjectURL(new Blob([buf], { type: mime }));
      }

      ffmpeg = new FFmpeg();
      ffmpeg.on('log', ({ message }) => {
        // console.log('[ffmpeg]', message);
      });
      ffmpeg.on('progress', ({ progress }) => {
        const pct = Math.min(99, Math.round(progress * 100));
        progressBar.style.width = pct + '%';
        progressText.textContent = `Encodage… ${pct}%`;
      });

      // Chemins locaux (même origine) — évite les blocages CDN
      const base = new URL('js/ffmpeg-core/', window.location.href).href;

      setProgress(10, 'Téléchargement du moteur…<br><small style="opacity:0.7">ffmpeg-core.js</small>');
      const coreURL = await toBlobURL(base + 'ffmpeg-core.js', 'text/javascript');
      setProgress(40, 'Téléchargement du moteur…<br><small style="opacity:0.7">ffmpeg-core.wasm (~30 Mo)</small>');
      const wasmURL = await toBlobURL(base + 'ffmpeg-core.wasm', 'application/wasm');
      setProgress(75, 'Initialisation du moteur…');

      // Timeout de sécurité (90 s)
      const loadPromise = ffmpeg.load({ coreURL, wasmURL });
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout : chargement > 90 s')), 90000)
      );
      await Promise.race([loadPromise, timeout]);

      setProgress(100, 'Moteur prêt');
      ffmpegLoaded = true;
      return ffmpeg;
    } catch (err) {
      console.error(err);
      const hint = err.message && err.message.includes('Timeout')
        ? 'Le chargement a pris trop de temps. Rechargez la page et réessayez.'
        : 'Échec du chargement de FFmpeg. Rechargez la page.';
      showToast(hint, 'error');
      throw err;
    } finally {
      overlay.remove();
    }
  }

  async function exportCut() {
    if (!sourceFile || isExporting) return;
    if (endTime - startTime < 0.1) {
      showToast('Le segment est trop court.', 'error');
      return;
    }

    isExporting = true;
    btnExport.disabled = true;
    exportProgress.hidden = false;
    progressBar.style.width = '5%';
    progressText.textContent = 'Préparation…';

    const inputName = 'input' + getExt(sourceFile.name);
    const outputName = 'output_cut.mp4';
    const cutDuration = Math.max(0.1, endTime - startTime);
    let lastFFmpegLog = '';

    try {
      await loadFFmpeg();

      // Capturer les logs pour diagnostiquer les erreurs
      const logHandler = ({ message }) => {
        lastFFmpegLog = message;
        if (/error|failed|invalid/i.test(message)) {
          console.warn('[ffmpeg]', message);
        }
      };
      ffmpeg.on('log', logHandler);

      progressBar.style.width = '15%';
      progressText.textContent = 'Chargement du fichier dans le moteur…';
      const data = new Uint8Array(await sourceFile.arrayBuffer());
      await ffmpeg.writeFile(inputName, data);

      progressBar.style.width = '30%';
      progressText.textContent = 'Découpe (copie rapide)…';

      // 1) Essai stream-copy (très rapide, pas de ré-encodage)
      let ok = false;
      try {
        await ffmpeg.exec([
          '-ss', String(startTime),
          '-i', inputName,
          '-t', String(cutDuration),
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          '-y',
          outputName
        ]);
        // Vérifier que le fichier de sortie n'est pas vide
        const probe = await ffmpeg.readFile(outputName);
        if (probe && probe.length > 1000) ok = true;
        else try { await ffmpeg.deleteFile(outputName); } catch (_) {}
      } catch (e1) {
        console.warn('Stream copy failed, fallback re-encode', e1);
        try { await ffmpeg.deleteFile(outputName); } catch (_) {}
      }

      // 2) Fallback : ré-encodage H.264 / AAC
      if (!ok) {
        progressText.textContent = 'Ré-encodage H.264…';
        progressBar.style.width = '40%';
        await ffmpeg.exec([
          '-ss', String(startTime),
          '-i', inputName,
          '-t', String(cutDuration),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ac', '2',
          '-movflags', '+faststart',
          '-y',
          outputName
        ]);
      }

      progressText.textContent = 'Finalisation…';
      progressBar.style.width = '95%';

      const outData = await ffmpeg.readFile(outputName);
      if (!outData || outData.length < 1000) {
        throw new Error('Fichier de sortie vide ou trop petit. ' + (lastFFmpegLog || ''));
      }

      // outData is Uint8Array — use .buffer carefully (may be SharedArrayBuffer slice)
      const bytes = outData instanceof Uint8Array ? outData : new Uint8Array(outData);
      const blob = new Blob([bytes], { type: 'video/mp4' });
      const baseName = sourceFile.name.replace(/\.[^.]+$/, '');
      const outName = `${baseName}_cut.mp4`;

      downloadBlob(blob, outName);
      progressBar.style.width = '100%';
      showToast(`Export terminé : ${outName}`, 'success');

      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (_) {}
    } catch (err) {
      console.error('Export error:', err);
      const detail = (err && err.message) ? err.message : String(err);
      const short = detail.length > 120 ? detail.slice(0, 120) + '…' : detail;
      showToast('Erreur export : ' + short, 'error');
      progressText.textContent = 'Échec';
    } finally {
      isExporting = false;
      btnExport.disabled = false;
      setTimeout(() => { exportProgress.hidden = true; }, 1500);
    }
  }

  function getExt(name) {
    const m = name.match(/\.[^.]+$/);
    return m ? m[0].toLowerCase() : '.mp4';
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  btnExport.addEventListener('click', exportCut);

  // ---------- Drag & drop / file input ----------
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) handleFile(f);
    fileInput.value = '';
  });

  btnNew.addEventListener('click', () => {
    if (confirm('Commencer un nouveau projet ? La vidéo actuelle sera fermée.')) {
      reset();
    }
  });

  // ---------- Keyboard shortcuts (optionnel) ----------
  document.addEventListener('keydown', (e) => {
    if (!sourceFile) return;
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      toggleRushPlay();
    }
  });
})();
