//const socket = io.connect('http://signaling_peer:5000');
const socket = io();
//const socket = io.connect('http://localhost:5000');
const divVideoChatLobby = document.getElementById('video-chat-lobby');
const divVideoChat = document.getElementById('video-chat-room');
const peerTitle = document.getElementById('peer-title');
const joinButton = document.getElementById('join');
const userVideo = document.getElementById('user-video');
const peerVideo = document.getElementById('peer-video');
const roomInput = document.getElementById('roomName');
const aspectRatio = document.getElementById('aspectRatio');
const frameRate = document.getElementById('frameRate');
const resolutions = document.getElementById('resolutions');

let roomName;

let creator = false;
let rtcPeerConnection;

let public = {
  iceServers: [
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

let private = {
  iceServers: [
    {
      urls: 'turn:coturn:3478',
      username: 'admin',
      credential: 'admin',
    },
    {
      urls: 'stun:coturn:3478',
      username: 'admin',
      credential: 'admin',
    },
  ],
};

let iceServers = public;

const tempCandidates = [];

let userStream;
roomInput.value = Math.floor(1000 + Math.random() * 9000);
joinButton.addEventListener('click', function () {
  if (roomInput.value == '') {
    alert('Please enter a room name');
  } else {
    roomName = roomInput.value;
    socket.emit('join', roomName);
  }
});

const stopBtn = document.getElementById('stopBtn');

divVideoChat.style.display = 'none';

stopBtn.onclick = (e) => {
  //mediaRecorder.stop();
  roomInput.value = Math.floor(1000 + Math.random() * 9000);
  divVideoChatLobby.style.display = 'block';
  divVideoChat.style.display = 'none';
  // peerVideo.style.display = 'none';
  //  userVideo.style.display = 'none';
  socket.emit('stop', roomName);
  if (userVideo.srcObject)
    userVideo.srcObject.getTracks().forEach((track) => track.stop());
  if (peerVideo.srcObject)
    peerVideo.srcObject.getTracks().forEach((track) => track.stop());
};

socket.on('rooms', (rooms) => {
  // either with send()
  console.log('rooms: ', rooms);
});

const toggleVideochat = () => {
  console.log('toggleVideochat');
  const elems = [divVideoChatLobby, divVideoChat];
  elems.forEach((elem) => {
    elem.style =
      elem.style.display !== 'none' ? 'display:none' : 'display:block';
  });
};

socket.on('joined', (supervisor) => {
  console.log(`on joined as supervisor? ${supervisor} from `, socket.id);
  divVideoChatLobby.style.display = 'none';
  divVideoChat.style.display = 'block';
  if (supervisor) {
    console.log('emit ready supervisor: ', roomName);
    socket.emit('ready', roomName, supervisor);
    return;
  }

  invokeGetDisplayMedia(
    function (mediaStream) {
      userStream = mediaStream;
      userVideo.style.display = 'block';
      peerVideo.style.display = 'none';
      userVideo.srcObject = mediaStream;
      userVideo.onloadedmetadata = function (e) {
        userVideo.play();
        peerTitle.textContent = `This is your stream (${roomName}) `;
      };
      console.log('emit ready: ', roomName);
      socket.emit('ready', roomName);
    },
    function (e) {
      alert('Cant access User Media');
      console.log(err.name + ': ' + err.message);
    }
  );

  /*
  navigator.mediaDevices
    .getDisplayMedia(displayMediaOptions)
    .then(function (mediaStream) {
      //console.log('mediaDevices getDisplayMedia then');
      userStream = mediaStream;
      userVideo.style.display = 'block';
      peerVideo.style.display = 'none';
      userVideo.srcObject = mediaStream;
      userVideo.onloadedmetadata = function (e) {
        userVideo.play();
        peerTitle.textContent = `This is your stream (${roomName}) `;
      };
      console.log('emit ready: ', roomName);
      socket.emit('ready', roomName);

      //console.log('userStream: ', userStream);
    })
    .catch(function (err) {
      alert('Cant access User Media');
      console.log(err.name + ': ' + err.message);
    }); // always check for errors at the end.
    */
});

socket.on('ready', function () {
  console.log('on ready', socket.id);

  rtcPeerConnection = new RTCPeerConnection(iceServers);
  rtcPeerConnection.onicecandidate = OnIceCandidateFunction;
  rtcPeerConnection.ontrack = OnTrackFunction;

  const videotrack = userStream.getTracks()[0];
  rtcPeerConnection.addTrack(videotrack, userStream); // video track

  rtcPeerConnection
    .createOffer()
    .then((offer) => {
      //console.log('emit offer: ', offer);

      rtcPeerConnection.setLocalDescription(offer);
      console.log('emit offer');
      socket.emit('offer', offer, roomName);
    })
    .catch((error) => {
      console.log(error);
    });
});

socket.on('candidate', function (candidate) {
  console.log('on candidate', { socketId: socket.id, candidate });
  let iceCandidate = new RTCIceCandidate(candidate);
  if (!rtcPeerConnection || !rtcPeerConnection.remoteDescription) {
    tempCandidates.push(iceCandidate);
    return;
  }
  while (tempCandidates.length > 0) {
    rtcPeerConnection.addIceCandidate(tempCandidates.pop());
  }
  rtcPeerConnection.addIceCandidate(iceCandidate);
});

socket.on('offer', function (offer, roomName, supervisor) {
  console.log('on offer supervisor? ', supervisor);

  rtcPeerConnection = new RTCPeerConnection(iceServers);
  rtcPeerConnection.onicecandidate = OnIceCandidateFunction;
  rtcPeerConnection.ontrack = OnTrackFunction;
  if (!supervisor) {
    const videotrack = userStream.getTracks()[0];
    rtcPeerConnection.addTrack(videotrack, userStream);
  } // video track
  rtcPeerConnection.setRemoteDescription(offer);
  while (tempCandidates.length > 0) {
    rtcPeerConnection.addIceCandidate(tempCandidates.pop());
  }
  rtcPeerConnection.onnegotiationneeded = (event) => {
    console.log('onnegotiationneeded supervisor? ', supervisor);
    rtcPeerConnection
      .createOffer()
      .then((offer) => {
        rtcPeerConnection.setLocalDescription(offer);
        socket.emit('offer', offer, roomName, supervisor);
      })
      .catch((err) => console.log('error1234: ', err));
  };
  rtcPeerConnection
    .createAnswer()
    .then((answer) => {
      rtcPeerConnection.setLocalDescription(answer);
      console.log('emit answer', roomName);
      socket.emit('answer', answer, roomName);
      peerTitle.textContent = `This stream is from:  ${roomName}`;
    })
    .catch((error) => {
      console.log(error);
    });
});

socket.on('answer', function (answer) {
  console.log('on answer');
  rtcPeerConnection.setRemoteDescription(answer);
  console.log('rtcPeerConnection: ', rtcPeerConnection);
  if (tempCandidates.length > 0) {
    tempCandidates.forEach((iceCandidate) => {
      rtcPeerConnection.addIceCandidate(iceCandidate);
    });
  }
});

function OnIceCandidateFunction(event) {
  console.log('OnIceCandidateFunction');
  if (event.candidate) {
    //console.log('emit candidate: ', event.candidate);
    console.log('emit candidate (OnIceCandidateFunction): ', roomName);
    socket.emit('candidate', event.candidate, roomName);
  }
  //console.log('out of OnIceCandidateFunction...');
}

function OnTrackFunction(event) {
  //toggleDisplay(divVideoChatLobby);
  console.log('OnTrackFunction');
  peerVideo.srcObject = event.streams[0];
  peerVideo.style.display = 'block';
  userVideo.style.display = 'none';
  peerVideo.onloadedmetadata = function (e) {
    peerVideo.play();
    // peerTitle.textContent = 'This is your stream ?';
  };
}

function invokeGetDisplayMedia(success, error) {
  var videoConstraints = {};

  if (aspectRatio.value !== 'default') {
    videoConstraints.aspectRatio = aspectRatio.value;
  }

  if (frameRate.value !== 'default') {
    videoConstraints.frameRate = frameRate.value;
  }

  if (resolutions.value !== 'default') {
    if (resolutions.value === 'fit-screen') {
      videoConstraints.width = screen.width;
      videoConstraints.height = screen.height;
    }

    if (resolutions.value === '4K') {
      videoConstraints.width = 3840;
      videoConstraints.height = 2160;
    }

    if (resolutions.value === '1080p') {
      videoConstraints.width = 1920;
      videoConstraints.height = 1080;
    }

    if (resolutions.value === '720p') {
      videoConstraints.width = 1280;
      videoConstraints.height = 720;
    }

    if (resolutions.value === '480p') {
      videoConstraints.width = 853;
      videoConstraints.height = 480;
    }

    if (resolutions.value === '360p') {
      videoConstraints.width = 640;
      videoConstraints.height = 360;
    }

    /*
      videoConstraints.width = {
          exact: videoConstraints.width
      };

      videoConstraints.height = {
          exact: videoConstraints.height
      };
      */
  }

  videoConstraints.cursor = 'always';

  if (!Object.keys(videoConstraints).length) {
    videoConstraints = true;
  }

  var displayMediaStreamConstraints = {
    video: videoConstraints,
  };

  if (navigator.mediaDevices.getDisplayMedia) {
    navigator.mediaDevices
      .getDisplayMedia(displayMediaStreamConstraints)
      .then(success)
      .catch(error);
  } else {
    navigator
      .getDisplayMedia(displayMediaStreamConstraints)
      .then(success)
      .catch(error);
  }
}
