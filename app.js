// Frame duration approximation (~25 FPS)
const FRAME_TIME = 0.04;

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const editorWrapper = document.getElementById('editor-wrapper');

const mainVideo = document.getElementById('main-video');
const btnPlayPause = document.getElementById('btn-play-pause');
const timeMain = document.getElementById('time-main');
const durationMain = document.getElementById('duration-main');
const seekerMain = document.getElementById('seeker-main');

const timeIn = document.getElementById('time-in');
const timeOut = document.getElementById('time-out');
const seekerIn = document.getElementById('seeker-in');
const seekerOut = document.getElementById('seeker-out');
const canvasIn = document.getElementById('canvas-in');
const canvasOut = document.getElementById('canvas-out');

const btnInPrev = document.getElementById('btn-in-prev');
const btnInNext = document.getElementById('btn-in-next');
const btnSetIn = document.getElementById('btn-set-in');

const btnOutPrev = document.getElementById('btn-out-prev');
const btnOutNext = document.getElementById('btn-out-next');
const btnSetOut = document.getElementById('btn-set-out');

const btnPreviewCut = document.getElementById('btn-preview-cut');
const btnSaveCut = document.getElementById('btn-save-cut');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');

// State
let videoFile = null;
let originalFileName = 'video';
let cutInTime = 0;
let cutOutTime = 0;
let isPreviewingCut = false;

// Format mm:ss.ms
function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00.00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

// Drag & Drop
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) loadVideo(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) loadVideo(e.target.files[0]);
});

function loadVideo(file) {
  videoFile = file;
  originalFileName = file.name.replace(/\.[^/.]+$/, "");
  const url = URL.createObjectURL(file);
  mainVideo.src = url;
  editorWrapper.classList.remove('hidden');
  dropZone.classList.add('hidden');
}

mainVideo.addEventListener('loadedmetadata', () => {
  const duration = mainVideo.duration;
  seekerMain.max = duration;
  seekerIn.max = duration;
  seekerOut.max = duration;
  
  durationMain.textContent = formatTime(duration);
  
  cutInTime = 0;
  cutOutTime = duration;
  
  seekerIn.value = cutInTime;
  seekerOut.value = cutOutTime;
  
  updateInPreview();
  updateOutPreview();
});

// Update video timeline
mainVideo.addEventListener('timeupdate', () => {
  if (!isPreviewingCut) {
    seekerMain.value = mainVideo.currentTime;
    timeMain.textContent = formatTime(mainVideo.currentTime);
  } else {
    seekerMain.value = mainVideo.currentTime;
    timeMain.textContent = formatTime(mainVideo.currentTime);
    if (mainVideo.currentTime >= cutOutTime) {
      mainVideo.pause();
      isPreviewingCut = false;
      btnPlayPause.textContent = '▶ Lecture';
    }
  }
});

seekerMain.addEventListener('input', () => {
  mainVideo.currentTime = parseFloat(seekerMain.value);
});

btnPlayPause.addEventListener('click', () => {
  isPreviewingCut = false;
  if (mainVideo.paused) {
    mainVideo.play();
    btnPlayPause.textContent = '⏸ Pause';
  } else {
    mainVideo.pause();
    btnPlayPause.textContent = '▶ Lecture';
  }
});

// Helper for canvas frame rendering
function renderFrameToCanvas(time, canvas) {
  const tempVid = document.createElement('video');
  tempVid.src = mainVideo.src;
  tempVid.currentTime = time;
  tempVid.addEventListener('seeked', () => {
    canvas.width = tempVid.videoWidth || 640;
    canvas.height = tempVid.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(tempVid, 0, 0, canvas.width, canvas.height);
  }, { once: true });
}

function updateInPreview() {
  timeIn.textContent = formatTime(cutInTime);
  seekerIn.value = cutInTime;
  renderFrameToCanvas(cutInTime, canvasIn);
}

function updateOutPreview() {
  timeOut.textContent = formatTime(cutOutTime);
  seekerOut.value = cutOutTime;
  renderFrameToCanvas(cutOutTime, canvasOut);
}

// IN Controls
seekerIn.addEventListener('input', () => {
  cutInTime = Math.min(parseFloat(seekerIn.value), cutOutTime - 0.1);
  updateInPreview();
});
btnSetIn.addEventListener('click', () => {
  cutInTime = Math.min(mainVideo.currentTime, cutOutTime - 0.1);
  updateInPreview();
});
btnInPrev.addEventListener('click', () => {
  cutInTime = Math.max(0, cutInTime - FRAME_TIME);
  updateInPreview();
});
btnInNext.addEventListener('click', () => {
  cutInTime = Math.min(mainVideo.duration, cutInTime + FRAME_TIME, cutOutTime - 0.1);
  updateInPreview();
});

// OUT Controls
seekerOut.addEventListener('input', () => {
  cutOutTime = Math.max(parseFloat(seekerOut.value), cutInTime + 0.1);
  updateOutPreview();
});
btnSetOut.addEventListener('click', () => {
  cutOutTime = Math.max(mainVideo.currentTime, cutInTime + 0.1);
  updateOutPreview();
});
btnOutPrev.addEventListener('click', () => {
  cutOutTime = Math.max(0, cutOutTime - FRAME_TIME, cutInTime + 0.1);
  updateOutPreview();
});
btnOutNext.addEventListener('click', () => {
  cutOutTime = Math.min(mainVideo.duration, cutOutTime + FRAME_TIME);
  updateOutPreview();
});

// Preview cut
btnPreviewCut.addEventListener('click', () => {
  isPreviewingCut = true;
  mainVideo.currentTime = cutInTime;
  mainVideo.play();
  btnPlayPause.textContent = '⏸ Pause';
});

// Smooth Real-time Video Stream Capture & Export
btnSaveCut.addEventListener('click', async () => {
  if (cutOutTime <= cutInTime) return;
  
  btnSaveCut.disabled = true;
  btnPreviewCut.disabled = true;
  progressBar.style.display = 'block';
  progressFill.style.width = '0%';

  mainVideo.pause();

  const exportVid = document.createElement('video');
  exportVid.src = mainVideo.src;
  exportVid.muted = false;
  exportVid.volume = 1.0;
  
  await new Promise(r => {
    exportVid.onloadedmetadata = r;
    exportVid.load();
  });

  const canvas = document.createElement('canvas');
  canvas.width = exportVid.videoWidth || 1280;
  canvas.height = exportVid.videoHeight || 720;
  const ctx = canvas.getContext('2d');

  // Web Audio setup to route audio smoothly into stream
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(exportVid);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  let mimeType = 'video/mp4;codecs=avc1';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp9';
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 5000000
  });

  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${originalFileName}_cut.mp4`;
    a.click();

    audioCtx.close();
    btnSaveCut.disabled = false;
    btnPreviewCut.disabled = false;
    progressBar.style.display = 'none';
  };

  exportVid.currentTime = cutInTime;
  await new Promise(r => exportVid.onseeked = r);

  recorder.start();
  exportVid.play();

  const duration = cutOutTime - cutInTime;

  function renderLoop() {
    if (exportVid.currentTime >= cutOutTime || exportVid.ended) {
      exportVid.pause();
      if (recorder.state !== 'inactive') recorder.stop();
      return;
    }

    ctx.drawImage(exportVid, 0, 0, canvas.width, canvas.height);
    const progress = ((exportVid.currentTime - cutInTime) / duration) * 100;
    progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;

    requestAnimationFrame(renderLoop);
  }

  renderLoop();
});

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    console.log('Service Worker Enregistré');
  });
}
