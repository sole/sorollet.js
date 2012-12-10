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

	function updateGraph() {
		//ctx.fillStyle = '#ff0000';
		//ctx.fillRect( 0, 0, width, height );

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

	this.setValue = function( v ) {
		value = Math.round( v ) % numberOfStates;
		updateGraph();
	}

	this.getValue = function() {
		return value;
	}

	this.dom = canvas;

	return this;
}
