window.onload = function() {
	'use strict';

	var audioContext = new AudioContext(),
		bufferLength = 2048,
		jsAudioNode = audioContext.createScriptProcessor( bufferLength ),
		samplingRate = audioContext.sampleRate,
		baseNote = 48, // C-5?
		numVoices = 4,
		patternLength = 32,
		numPushStates = 3,
		btnPlay = document.getElementById( 'btn_play' ),
		btnStop = document.getElementById( 'btn_stop' ),
		bpmInput = document.getElementById( 'bpm' ),
		btnZap = document.getElementById( 'btn_zap' ),
		btnWav = document.getElementById( 'btn_wav' ),
		wavAudioContainer = document.getElementById( 'wav_audio_container' ),
		btnAddPattern = document.getElementById( 'btn_add_pattern' ),
		btnRemovePattern = document.getElementById( 'btn_remove_pattern' ),
		btnAddAgainPattern = document.getElementById( 'btn_add_again_pattern' ),
		btnDuplicatePattern = document.getElementById( 'btn_duplicate_pattern' ),
		btnRandomisePattern = document.getElementById( 'btn_randomise_pattern' ),
		btnClearPattern = document.getElementById( 'btn_clear_pattern' ),
		ordersContainer = document.getElementById( 'orders' ),
		sequencerContainer = document.getElementById( 'pattern_sequencer' ),
		voicesContainer = document.getElementById( 'voices' ),
		debugContainer = document.getElementById( 'debug' ),
		voiceGUIs = [],
		patternGUI = new DrumPatternGUI( numVoices, patternLength, numPushStates ),
		player = new SOROLLET.Player( samplingRate ),
		currentPattern = null,
		playing = false;
		

	for( var i = 0; i < numVoices; i++ ) {
		var voice = new SOROLLET.Voice(),
			voiceGui = new SOROLLET.VoiceGUI({ width: 250 });

		voiceGui.addEventListener( 'change', saveData, false );

		player.voices.push( voice );
		voiceGUIs.push( voiceGui );
		voicesContainer.appendChild( voiceGui.dom );
	}

	sequencerContainer.appendChild( patternGUI.dom );


	// Event handling

	player.addEventListener( 'change', function( e ) {
		ordersToGUI();
		saveData();
	}, false );

	player.addEventListener( 'orderChanged', function( e ) {
		setCurrentOrderInGUI( e.order );
	}, false );

	player.addEventListener( 'patternChanged', function( e ) {
		setCurrentPattern( player.patterns[ e.pattern ] );
	}, false );

	player.addEventListener( 'rowChanged', function( e ) {
		patternGUI.highlightColumn( e.row );
	}, false );

	player.addEventListener( 'bpmChanged', function( e ) {
		bpmInput.value = e.bpm;
	}, false );

	patternGUI.addEventListener( 'change', function( e ) {
		var volume = valueToVolume( e.value ),
			changedCell = currentPattern.rows[ e.row ][ e.track ];
		
		if( volume === 0 ) {
			changedCell.reset();
		} else {
			changedCell.note = baseNote;
			changedCell.volume = volume;
		}
		
		saveData();
	}, false );

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

	btn_play.addEventListener( 'click', function() {
		if( !playing ) {
			jsAudioNode.connect( audioContext.destination );
			player.play();
			playing = true;
			this.innerHTML = this.dataset.playing;
		} else {
			jsAudioNode.disconnect( );
			playing = false;
			this.innerHTML = this.dataset.paused;
		}
	}, false );

	btn_stop.addEventListener( 'click', function() {
		jsAudioNode.disconnect();
		playing = false;
		btn_play.innerHTML = btn_play.dataset.paused;
		player.stop();
	}, false );

	function onBpmChange( e ) {
		var value = SOROLLET.Math.clip( bpmInput.value >> 0, bpmInput.min, bpmInput.max );

		bpmInput.value = value;
		player.setBPM( value );
		saveData( true );
	}

	bpmInput.addEventListener( 'keyup', onBpmChange, false );
	bpmInput.addEventListener( 'change', onBpmChange, false );

	/*btnZap.addEventListener( 'click', function() {
		if( window.confirm('Do you really, seriously, absolutely want to delete the song?') ) {
			deleteSong();
		}
	}, false );*/

	btnWav.addEventListener( 'click', function() {
		saveWAV();
	}, false );

	btnAddPattern.addEventListener( 'click', function() {
		var pattern = new SOROLLET.Pattern( numVoices, patternLength ),
			patternIndex = player.addPattern( pattern );
		player.addToOrderList( patternIndex );
	}, false );

	btnRemovePattern.addEventListener( 'click', function() {
		// Not removing if only one order
		// TODO: maybe the player.change listener should disable this button when appropriate
		if( player.orderList.length < 2 ) {
			return;
		}

		var currentOrder = player.currentOrder,
			newOrder;

		// Need to bring the player to an existing order instead of the one we're about to delete
		if( currentOrder !== 0 ) {
			newOrder = currentOrder - 1;
		} else {
			newOrder = currentOrder;
		}

		player.jumpToOrder( newOrder );
		player.removeFromOrderList( currentOrder );
	}, false );

	btnAddAgainPattern.addEventListener( 'click', function() {
		player.addToOrderListAfter( player.currentPattern, player.currentOrder );
	}, false );

	btnDuplicatePattern.addEventListener( 'click', function() {
		var pattern = new SOROLLET.Pattern( numVoices, patternLength ),
			srcPattern = player.getCurrentPattern();
		if( srcPattern === undefined ) {
			srcPattern = player.patterns[ 0 ];
		}

		if( srcPattern === undefined ) {
			return;
		}

		for( var i = 0; i < srcPattern.rows.length; i++ ) {
			var row = srcPattern.rows[ i ];
			for( var j = 0; j < row.length; j++ ) {
				var srcCell = srcPattern.rows[i][j],
					dstCell = pattern.rows[i][j];

				dstCell.note = srcCell.note;
				dstCell.volume = srcCell.volume;
			}
		}

		var patternIndex = player.addPattern( pattern );
		player.addToOrderList( patternIndex );
		
	}, false );

	btnRandomisePattern.addEventListener( 'click', function() {
		var pattern = player.getCurrentPattern();
		pattern.rows.forEach(function(row) {
			row.forEach(function(cell) {
				var v = Math.random();

				cell.reset();

				if( v > 0.6 ) {
					cell.note = baseNote;
					cell.volume = 0.5;

					if( v > 0.8 ) {
						cell.volume = 1;
					}
				}

			});
		});
		setCurrentPattern( pattern );

		saveData();

	}, false );

	btnClearPattern.addEventListener( 'click', function() {
		var pattern = player.getCurrentPattern();
		pattern.rows.forEach(function(row) {
			row.forEach(function(cell) {
				var v = Math.random();

				cell.reset();

			});
		});
		setCurrentPattern( pattern );

		saveData();
	}, false );


	// --- Setup initial data ---
	
	if( window.location.hash ) {
		loadSongFromHash();
	} else {
		loadDefaultSong();
	}

	// & load data into GUIs

	player.voices.forEach(function(voice, index) {
		var gui = voiceGUIs[index];
		gui.attachTo( voice );
	});

	ordersToGUI();

	// ~~~ finally...

	setCurrentPattern( player.patterns[ player.orderList[0] ] );


	saveData();


	// ~~~
	
	function valueToVolume( v ) {
		return 1.0 * v / (numPushStates - 1);
	}

	function volumeToValue( v ) {
		return v * (numPushStates - 1);
	}

	function ordersToGUI( ) {

		function getNodePosition( node ) {
			var siblings = node.parentNode.childNodes,
				position = -1;

				for( var i = 0; i < siblings.length; i++ ) {
					position = i;
					if( node == siblings[i] ) {
						break;
					}
				}

			return position;
		}

		ordersContainer.innerHTML = '';

		function onOrderInputChanged(e) {
			var input = e.target,
				position = getNodePosition( input ),
				newPatternIndex = parseInt(input.value, 10);

			player.setOrderValueAt( position, newPatternIndex );

			// ensure player gui is updated
			if( player.currentOrder === position ) {
				setCurrentPattern( player.patterns[ newPatternIndex ] );
			}
		}

		function onOrderDoubleClicked(e) {
			e.preventDefault();
			e.stopPropagation();

			var orderIndex = getNodePosition( e.target );
			player.jumpToOrder( orderIndex );
			player.updateNextEventToOrderRow( orderIndex, 0 );

			return false;
		}

		for( var i = 0; i < player.orderList.length; i++ ) {
			var input = document.createElement( 'input' );
			input.type = 'number';
			input.value = player.orderList[ i ];
			input.min = 0;
			input.max = player.patterns.length - 1;

			input.addEventListener('change', onOrderInputChanged, false);
			input.addEventListener('dblclick', onOrderDoubleClicked, false);

			ordersContainer.appendChild( input );
		}

		setCurrentOrderInGUI( player.currentOrder );
	}

	function setCurrentOrderInGUI( orderIndex ) {
		var currentlySelected = ordersContainer.querySelector( '.selected' ),
			orderNodes = ordersContainer.querySelectorAll( 'input' );

		if( currentlySelected !== null) {
			currentlySelected.className = '';
		}
		orderNodes[ orderIndex ].className = 'selected';
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

	function saveData( bpmChange ) {
		var settings = {
			bpm: player.bpm,
			voiceParams: [],
			patterns: [],
			orderList: []
		};

		player.voices.forEach(function( v ) {
			settings.voiceParams.push( v.getParams() );
		});

		player.patterns.forEach(function( p ) {
			settings.patterns.push( compressPattern( p ) );
		});

		player.orderList.forEach(function( o ) {
			settings.orderList.push( o );
		});

		var json = JSON.stringify( settings, null, "\t" ),
			base64ised = btoa( JSON.stringify( settings) ); // no pretty print this time so it's smaller

		debugContainer.innerHTML = json;

		window.location.hash = base64ised;

		var currentRow = player.currentRow,
			currentOrder = player.currentOrder;

		player.buildEventsList();

		if( bpmChange !== undefined && bpmChange === true ) {
			player.updateNextEventToOrderRow( currentOrder, currentRow );
		} else {
			player.updateNextEventPosition();
		}
	
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

	function getDefaultSong() {

		var defaultValues = {
			"bpm": 100,
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
			],
			"orderList": [ 0 ]
		};

		return defaultValues;
	}

	function deleteSong() {
		// TODO implement
	}

	function loadSong( player, values ) {

		var i;
		
		for( i = 0; i < values.voiceParams.length; i++ ) {
			var v = player.voices[i],
				params = values.voiceParams[i];

			v.setParams( params );
		}

		player.setBPM( values.bpm );
		player.patterns = [];
		player.orderList = [];

		for( i = 0; i < values.patterns.length; i++ ) {
			var compressedPattern = values.patterns[i],
				uncompressed = uncompressPattern( compressedPattern, numVoices, patternLength );

			player.patterns.push( uncompressed );
		}

		for( i = 0; i < values.orderList.length; i++ ) {
			player.orderList.push( values.orderList[ i ] );
		}

	}

	function loadDefaultSong() {
		loadSong( player, getDefaultSong() );
	}

	function loadSongFromHash() {
		try {
			var hash = window.location.hash,
				encoded = hash.substr(1),
				serialised = atob( encoded ),
				unserialised = JSON.parse( serialised );
				loadSong( player, unserialised );
		} catch( ohno ) {
			loadDefaultSong();
		}
	}

	function saveWAV() {
		var buttons = [ btn_wav, btn_play, btn_stop ],
			previousText = btn_wav.innerHTML,
			audioData = [],
			bufferSize = 8192 * 4,
			timeoutDelay = 10,
			audio,
			source;

		btn_wav.disabled = true;
		btn_wav.innerHTML = 'Saving...';

		// disconnect player
		btn_stop.click();

		// disable buttons
		buttons.forEach(function( b ) {
			b.disabled = true;
		});
		
		player.repeat = false;
		player.finished = false;
		player.stop();
		player.play();

		var runs = 0;
		renderPass();

		function renderPass() {
			if( player.finished ) {
				onFinishedRendering();
			} else {
				var outBuffer = player.getBuffer( bufferSize );

				audioData = audioData.concat( outBuffer );

				btn_wav.innerHTML = "Rendering... (" + StringFormat.toFixed( player.nextEventPosition * 100.0 / player.eventsList.length ) + "%)";

				setTimeout( renderPass, timeoutDelay );
			}
		}

		function onFinishedRendering() {
			
			btn_wav.innerHTML = 'Generating WAV';
			wavAudioContainer.innerHTML = '';
			audio = document.createElement( 'audio' );
			source = document.createElement( 'source' );

			audio.controls = true;
			audio.loop = true;

			source.type = 'audio/wav';
			audio.appendChild( source );

			dataToSource( audioData, samplingRate, source, onWAVProgress, onWAVCompleted );

		}

		function onWAVProgress( message ) {
			btn_wav.innerHTML = 'Saving WAV: ' + message;
		}

		function onWAVCompleted( base64Source ) {

			wavAudioContainer.appendChild( audio );

			source.src = base64Source;

			// re enable buttons
			buttons.forEach(function( b ) {
				b.disabled = false;
			});

			player.stop();
			player.finished = false;
			player.repeat = true;
	
		}

		function dataToSource( data, sampleRate, sourceElement, onProgress, onComplete ) {
			var n = data.length,
				integer = 0,
				header = "RIFF<##>WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00<##><##>\x01\x00\x08\x00data<##>";

			function insertLong(value) {
				var bytes = "";
				for( var i = 0; i < 4; i++ ) {
						bytes += String.fromCharCode(value % 256);
						value = value >> 8;
				}
				header = header.replace('<##>', bytes);
			}
			
			onProgress( 'Writing header' );

			insertLong(36 + n);
			insertLong(sampleRate);
			insertLong(sampleRate);
			insertLong(n);

			var position = 0,
				processLength = bufferLength;

			process();

			function process() {
				for( var i = 0; i < processLength; i++ ) {

					header += String.fromCharCode(Math.round(Math.min(1, Math.max(-1, data[position])) * 126 + 128));
					position++;
					onProgress( 'converting ' + StringFormat.toFixed( position * 100.0 / n ) + '%' );

					if( position >= n ) {
						break;
					}
				}

				if( position < n ) {
					setTimeout( process, timeoutDelay );
				} else {
					onProgress( 'done' );
					onComplete( 'data:audio/wav;base64,' + btoa(header) );
				}
			}
		}
	}

	
};
