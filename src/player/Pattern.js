SOROLLET.Pattern = function( numTracks, length ) {
	'use strict';

	this.rows = [];

	for( var i = 0; i < length; i++ ) {
		
		var row = [];
		
		for( var j = 0; j < numTracks; j++ ) {

			row.push( new SOROLLET.PatternCell() );

		}

		this.rows.push( row );
	}

	this.getCell = function( i, j ) {
		return this.rows[i][j];
	}
}

SOROLLET.PatternCell = function() {
	
	this.reset();

}

SOROLLET.PatternCell.prototype = {
	note: null,
	noteOff: false,
	volume: null,

	reset: function() {
		this.note = null;
		this.noteOff = false;
		this.volume = null;
	}
};
