window.onload = function init() {
	'use strict';

	var audioContext = new webkitAudioContext(),
		jsAudioNode = audioContext.createJavaScriptNode(4096),
		voice = new SOROLLET.Voice(),
		voiceGUI = new SOROLLET.VoiceGUI(),
		keyPressed = false,
		canvas, ctx,
		debug = false;

	voiceGUI.attachTo(voice);

	// DEBUG
	var envLastValue = document.createElement('div');
	document.body.appendChild( envLastValue );
	////////

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

		if( debug ) {
			envLastValue.innerHTML = 'Volume ' + voice.ampADSR.lastValue + '<br />' + 'Pitch ' + voice.pitchADSR.lastValue;
		}
	};

	// Maybe this will fix the 'callback stops being called after a while' issue 
	// (by connecting the node a bit after window.onload)
	// http://code.google.com/p/chromium/issues/detail?id=82795
	setTimeout(function() {
		jsAudioNode.connect(audioContext.destination);
	}, 1000);

	canvas = document.createElement( 'canvas' );
	ctx = canvas.getContext('2d');

	var canvasW = 300, canvasH = 240;
		canvas.width = canvasW;
		canvas.height = canvasH;

	function updateGraph(buffer) {
		ctx.fillStyle = 'rgb(0, 0, 0)';
		ctx.fillRect(0, 0, canvasW, canvasH);

		var num = 128,
			sliceSize = Math.round(buffer.length / num),
			sliceWidth = canvasW / num,
			index = 0;

		ctx.lineWidth = 1;
		ctx.strokeStyle = 'rgb(0, 255, 0)';
		var halfH = canvasH >> 1;

		ctx.beginPath();

		var x = 0;

		for(var i = 0; i < num; i++) {
			index += sliceSize ;

			if(index > buffer.length) {
				break;
			}
			
			var v = buffer[index],
				y = halfH + v * halfH; // relative to canvas size. Originally it's -1..1
			
			if(i == 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}

			x += sliceWidth;
		}

		ctx.lineTo(canvasW, halfH);

		ctx.stroke();
	}

	// New Keyboard GUI
	var keyboardGUI = new SOROLLET.KeyboardGUI( { numOctaves: 2 } );
	keyboardGUI.dom.tabIndex = 1;
	keyboardGUI.dom.id = 'keyboard';
	keyboardGUI.addEventListener( 'keydown', function( e ) {
		
		var baseNote = 44,
			note = baseNote + 1 * e.index;

		voice.sendNoteOn( note, 64 );

	}, false);

	keyboardGUI.addEventListener( 'keyup', function( e ) {
		voice.sendNoteOff();
	}, false );


	//
	
	var voiceContainer = document.getElementById('voice_container');
	voiceContainer.appendChild( voiceGUI.dom );

	var canvasKeyboardContainer = document.getElementById('canvasKeyboard_container');
	canvasKeyboardContainer.appendChild( canvas );
	canvasKeyboardContainer.appendChild( keyboardGUI.dom );
	
}
