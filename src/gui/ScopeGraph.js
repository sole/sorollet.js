SOROLLET.ScopeGraph = function( params ) {
	var params = params || {},
		canvasWidth = params.width !== undefined ? params.width : 320,
		canvasHeight = params.height !== undefined ? params.height : 240,
		numSlices = params.numSlices !== undefined ? params.numSlices : 128,
		inverseNumSlices = 1.0 / numSlices,
		sliceWidth = canvasWidth / numSlices,
		halfHeight = canvasHeight >> 1,
		canvas = document.createElement( 'canvas' ),
		ctx = canvas.getContext( '2d' );

	canvas.width = canvasWidth;
	canvas.height = canvasHeight;

	this.dom = canvas;

	// Data is assumed to be a two dimensional array where X ~ time, and Y ~ values
	this.update = function( data ) {

		var sliceSize = Math.round(data.length * inverseNumSlices),
			index = 0;

		ctx.fillStyle = 'rgb(0, 0, 0)';
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		ctx.lineWidth = 1;
		ctx.strokeStyle = 'rgb(0, 255, 0)';

		ctx.beginPath();

		var x = 0;

		for(var i = 0; i < numSlices; i++) {
			index += sliceSize ;

			if(index > data.length) {
				break;
			}
			
			var v = data[index],
				y = halfHeight + v * halfHeight; // relative to canvas size. Originally it's -1..1
			
			if(i == 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}

			x += sliceWidth;
		}

		ctx.lineTo(canvasWidth, halfHeight);

		ctx.stroke();

	}

	return this;

};
