window.onload = function init() {
	'use strict';

	var audioContext = new webkitAudioContext(),
		jsAudioNode = audioContext.createJavaScriptNode(4096),
		voice = new SOROLLET.Voice(),
		voiceGUI = new SOROLLET.VoiceGUI(),
		keyPressed = false;

	//voice.getAmpADSR().setRelease(1);
		
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
		event.stopPropagation();
		if(!keyPressed) {
			keyPressed = true;
			var key = event.keyCode || event.which,
				keyChar = String.fromCharCode(key),
				keyPos = keyList.indexOf(keyChar);
	//console.log(key, keyPos, keyChar);
			if(keyPos !== -1) {
				var note = baseNote + keyPos;
				//console.log(keyChar, note);
				voice.sendNoteOn(note, 64);
			}
		}		
		return false;
	}, false);

	document.addEventListener('keyup', function(event) {
		event.stopPropagation();
		voice.sendNoteOff();
		keyPressed = false;
		return false;
	}, false);


	jsAudioNode.connect(audioContext.destination);

	document.body.appendChild(voiceGUI.dom);

	document.body.focus();
}
