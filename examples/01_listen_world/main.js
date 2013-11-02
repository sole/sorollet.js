window.onload = function init() {
	'use strict';

	var audioContext = new AudioContext(),
		jsAudioNode = audioContext.createScriptProcessor(2048),
		voice = new SOROLLET.Voice(),
		voiceGUI = new SOROLLET.VoiceGUI(),
		keyPressed = false,
		scopeGraph = new SOROLLET.ScopeGraph({ width: 300, height: 240 }),
		keyboardGUI = new SOROLLET.KeyboardGUI({ numOctaves: 2 }),
		voiceContainer = document.getElementById('voice_container'),
		canvasKeyboardContainer = document.getElementById('canvasKeyboard_container'),
		debug = false,
		envLastValue = document.createElement('div');

	if( window.location.hash ) {
		try {
			var hash = window.location.hash,
				encoded = hash.substr(1),
				serialised = atob( encoded ),
				unserialised = JSON.parse( serialised );

			voice.setParams( unserialised );

		} catch( oooh ) {
			window.location = window.location.href.split('#')[0];
		}
	}

	voiceGUI.attachTo(voice);
	voiceGUI.addEventListener( 'change', function( e ) {

		var serialised = JSON.stringify( e.synthParams ),
			hash = btoa( serialised );
		
		window.location.hash = hash;

	});

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

	document.body.appendChild( envLastValue );
	voiceContainer.appendChild( voiceGUI.dom );

	canvasKeyboardContainer.appendChild( scopeGraph.dom );
	canvasKeyboardContainer.appendChild( keyboardGUI.dom );

	//
	
	jsAudioNode.onaudioprocess = function(event) {
		var buffer = event.outputBuffer,
			outputBufferLeft = buffer.getChannelData(0),
			outputBufferRight = buffer.getChannelData(1),
			numSamples = outputBufferLeft.length,
			voiceBuffer = voice.getBuffer(numSamples);

		for(var i = 0; i < numSamples; i++) {
			outputBufferLeft[i] = voiceBuffer[i];
			outputBufferRight[i] = voiceBuffer[i];
		}

		scopeGraph.update( voiceBuffer );

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

	
	
};
