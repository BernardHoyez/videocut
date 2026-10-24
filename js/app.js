"use strict";
const $=id=>document.getElementById(id);
const importScreen=$("import-screen"),videoInput=$("video-input"),selectVideoButton=$("select-video-button"),selectedFileName=$("selected-file-name");
const editorScreen=$("editor-screen"),videoPlayer=$("video-player");
const startFrameCanvas=$("start-frame"),endFrameCanvas=$("end-frame"),startFrameTime=$("start-frame-time"),endFrameTime=$("end-frame-time");
const timeline=$("timeline"),thumbnails=$("thumbnails"),selectedZone=$("selected-zone"),startHandle=$("start-handle"),endHandle=$("end-handle");
const startTimeInput=$("start-time"),endTimeInput=$("end-time"),cutDurationInput=$("cut-duration");
const playSelectionButton=$("play-selection-button"),stopPreviewButton=$("stop-preview-button");
const exportButton=$("export-button"),progressArea=$("progress-area"),progressFill=$("progress-fill"),progressLabel=$("progress-label"),message=$("message"),downloadButton=$("download-button");
const installButton=$("install-button");
let videoFile=null,videoObjectUrl=null,videoDuration=0,cutStart=0,cutEnd=0,previewInterval=null;

function formatTime(seconds){if(!Number.isFinite(seconds))seconds=0;const total=Math.floor(seconds),ms=Math.round((seconds-total)*1000);return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0")+"."+String(ms).padStart(3,"0")}
function parseTime(text){const value=String(text||"").trim();if(!value)return NaN;if(/^\d+(\.\d+)?$/.test(value))return parseFloat(value);const match=value.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);if(!match)return NaN;const hours=Number(match[1]||0),minutes=Number(match[2]),seconds=Number(match[3]),ms=Number((match[4]||"0").padEnd(3,"0"));return hours*3600+minutes*60+seconds+ms/1000}
function clamp(value,minimum,maximum){return Math.min(maximum,Math.max(minimum,value))}
function showMessage(text,isError=false){message.textContent=text;message.classList.toggle("error",isError)}
function setProgress(percent,text){progressArea.hidden=false;progressFill.style.width=percent+"%";progressLabel.textContent=text}

function selectVideo(){videoInput.click()}
function loadVideo(file){if(!file)return;const isVideo=file.type.startsWith("video/"),hasExtension=/\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(file.name);if(!isVideo&&!hasExtension){showMessage("Ce fichier n’est pas une vidéo.",true);return}
videoFile=file;if(videoObjectUrl)URL.revokeObjectURL(videoObjectUrl);videoObjectUrl=URL.createObjectURL(file);videoPlayer.src=videoObjectUrl;selectedFileName.textContent=file.name+" — "+(file.size/1048576).toFixed(1)+" Mo";importScreen.hidden=true;editorScreen.hidden=false;
videoPlayer.addEventListener("loadedmetadata",()=>{videoDuration=videoPlayer.duration||0;cutStart=0;cutEnd=videoDuration;refreshInterface();createThumbnails();updateFramePreviews();showMessage("Réglez le début et la fin de votre séquence.")},{once:true})}

async function createThumbnails(){thumbnails.innerHTML="";const count=Math.min(18,Math.max(8,Math.floor(timeline.clientWidth/90)));const canvas=document.createElement("canvas"),context=canvas.getContext("2d"),hiddenVideo=document.createElement("video");hiddenVideo.src=videoObjectUrl;hiddenVideo.muted=true;hiddenVideo.playsInline=true;hiddenVideo.preload="auto";await waitForVideoMetadata(hiddenVideo);canvas.width=160;canvas.height=Math.max(70,Math.round(160*(hiddenVideo.videoHeight/hiddenVideo.videoWidth||.5625)));
for(let index=0;index<count;index++){const time=videoDuration*index/count;await seekVideo(hiddenVideo,time);context.drawImage(hiddenVideo,0,0,canvas.width,canvas.height);const thumbnail=canvas.cloneNode();thumbnail.getContext("2d").drawImage(canvas,0,0);thumbnails.appendChild(thumbnail)}}
function waitForVideoMetadata(video){return new Promise((resolve,reject)=>{video.addEventListener("loadedmetadata",resolve,{once:true});video.addEventListener("error",()=>reject(new Error("Vidéo illisible.")),{once:true})})}
function seekVideo(video,time){return new Promise(resolve=>{const onSeeked=()=>{video.removeEventListener("seeked",onSeeked);resolve()};video.addEventListener("seeked",onSeeked);video.currentTime=Math.min(time,Math.max(0,(video.duration||0)-.05))})}

async function updateFramePreviews(){if(!videoFile||!videoObjectUrl||!videoDuration)return;const hiddenVideo=document.createElement("video");hiddenVideo.src=videoObjectUrl;hiddenVideo.muted=true;hiddenVideo.playsInline=true;hiddenVideo.preload="auto";await waitForVideoMetadata(hiddenVideo);await drawFrame(hiddenVideo,cutStart,startFrameCanvas,startFrameTime);await drawFrame(hiddenVideo,cutEnd,endFrameCanvas,endFrameTime)}
async function drawFrame(video,time,canvas,timeLabel){await seekVideo(video,time);canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||360;const context=canvas.getContext("2d");context.fillStyle="#000";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(video,0,0,canvas.width,canvas.height);timeLabel.textContent=formatTime(time)}

function refreshInterface(){startTimeInput.value=formatTime(cutStart);endTimeInput.value=formatTime(cutEnd);cutDurationInput.value=formatTime(cutEnd-cutStart);const left=cutStart/videoDuration*100,width=Math.max(.5,(cutEnd-cutStart)/videoDuration*100);selectedZone.style.left=left+"%";selectedZone.style.width=width+"%";startHandle.style.left="calc("+left+"% - 10px)";endHandle.style.left="calc("+(left+width)+"% - 10px)";updateFramePreviews()}
function getTimeFromPointer(event){const rect=timeline.getBoundingClientRect();const clientX=event.touches?event.touches[0].clientX:event.clientX;return clamp((clientX-rect.left)/rect.width,0,1)*videoDuration}
function makeHandleDraggable(handle,isStartHandle){let isDragging=false;
function onPointerMove(event){if(!isDragging)return;event.preventDefault();const time=getTimeFromPointer(event);if(isStartHandle)cutStart=clamp(time,0,cutEnd-.05);else cutEnd=clamp(time,cutStart+.05,videoDuration);refreshInterface()}
function onPointerUp(){isDragging=false;window.removeEventListener("pointermove",onPointerMove);window.removeEventListener("pointerup",onPointerUp)}
handle.addEventListener("pointerdown",event=>{event.preventDefault();isDragging=true;window.addEventListener("pointermove",onPointerMove);window.addEventListener("pointerup",onPointerUp)})}
makeHandleDraggable(startHandle,true);makeHandleDraggable(endHandle,false);
timeline.addEventListener("pointerdown",event=>{if(!videoDuration||event.target.closest(".handle"))return;const time=getTimeFromPointer(event);if(Math.abs(time-cutStart)<=Math.abs(time-cutEnd))cutStart=clamp(time,0,cutEnd-.05);else cutEnd=clamp(time,cutStart+.05,videoDuration);refreshInterface()});
startTimeInput.addEventListener("change",()=>{const time=parseTime(startTimeInput.value);if(Number.isFinite(time))cutStart=clamp(time,0,cutEnd-.05);refreshInterface()});
endTimeInput.addEventListener("change",()=>{const time=parseTime(endTimeInput.value);if(Number.isFinite(time))cutEnd=clamp(time,cutStart+.05,videoDuration);refreshInterface()});

function playSelection(){stopPreview();videoPlayer.currentTime=cutStart;videoPlayer.play();previewInterval=setInterval(()=>{if(videoPlayer.currentTime>=cutEnd){videoPlayer.pause();videoPlayer.currentTime=cutStart;stopPreview()}},100)}
function stopPreview(){if(previewInterval){clearInterval(previewInterval);previewInterval=null}videoPlayer.pause()}

async function exportVideo(){if(!videoFile||!videoDuration)return;const duration=cutEnd-cutStart;if(duration<=0){showMessage("La durée du cut doit être supérieure à zéro.",true);return}
exportButton.disabled=true;downloadButton.hidden=true;message.classList.remove("error");setProgress(5,"Chargement de FFmpeg.wasm…");
try{const blob=await VideocutFFmpeg.cutVideo(videoFile,cutStart,duration,text=>setProgress(15,text));setProgress(100,"Export terminé.");const originalName=videoFile.name.replace(/\.[^.]+$/,"");const exportName=originalName+"_cut.mp4";if(downloadButton.href)URL.revokeObjectURL(downloadButton.href);downloadButton.href=URL.createObjectURL(blob);downloadButton.download=exportName;downloadButton.textContent="⬇ Télécharger "+exportName;downloadButton.hidden=false;showMessage("Séquence de "+formatTime(duration)+" exportée.")}catch(error){console.error(error);showMessage("Échec de l’export : "+error.message,true)}finally{exportButton.disabled=false}}

selectVideoButton.addEventListener("click",event=>{event.stopPropagation();selectVideo()});
importScreen.addEventListener("click",selectVideo);
importScreen.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" ")selectVideo()});
videoInput.addEventListener("change",()=>loadVideo(videoInput.files[0]));
["dragenter","dragover"].forEach(eventName=>importScreen.addEventListener(eventName,event=>{event.preventDefault();importScreen.classList.add("dragover")}));
["dragleave","drop"].forEach(eventName=>importScreen.addEventListener(eventName,event=>{event.preventDefault();importScreen.classList.remove("dragover")}));
importScreen.addEventListener("drop",event=>loadVideo(event.dataTransfer.files[0]));
playSelectionButton.addEventListener("click",playSelection);stopPreviewButton.addEventListener("click",stopPreview);exportButton.addEventListener("click",exportVideo);
window.addEventListener("videocut-progress",event=>setProgress(event.detail.percent,"Traitement : "+event.detail.percent+" %"));
let installPrompt=null;window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;installButton.hidden=false});
installButton.addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installButton.hidden=true});