window.onload = function() {
	'use strict';

	var numVoices = 4,
		voices = [],
		voiceGUIs = [],
		patternGUI,
		sequencerContainer = document.getElementById( 'sequencer' ),
		voicesContainer = document.getElementById( 'voices' );

	for( var i = 0; i < numVoices; i++ ) {
		var voice = new SOROLLET.Voice(),
			gui = new SOROLLET.VoiceGUI({ width: 250 });

		// TODO: settings for voice
		gui.attachTo( voice );

		voices.push( voice );
		voiceGUIs.push( gui );
		voicesContainer.appendChild( gui.dom );
	}

	patternGUI = new DrumPatternGUI( numVoices, 32 );
	sequencer.appendChild( patternGUI.dom );


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

				pushButton.setValue( (Math.random() * 3)  );
				pushButton.addEventListener( 'change', (function( _i, _j ) {
						return function( e ) {
							console.log( 'changed', _i, _j, e );
						};
					})(i, j)
				);

				tr.appendChild( td );
				td.appendChild( pushButton.dom );

				row.push( pushButton );
				
			}

			cells.push( row );
		}

		this.dom = div;
		return this;
	}
}
