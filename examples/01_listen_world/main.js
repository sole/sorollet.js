window.onload = function init() {
	'use strict';

	var audioContext = new webkitAudioContext(),
		jsAudioNode = audioContext.createJavaScriptNode(4096),
		voice = new SOROLLET.Voice(),
		voiceGUI = new SOROLLET.VoiceGUI(),
		keyPressed = false;

	voiceGUI.attachTo(voice);

	jsAudioNode.onaudioprocess = function(event) {
		var buffer = event.outputBuffer,
			outputBufferLeft = buffer.getChannelData(0),
			outputBufferRight = buffer.getChannelData(1),
			numSamples = outputBufferLeft.length;

		var voiceBuffer = voice.getBuffer(numSamples);

		for(var i = 0; i < numSamples; i++) {
			outputBufferLeft[i] = voiceBuffer[i];
			outputBufferRight[i] = voiceBuffer[i];
		}

	};

	// Keyboard handling
	var keyList = 'ZSXDCVGBHNJMQ2W3ER5T6Y'.split(''),
		baseNote = 44;
	
	document.addEventListener('keydown', function(event) {
		if(!keyPressed) {
			keyPressed = true;
			var key = event.keyCode || event.which,
				keyChar = String.fromCharCode(key),
				keyPos = keyList.indexOf(keyChar);
			if(keyPos !== -1) {
				event.stopPropagation();
				event.preventDefault();
				var note = baseNote + keyPos;
				voice.sendNoteOn(note, 64);
				return false;
			}
		}		
		return true;
	}, true);

	document.addEventListener('keyup', function(event) {
		if( keyPressed) {
			event.stopPropagation();
			event.preventDefault();
			voice.sendNoteOff();
		}
		keyPressed = false;
		return false;
	}, true);


	jsAudioNode.connect(audioContext.destination);

	document.body.appendChild(voiceGUI.dom);

	document.body.focus();
}
