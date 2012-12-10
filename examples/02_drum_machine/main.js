window.onload = function() {
	'use strict';

	var audioContext = new webkitAudioContext(),
		bufferLength = 4096,
		jsAudioNode = audioContext.createJavaScriptNode( bufferLength ),
		samplingRate = audioContext.sampleRate,
		baseNote = 48, // C-5?
		numVoices = 4,
		voices = [],
		voiceGUIs = [],
		patternGUI,
		pushNumStates = 3,
		sequencerContainer = document.getElementById( 'sequencer' ),
		voicesContainer = document.getElementById( 'voices' ),
		debugContainer = document.getElementById( 'debug' ),
		patternLength = 32,
		pattern = new SOROLLET.Pattern( numVoices, patternLength ),
		player = new SOROLLET.Player( samplingRate );

	player.setBPM( 130 );
		
	for( var i = 0; i < numVoices; i++ ) {
		var voice = new SOROLLET.Voice(),
			voiceGui = new SOROLLET.VoiceGUI({ width: 250 });

		voiceGui.addEventListener( 'change', updateDebugInfo, false );

		player.voices.push( voice );
		voices.push( voice );
		voiceGUIs.push( voiceGui );
		voicesContainer.appendChild( voiceGui.dom );
	}

	//
	
	if( window.location.hash ) {
		// TODO settings from window.hash
	} else {
		setDefaultParams( voices, player );
	}

	for( var i = 0; i < numVoices; i++ ) {
		var voice = voices[i],
			gui = voiceGUIs[i];

		gui.attachTo( voice );
	}

	updateDebugInfo();

	// TODO randomise - pattern, button
	
	player.addEventListener( 'patternChanged', function( e ) {
		patternGUI.setPatternData( player.patterns[ e.pattern ] );
	}, false );

	player.addEventListener( 'rowChanged', function( e ) {
		patternGUI.highlightColumn( e.row );
	}, false );


	patternGUI = new DrumPatternGUI( numVoices, patternLength, pushNumStates );
	patternGUI.addEventListener( 'change', function( e ) {
		var currentPattern = pattern, // TMP should get using current order, etc
			volume = valueToVolume( e.value ),
			changedCell = pattern.rows[ e.row ][ e.track ];

		if( volume == 0 ) {
			changedCell.reset();
		} else {
			changedCell.note = baseNote;
			changedCell.volume = volume;
		}

		updateDebugInfo();

	}, false );

	sequencer.appendChild( patternGUI.dom );

	patternGUI.setPatternData( player.patterns[ 0 ] ); // TMP should be first in order list

	// ~~~ finally...

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

	// work around http://code.google.com/p/chromium/issues/detail?id=82795
	setTimeout(function() {
		jsAudioNode.connect( audioContext.destination );
	}, 500);



	// ~~~
	
	function valueToVolume( v ) {
		return 1.0 * v / (pushNumStates - 1);
	}

	function volumeToValue( v ) {
		return v * (pushNumStates - 1);
	}
	
	function DrumPatternGUI( numVoices, patternLength, pushButtonNumberStates ) {
		
		var div = document.createElement( 'div' ),
			table = document.createElement( 'table' ),
			tbody = document.createElement( 'tbody' ),
			numberOfStates = pushButtonNumberStates !== undefined ? pushButtonNumberStates : 3,
			cells = [],
			scope = this;

		EventTarget.call( this );

		div.appendChild( table );
		table.appendChild( tbody );

		for( var i = 0; i < numVoices; i++) {
			var row = [],
				tr = document.createElement( 'tr' );

			tbody.appendChild( tr );

			for(var j = 0; j < patternLength; j++) {
				var td = document.createElement( 'td' ),
					pushButton = new SOROLLET.MultipleStatePushButton({ numberOfStates: numberOfStates });

				pushButton.addEventListener( 'change', (function( _i, _j ) {
						return function( e ) {
							console.log( 'changed', _i, _j, e );
							dispatchEvent({ type: 'change', track: _i, row: _j, value: e.value });
						};
					})(i, j), false);

				tr.appendChild( td );
				td.appendChild( pushButton.dom );

				row.push( pushButton );
				
			}

			cells.push( row );
		}

		function dispatchEvent(e) {
			scope.dispatchEvent( e );
		}

		this.dom = div;

		this.highlightColumn = function( columnNumber ) {
			for( var j = 0; j < patternLength; j++ ) {
				for(var i = 0; i < numVoices; i++ ) {
					var cell = cells[i][j];

					cell.setActive( j == columnNumber );
				}
			}
		}

		this.getPatternData = function() {
		}

		this.setPatternData = function( pattern ) {
			for( var i = 0; i < pattern.rows.length; i++ ) {
				var row = pattern.rows[i];
				for( var j = 0; j < row.length; j++) {
					var cell = row[j],
						pushButton = cells[j][i];

					if( cell.note !== null ) {
						pushButton.setValue( volumeToValue( cell.volume ), false );
					} else {
						pushButton.setValue( 0, false );
					}
				}
			}
		}

		return this;
	}

	function updateDebugInfo() {
		var settings = {
			voiceParams: []
		};

		voices.forEach(function( v ) {
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

	function setDefaultParams( voices, player ) {
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
			var v = voices[i],
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
