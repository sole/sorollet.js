window.onload = function() {
	'use strict';

	var audioContext = new webkitAudioContext(),
		bufferLength = 4096,
		jsAudioNode = audioContext.createJavaScriptNode( bufferLength ),
		samplingRate = audioContext.sampleRate,
		numVoices = 4,
		voices = [],
		voiceGUIs = [],
		patternGUI,
		sequencerContainer = document.getElementById( 'sequencer' ),
		voicesContainer = document.getElementById( 'voices' ),
		patternLength = 32,
		pattern = new SOROLLET.Pattern( numVoices, patternLength ),
		player = new SOROLLET.Player( samplingRate );

	player.patterns.push( pattern );
	player.orderList.push( 0 );

	for( var i = 0; i < numVoices; i++ ) {
		var voice = new SOROLLET.Voice(),
			gui = new SOROLLET.VoiceGUI({ width: 250 });

		// TODO: settings for voice
		gui.attachTo( voice );

		voices.push( voice );
		voiceGUIs.push( gui );
		voicesContainer.appendChild( gui.dom );
	}

	/*player.addEventListener( 'orderChanged', function( e ) {
		// TODO
	}, false );

	player.addEventListener( 'patternChanged', function( e ) {
		// TODO
	}, false );*/

	player.addEventListener( 'rowChanged', function( e ) {
		console.log('rowChanged', e.row, e);
		patternGUI.highlightColumn( e.row );
	}, false );




	patternGUI = new DrumPatternGUI( numVoices, patternLength );
	patternGUI.setPatternData( pattern );
	sequencer.appendChild( patternGUI.dom );

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
	
	function DrumPatternGUI( numVoices, patternLength ) {
		// Voice 1 / .....x....X.....
		// Voice 2 / x...x...x...x...
		// ...
		
		var div = document.createElement( 'div' ),
			table = document.createElement( 'table' ),
			tbody = document.createElement( 'tbody' ),
			cells = [];

		div.appendChild( table );
		table.appendChild( tbody );

		for( var i = 0; i < numVoices; i++) {
			var row = [],
				tr = document.createElement( 'tr' );

			tbody.appendChild( tr );

			for(var j = 0; j < patternLength; j++) {
				var td = document.createElement( 'td' ),
					pushButton = new SOROLLET.MultipleStatePushButton({ numberOfStates: 3 });

				//pushButton.setValue( (Math.random() * 3)  ); // XXX tmp
				pushButton.addEventListener( 'change', (function( _i, _j ) {
						return function( e ) {
							console.log( 'changed', _i, _j, e );
						};
					})(i, j) // TODO also trigger pattern gui changed evt
				);

				tr.appendChild( td );
				td.appendChild( pushButton.dom );

				row.push( pushButton );
				
			}

			cells.push( row );
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

		}

		return this;
	}
}
