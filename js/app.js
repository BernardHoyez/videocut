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
      // Essayer d'estimer le FPS via requestVideoFrameCallback si dispo
      estimateFps();
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
      <p style="color:var(--text-muted)">Chargement du moteur vidéo…</p>
    `;
    document.body.appendChild(overlay);

    try {
      // FFmpeg.wasm v0.12+ API (UMD global FFmpeg)
      const { FFmpeg } = FFmpegWASM;
      ffmpeg = new FFmpeg();
      ffmpeg.on('log', ({ message }) => {
        // console.log(message);
      });
      ffmpeg.on('progress', ({ progress }) => {
        const pct = Math.min(99, Math.round(progress * 100));
        progressBar.style.width = pct + '%';
        progressText.textContent = `Encodage… ${pct}%`;
      });

      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
      });
      ffmpegLoaded = true;
      return ffmpeg;
    } catch (err) {
      console.error(err);
      showToast('Échec du chargement de FFmpeg. Vérifiez votre connexion.', 'error');
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
    progressBar.style.width = '0%';
    progressText.textContent = 'Préparation…';

    try {
      await loadFFmpeg();

      const inputName = 'input' + getExt(sourceFile.name);
      const outputName = 'output_cut.mp4';

      progressText.textContent = 'Chargement du fichier…';
      const data = await sourceFile.arrayBuffer();
      await ffmpeg.writeFile(inputName, new Uint8Array(data));

      progressText.textContent = 'Découpe en cours…';
      // -ss avant -i = seek rapide ; -to pour durée relative alternative : -t
      // On utilise -ss start -to end pour précision
      await ffmpeg.exec([
        '-ss', String(startTime),
        '-to', String(endTime),
        '-i', inputName,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        outputName
      ]);

      progressText.textContent = 'Finalisation…';
      progressBar.style.width = '100%';

      const outData = await ffmpeg.readFile(outputName);
      const blob = new Blob([outData.buffer], { type: 'video/mp4' });
      const baseName = sourceFile.name.replace(/\.[^.]+$/, '');
      const outName = `${baseName}_cut.mp4`;

      downloadBlob(blob, outName);
      showToast(`Export terminé : ${outName}`, 'success');

      // Cleanup
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (_) {}
    } catch (err) {
      console.error(err);
      showToast('Erreur pendant l\'export. Réessayez.', 'error');
    } finally {
      isExporting = false;
      btnExport.disabled = false;
      setTimeout(() => { exportProgress.hidden = true; }, 800);
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
