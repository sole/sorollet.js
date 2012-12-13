function DrumPatternGUI( numVoices, patternLength, pushButtonNumberStates ) {
	
	var div = document.createElement( 'div' ),
		table = document.createElement( 'table' ),
		tbody = document.createElement( 'tbody' ),
		numberOfStates = pushButtonNumberStates !== undefined ? pushButtonNumberStates : 3,
		cells = [],
		scope = this,
		blockWidth = 4; // TODO make this a parameter

	EventTarget.call( this );

	div.appendChild( table );
	table.appendChild( tbody );

	for( var i = 0; i < numVoices; i++) {
		var row = [],
			tr = document.createElement( 'tr' );

		tbody.appendChild( tr );

		for(var j = 0; j < patternLength; j++) {
			var td = document.createElement( 'td' ),
				blockNumber = (j / blockWidth) | 0,
				pushButton = new SOROLLET.MultipleStatePushButton({ numberOfStates: numberOfStates, inactiveFillStyle: blockNumber % 2 == 0 ? '#dddddd' : '#eeeeee'  });

;

			pushButton.addEventListener( 'change', (function( _i, _j ) {
					return function( e ) {
						dispatchEvent({ type: 'change', track: _i, row: _j, value: e.value });
					};
				})(i, j), false);

			tr.appendChild( td );
			td.appendChild( pushButton.dom );

			row.push( pushButton );
			
		}

		cells.push( row );
	}

	function dispatchEvent(e) {
		scope.dispatchEvent( e );
	}

	this.dom = div;

	this.highlightColumn = function( columnNumber ) {
		for( var j = 0; j < patternLength; j++ ) {
			for(var i = 0; i < numVoices; i++ ) {
				var cell = cells[i][j];

				cell.setActive( j == columnNumber );
			}
		}
	}

	this.setCellValue = function(i, j, value, dispatchEvents ) {
		cells[j][i].setValue( value, dispatchEvents );
	}

	this.setPatternData = function( pattern ) {
		for( var i = 0; i < pattern.rows.length; i++ ) {
			var row = pattern.rows[i];
			for( var j = 0; j < row.length; j++) {
				var cell = row[j],
					pushButton = cells[j][i];

				if( cell.note !== null ) {
					pushButton.setValue( volumeToValue( cell.volume ), false );
				} else {
					pushButton.setValue( 0, false );
				}
			}
		}
	}

	return this;
}
