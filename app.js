(() => {
  "use strict";

  const { FFmpeg } = FFmpegWASM;
  const { fetchFile, toBlobURL } = FFmpegUtil;

  // DOM
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const uploadSection = document.getElementById("upload-section");
  const editorSection = document.getElementById("editor-section");
  const preview = document.getElementById("preview");
  const fileNameEl = document.getElementById("file-name");
  const durationEl = document.getElementById("duration");
  const startRange = document.getElementById("start-range");
  const endRange = document.getElementById("end-range");
  const startTimeInput = document.getElementById("start-time");
  const endTimeInput = document.getElementById("end-time");
  const startLabel = document.getElementById("start-label");
  const endLabel = document.getElementById("end-label");
  const btnPreviewCut = document.getElementById("btn-preview-cut");
  const btnExport = document.getElementById("btn-export");
  const btnReset = document.getElementById("btn-reset");
  const progressContainer = document.getElementById("progress-container");
  const progressFill = document.getElementById("progress-fill");
  const progressText = document.getElementById("progress-text");
  const statusEl = document.getElementById("status");

  let currentFile = null;
  let duration = 0;
  let ffmpeg = null;
  let ffmpegLoaded = false;
  let isProcessing = false;

  // ——— Utils ———
  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  }

  function parseTime(str) {
    str = str.trim();
    // Accept mm:ss.ms or ss.ms or just seconds
    const parts = str.split(":");
    let total = 0;
    if (parts.length === 2) {
      total = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    } else {
      total = parseFloat(str);
    }
    return isNaN(total) ? 0 : Math.max(0, total);
  }

  function setStatus(msg, type = "") {
    statusEl.textContent = msg;
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function setProgress(ratio) {
    const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
    progressFill.style.width = pct + "%";
    progressText.textContent = pct + " %";
  }

  // ——— File loading ———
  function handleFile(file) {
    if (!file || !file.type.startsWith("video/")) {
      setStatus("Fichier non supporté. Choisissez une vidéo.", "error");
      return;
    }
    currentFile = file;
    const url = URL.createObjectURL(file);
    preview.src = url;
    fileNameEl.textContent = file.name;
    fileNameEl.title = file.name;

    preview.onloadedmetadata = () => {
      duration = preview.duration;
      durationEl.textContent = formatTime(duration);
      startRange.max = 1000;
      endRange.max = 1000;
      startRange.value = 0;
      endRange.value = 1000;
      updateFromRanges();
      uploadSection.classList.add("hidden");
      editorSection.classList.remove("hidden");
      btnPreviewCut.disabled = false;
      btnExport.disabled = false;
      setStatus("");
    };

    preview.onerror = () => {
      setStatus("Impossible de lire cette vidéo.", "error");
      URL.revokeObjectURL(url);
    };
  }

  // ——— Range / time sync ———
  function updateFromRanges() {
    const start = (startRange.value / 1000) * duration;
    const end = (endRange.value / 1000) * duration;
    // Ensure start < end
    if (start >= end) {
      if (document.activeElement === startRange) {
        endRange.value = Math.min(1000, Number(startRange.value) + 1);
      } else {
        startRange.value = Math.max(0, Number(endRange.value) - 1);
      }
      return updateFromRanges();
    }
    startTimeInput.value = formatTime(start);
    endTimeInput.value = formatTime(end);
    startLabel.textContent = formatTime(start);
    endLabel.textContent = formatTime(end);
  }

  function updateFromInputs() {
    let start = parseTime(startTimeInput.value);
    let end = parseTime(endTimeInput.value);
    start = Math.min(start, duration);
    end = Math.min(end, duration);
    if (start >= end) end = Math.min(duration, start + 0.1);
    startRange.value = Math.round((start / duration) * 1000);
    endRange.value = Math.round((end / duration) * 1000);
    startLabel.textContent = formatTime(start);
    endLabel.textContent = formatTime(end);
    startTimeInput.value = formatTime(start);
    endTimeInput.value = formatTime(end);
  }

  startRange.addEventListener("input", updateFromRanges);
  endRange.addEventListener("input", updateFromRanges);
  startTimeInput.addEventListener("change", updateFromInputs);
  endTimeInput.addEventListener("change", updateFromInputs);

  // ——— Drag & drop ———
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  ["dragenter", "dragover"].forEach((ev) => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // ——— Preview cut (seek video) ———
  btnPreviewCut.addEventListener("click", () => {
    const start = parseTime(startTimeInput.value);
    const end = parseTime(endTimeInput.value);
    preview.currentTime = start;
    preview.play();
    const check = () => {
      if (preview.currentTime >= end) {
        preview.pause();
        preview.removeEventListener("timeupdate", check);
      }
    };
    preview.addEventListener("timeupdate", check);
  });

  // ——— FFmpeg ———
  async function loadFFmpeg() {
    if (ffmpegLoaded) return;
    setStatus("Chargement de FFmpeg…");
    ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      // console.log(message);
    });
    ffmpeg.on("progress", ({ progress }) => {
      if (isProcessing) setProgress(progress);
    });

    // Single-thread core (no SharedArrayBuffer required)
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegLoaded = true;
    setStatus("");
  }

  btnExport.addEventListener("click", async () => {
    if (!currentFile || isProcessing) return;
    isProcessing = true;
    btnExport.disabled = true;
    btnPreviewCut.disabled = true;
    progressContainer.classList.remove("hidden");
    setProgress(0);
    setStatus("Préparation…");

    try {
      await loadFFmpeg();

      const start = parseTime(startTimeInput.value);
      const end = parseTime(endTimeInput.value);
      const length = end - start;
      if (length <= 0) throw new Error("La fin doit être après le début.");

      const inputName = "input" + getExtension(currentFile.name);
      const outputName = "output.mp4";

      setStatus("Écriture du fichier…");
      await ffmpeg.writeFile(inputName, await fetchFile(currentFile));

      setStatus("Découpe en cours…");
      // -ss before -i for fast seek, -c copy for lossless when possible
      // Fallback to re-encode if copy fails on some containers
      try {
        await ffmpeg.exec([
          "-ss", String(start),
          "-i", inputName,
          "-t", String(length),
          "-c", "copy",
          "-avoid_negative_ts", "make_zero",
          outputName,
        ]);
      } catch (copyErr) {
        console.warn("Copy failed, re-encoding…", copyErr);
        setStatus("Ré-encodage (plus lent)…");
        await ffmpeg.exec([
          "-ss", String(start),
          "-i", inputName,
          "-t", String(length),
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", "23",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          outputName,
        ]);
      }

      setStatus("Préparation du téléchargement…");
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentFile.name.replace(/\.[^.]+$/, "") + "_cut.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Cleanup
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (_) {}

      setProgress(1);
      setStatus("Export terminé ✓", "success");
    } catch (err) {
      console.error(err);
      setStatus("Erreur : " + (err.message || err), "error");
    } finally {
      isProcessing = false;
      btnExport.disabled = false;
      btnPreviewCut.disabled = false;
      setTimeout(() => {
        progressContainer.classList.add("hidden");
        setProgress(0);
      }, 1500);
    }
  });

  function getExtension(name) {
    const m = name.match(/\.[^.]+$/);
    return m ? m[0].toLowerCase() : ".mp4";
  }

  // ——— Reset ———
  btnReset.addEventListener("click", () => {
    if (isProcessing) return;
    currentFile = null;
    preview.removeAttribute("src");
    preview.load();
    fileInput.value = "";
    editorSection.classList.add("hidden");
    uploadSection.classList.remove("hidden");
    setStatus("");
    progressContainer.classList.add("hidden");
  });
})();
