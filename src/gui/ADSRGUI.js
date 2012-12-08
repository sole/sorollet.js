SOROLLET.ADSRGUI = function( params ) {

	var params = params || {},
		label = params.label || '',
		outMin = params.outMin || 0,
		outMax = params.outMax || 1,
		step = params.step || 0.5,
		timeMin = params.timeMin || 0,
		timeMax = params.timeMax || 100,
		width = params.width || 220,
		//
		panel = new UI.Panel(),
		subPanel = new UI.Panel().setClass('ADSR_GUI'),
		leftDiv = document.createElement( 'div' ),
		rightDiv = document.createElement( 'div' ),
		outputMinKnob = new SOROLLET.KnobGUI({ label: 'MIN', min: outMin, max: outMax, step: step }),
		outputMaxKnob = new SOROLLET.KnobGUI({ label: 'MAX', min: outMin, max: outMax, step: step }),
		knobsDiv = document.createElement( 'div' ),
		attackKnob = new SOROLLET.KnobGUI({ label: 'ATTACK' }),
		decayKnob = new SOROLLET.KnobGUI({ label: 'DECAY' }),
		sustainKnob = new SOROLLET.KnobGUI({ label: 'SUSTAIN' }),
		releaseKnob = new SOROLLET.KnobGUI({ label: 'RELEASE' }),
		timeScaleKnob = new SOROLLET.KnobGUI({ label: 'TIME SCALE' });

	panel.add( new UI.Text().setValue( label ).setClass( 'section_label'  ));
	
	panel.add( subPanel );
	subPanel.dom.appendChild( leftDiv );
	subPanel.dom.appendChild( rightDiv );
	leftDiv.className = 'output_range';
	rightDiv.className = 'graph_controls';

	leftDiv.appendChild( outputMaxKnob.dom );
	leftDiv.appendChild( outputMinKnob.dom );

	outputMinKnob.onChange( onChange );
	outputMaxKnob.onChange( onChange );

	// TODO refactor canvas & handling into ADSR_Graph
	var canvas = document.createElement( 'canvas' ),
		ctx = canvas.getContext( '2d' ),
		canvasW = width,
		canvasH = width - 100;

	canvas.width = canvasW;
	canvas.height = canvasH;
	
	rightDiv.appendChild( canvas );
	rightDiv.appendChild( knobsDiv );

	knobsDiv.className = 'controls_row';
	knobsDiv.appendChild( attackKnob.dom );
	knobsDiv.appendChild( decayKnob.dom );
	knobsDiv.appendChild( sustainKnob.dom );
	knobsDiv.appendChild( releaseKnob.dom );
	knobsDiv.appendChild( timeScaleKnob.dom );

	[ attackKnob, decayKnob, sustainKnob, releaseKnob ].forEach(function( elem ) {
		elem.min = 0.0;
		elem.max = 1.0;
		elem.onChange( onChange );
	});

	timeScaleKnob.min = timeMin;
	timeScaleKnob.max = timeMax;
	timeScaleKnob.step = 10;
	timeScaleKnob.onChange( onChange );
	
	//

	EventTarget.call( this );

	this.dom = panel.dom;
	this.attack = attackKnob;
	this.attackLength = 0;
	this.decay = decayKnob;
	this.decayLength = 0;
	this.sustain = sustainKnob;
	this.release = releaseKnob;
	this.releaseLength = 0;
	this.timeScale = timeScaleKnob;
	this.outputMin = outputMinKnob;
	this.outputMax = outputMaxKnob;

	var dispatchEvent = this.dispatchEvent;
	function onChange() {
		dispatchEvent({
			type: 'change',
			attack: attackKnob.getValue(),
			decay: decayKnob.getValue(),
			sustain: sustainKnob.getValue(),
			release: releaseKnob.getValue(),
			timeScale: timeScaleKnob.getValue(),
			outputMin: outputMinKnob.getValue(),
			outputMax: outputMaxKnob.getValue()
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
			ax = ox + attackKnob.getValue() * segW,
			ay = oy + h,
			dx = ax + decayKnob.getValue() * segW,
			dy = oy + sustainKnob.getValue() * h,
			sx = w - releaseKnob.getValue() * segW + ox,
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

		// Dashed hints (if supported)
		if( ctx.setLineDash ) {
			ctx.setLineDash([1, 1, 0, 1]);
		}
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

		if( ctx.setLineDash) {
			ctx.setLineDash( null );
		}
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
		ctx.strokeText( outputMinKnob.getValue(), yAxisX, yAxisY );
		ctx.strokeText( outputMaxKnob.getValue(), yAxisX, yAxisY - h );

		if( sustainKnob.getValue()*1 < 1) {
			var min = outputMinKnob.getValue() * 1,
				max = outputMaxKnob.getValue() * 1,
				sustainValue = sustainKnob.getValue() * 1,
				diff = max - min,
				middle = StringFormat.toFixed( min + (diff) * sustainValue );

			ctx.strokeText( middle, yAxisX, yAxisY - h * sustainValue );
		}
		
	}

	this.updateGraph = updateGraph;
	
	updateGraph();


}
