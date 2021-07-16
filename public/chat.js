//const socket = io.connect('http://signaling_peer:5000');

const socket = io();
//const socket = null;
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
const supervisorCheckbox = document.getElementById('supervisor');

const datachannelsend = document.getElementById('datachannelsend');
const datachannelreceive = document.getElementById('datachannelreceive');
const sendDataButton = document.getElementById('senddata');

const urlParams = new URLSearchParams(window.location.search);

const agentId = urlParams.get('agent');
console.log('agentId: ', agentId);

let roomName;

let creator = false;
let rtcPeerConnection;
let sendChannel;
let receiveChannel;

const iceServers = {
  iceServers: [
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'stun:stun1.l.google.com:19302'},
    {urls: 'stun:stun2.l.google.com:19302'},
  ],
};

const tempCandidates = [];

let userStream;

const emitJoin = (roomName, supervisor) => {
  const preSignedWriteUrl = '';
  const webhookUrl = '';
  const providerRecId = '';
  console.log('emit join: ', {
    roomName,
    preSignedWriteUrl,
    webhookUrl,
    providerRecId,
    supervisor,
  });
  socket.emit(
    'join',
    roomName,
    preSignedWriteUrl,
    webhookUrl,
    providerRecId,
    supervisor,
  );
};

if (agentId) {
  const supervisor = true;
  emitJoin(agentId, supervisor);
}

roomInput.value = Math.floor(1000 + Math.random() * 9000);

joinButton.addEventListener('click', function () {
  if (roomInput.value == '') {
    alert('Please enter a room name');
  } else {
    const supervisor = supervisorCheckbox.checked;

    roomName = roomInput.value;
    emitJoin(roomName, supervisor);
  }
});

sendDataButton.addEventListener('click', function () {
  if (datachannelsend.value == '') {
    alert('Please enter something to send');
  } else {
    if (sendChannel) {
      console.log('sending to datachannel: ', datachannelsend.value);
      sendChannel.send(datachannelsend.value);
    } else {
      console.log('no datachannel available');
    }
  }
});

const stopBtn = document.getElementById('stopBtn');

divVideoChat.style.display = 'none';

stopBtn.onclick = (e) => {
  roomInput.value = Math.floor(1000 + Math.random() * 9000);
  divVideoChatLobby.style.display = 'block';
  divVideoChat.style.display = 'none';

  socket.emit('stop', roomName);
  if (userVideo.srcObject)
    userVideo.srcObject.getTracks().forEach((track) => track.stop());
  if (peerVideo.srcObject)
    peerVideo.srcObject.getTracks().forEach((track) => track.stop());
};

const pauseBtn = document.getElementById('pauseBtn');
pauseBtn.onclick = (e) => {
  socket.emit('pause', roomName);
};

const resumeBtn = document.getElementById('resumeBtn');
resumeBtn.onclick = (e) => {
  socket.emit('resume', roomName);
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

  rtcPeerConnection = new RTCPeerConnection(iceServers);
  rtcPeerConnection.onicecandidate = (event) => {
    console.log('OnIceCandidateFunction');
    if (event.candidate) {
      //console.log('emit candidate: ', event.candidate);
      console.log('emit candidate (OnIceCandidateFunction): ', roomName);
      socket.emit('candidate', roomName, event.candidate);
    }
  };
  rtcPeerConnection.ontrack = OnTrackFunction;
  rtcPeerConnection.onnegotiationneeded = (event) => {
    console.log('onnegotiationneeded supervisor? ', supervisor);
  };
  if (supervisor) {
    console.log('emit ready supervisor: ', roomName);
    socket.emit('ready', roomName, supervisor);

    // DATA CHANNEL
    sendChannel = rtcPeerConnection.createDataChannel('desktop');
    //return;
  } else {
    // DATA CHANNEL
    sendChannel = rtcPeerConnection.createDataChannel('analytics');
  }

  sendChannel.onopen = handleSendChannelStatusChange;
  sendChannel.onclose = handleSendChannelStatusChange;

  console.log('sendChannel created: ', sendChannel);
  rtcPeerConnection.ondatachannel = (event) => {
    // receive analytics from agent
    // receive desktop from supervisor
    console.log('[RELAY] ondatachannel ', event);
    receiveChannel = event.channel;

    receiveChannel.onmessage = handleReceiveMessage;
    receiveChannel.onopen = handleReceiveChannelStatusChange;
    receiveChannel.onclose = handleReceiveChannelStatusChange;

    // recorderPc.createDataChannel(receiveChannel);
  };

  if (supervisor) return;

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
    },
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

socket.on('ready', (supervisor) => {
  console.log('on ready', socket.id);

  if (!supervisor) {
    const videotrack = userStream.getTracks()[0];
    rtcPeerConnection.addTrack(videotrack, userStream); // video track
  }

  rtcPeerConnection
    .createOffer()
    .then((offer) => {
      //console.log('emit offer: ', offer);

      rtcPeerConnection.setLocalDescription(offer);
      console.log('emit offer');
      socket.emit('offer', offer, roomName, supervisor);
    })
    .catch((error) => {
      console.log(error);
    });
});

socket.on('candidate', function (candidate) {
  console.log('on candidate', {socketId: socket.id, candidate});
  let iceCandidate = new RTCIceCandidate(candidate);

  if (!rtcPeerConnection || !rtcPeerConnection.remoteDescription) {
    console.log('push candidate: ', tempCandidates.length);
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

  if (!supervisor) {
    const videotrack = userStream.getTracks()[0];
    rtcPeerConnection.addTrack(videotrack, userStream);
  } // video track
  rtcPeerConnection.setRemoteDescription(offer);
  //while (tempCandidates.length > 0) {
  //  rtcPeerConnection.addIceCandidate(tempCandidates.pop());
  //}

  rtcPeerConnection
    .createAnswer()
    .then((answer) => {
      rtcPeerConnection.setLocalDescription(answer);
      console.log('emit answer', roomName);
      socket.emit('answer', answer, roomName, supervisor);
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
  //if (tempCandidates.length > 0) {
  //  tempCandidates.forEach((iceCandidate) => {
  //    rtcPeerConnection.addIceCandidate(iceCandidate);
  //  });
  //}
});

function OnIceCandidateFunction(event) {
  console.log('OnIceCandidateFunction');
  if (event.candidate) {
    //console.log('emit candidate: ', event.candidate);
    console.log('emit candidate (OnIceCandidateFunction): ', roomName);
    socket.emit('candidate', roomName, event.candidate);
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

  videoConstraints.frameRate = 5;
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

const handleSendChannelStatusChange = (event) => {
  if (sendChannel) {
    var state = sendChannel.readyState;

    if (state === 'open') {
      console.log('sendChannel open');
    } else {
      console.log('sendChannel closed');
    }
  }
};

const handleReceiveChannelStatusChange = (event) => {
  console.log('[RELAY] Receive channel status has changed  ', event);
};
const handleReceiveMessage = (event) => {
  console.log('[RELAY] Receive channel event ', event);
};
