SOROLLET.WaveTypeSelectGUI = function( params ) {
	'use strict';

	var params = params || {},
		graphWidth = params.graphWidth !== undefined ? params.graphWidth : 50,
		graphHeight = params.graphHeight !== undefined ? params.graphHeight : 30,
		backgroundStyle = params.backgroundStyle !== undefined ? params.backgroundStyle : null,
		strokeStyle = params.strokeStyle !== undefined ? params.strokeStyle : '#000000',
		lineWidth = params.strokeWidth !== undefined ? params.lineWidth : 2,
		div = document.createElement( 'div' ),
		canvas = document.createElement( 'canvas' ),
		ctx = canvas.getContext( '2d' ),
		label = document.createElement( 'div' ),
		value,
		waveFunctions = null, waveNames = null, numWaveFunctions = 0,
		onChangeHandler = function( ) { };

	div.className = 'control';

	canvas.width = graphWidth;
	canvas.height = graphHeight;

	label.className = 'label';

	div.appendChild( canvas );
	div.appendChild( label );

	this.dom = div;

	canvas.addEventListener('click', onCanvasClick, false);

	function onCanvasClick( e ) {
		var x = e.offsetX,
			w = e.srcElement.offsetWidth;

		e.preventDefault();
		e.stopPropagation();

		if( x < w / 2 ) {
			usePreviousWaveType();
		} else {
			useNextWaveType();
		}
	}

	function usePreviousWaveType() {
		var newValue = value - 1;
		
		if( newValue < 0 ) {
			newValue = numWaveFunctions - 1;
		}
		setValue( newValue );
		onChangeHandler( newValue );
	}

	function useNextWaveType() {
		var newValue = (value + 1) % numWaveFunctions;
		setValue( newValue );
		onChangeHandler( newValue );
	}

	function drawGraph() {
	
		var angleIncrement = Math.PI * 2.0 / graphWidth,
			x = 1, y, angle = 0,
			graphHeightRange = graphHeight * 0.7;

		if( backgroundStyle === null) {
			ctx.clearRect( 0, 0, graphWidth, graphHeight );
		} else {
			ctx.fillStyle = backgroundStyle;
			ctx.fillRect( 0, 0, graphWidth, graphHeight );
		}

		ctx.save();
		
		ctx.translate( -lineWidth * 0.5, 0 );

		ctx.strokeStyle = strokeStyle;
		ctx.lineWidth = lineWidth;

		if( waveFunctions === null ) {
			return;
		}

		var voice = new SOROLLET.Voice(),
			plotBuffer = [],
			plotFunction = waveFunctions[ value ];
		
		voice.setSamplingRate( graphWidth );
	
		plotFunction.call( voice, plotBuffer, graphWidth, 0, 2, 0 );

		ctx.beginPath();

		for( var i = 0; i <= graphWidth; i++) {
			y = plotBuffer[i] * graphHeightRange * .5 + graphHeight * 0.5;

			if( x == 0 ) {
				ctx.moveTo( x, y );
			}

			ctx.lineTo( x, y );
			angle += angleIncrement;
			x++;
		}

		ctx.stroke();
		ctx.restore();

	}
	this.drawGraph = drawGraph;

	this.setOptions = function( names, functions ) {
		waveNames = names;
		waveFunctions = functions;

		numWaveFunctions = 0;

		for(var prop in waveFunctions) {
			numWaveFunctions++;
		}
		return this;
	}


	function setValue( v ) {
		value = v >> 0;

		drawGraph();

		label.innerHTML = waveNames[ v ];
	}
	this.setValue = setValue;

	this.getValue = function( ) {
		return value;
	}

	this.onChange = function( newOnChangeHandler ) {
		onChangeHandler = newOnChangeHandler;
		return this;
	}

	return this;
}
