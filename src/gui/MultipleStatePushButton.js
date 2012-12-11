SOROLLET.MultipleStatePushButton = function( params ) {
	'use strict';
	var params = params || {},
		width = params.width !== undefined ? params.width : 32,
		height = width,
		numberOfStates = params.numberOfStates !== undefined ? params.numberOfStates : 2,
		activeFillStyle = params.activeFillStyle !== undefined ? params.activeFillStyle : '#eeffff',
		inactiveFillStyle = params.inactiveFillStyle !== undefined ? params.inactiveFillStyle : '#eeeeee',
		hoverFillStyle = params.hoverFillStyle !== undefined ? params.hoverFillStyle : '#ffffee',
		canvas = document.createElement('canvas'),
		ctx = canvas.getContext( '2d' ),
		value = 0,
		scope = this;

	canvas.width = width;
	canvas.height = height;
	canvas.dataset['control'] = this; // TODO ???

	canvas.addEventListener( 'click', function( e ) {
		e.preventDefault();
		nextValue();
	}, false );

	canvas.addEventListener( 'mouseover', function() {
		scope.hovered = true;
		updateGraph();
	}, false );

	canvas.addEventListener( 'mouseout', function() {
		scope.hovered = false;
		updateGraph();
	}, false );

	this.dom = canvas;
	this.active = false;
	this.hovered = false;
	
	EventTarget.call( this );

	function updateGraph() {

		ctx.clearRect(0, 0, width, height);
		
		var radius = (value * width * 0.5) / numberOfStates,
			cx = width * 0.5,
			cy = height * 0.5;

		if( scope.hovered ) {
			ctx.fillStyle = hoverFillStyle;
		} else if( scope.active ) {
			ctx.fillStyle = activeFillStyle;
		} else {
			ctx.fillStyle = inactiveFillStyle;
		}
		//ctx.fillStyle = '#eeeeee';
		ctx.beginPath();
		ctx.arc( cx, cy, width * 0.5, 0, Math.PI * 2, true );
		ctx.fill();

		if( radius > 0 ) {
			ctx.strokeStyle = '#000000';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc( cx, cy, radius, 0, Math.PI * 2, true );
			ctx.stroke();
		}

	}

	function nextValue() {
		var newValue = (value+1) % numberOfStates;
		setValue( newValue );
	}
	
	function setValue( v, eventDispatchingAllowed ) {
		eventDispatchingAllowed = eventDispatchingAllowed !== undefined ? eventDispatchingAllowed : true;

		value = Math.round( v ) % numberOfStates;
		updateGraph();

		if( eventDispatchingAllowed ) {
			dispatchEvent({
				type: 'change',
				value: value
			});
		}
	}
	this.setValue = setValue;

	this.getValue = function() {
		return value;
	}

	this.setActive = function( v ) {
		this.active = v;
		updateGraph();
	}

	var dispatchEvent = this.dispatchEvent;



	return this;
}
