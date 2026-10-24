const $=(id)=>document.getElementById(id);
const dropZone=$("drop-zone"),videoInput=$("video-input"),selectButton=$("select-button");
const editor=$("editor"),sourceVideo=$("source-video"),globalSeek=$("global-seek"),currentTime=$("current-time"),durationEl=$("duration"),fileInfo=$("file-info");
const startCanvas=$("start-canvas"),endCanvas=$("end-canvas"),startSeek=$("start-seek"),endSeek=$("end-seek"),startTimeEl=$("start-time"),endTimeEl=$("end-time");
const previewVideo=$("preview-video"),cutDuration=$("cut-duration");
const exportButton=$("export-button"),exportStatus=$("export-status"),exportProgress=$("export-progress"),downloadLink=$("download-link");
let sourceFile=null,sourceUrl=null,fps=30,startSeconds=0,endSeconds=0,isExporting=false;
function formatTime(s){if(!Number.isFinite(s)||s<0)s=0;const m=Math.floor(s/60),sec=Math.floor(s%60),ms=Math.floor((s-Math.floor(s))*1000);return String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0")+"."+String(ms).padStart(3,"0")}
function updateCutDuration(){const d=Math.max(0,endSeconds-startSeconds);cutDuration.textContent="Durée : "+formatTime(d);exportButton.disabled=isExporting||d<=0||!sourceFile}
function updateStartUi(){startSeek.value=sourceVideo.duration?Math.round(startSeconds/sourceVideo.duration*1000):0;startTimeEl.textContent=formatTime(startSeconds);updateCutDuration()}
function updateEndUi(){endSeek.value=sourceVideo.duration?Math.round(endSeconds/sourceVideo.duration*1000):0;endTimeEl.textContent=formatTime(endSeconds);updateCutDuration()}
async function drawFrame(video,canvas,t){if(!video.duration)return;const target=Math.min(Math.max(0,t),video.duration-.001);video.pause();await new Promise(r=>{const f=()=>{video.removeEventListener("seeked",f);r()};video.addEventListener("seeked",f);video.currentTime=target});const c=canvas.getContext("2d");canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||360;c.drawImage(video,0,0,canvas.width,canvas.height)}
async function setStart(s){startSeconds=Math.min(Math.max(0,s),Math.max(0,sourceVideo.duration-.05));if(endSeconds<startSeconds)endSeconds=startSeconds;await drawFrame(sourceVideo,startCanvas,startSeconds);updateStartUi();updateEndUi()}
async function setEnd(s){endSeconds=Math.min(Math.max(0,s),sourceVideo.duration);if(endSeconds<startSeconds)startSeconds=endSeconds;await drawFrame(sourceVideo,endCanvas,endSeconds);updateStartUi();updateEndUi()}
function estimateFps(){let last=null,samples=[];const cb=(n,m)=>{if(last!==null){const d=m.mediaTime-last;if(d>0&&d<.5)samples.push(1/d)}last=m.mediaTime;if(samples.length>=12){fps=Math.min(120,Math.max(1,Math.round(samples.reduce((a,b)=>a+b,0)/samples.length)));samples=[]}sourceVideo.requestVideoFrameCallback(cb)};if("requestVideoFrameCallback" in HTMLVideoElement.prototype)sourceVideo.requestVideoFrameCallback(cb)}
function loadVideo(file){sourceFile=file;if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=URL.createObjectURL(file);sourceVideo.src=sourceUrl;previewVideo.src=sourceUrl;fileInfo.textContent=file.name+" — "+(file.size/1048576).toFixed(2)+" Mo";sourceVideo.addEventListener("loadedmetadata",async()=>{editor.classList.remove("hidden");durationEl.textContent=formatTime(sourceVideo.duration);startSeconds=0;endSeconds=Math.min(sourceVideo.duration,5);fps=30;await drawFrame(sourceVideo,startCanvas,startSeconds);await drawFrame(sourceVideo,endCanvas,endSeconds);updateStartUi();updateEndUi();estimateFps()},{once:true})}
selectButton.addEventListener("click",()=>videoInput.click());
videoInput.addEventListener("change",()=>{if(videoInput.files.length)loadVideo(videoInput.files[0])});
["dragenter","dragover"].forEach(e=>dropZone.addEventListener(e,ev=>{ev.preventDefault();dropZone.classList.add("dragover")}));
["dragleave","drop"].forEach(e=>dropZone.addEventListener(e,ev=>{ev.preventDefault();dropZone.classList.remove("dragover")}));
dropZone.addEventListener("drop",ev=>{const f=ev.dataTransfer?.files?.[0];if(f&&f.type.startsWith("video/"))loadVideo(f)});
$("play-pause").addEventListener("click",()=>sourceVideo.paused?sourceVideo.play():sourceVideo.pause());
$("stop").addEventListener("click",()=>{sourceVideo.pause();sourceVideo.currentTime=0});
sourceVideo.addEventListener("timeupdate",()=>{currentTime.textContent=formatTime(sourceVideo.currentTime);if(!globalSeek.matches(":active"))globalSeek.value=sourceVideo.duration?Math.round(sourceVideo.currentTime/sourceVideo.duration*1000):0});
globalSeek.addEventListener("input",()=>{if(sourceVideo.duration)sourceVideo.currentTime=globalSeek.value/1000*sourceVideo.duration});
$("set-start").addEventListener("click",()=>setStart(sourceVideo.currentTime));
$("set-end").addEventListener("click",()=>setEnd(sourceVideo.currentTime));
$("start-minus").addEventListener("click",()=>setStart(startSeconds-1/fps));
$("start-plus").addEventListener("click",()=>setStart(startSeconds+1/fps));
$("end-minus").addEventListener("click",()=>setEnd(endSeconds-1/fps));
$("end-plus").addEventListener("click",()=>setEnd(endSeconds+1/fps));
startSeek.addEventListener("input",()=>{if(sourceVideo.duration)setStart(startSeek.value/1000*sourceVideo.duration)});
endSeek.addEventListener("input",()=>{if(sourceVideo.duration)setEnd(endSeek.value/1000*sourceVideo.duration)});
$("preview-play").addEventListener("click",()=>{if(endSeconds-startSeconds<=0)return;previewVideo.currentTime=startSeconds;previewVideo.play();const stop=()=>{if(previewVideo.currentTime>=endSeconds-.02){previewVideo.pause();previewVideo.currentTime=endSeconds;previewVideo.removeEventListener("timeupdate",stop)}};previewVideo.addEventListener("timeupdate",stop)});
$("preview-stop").addEventListener("click",()=>{previewVideo.pause();previewVideo.currentTime=startSeconds});
exportButton.addEventListener("click",async()=>{if(isExporting||!sourceFile)return;const d=endSeconds-startSeconds;if(d<=0){exportStatus.textContent="La fin doit être postérieure au début.";return}isExporting=true;exportButton.disabled=true;exportProgress.value=0;downloadLink.classList.add("hidden");exportStatus.textContent="Préparation de FFmpeg.wasm…";const worker=new Worker("js/ffmpeg-worker.js",{type:"module"});worker.onmessage=async e=>{const{type,message,progress,blob,fileName}=e.data;if(type==="status")exportStatus.textContent=message;if(type==="progress"){exportProgress.value=progress;exportStatus.textContent="Traitement : "+Math.round(progress*100)+" %"}if(type==="done"){const url=URL.createObjectURL(blob);downloadLink.href=url;downloadLink.download=fileName;downloadLink.textContent="Télécharger "+fileName;downloadLink.classList.remove("hidden");exportStatus.textContent="Cut MP4 prêt.";exportProgress.value=1;worker.terminate();isExporting=false;exportButton.disabled=false}if(type==="error"){exportStatus.textContent="Erreur : "+message;exportProgress.value=0;worker.terminate();isExporting=false;exportButton.disabled=false}};worker.postMessage({file:sourceFile,startSeconds,duration:d})});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));