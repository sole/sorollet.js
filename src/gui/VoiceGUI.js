SOROLLET.VoiceGUI = function( signals ) {
	'use strict';

	var scope = this;

	this.synth = null;
	
	var container = new UI.Panel( 'relative' );
	container.setWidth( '300px' );
	container.setBackgroundColor( '#eee' );
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

SOROLLET.ADSRGUI = function( params ) {

	var params = params || {},
		label = params.label || '',
		outMin = params.outMin || 0,
		outMax = params.outMax || 1,
		step = params.step || 0.5,
		timeMin = params.timeMin || 0,
		timeMax = params.timeMax || 100,
		//
		panel = new UI.Panel(),
		subPanel = new UI.Panel().setClass('ADSR_GUI'),
		leftDiv = document.createElement( 'div' ),
		rightDiv = document.createElement( 'div' ),
		outputMinInput = new SOROLLET.KnobGUI({ label: 'MIN' }),
		outputMaxInput = new SOROLLET.KnobGUI({ label: 'MAX' }),
		knobsDiv = document.createElement( 'div' ),
		attackInput = new SOROLLET.KnobGUI({ label: 'ATTACK' }),
		decayInput = new SOROLLET.KnobGUI({ label: 'DECAY' }),
		sustainInput = new SOROLLET.KnobGUI({ label: 'SUSTAIN' }),
		releaseInput = new SOROLLET.KnobGUI({ label: 'RELEASE' }),
		timeScaleInput = new SOROLLET.KnobGUI({ label: 'TIME SCALE' });

	panel.add( new UI.Text().setValue( label ).setClass( 'section_label'  ));
	
	panel.add( subPanel );
	subPanel.dom.appendChild( leftDiv );
	subPanel.dom.appendChild( rightDiv );
	leftDiv.className = 'output_range';
	rightDiv.className = 'graph_controls';

	leftDiv.appendChild( outputMaxInput.dom );
	leftDiv.appendChild( outputMinInput.dom );

	outputMinInput.min = outMin;
	outputMinInput.max = outMax;
	outputMinInput.step = step;
	outputMinInput.onChange( onChange );

	outputMaxInput.min = outMin;
	outputMaxInput.max = outMax;
	outputMaxInput.step = step;
	outputMaxInput.onChange( onChange );

	// TODO refactor canvas & handling into ADSR_Graph
	var canvas = document.createElement( 'canvas' ),
		ctx = canvas.getContext( '2d' ),
		canvasW = 220,
		canvasH = 120;

	canvas.width = canvasW;
	canvas.height = canvasH;
	
	rightDiv.appendChild( canvas );
	rightDiv.appendChild( knobsDiv );

	knobsDiv.className = 'knobs';
	knobsDiv.appendChild( attackInput.dom );
	knobsDiv.appendChild( decayInput.dom );
	knobsDiv.appendChild( sustainInput.dom );
	knobsDiv.appendChild( releaseInput.dom );
	knobsDiv.appendChild( timeScaleInput.dom );

	[ attackInput, decayInput, sustainInput, releaseInput ].forEach(function( elem ) {
		elem.min = 0.0;
		elem.max = 1.0;
		elem.onChange( onChange );
	});

	timeScaleInput.min = timeMin;
	timeScaleInput.max = timeMax;
	timeScaleInput.step = 10;
	timeScaleInput.onChange( onChange );
	
	//

	EventTarget.call( this );

	this.dom = panel.dom;
	this.attack = attackInput;
	this.attackLength = 0;
	this.decay = decayInput;
	this.decayLength = 0;
	this.sustain = sustainInput;
	this.release = releaseInput;
	this.releaseLength = 0;
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

	function updateGraph() {
		var darkStrokeStyle = '#222222',
			lightStrokeStyle = '#666666';

		ctx.clearRect( 0, 0, canvasW, canvasH );

		ctx.save();
		ctx.translate(0, canvasH);
		ctx.scale(1, -1);
		
		var padW = 30,
			padH = 20,
			ox = padW,
			oy = padH,
			w = canvasW - padW * 2,
			h = canvasH - padH * 2,
			segW = w / 4,
			ax = ox + attackInput.getValue() * segW,
			ay = oy + h,
			dx = ax + decayInput.getValue() * segW,
			dy = oy + sustainInput.getValue() * h,
			sx = w - releaseInput.getValue() * segW + ox,
			rx = w + ox,
			ry = oy;
		
		// Axis
		ctx.strokeStyle = lightStrokeStyle;

		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo( ox, oy + h + padH * 0.5 );
		ctx.lineTo( ox, oy );
		ctx.lineTo( w + ox*1.5, oy );
		ctx.stroke();

		ctx.lineWidth = 1;
		ctx.strokeStyle = darkStrokeStyle;

		// Dashed hints
		ctx.setLineDash([1, 1, 0, 1]);
		var hints = [];
	
		hints.push([ [ox, ay], [ax, ay] ]);
		if( ax != ox ) {
			hints.push([ [ax, oy], [ax, ay] ]);
		}

		if( ax != dx ) {
			hints.push([ [dx, oy], [dx, dy] ]);
		}
		if( ay != dy ) {
			hints.push([ [ox, dy], [dx, dy] ]); 
		}

		if( sx != rx ) {
			hints.push([ [sx, oy], [sx, dy] ]);
		}

		hints.forEach(function(pair) {
			var src = pair[0],
				dst = pair[1];
			ctx.beginPath();
			ctx.moveTo( src[0], src[1] );
			ctx.lineTo( dst[0], dst[1] );
			ctx.stroke();
		});

		
		// ADSR 'proper'

		ctx.setLineDash( null );
		ctx.beginPath();
		ctx.moveTo( ox, oy );
		ctx.lineTo( ax, ay );
		ctx.lineTo( dx, dy );
		ctx.lineTo( sx, dy );
		ctx.lineTo( rx, ry );
		ctx.stroke();

		ctx.restore();

		// Labels
		// (getting out of translated/scale coord system because otherwise
		// the text shows upside down ò_ó)
		var textHeight = 10,
			xAxisY = oy + h + textHeight,
			yAxisX = ox - 3,
			yAxisY = oy + h;

		ctx.strokeStyle = darkStrokeStyle;
		ctx.textAlign = 'center';
		ctx.font = 'normal ' + textHeight + 'px Helvetica, Arial, sans-serif';

		ctx.strokeText( this.attackLength, (ox + ax) / 2, xAxisY );

		if( ax != dx ) {
			ctx.strokeText( this.decayLength, (ax+dx) / 2, xAxisY );
		}

		ctx.strokeText( this.releaseLength, (sx+rx) / 2, xAxisY );

		ctx.textAlign = 'end';
		ctx.strokeText( outputMinInput.getValue(), yAxisX, yAxisY );
		ctx.strokeText( outputMaxInput.getValue(), yAxisX, yAxisY - h );

		if( sustainInput.getValue()*1 < 1) {
			var min = outputMinInput.getValue() * 1,
				max = outputMaxInput.getValue() * 1,
				sustainValue = sustainInput.getValue() * 1,
				diff = max - min,
				middle = StringFormat.toFixed( min + (diff) * sustainValue );

			ctx.strokeText( middle, yAxisX, yAxisY - h * sustainValue );
		}
		
	}

	this.updateGraph = updateGraph;
	
	updateGraph();


}
