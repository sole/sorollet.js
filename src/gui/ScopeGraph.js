SOROLLET.ScopeGraph = function( params ) {
	var params = params || {},
		canvasWidth = params.width !== undefined ? params.width : 320,
		canvasHeight = params.height !== undefined ? params.height : 240,
		canvas = document.createElement( 'canvas' ),
		ctx = canvas.getContext( '2d' );

	canvas.width = canvasWidth;
	canvas.height = canvasHeight;

	this.dom = canvas;

	// Data is assumed to be a two dimensional array where X ~ time, and Y ~ values
	this.update = function( data ) {

		ctx.fillStyle = 'rgb(0, 0, 0)';
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		var num = 128,
			sliceSize = Math.round(data.length / num),
			sliceWidth = canvasWidth / num,
			index = 0;

		ctx.lineWidth = 1;
		ctx.strokeStyle = 'rgb(0, 255, 0)';
		var halfHeight = canvasHeight >> 1;

		ctx.beginPath();

		var x = 0;

		for(var i = 0; i < num; i++) {
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
