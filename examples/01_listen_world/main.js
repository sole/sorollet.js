window.onload = function init() {
	'use strict';

	var audioContext = new webkitAudioContext(),
		jsAudioNode = audioContext.createJavaScriptNode(4096),
		voice = new SOROLLET.Voice(),
		voiceGUI = new SOROLLET.VoiceGUI(),
		keyPressed = false,
		canvas, ctx;

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

		updateGraph( voiceBuffer );

	};

	canvas = document.createElement( 'canvas' );
	ctx = canvas.getContext('2d');

	var canvasW = 320, canvasH = 240;
		canvas.width = canvasW;
		canvas.height = canvasH;

	function updateGraph(buffer) {
		ctx.fillStyle = 'rgb(0, 0, 0)';
		ctx.fillRect(0, 0, canvasW, canvasH);

		var num = 128,
			sliceSize = Math.round(buffer.length / num),
			sliceWidth = canvasW / num,
			index = 0;

		ctx.strokeStyle = 'rgb(0, 255, 0)';
		var halfH = canvasH >> 1;

		ctx.beginPath();

		for(var i = 0; i < num; i++) {
			index += sliceSize ;

			if(index > buffer.length) {
				break;
			}
			
			var v = buffer[index],
				x = sliceWidth * i,
				y = halfH + v * halfH; // relative to canvas size. Originally it's -1..1
			
			if(i == 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}

		ctx.lineTo(canvasW, halfH);

		ctx.stroke();
	}


	// Keyboard handling
	var keyList = 'ZSXDCVGBHNJMQ2W3ER5T6Y7UI9OP'.split(''),
		baseNote = 44;
	
	document.addEventListener('keydown', function(event) {
		if(!keyPressed) {
			
			var key = event.keyCode || event.which,
				keyChar = String.fromCharCode(key),
				keyPos = keyList.indexOf(keyChar);
			
			if(keyPos !== -1) {
				keyPressed = true;
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
		if( keyPressed ) {
			event.stopPropagation();
			event.preventDefault();
			voice.sendNoteOff();
		}
		keyPressed = false;
		return false;
	}, true);


	jsAudioNode.connect(audioContext.destination);


	document.body.appendChild(voiceGUI.dom);
	document.body.appendChild( canvas );

	canvas.style.position = 'absolute';
	canvas.style.left = '300px';

	document.body.focus();
}
