SOROLLET.MultipleStatePushButton = function( params ) {

	var params = params || {},
		width = params.width !== undefined ? params.width : 32,
		height = width,
		numberOfStates = params.numberOfStates !== undefined ? params.numberOfStates : 2,
		canvas = document.createElement('canvas'),
		ctx = canvas.getContext( '2d' );

	canvas.width = width;
	canvas.height = height;
	canvas.dataset['control'] = this; // TODO ???

	canvas.addEventListener( 'click', function() {
		nextValue();
	}, false );

	this.dom = canvas;

	EventTarget.call( this );

	function updateGraph() {

		ctx.clearRect(0, 0, width, height);
		
		var radius = (value * width * 0.5) / numberOfStates,
			cx = width * 0.5,
			cy = height * 0.5;

		ctx.fillStyle = '#eeeeee';
		ctx.beginPath();
		ctx.arc( cx, cy, width * 0.5, 0, Math.PI * 2, true );
		ctx.fill();

		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc( cx, cy, radius, 0, Math.PI * 2, true );
		ctx.stroke();

	}

	function nextValue() {
		var newValue = (value+1) % numberOfStates;
		setValue( newValue );
	}
	
	function setValue( v ) {
		value = Math.round( v ) % numberOfStates;
		updateGraph();

		dispatchEvent({
			type: 'change',
			value: value
		});
	}
	this.setValue = setValue;

	this.getValue = function() {
		return value;
	}

	var dispatchEvent = this.dispatchEvent;

	return this;
}
