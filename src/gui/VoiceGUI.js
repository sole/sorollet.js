SOROLLET.VoiceGUI = function( signals ) {
	'use strict';

	var scope = this;

	this.synth = null;
	
	var container = new UI.Panel( 'absolute' );
	container.setWidth( '500px' );
	container.setBackgroundColor( '#eee' );
	container.setOverflow( 'auto' );

	var oscillatorConfigPanel = new UI.Panel(  );
	oscillatorConfigPanel.setOverflow( 'auto' );
	container.add( oscillatorConfigPanel );

	var oscillatorPanel1 = new SOROLLET.OscillatorGUI(0);
	oscillatorConfigPanel.add( oscillatorPanel1 );
	oscillatorPanel1.addEventListener('change', function(e) {
		
		if(scope.synth == null) {
			console.log('Not attached to any synth');
			return;
		}

		scope.synth.wave1Volume = e.volume;
		scope.synth.wave1Octave = e.octave;
		scope.synth.wave1Phase = e.phase;
		scope.synth.wave1Type = SOROLLET.VoiceGUI.prototype.WAVE_FUNCTIONS[ e.waveType ];

	}, false);

	var oscillatorPanel2 = new SOROLLET.OscillatorGUI(1);
	oscillatorConfigPanel.add( oscillatorPanel2 );
	oscillatorPanel2.addEventListener('change', function(e) {
		
		if(scope.synth == null) {
			console.log('Not attached to any synth');
			return;
		}

		scope.synth.wave2Volume = e.volume;
		scope.synth.wave2Octave = e.octave;
		scope.synth.wave2Phase = e.phase;
		scope.synth.wave2Type = SOROLLET.VoiceGUI.prototype.WAVE_FUNCTIONS[ e.waveType ];

	}, false);

	oscillatorConfigPanel.add( new UI.Break() );

	var mixPanel = new UI.Panel();
	mixPanel.add( new UI.Text().setValue( 'TO DO: wave mix function' ));
	oscillatorConfigPanel.add( mixPanel );

	// Noise
	var noiseConfigPanel = new UI.Panel( 'absolute' );
	noiseConfigPanel.setLeft( '250px' );
	noiseConfigPanel.setTop( '0px' );
	noiseConfigPanel.add( new UI.Text().setValue( 'NOISE' ) );

	var noiseRow = new UI.Panel(),
		noiseAmountInput = new UI.Number();
	noiseRow.add( new UI.Text().setValue( 'Amount' ) );
	noiseAmountInput.min = 0;
	noiseAmountInput.max = 1;
	noiseAmountInput.onChange( function() {
		scope.synth.noiseAmount = noiseAmountInput.getValue();
	});
	noiseRow.add( noiseAmountInput );
	noiseConfigPanel.add( noiseRow );

	var noiseMixRow = new UI.Panel(),
		noiseMixType = new UI.Select( 'absolute' )
			.setOptions( SOROLLET.VoiceGUI.prototype.NOISE_MIX_NAMES )
			.onChange( function() {
				scope.synth.noiseMixFunction = SOROLLET.VoiceGUI.prototype.NOISE_MIX_FUNCTIONS[ noiseMixType.getValue() ];
			});

	noiseMixRow.add( new UI.Text().setValue( 'Mix type' ) );
	noiseMixRow.add( noiseMixType );
	noiseConfigPanel.add( noiseMixRow );

	container.add( noiseConfigPanel );
	
	
	// Envelopes
	// TODO

	// Making stuff 'public'
	this.dom = container.dom;
	this.oscillatorPanel1 = oscillatorPanel1;
	this.oscillatorPanel2 = oscillatorPanel2;
	this.noiseAmount = noiseAmountInput;
	this.noiseMix = noiseMixType;


}

SOROLLET.VoiceGUI.prototype = {

	constructor: SOROLLET.VoiceGUI,

	valueToKey: function( obj, value ) {
		for( var key in obj ) {
			if( value == obj[key] ) {
				return key;
			}
		}
	},

	attachTo: function( synth ) {

		var waveFunctionToValue = function( fn ) {
			var functions = SOROLLET.VoiceGUI.prototype.WAVE_FUNCTIONS;
			for( var key in functions ) {
				if( fn == functions[key] ) {
					return key;
				}
			}
		}

		this.oscillatorPanel1.volume.setValue( synth.wave1Volume );
		this.oscillatorPanel1.octave.setValue( synth.wave1Octave );
		this.oscillatorPanel1.phase.setValue( synth.wave1Phase );
		this.oscillatorPanel1.waveType.setValue( waveFunctionToValue( synth.wave1Function ) );

		this.oscillatorPanel2.volume.setValue( synth.wave2Volume );
		this.oscillatorPanel2.octave.setValue( synth.wave2Octave );
		this.oscillatorPanel2.phase.setValue( synth.wave2Phase );
		this.oscillatorPanel2.waveType.setValue( waveFunctionToValue( synth.wave2Function ) );
console.log( this );

		this.noiseAmount.setValue( synth.noiseAmount );
		this.noiseMix.setValue( this.valueToKey( SOROLLET.VoiceGUI.prototype.NOISE_MIX_FUNCTIONS, synth.noiseMixFunction ) );

		this.synth = synth;
		
	},

	WAVE_NAMES: {
		0: 'Sine',
		1: 'Triangle',
		2: 'Square',
		3: 'Sawtooth'
	},

	WAVE_FUNCTIONS: {
		0: SOROLLET.Voice.prototype.getSineBuffer,
		1: SOROLLET.Voice.prototype.getTriangleBuffer,
		2: SOROLLET.Voice.prototype.getSquareBuffer,
		3: SOROLLET.Voice.prototype.getSawtoothBuffer,
	
	},

	NOISE_MIX_NAMES: {
		0: 'Add',
		1: 'Mix',
		2: 'Multiply'
	},

	NOISE_MIX_FUNCTIONS: {
		0: SOROLLET.Voice.prototype.noiseAdd,
		1: SOROLLET.Voice.prototype.noiseMix,
		2: SOROLLET.Voice.prototype.noiseMultiply
	}
};

SOROLLET.OscillatorGUI = function( oscillatorIndex ) {

	var labelName = 'OSCILLATOR ' + (oscillatorIndex + 1),
		panel = new UI.Panel( 'relative' );

	panel.add( new UI.Text().setValue( labelName ) );
	panel.add( new UI.Break() );

	var indent = '90px',
		labelColor = '#666';

	var waveTypeRow = new UI.Panel(),
		waveTypeSelect = new UI.Select( 'absolute' )
		.setLeft( indent )
		.setWidth( '150px' )
		.setOptions( SOROLLET.VoiceGUI.prototype.WAVE_NAMES )
		.onChange( onChange );

	waveTypeRow.add( new UI.Text().setValue( 'Wave type' ).setColor( labelColor ) );
	waveTypeRow.add( waveTypeSelect );
	panel.add( waveTypeRow );

	var volumeRow = new UI.Panel(),
		volumeInput = new UI.Number( 'absolute' )
			.setLeft( indent )
			.onChange( onChange );

	volumeInput.min = 0.0;
	volumeInput.max = 1.0;

	volumeRow.add( new UI.Text().setValue( 'Volume' ) ).setColor( labelColor );
	volumeRow.add( volumeInput );
	panel.add( volumeRow );
	
	var octaveRow = new UI.Panel(),
		octaveInput = new UI.Number( 'absolute' )
			.setLeft( indent )
			.onChange( onChange );

	octaveInput.min = 0;
	octaveInput.max = 9;
	octaveInput.step = 1;
	octaveInput.precision = 0;
	
	octaveRow.add( new UI.Text().setValue( 'Octave' ) ).setColor( labelColor );
	octaveRow.add( octaveInput );
	panel.add( octaveRow );


	var phaseRow = new UI.Panel(),
		phaseInput = new UI.Number( 'absolute' )
			.setLeft( indent )
			.onChange( onChange );

	phaseInput.min = - Math.PI;
	phaseInput.max = Math.PI;
	
	phaseRow.add( new UI.Text().setValue( 'Phase' ) ).setColor( labelColor );
	phaseRow.add( phaseInput );
	panel.add( phaseRow );

	//
	
	this.waveType = waveTypeSelect;
	this.octave = octaveInput;
	this.volume = volumeInput;
	this.phase = phaseInput;

	EventTarget.call( this );

	var dispatchEvent = this.dispatchEvent;

	function onChange() {
		dispatchEvent({
			type: 'change',
			waveType: waveTypeSelect.getValue(),
			octave: octaveInput.getValue(),
			volume: volumeInput.getValue(),
			phase: phaseInput.getValue()
		});
	}

	this.dom = panel.dom;

}
