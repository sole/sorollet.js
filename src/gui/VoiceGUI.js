SOROLLET.VoiceGUI = function( signals ) {
	'use strict';

	var scope = this;

	this.synth = null;
	
	var container = new UI.Panel( 'absolute' );
	container.setWidth( '250px' );
	container.setBackgroundColor( '#eee' );
	container.setOverflow( 'auto' );

	var oscillatorPanel1 = new SOROLLET.OscillatorGUI(0);
	container.add( oscillatorPanel1 );
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
	container.add( oscillatorPanel2 );
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

	container.add( new UI.Break() );

	var mixPanel = new UI.Panel(),
		mixRow = new UI.Panel(),
		mixSelect = new UI.Select()
			.setOptions( SOROLLET.VoiceGUI.prototype.WAVE_MIX_NAMES)
			.onChange( function() {
				scope.synth.waveMixFunction = SOROLLET.VoiceGUI.prototype.WAVE_MIX_FUNCTIONS[ mixSelect.getValue() ];
			} );
	mixPanel.add( new UI.Text().setValue( 'OSCILLATOR MIX' ));
	mixPanel.add( mixRow );
	mixRow.add( new UI.Text().setValue( 'Type' ) );
	mixRow.add( mixSelect );
	
	container.add( mixPanel );

	// Noise
	var noiseConfigPanel = new UI.Panel();
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
	
	var ampEnvGUI = new SOROLLET.ADSRGUI('VOLUME ENVELOPE');
	container.add( ampEnvGUI );
	ampEnvGUI.addEventListener( 'change', function( e ) {
		var env = scope.synth.ampADSR;

		env.setAttack( e.attack );
		env.setDecay( e.decay );
		env.setSustainLevel( e.sustain );
		env.setRelease( e.release );
		env.setOutputRange( e.outputMin, e.outputMax );
		env.setTimeScale( e.timeScale );
		
		scope.updateEnvelopeLengths();
		
	});

	var pitchEnvGUI = new SOROLLET.ADSRGUI('PITCH ENVELOPE');
	container.add( pitchEnvGUI );
	pitchEnvGUI.addEventListener( 'change', function( e ) {
		// TODO refactor this and above functions
		var env = scope.synth.pitchADSR;

		env.setAttack( e.attack );
		env.setDecay( e.decay );
		env.setSustainLevel( e.sustain );
		env.setRelease( e.release );
		env.setOutputRange( e.outputMin, e.outputMax );
		env.setTimeScale( e.timeScale );
		
		scope.updateEnvelopeLengths();
	});




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

		// TODO refactor
		this.ampEnvGUI.attack.setValue( synth.ampADSR.__unscaledAttackLength );
		this.ampEnvGUI.decay.setValue( synth.ampADSR.__unscaledDecayLength );
		this.ampEnvGUI.sustain.setValue( synth.ampADSR.sustainLevel );
		this.ampEnvGUI.release.setValue( synth.ampADSR.__unscaledReleaseLength );
		this.ampEnvGUI.timeScale.setValue( synth.ampADSR.timeScale );
		this.ampEnvGUI.outputMin.setValue( synth.ampADSR.outputMinimumValue );
		this.ampEnvGUI.outputMax.setValue( synth.ampADSR.outputMaximumValue );

		this.pitchEnvGUI.attack.setValue( synth.pitchADSR.__unscaledAttackLength );
		this.pitchEnvGUI.decay.setValue( synth.pitchADSR.__unscaledDecayLength );
		this.pitchEnvGUI.sustain.setValue( synth.pitchADSR.sustainLevel );
		this.pitchEnvGUI.release.setValue( synth.pitchADSR.__unscaledReleaseLength );
		this.pitchEnvGUI.timeScale.setValue( synth.pitchADSR.timeScale );
		this.pitchEnvGUI.outputMin.setValue( synth.pitchADSR.outputMinimumValue );
		this.pitchEnvGUI.outputMax.setValue( synth.pitchADSR.outputMaximumValue );


		this.synth = synth;

		this.updateEnvelopeLengths();	
	
	},

	updateEnvelopeLengths: function() {
		var synth = this.synth,
			ampEnvGUI = this.ampEnvGUI,
			ampADSR = synth.ampADSR,
			pitchEnvGUI = this.pitchEnvGUI,
			pitchADSR = synth.pitchADSR;

		ampEnvGUI.attackLength.setValue( StringFormat.toFixed( ampADSR.attackLength ) );
		ampEnvGUI.decayLength.setValue( StringFormat.toFixed( ampADSR.decayLength ) );
		ampEnvGUI.releaseLength.setValue( StringFormat.toFixed( ampADSR.releaseLength ) );
		pitchEnvGUI.attackLength.setValue( StringFormat.toFixed( pitchADSR.attackLength ) );
		pitchEnvGUI.decayLength.setValue( StringFormat.toFixed( pitchADSR.decayLength ) );
		pitchEnvGUI.releaseLength.setValue( StringFormat.toFixed( pitchADSR.releaseLength ) );


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

SOROLLET.ADSRGUI = function( label ) {
	var panel = new UI.Panel(),
		tipSize = '10px',
		indent = '50px';

	panel.add( new UI.Text().setValue( label ) );

	var attackRow = new UI.Panel(),
		attackInput = new UI.Number().setLeft( indent ),
		attackLength = new UI.Text().setValue( 0 ).setFontSize( tipSize );

	panel.add(attackRow);
	attackRow.add( new UI.Text().setValue( 'Attack' ) );
	attackRow.add( attackInput );
	attackRow.add( attackLength );

	attackInput.min = 0.0;
	attackInput.max = 1.0;
	attackInput.onChange( onChange );

	//

	var decayRow = new UI.Panel(),
		decayInput = new UI.Number().setLeft( indent ),
		decayLength = new UI.Text().setValue( 0 ).setFontSize( tipSize );

	panel.add(decayRow);
	decayRow.add( new UI.Text().setValue( 'Decay' ) );
	decayRow.add( decayInput );
	decayRow.add( decayLength );

	decayInput.min = 0.0;
	decayInput.max = 1.0;
	decayInput.onChange( onChange );

	//
	
	var sustainRow = new UI.Panel(),
		sustainInput = new UI.Number().setLeft( indent );

	panel.add(sustainRow);
	sustainRow.add( new UI.Text().setValue( 'Sustain' ) );
	sustainRow.add( sustainInput );

	sustainInput.min = 0.0;
	sustainInput.max = 1.0;
	sustainInput.onChange( onChange );

	//
	
	var releaseRow = new UI.Panel(),
		releaseInput = new UI.Number().setLeft( indent ),
		releaseLength = new UI.Text().setValue( 0 ).setFontSize( tipSize );

	panel.add(releaseRow);
	releaseRow.add( new UI.Text().setValue( 'Release' ) );
	releaseRow.add( releaseInput );
	releaseRow.add( releaseLength );

	releaseInput.min = 0.0;
	releaseInput.max = 1.0;
	releaseInput.onChange( onChange );

	//
	
	var timeScaleRow = new UI.Panel(),
		timeScaleInput = new UI.Number().setLeft( indent );

	panel.add(timeScaleRow);
	timeScaleRow.add( new UI.Text().setValue( 'Time scale' ) );
	timeScaleRow.add( timeScaleInput );

	timeScaleInput.min = 0.0;
	timeScaleInput.max = 100.0;
	timeScaleInput.onChange( onChange );
	
	//
	
	var outputRow = new UI.Panel(),
		outputMinInput = new UI.Number().setWidth( '50px' ), //.setLeft( indent ),
		outputMaxInput = new UI.Number().setWidth( '50px' );

	panel.add(outputRow);
	outputRow.add( new UI.Text().setValue( 'Output range' ) );
	outputRow.add( outputMinInput );
	outputRow.add( outputMaxInput );

	var min = -100,
		max = 100;

	outputMinInput.min = min;
	outputMinInput.max = max;
	outputMinInput.onChange( onChange );
	outputMaxInput.min = min;
	outputMaxInput.max = max;
	outputMaxInput.onChange( onChange );

	//

	EventTarget.call( this );

	this.dom = panel.dom;
	this.attack = attackInput;
	this.attackLength = attackLength;
	this.decay = decayInput;
	this.decayLength = decayLength;
	this.sustain = sustainInput;
	this.release = releaseInput;
	this.releaseLength = releaseLength;
	this.timeScale = timeScaleInput;
	this.outputMin = outputMinInput;
	this.outputMax = outputMaxInput;

	var dispatchEvent = this.dispatchEvent;
	function onChange() {
		dispatchEvent({
			type: 'change',
			attack: attackInput.getValue(),
			decay: decayInput.getValue(),
			sustain: sustainInput.getValue(),
			release: releaseInput.getValue(),
			timeScale: timeScaleInput.getValue(),
			outputMin: outputMinInput.getValue(),
			outputMax: outputMaxInput.getValue()
		});
	}

}
