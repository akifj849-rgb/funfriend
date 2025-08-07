// script.js
const socket = io("https://470958ca-a277-48df-b8b0-b3815357d652-00-2nxyt6ovme0yu.sisko.replit.dev/");

let localStream;
let peerConnection;
let isMuted = false;
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const skipBtn = document.getElementById("skipBtn");
const muteBtn = document.getElementById("muteBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const statusText = document.getElementById("status");
const loadingOverlay = document.getElementById("loadingOverlay");

navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    localStream = stream;
    localVideo.srcObject = stream;
    statusText.textContent = "Waiting for partner...";
    loadingOverlay.style.display = "flex";
  })
  .catch((error) => {
    alert("Camera/mic access denied. Please check permissions.");
    console.error(error);
    statusText.textContent = "Permission denied.";
  });

socket.on("partner-found", () => {
  startCall();
  statusText.textContent = "Connected";
  loadingOverlay.style.display = "none";
});

socket.on("partner-left", () => {
  endCall();
  statusText.textContent = "Partner disconnected.";
  loadingOverlay.style.display = "flex";
});

socket.on("signal", async (data) => {
  if (!peerConnection) startCall();

  if (data.sdp) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if (data.sdp.type === "offer") {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("signal", { sdp: answer });
    }
  }

  if (data.candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

function startCall() {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("signal", { candidate: e.candidate });
    }
  };

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  setTimeout(async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("signal", { sdp: offer });
  }, 500);
}

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
}

skipBtn.addEventListener("click", () => {
  endCall();
  statusText.textContent = "Searching for new partner...";
  loadingOverlay.style.display = "flex";
  socket.emit("skip");
});

muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach((track) => (track.enabled = !isMuted));
  muteBtn.textContent = isMuted ? "🔈" : "🔇";
});

fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});
