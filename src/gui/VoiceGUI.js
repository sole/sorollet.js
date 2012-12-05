SOROLLET.VoiceGUI = function( signals ) {
	'use strict';

	var scope = this;

	this.synth = null;
	
	var container = new UI.Panel( 'relative' );
	container.setWidth( '300px' );
	container.setBackgroundColor( '#eee' );
	container.setPadding( '1em' );
	container.setOverflow( 'auto' );

	function updateOscillatorWithGUI( ev, index ) {
		if(scope.synth == null) {
			console.log('Not attached to any synth');
			return;
		}

		var prefix = 'wave' + index;

		scope.synth[prefix + 'Volume'] = ev.volume;
		scope.synth[prefix + 'Octave'] = ev.octave;
		scope.synth[prefix + 'Phase'] = ev.phase;
		scope.synth[prefix + 'Function'] = SOROLLET.VoiceGUI.prototype.WAVE_FUNCTIONS[ ev.waveType ];
	}

	var oscillatorPanel1 = new SOROLLET.OscillatorGUI(0);
	container.add( oscillatorPanel1 );
	oscillatorPanel1.addEventListener('change', function(e) {
		updateOscillatorWithGUI( e, 1 );
	}, false);

	var oscillatorPanel2 = new SOROLLET.OscillatorGUI(1);
	container.add( oscillatorPanel2 );
	oscillatorPanel2.addEventListener('change', function(e) {
		updateOscillatorWithGUI( e, 2 );
	}, false);

	var mixPanel = new UI.Panel(),
		mixRow = new UI.Panel(),
		mixSelect = new UI.Select()
			.setOptions( SOROLLET.VoiceGUI.prototype.WAVE_MIX_NAMES)
			.onChange( function() {
				scope.synth.waveMixFunction = SOROLLET.VoiceGUI.prototype.WAVE_MIX_FUNCTIONS[ mixSelect.getValue() ];
			} );
	mixPanel.add( new UI.Text().setValue( 'OSCILLATOR MIX' ).setClass( 'section_label'  ));
	mixPanel.add( mixRow );
	mixRow.add( new UI.Text().setValue( 'Type' ) );
	mixRow.add( mixSelect );
	
	container.add( mixPanel );

	// Noise
	var noiseConfigPanel = new UI.Panel();
	noiseConfigPanel.add( new UI.Text().setValue( 'NOISE' ).setClass('section_label')   );

	var noiseRow = new UI.Panel(),
		noiseAmountInput = new UI.Number();
	noiseRow.add( new UI.Text().setValue( 'Amount' ) );
	noiseAmountInput.min = 0;
	noiseAmountInput.max = 1;
	noiseAmountInput.setWidth( '40px' );
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

	noiseRow.add( new UI.Text().setValue( 'Mix type' ) );
	noiseRow.add( noiseMixType );
	container.add( noiseConfigPanel );
	
	
	// Envelopes
	function updateEnvelopeWithGUI( ev, env, gui ) {
		env.setAttack( ev.attack );
		env.setDecay( ev.decay );
		env.setSustainLevel( ev.sustain );
		env.setRelease( ev.release );
		env.setOutputRange( ev.outputMin, ev.outputMax );
		env.setTimeScale( ev.timeScale );
		
		gui.updateGraph();
		
		scope.updateEnvelopeLengths();
	}

	var ampEnvGUI = new SOROLLET.ADSRGUI({
		label: 'VOLUME ENVELOPE',
		outMin: 0,
		outMax: 8,
		step: 1,
		timeMin: 0,
		timeMax: 32
	});
	container.add( ampEnvGUI );
	ampEnvGUI.addEventListener( 'change', function( e ) {
		updateEnvelopeWithGUI( e, scope.synth.ampADSR, ampEnvGUI );
	}, false );

	var pitchEnvGUI = new SOROLLET.ADSRGUI({
		label: 'PITCH ENVELOPE',
		outMin: -48,
		outMax: 48,
		step: 12,
		timeMin: 0,
		timeMax: 32
	});
	container.add( pitchEnvGUI );
	pitchEnvGUI.addEventListener( 'change', function( e ) {
		updateEnvelopeWithGUI( e, scope.synth.pitchADSR, pitchEnvGUI );
	}, false );



	// Making stuff 'public'
	this.dom = container.dom;
	this.oscillatorPanel1 = oscillatorPanel1;
	this.oscillatorPanel2 = oscillatorPanel2;
	this.waveMix = mixSelect;
	this.noiseAmount = noiseAmountInput;
	this.noiseMix = noiseMixType;
	this.ampEnvGUI = ampEnvGUI;
	this.pitchEnvGUI = pitchEnvGUI;


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

		this.oscillatorPanel1.volume.setValue( synth.wave1Volume );
		this.oscillatorPanel1.octave.setValue( synth.wave1Octave );
		this.oscillatorPanel1.phase.setValue( synth.wave1Phase );
		this.oscillatorPanel1.waveType.setValue( this.valueToKey( this.WAVE_FUNCTIONS, synth.wave1Function ) );

		this.oscillatorPanel2.volume.setValue( synth.wave2Volume );
		this.oscillatorPanel2.octave.setValue( synth.wave2Octave );
		this.oscillatorPanel2.phase.setValue( synth.wave2Phase );
		this.oscillatorPanel2.waveType.setValue( this.valueToKey( this.WAVE_FUNCTIONS, synth.wave2Function ) );

		this.waveMix.setValue( this.valueToKey( this.WAVE_MIX_FUNCTIONS, synth.waveMixFunction ) );

		this.noiseAmount.setValue( synth.noiseAmount );
		this.noiseMix.setValue( this.valueToKey( this.NOISE_MIX_FUNCTIONS, synth.noiseMixFunction ) );

		function updateADSRGUIWithEnvelope( gui, env ) {
			gui.attack.setValue( env.__unscaledAttackLength );
			gui.decay.setValue( env.__unscaledDecayLength );
			gui.sustain.setValue( env.sustainLevel );
			gui.release.setValue( env.__unscaledReleaseLength );
			gui.timeScale.setValue( env.timeScale );
			gui.outputMin.setValue( env.outputMinimumValue );
			gui.outputMax.setValue( env.outputMaximumValue );
		}

		updateADSRGUIWithEnvelope( this.ampEnvGUI, synth.ampADSR );
		updateADSRGUIWithEnvelope( this.pitchEnvGUI, synth.pitchADSR );

		this.synth = synth;

		this.updateEnvelopeLengths();	
		
		this.ampEnvGUI.updateGraph();
		this.pitchEnvGUI.updateGraph();
	},

	updateEnvelopeLengths: function() {
		var synth = this.synth,
			ampEnvGUI = this.ampEnvGUI,
			ampADSR = synth.ampADSR,
			pitchEnvGUI = this.pitchEnvGUI,
			pitchADSR = synth.pitchADSR;

		ampEnvGUI.attackLength = StringFormat.toFixed( ampADSR.attackLength );
		ampEnvGUI.decayLength = StringFormat.toFixed( ampADSR.decayLength );
		ampEnvGUI.releaseLength = StringFormat.toFixed( ampADSR.releaseLength );
		pitchEnvGUI.attackLength = StringFormat.toFixed( pitchADSR.attackLength );
		pitchEnvGUI.decayLength = StringFormat.toFixed( pitchADSR.decayLength );
		pitchEnvGUI.releaseLength = StringFormat.toFixed( pitchADSR.releaseLength );
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

	WAVE_MIX_NAMES: {
		0: 'Add',
		1: 'Substract',
		2: 'Multiply',
		3: 'Divide'
	},

	WAVE_MIX_FUNCTIONS: {
		0: SOROLLET.Voice.prototype.mixAdd,
		1: SOROLLET.Voice.prototype.mixSubstract,
		2: SOROLLET.Voice.prototype.mixMultiply,
		3: SOROLLET.Voice.prototype.mixDivide
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

	panel.add( new UI.Text().setValue( labelName ).setClass( 'section_label'  ) );

	var row = new UI.Panel(),
		div = document.createElement('div'),
		waveTypeSelect = new UI.Select( )
			.setOptions( SOROLLET.VoiceGUI.prototype.WAVE_NAMES )
			.onChange( onChange ),
		volumeInput = new SOROLLET.KnobGUI({ label: 'Volume', min: 0.0, max: 1.0 })
			.onChange( onChange ),
		octaveInput = new SOROLLET.KnobGUI({ label: 'Octave', min: 0, max: 9, step: 1, precision: 0 })
			.onChange( onChange ),
		phaseInput = new SOROLLET.KnobGUI({ label: 'Phase', min: -Math.PI, max: Math.PI })
			.onChange( onChange );


	panel.add( row );
	row.setClass('controls_row');

	row.add( waveTypeSelect );
	row.add( volumeInput );
	row.add( octaveInput );
	row.add( phaseInput );
	
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

