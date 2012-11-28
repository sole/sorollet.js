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

		dispatchKeyDown( key.dataset['index'] );
	}

	function onDivMouseUp( e ) {
		if( keyPressed ) {
			dispatchKeyUp();
		}
	}

	function findKeyIndex( e ) {
		var keyCode = e.keyCode || e.which,
			keyChar = String.fromCharCode( keyCode ),
			index = keyboardLayout.indexOf( keyChar );
		
		return index;

	}

	function onKeyDown( e ) {

		var index = findKeyIndex( e );

		if( keyPressed ) {
			return;
		}

		if( index == -1 || e.altKey || e.altGraphKey || e.ctrlKey || e.metaKey || e.shiftKey ) {
			// no further processing
			return;
		}

		dispatchKeyDown( index );
	}

	function onKeyUp( e ) {
		// Only fire key up if the key is in the defined layout
		if( findKeyIndex( e ) !== -1 ) {
			dispatchKeyUp();
		}
	}

	function dispatchKeyDown( index ) {
		
		keyPressed = true;
	
		var key = keys[index],
			currentClass = key.className;
		
		if( currentClass.indexOf('active') == -1 ) {
			currentClass += ' active';
		}

		key.className = currentClass;

		scope.dispatchEvent({
			type: 'keydown',
			index: index
		});
	}

	function dispatchKeyUp( ) {
	
		var activeKey = dom.querySelector( '.active' );
		if( activeKey ) {
			activeKey.className = activeKey.className.replace('active', '');
		}

		keyPressed = false;

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
