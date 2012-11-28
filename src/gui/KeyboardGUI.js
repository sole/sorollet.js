'use strict';
SOROLLET.KeyboardGUI = function( params ) {
	var params = params || {},
		numOctaves = Math.min(2, params.numOctaves || 1),
		keyClass = params.keyClass || 'key',
		keyBlackClass = params.keyClassBlack || 'key black',
		keyboardLayout = params.keyboardLayout || 'ZSXDCVGBHNJMQ2W3ER5T6Y7U'.split(''),
		blacks = [ false, true, false, true, false, false, true, false, true, false, true, false ],
		dom = document.createElement( 'div' ),
		keys = [],
		scope = this,
		keyPressed = false;

	function onDivMouseDown( e ) {
		var key = this;

		if( keyPressed ) {
			return;
		}

		keyPressed = true;
		dispatchKeyDown( key.dataset['index'] );
	}

	function onDivMouseUp( e ) {
		if( keyPressed ) {
			dispatchKeyUp();
		}
		keyPressed = false;
	}

	function onKeyDown( e ) {
		var keyCode = e.keyCode || e.which,
			keyChar = String.fromCharCode( keyCode ),
			index = keyboardLayout.indexOf( keyChar );
		
		if( keyPressed ) {
			return;
		}

		if( index == -1 || e.altKey || e.altGraphKey || e.ctrlKey || e.metaKey || e.shiftKey ) {
			// no further processing
			return;
		}

		keyPressed = true;
		dispatchKeyDown( index );
	}

	function onKeyUp( e ) {
		dispatchKeyUp();
		keyPressed = false;
	}

	function dispatchKeyDown( index ) {
		scope.dispatchEvent({
			type: 'keydown',
			index: index
		});
	}

	function dispatchKeyUp( ) {
		scope.dispatchEvent({
			type: 'keyup'
		});
	}

	for(var i = 0; i < numOctaves; i++) {
		for(var j = 0; j < blacks.length; j++) {
			var isBlack = blacks[j],
				keyDiv = document.createElement( 'div' ),
				index = j + blacks.length * i,
				label = keyboardLayout[ index ];

			keyDiv.className = isBlack ? keyBlackClass : keyClass;
			keyDiv.innerHTML = label;
			keyDiv.dataset['index'] = index;

			keyDiv.addEventListener( 'mousedown', onDivMouseDown, false );
			keyDiv.addEventListener( 'mouseup', onDivMouseUp, false );

			keys.push( keyDiv );

			dom.appendChild( keyDiv );
		}
	}

	dom.addEventListener( 'keydown', onKeyDown, false);
	dom.addEventListener( 'keyup', onKeyUp, false);


	this.dom = dom;

	EventTarget.call( this );

	return this;
}
