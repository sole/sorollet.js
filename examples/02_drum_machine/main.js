window.onload = function() {
	'use strict';

	var audioContext = new webkitAudioContext(),
		bufferLength = 4096,
		jsAudioNode = audioContext.createJavaScriptNode( bufferLength ),
		samplingRate = audioContext.sampleRate,
		baseNote = 48, // C-5?
		numVoices = 4,
		patternLength = 32,
		numPushStates = 3,
		sequencerContainer = document.getElementById( 'sequencer' ),
		voicesContainer = document.getElementById( 'voices' ),
		debugContainer = document.getElementById( 'debug' ),
		voiceGUIs = [],
		patternGUI = new DrumPatternGUI( numVoices, patternLength, numPushStates ),
		player = new SOROLLET.Player( samplingRate ),
		currentPattern = null;
		

	for( var i = 0; i < numVoices; i++ ) {
		var voice = new SOROLLET.Voice(),
			voiceGui = new SOROLLET.VoiceGUI({ width: 250 });

		voiceGui.addEventListener( 'change', updateDebugInfo, false );

		player.voices.push( voice );
		voiceGUIs.push( voiceGui );
		voicesContainer.appendChild( voiceGui.dom );
	}

	sequencerContainer.appendChild( patternGUI.dom );


	// event handling

	player.addEventListener( 'patternChanged', function( e ) {
		setCurrentPattern( player.patterns[ e.pattern ] );
	}, false );

	player.addEventListener( 'rowChanged', function( e ) {
		patternGUI.highlightColumn( e.row );
	}, false );


	patternGUI.addEventListener( 'change', function( e ) {
		var volume = valueToVolume( e.value ),
			changedCell = currentPattern.rows[ e.row ][ e.track ];
		
		if( volume == 0 ) {
			changedCell.reset();
		} else {
			changedCell.note = baseNote;
			changedCell.volume = volume;
		}
		
		updateDebugInfo();

	}, false );


	// Setup initial data
	
	if( window.location.hash ) {
		// TODO settings from window.hash
	} else {
		setDefaultParams( player );
	}

	// & load data into GUIs

	for( var i = 0; i < numVoices; i++ ) {
		var voice = player.voices[i],
			gui = voiceGUIs[i];

		gui.attachTo( voice );
	}

	// ~~~ finally...

	setCurrentPattern( player.patterns[0] ); // TMP should be first in order list

	jsAudioNode.onaudioprocess = function(event) {

		var buffer = event.outputBuffer,
			outputBufferLeft = buffer.getChannelData(0),
			outputBufferRight = buffer.getChannelData(1),
			numSamples = outputBufferLeft.length,
			sorolletBuffer = player.getBuffer(numSamples);

		for(var i = 0; i < numSamples; i++) {
			outputBufferLeft[i] = sorolletBuffer[i];
			outputBufferRight[i] = sorolletBuffer[i];
		}

	};

	updateDebugInfo();


	// work around http://code.google.com/p/chromium/issues/detail?id=82795
	setTimeout(function() {
		jsAudioNode.connect( audioContext.destination );
	}, 500);



	// ~~~
	
	function valueToVolume( v ) {
		return 1.0 * v / (numPushStates - 1);
	}

	function volumeToValue( v ) {
		return v * (numPushStates - 1);
	}

	function setCurrentPattern( pattern ) {
		currentPattern = pattern;
		patternToGUI( pattern, patternGUI );
	}
	
	function patternToGUI( pattern, gui ) {
		for( var i = 0; i < pattern.rows.length; i++ ) {
			var row = pattern.rows[i];
			for( var j = 0; j < row.length; j++) {
				var cell = row[j];

				if( cell.note !== null ) {
					patternGUI.setCellValue( i, j, volumeToValue( cell.volume ), false );
				} else {
					patternGUI.setCellValue( i, j, 0, false );
				}
			}
		}
	}

	function updateDebugInfo() {
		var settings = {
			voiceParams: []
		};

		player.voices.forEach(function( v ) {
			settings.voiceParams.push( v.getParams() );
		});

		settings.patterns = [];
		player.patterns.forEach(function( p ) {
			settings.patterns.push( compressPattern( p ) );
		});

		var json = JSON.stringify( settings, null, "\t" ),
			base64ised = btoa( JSON.stringify( settings) ); // no pretty print this time so it's smaller

		console.log( base64ised, base64ised.length );
		debugContainer.innerHTML = json;
	}

	// A very case specific way to store/retrieve pattern data
	function compressPattern( pattern ) {
		var out = [];

		for( var i = 0; i < pattern.rows.length; i++ ) {
			var row = pattern.rows[i];
			for(var j = 0; j < row.length; j++) {
				var cell = row[j];
				if( cell.note !== null ) {
					out.push( [i, j, volumeToValue( cell.volume ) ]);
				}
			}
		}
		return out;
	}

	function uncompressPattern( compressed, numTracks, length ) {
		var newPat = new SOROLLET.Pattern( numTracks, length );
		compressed.forEach(function( entry ) {
			var row = entry[0],
				col = entry[1],
				value = entry[2],
				cell = newPat.rows[row][col];
		
			cell.note = baseNote;
			cell.volume = valueToVolume( value );
		});

		return newPat;
	}

	function setDefaultParams( player ) {
	 var defaultValues = {
			"voiceParams": [
				{
					"wave1Function": 2,
					"wave1Octave": 3,
					"wave1Volume": 0.48,
					"wave1Phase": 0,
					"wave2Function": 3,
					"wave2Octave": 4,
					"wave2Volume": 0,
					"wave2Phase": 0,
					"waveMixFunction": 0,
					"noiseAmount": 0,
					"noiseMixFunction": 0,
					"volumeEnvelope": {
						"attack": 0,
						"decay": 0.27,
						"sustain": 0,
						"release": 0,
						"outputMin": 0,
						"outputMax": 1,
						"timeScale": 1
					},
					"pitchEnvelope": {
						"attack": 0,
						"decay": 0.64,
						"sustain": 0,
						"release": 0,
						"outputMin": -48,
						"outputMax": 12,
						"timeScale": 1
					}
				},
				{
					"wave1Function": 0,
					"wave1Octave": 5,
					"wave1Volume": 0.5,
					"wave1Phase": 0,
					"wave2Function": 2,
					"wave2Octave": 4,
					"wave2Volume": 0,
					"wave2Phase": 0,
					"waveMixFunction": 0,
					"noiseAmount": 1,
					"noiseMixFunction": 2,
					"volumeEnvelope": {
						"attack": 0,
						"decay": 0.45,
						"sustain": 0,
						"release": 1,
						"outputMin": 0,
						"outputMax": 0.95,
						"timeScale": 1
					},
					"pitchEnvelope": {
						"attack": 0,
						"decay": 0.21,
						"sustain": 0,
						"release": 0,
						"outputMin": 0,
						"outputMax": -48,
						"timeScale": 1
					}
				},
				{
					"wave1Function": 0,
					"wave1Octave": 5,
					"wave1Volume": 0.5,
					"wave1Phase": 0,
					"wave2Function": 2,
					"wave2Octave": 4,
					"wave2Volume": 0.5,
					"wave2Phase": 0,
					"waveMixFunction": 0,
					"noiseAmount": 1,
					"noiseMixFunction": 1,
					"volumeEnvelope": {
						"attack": 0,
						"decay": 0.06,
						"sustain": 0,
						"release": 1,
						"outputMin": 0,
						"outputMax": 1,
						"timeScale": 1
					},
					"pitchEnvelope": {
						"attack": 0,
						"decay": 0,
						"sustain": 1,
						"release": 0,
						"outputMin": 0,
						"outputMax": 0,
						"timeScale": 1
					}
				},
				{
					"wave1Function": 3,
					"wave1Octave": 6,
					"wave1Volume": 0.55,
					"wave1Phase": 0,
					"wave2Function": 2,
					"wave2Octave": 4,
					"wave2Volume": 0,
					"wave2Phase": 0,
					"waveMixFunction": 0,
					"noiseAmount": 0,
					"noiseMixFunction": 0,
					"volumeEnvelope": {
						"attack": 0,
						"decay": 0.44,
						"sustain": 0,
						"release": 1,
						"outputMin": 0,
						"outputMax": 1,
						"timeScale": 1
					},
					"pitchEnvelope": {
						"attack": 0.16,
						"decay": 0.41,
						"sustain": 0,
						"release": 0,
						"outputMin": 6,
						"outputMax": 0.24,
						"timeScale": 1
					}
				}
			],
			"patterns": [
				[
					[
						0,
						0,
						1
					],
					[
						0,
						2,
						1
					],
					[
						2,
						2,
						1
					],
					[
						4,
						0,
						1
					],
					[
						4,
						1,
						1
					],
					[
						4,
						2,
						1
					],
					[
						6,
						2,
						1
					],
					[
						8,
						0,
						1
					],
					[
						8,
						2,
						1
					],
					[
						9,
						3,
						1
					],
					[
						10,
						2,
						1
					],
					[
						11,
						3,
						1
					],
					[
						12,
						0,
						1
					],
					[
						12,
						1,
						1
					],
					[
						12,
						2,
						1
					],
					[
						14,
						2,
						1
					],
					[
						15,
						2,
						1
					],
					[
						16,
						0,
						1
					],
					[
						16,
						2,
						1
					],
					[
						18,
						2,
						1
					],
					[
						20,
						0,
						1
					],
					[
						20,
						1,
						1
					],
					[
						20,
						2,
						1
					],
					[
						22,
						2,
						1
					],
					[
						24,
						0,
						1
					],
					[
						24,
						2,
						1
					],
					[
						26,
						2,
						1
					],
					[
						27,
						1,
						1
					],
					[
						28,
						0,
						1
					],
					[
						28,
						1,
						1
					],
					[
						28,
						2,
						1
					],
					[
						29,
						3,
						1
					],
					[
						30,
						2,
						1
					],
					[
						30,
						3,
						1
					],
					[
						31,
						2,
						1
					],
					[
						31,
						3,
						1
					]
				]
			]
		};
		
		for( var i = 0; i < defaultValues.voiceParams.length; i++ ) {
			var v = player.voices[i],
				params = defaultValues.voiceParams[i];

			v.setParams( params );
		}

		player.patterns = [];
		player.orderList = [];

		for( var i = 0; i < defaultValues.patterns.length; i++ ) {
			var compressedPattern = defaultValues.patterns[i],
				uncompressed = uncompressPattern( compressedPattern, numVoices, patternLength );

			player.patterns.push( uncompressed );

			// XXX hack to fill the order list for now
			player.orderList.push( i );
		}
	}
}
