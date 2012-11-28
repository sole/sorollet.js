// sorollet.js - http://github.com/sole/sorollet.js
var SOROLLET = SOROLLET || { 
        REVISION: '2',
        NOTE_NULL: -1
};
SOROLLET.Math = {

	randSeed : 1,

	normalize: function(value, minimum, maximum) {
		return (value - minimum) / (maximum - minimum);
	},

	interpolate: function(normValue, minimum, maximum) {
		return minimum + (maximum - minimum) * normValue;
	},

	map: function(value, in_min, in_max, out_min, out_max) {

		if(in_min == in_max) {
			return out_min;
		}

		return out_min + (out_max - out_min) * (value - in_min) / (in_max - in_min);
	},

	randf : function() {
		this.randSeed *= 16807;
		return (this.randSeed) / 0x80000000;
	},

	clip: function(value, minV, maxV) {
		return Math.max(Math.min(value, maxV), minV);
	}

}
'use strict';

SOROLLET.Voice = function() {
	
	this.buffer = [];
	this.position = 0;
	this.currentNote = null;
	this.currentVolume = 0;

	this.internalSamplePosition = 0;
	this.setSamplingRate( 44100 );

	this.wave1Function = this.getSineBuffer;
	this.wave1Octave = 5;
	this.wave1Volume = 0.5;
	this.wave1Phase = 0;
	
	this.wave2Function = this.getSquareBuffer;
	this.wave2Octave = 4;
	this.wave2Volume = 0.5;
	this.wave2Phase = 0;

	this.waveMixFunction = this.mixAdd;
	
	this.noiseAmount = 0.0;
	this.noiseMixFunction = this.noiseAdd;

	this.ampADSR = new SOROLLET.ADSR(0.5, 0, 1, 1, 1);
	this.pitchADSR = new SOROLLET.ADSR(0, 0, 1, 0, 1);

	this.ampADSR.setOutputRange( 0, 1 );
	this.pitchADSR.setOutputRange( 0, 0 );

}

SOROLLET.Voice.prototype = {

	constructor: SOROLLET.Voice,
	
	setSamplingRate : function( value ) {

		this.samplingRate = value;
		this.inverseSamplingRate = 1.0 / value;

	},

	noteToFrequency: function(note, octave) {
		return 440.0 * Math.pow(2, ((note - 57.0 + (octave - 4.0) * 12.0) / 12.0));
	},

	zeroBuffer: function(buffer, numSamples) {
		for(var i = 0; i < numSamples; i++) {
			buffer[i] = 0;
		}
	},

	getTime: function() {
		return this.internalSamplePosition * this.inverseSamplingRate;
	},


	getSineBuffer : function getSineBuffer(buffer, numSamples, pos, frequency, phase) {
		var value,
			cst = 2.0 * Math.PI * frequency * this.inverseSamplingRate;

		for(var i = 0; i < numSamples; ++i) {
			value = Math.sin(cst * pos + phase);
			buffer[i] = value;

			pos++;
		}
	},

	getTriangleBuffer: function getTriangleBuffer(buffer, numSamples, pos, frequency, phase) {
		var period = 1.0 / frequency,
			semiperiod = period * 0.5,
			value,
			ft = semiperiod * 0.5;

		for(var i = 0; i < numSamples; ++i) {
			var t = (i + pos + phase) * this.inverseSamplingRate + ft;

			if(t % period < semiperiod) {
				value = 2.0 * ((t % semiperiod) / semiperiod) - 1.0;
			} else {
				value = 1.0 - 2.0 * (t % semiperiod) / semiperiod;
			}

			buffer[i] = value;
		}
	},

	getSquareBuffer: function getSquareBuffer(buffer, numSamples, pos, frequency, phase) {
		var period = 1.0 / frequency,
			halfPeriod = period * 0.5,
			value;

		for(var i = 0; i < numSamples; i++) {
			var t = (i + pos + phase) * this.inverseSamplingRate;

			if(t % period < halfPeriod) {
				value = 1.0;
			} else {
				value = -1.0;
			}

			buffer[i] = value;
		}
	},

	getSawtoothBuffer: function getSawtoothBuffer(buffer, numSamples, pos, frequency, phase) {
		var period = 1.0 / frequency,
			value;

		for(var i = 0; i < numSamples; i++) {
			var t = (pos + phase) * this.inverseSamplingRate;

			value = 2.0 * ((t % period) * frequency) - 1.0;

			buffer[i] = value;

			pos++;
		}
	},

	mixAdd: function(v1, v2) {
		return v1 + v2;
	},

	mixSubstract: function(v1, v2) {
		return v1 - v2;
	},

	mixMultiply: function(v1, v2) {
		return v1 * v2;
	},

	mixDivide: function(v1, v2) {
		if(v2 == 0) {
			v2 = 0.0001;
		}

		return v1 / v2;
	},

	noiseAdd: function(noiseValue, waveValue, notNoiseAmount) {
		return noiseValue + waveValue;
	},

	noiseMix: function(noiseValue, waveValue, notNoiseAmount) {
		return waveValue * notNoiseAmount + noiseValue;
	},

	noiseMultiply: function(noiseValue, waveValue, notNoiseAmount) {
		return noiseValue * waveValue;
	},
	
	getNoiseBuffer: function(buffer, numSamples) {
		for(var i = 0; i < numSamples; i++) {
			buffer[i] = Math.random() * 2 - 1; 
		}
	},

	sendNoteOn: function(note, volume) {
		this.position = 0;
		this.internalSamplePosition = 0;
		this.currentNote = note;
		this.currentVolume = volume;

		var t = this.getTime();
		this.ampADSR.beginAttack(t);
		this.pitchADSR.beginAttack(t);
	},

	sendNoteOff: function() {
		var t = this.getTime();
		this.ampADSR.beginRelease(t);
		this.pitchADSR.beginRelease(t);
	},
	
	getBuffer: function(numSamples) {
		
		var wave1Buffer = [],
			wave2Buffer = [],
			noiseBuffer = [],
			bufferPitch1 = [],
			bufferPitch2 = [],
			bufferAmp = [],
			tmpBuffer = [],
			currentTime = this.getTime(),

			// Local references
			buffer = this.buffer,
			bufferTime = currentTime,
			currentNote = this.currentNote,
			wave1Octave = this.wave1Octave,
			wave2Octave = this.wave2Octave,
			wave1Volume = this.wave1Volume,
			wave1Phase = this.wave1Phase,
			wave2Phase = this.wave2Phase,
			wave2Volume = this.wave2Volume,
			inverseSamplingRate = this.inverseSamplingRate,
			noiseAmount = this.noiseAmount,
			notNoiseAmount = 1 - noiseAmount,
			zeroBufferFn = this.zeroBuffer,
			noteToFrequencyFn = this.noteToFrequency,
			getNoiseBufferFn = this.getNoiseBuffer,
			wave1Function = this.wave1Function,
			wave2Function = this.wave2Function,
			waveMixFunction = this.waveMixFunction,
			clipFn = SOROLLET.Math.clip;


		zeroBufferFn(buffer, numSamples);

		if( this.ampADSR.state == SOROLLET.ADSR.STATE_DONE ) {
			this.currentNote = null;
			currentNote = null;
		}

		if(this.currentNote === null) {
			return buffer;
		}

		zeroBufferFn(wave1Buffer, numSamples);
		zeroBufferFn(wave2Buffer, numSamples);
		zeroBufferFn(noiseBuffer, numSamples);
		zeroBufferFn(bufferPitch1, numSamples);
		zeroBufferFn(bufferPitch2, numSamples);
		zeroBufferFn(bufferAmp, numSamples);

		// Fill the amp and pitch buffers for this run
		
		for (var i = 0; i < numSamples; i++) {
			var pitchEnv = this.pitchADSR.update(bufferTime),
				sampleNote = currentNote + pitchEnv;

			bufferPitch1[i] = this.noteToFrequency(sampleNote, wave1Octave);
			bufferPitch2[i] = this.noteToFrequency(sampleNote, wave2Octave);
			bufferAmp[i] = this.ampADSR.update(bufferTime);
			
			bufferTime += inverseSamplingRate;
		}


		if(this.wave1Volume > 0) {
			var pos = this.position;
			
			for(var i = 0; i < numSamples; i++) {
				var frequency = bufferPitch1[i];
				
				this.wave1Function(tmpBuffer, 1, pos, frequency, wave1Phase);
				wave1Buffer[i] = tmpBuffer[0];
				pos++;
			}
		}

		if(this.wave2Volume > 0) {
			var pos = this.position;

			for(var i = 0; i < numSamples; i++) {
				var frequency = bufferPitch2[i];
				
				this.wave2Function(tmpBuffer, 1, pos, frequency, wave2Phase);
				wave2Buffer[i] = tmpBuffer[0];
				pos++;
			}
		}

		if(noiseAmount > 0) {
			getNoiseBufferFn(noiseBuffer, numSamples);
		}

		for(var i = 0; i < numSamples; i++) {

			var osc1 = wave1Buffer[i] * wave1Volume,
				osc2 = wave2Buffer[i] * wave2Volume;

			buffer[i] = waveMixFunction(osc1, osc2);

			if(noiseAmount > 0) {
				var noiseValue = noiseBuffer[i] * noiseAmount;
				buffer[i] = this.noiseMixFunction(noiseValue, buffer[i], notNoiseAmount);
			}

			// Apply amp envelope
			buffer[i] *= bufferAmp[i];

			// Clamp
			buffer[i] = clipFn(buffer[i], -1, 1);
		}

		this.position += numSamples;
		this.internalSamplePosition += numSamples;

		return buffer;
	}

}
'use strict';
SOROLLET.ADSR = function( attackLength, decayLength, sustainLevel, releaseLength, timeScale ) {
	this.state = this.STATE_DONE;
	this.timeScale = timeScale;

	this.attackStartTime = 0;
	this.attackEndTime = 0;
	this.decayEndTime = 0;
	this.releaseStartTime = 0;
	
	this.__unscaledAttackLength = 0;
	this.attackLength = 0;
	this.__unscaledDecayLength = 0;
	this.decayLength = 0;
	this.sustainLevel = 0.5;
	this.__unscaledReleaseLength = 0;
	this.releaseLength = 0;
	
	this.lastValue = 0;

	this.setAttack( attackLength );
	this.setDecay( decayLength );
	this.setSustainLevel( sustainLevel );
	this.setRelease( releaseLength );
	this.setOutputRange( 0, 1 );

}

SOROLLET.ADSR.prototype = {
	constructor: SOROLLET.ADSR,

	STATE_ATTACK: 0,
	STATE_DECAY: 1,
	STATE_SUSTAIN: 2,
	STATE_RELEASE: 3,
	STATE_DONE: 4,

	setOutputRange : function( minimumValue, maximumValue ) {

		this.outputMinimumValue = minimumValue;
		this.outputMaximumValue = maximumValue;

	},

	setAttack: function( v ) {
		this.__unscaledAttackLength = v;
		this.attackLength = v * this.timeScale;
	},

	setDecay: function( v ) {
		this.__unscaledDecayLength = v;
		this.decayLength = v * this.timeScale;
		this.decayEndTime = this.attackEndTime + this.decayLength;
	},

	setSustainLevel: function( v ) {
		this.sustainLevel = v;
	},

	setRelease: function( v ) {
		this.__unscaledReleaseLength = v;
		this.releaseLength = v * this.timeScale;
		this.releaseEndTime = this.releaseStartTime + this.releaseLength;
	},

	setTimeScale: function( v ) {
		this.timeScale = v;
		this.setAttack( this.__unscaledAttackLength );
		this.setDecay( this.__unscaledDecayLength );
		this.setRelease( this.__unscaledReleaseLength );
	},

	beginAttack: function( time ) {
		this.state = this.STATE_ATTACK;
		this.attackStartTime = time;
		this.attackEndTime = time + this.attackLength;
		this.decayEndTime = this.attackEndTime + this.decayLength;
	},

	beginRelease: function( time ) {
		this.state = this.STATE_RELEASE;
		this.releaseStartTime = time;
		this.releaseEndTime = time + this.releaseLength;


	},

	update: function( time ) {
		var scaledSustainLevel,
			value = 0,
			scaledValue = 0.5,
			map = SOROLLET.Math.map,
			interpolate = SOROLLET.Math.interpolate;

			scaledSustainLevel = map( this.sustainLevel, 0, 1, this.outputMinimumValue, this.outputMaximumValue );

		if( this.state == this.STATE_DONE ) {
			scaledValue = this.outputMinimumValue;
		} else if( this.state == this.STATE_ATTACK ) {
			if( time > this.attackEndTime ) {

				this.state = this.STATE_DECAY;
				scaledValue = this.outputMaximumValue;
			} else {
				scaledValue = map( time, this.attackStartTime, this.attackEndTime, this.outputMinimumValue, this.outputMaximumValue );
			}
		} else if( this.state == this.STATE_DECAY ) {
			if( time > this.decayEndTime ) {

				this.state = this.STATE_SUSTAIN;
				scaledValue = scaledSustainLevel;
			} else {
				scaledValue = map( time, this.attackEndTime, this.decayEndTime, this.outputMaximumValue, scaledSustainLevel );
			}
		} else if( this.state == this.STATE_SUSTAIN ) {
			scaledValue = scaledSustainLevel;
		} else if( this.state == this.STATE_RELEASE ) {

			if( time > this.releaseEndTime ) {
				this.state = this.STATE_DONE;
				scaledValue = this.outputMinimumValue;
			} else {
				scaledValue = map( time, this.releaseStartTime, this.releaseEndTime, scaledSustainLevel, this.outputMinimumValue );
			}

		}

		this.lastValue = scaledValue;

		return scaledValue;
	}

};
/**
 * @author mr.doob / http://mrdoob.com/
 */

var EventTarget = function () {

	var listeners = {};

	this.addEventListener = function ( type, listener ) {

		if ( listeners[ type ] == undefined ) {

			listeners[ type ] = [];

		}

		if ( listeners[ type ].indexOf( listener ) === - 1 ) {

			listeners[ type ].push( listener );

		}

	};

	this.dispatchEvent = function ( event ) {

		for ( var listener in listeners[ event.type ] ) {

			listeners[ event.type ][ listener ]( event );

		}

	};

	this.removeEventListener = function ( type, listener ) {

		var index = listeners[ type ].indexOf( listener );

		if ( index !== - 1 ) {

			listeners[ type ].splice( index, 1 );

		}

	};

};
/*

 JS Signals <http://millermedeiros.github.com/js-signals/>
 Released under the MIT license
 Author: Miller Medeiros
 Version: 0.7.4 - Build: 252 (2012/02/24 10:30 PM)
*/
(function(h){function g(a,b,c,d,e){this._listener=b;this._isOnce=c;this.context=d;this._signal=a;this._priority=e||0}function f(a,b){if(typeof a!=="function")throw Error("listener is a required param of {fn}() and should be a Function.".replace("{fn}",b));}var e={VERSION:"0.7.4"};g.prototype={active:!0,params:null,execute:function(a){var b;this.active&&this._listener&&(a=this.params?this.params.concat(a):a,b=this._listener.apply(this.context,a),this._isOnce&&this.detach());return b},detach:function(){return this.isBound()?
this._signal.remove(this._listener,this.context):null},isBound:function(){return!!this._signal&&!!this._listener},getListener:function(){return this._listener},_destroy:function(){delete this._signal;delete this._listener;delete this.context},isOnce:function(){return this._isOnce},toString:function(){return"[SignalBinding isOnce:"+this._isOnce+", isBound:"+this.isBound()+", active:"+this.active+"]"}};e.Signal=function(){this._bindings=[];this._prevParams=null};e.Signal.prototype={memorize:!1,_shouldPropagate:!0,
active:!0,_registerListener:function(a,b,c,d){var e=this._indexOfListener(a,c);if(e!==-1){if(a=this._bindings[e],a.isOnce()!==b)throw Error("You cannot add"+(b?"":"Once")+"() then add"+(!b?"":"Once")+"() the same listener without removing the relationship first.");}else a=new g(this,a,b,c,d),this._addBinding(a);this.memorize&&this._prevParams&&a.execute(this._prevParams);return a},_addBinding:function(a){var b=this._bindings.length;do--b;while(this._bindings[b]&&a._priority<=this._bindings[b]._priority);
this._bindings.splice(b+1,0,a)},_indexOfListener:function(a,b){for(var c=this._bindings.length,d;c--;)if(d=this._bindings[c],d._listener===a&&d.context===b)return c;return-1},has:function(a,b){return this._indexOfListener(a,b)!==-1},add:function(a,b,c){f(a,"add");return this._registerListener(a,!1,b,c)},addOnce:function(a,b,c){f(a,"addOnce");return this._registerListener(a,!0,b,c)},remove:function(a,b){f(a,"remove");var c=this._indexOfListener(a,b);c!==-1&&(this._bindings[c]._destroy(),this._bindings.splice(c,
1));return a},removeAll:function(){for(var a=this._bindings.length;a--;)this._bindings[a]._destroy();this._bindings.length=0},getNumListeners:function(){return this._bindings.length},halt:function(){this._shouldPropagate=!1},dispatch:function(a){if(this.active){var b=Array.prototype.slice.call(arguments),c=this._bindings.length,d;if(this.memorize)this._prevParams=b;if(c){d=this._bindings.slice();this._shouldPropagate=!0;do c--;while(d[c]&&this._shouldPropagate&&d[c].execute(b)!==!1)}}},forget:function(){this._prevParams=
null},dispose:function(){this.removeAll();delete this._bindings;delete this._prevParams},toString:function(){return"[Signal active:"+this.active+" numListeners:"+this.getNumListeners()+"]"}};typeof define==="function"&&define.amd?define(e):typeof module!=="undefined"&&module.exports?module.exports=e:h.signals=e})(this);var UI = {};

UI.Element = function () {};

UI.Element.prototype = {

	setClass: function ( name ) {

		this.dom.className = name;

		return this;

	},

	// styles

	setStyle: function ( style, array ) {

		for ( var i = 0; i < array.length; i ++ ) {

			this.dom.style[ style ] = array[ i ];

		}

	},

	setLeft: function () {

		this.setStyle( 'left', arguments );

		return this;

	},

	setTop: function () {

		this.setStyle( 'top', arguments );

		return this;

	},

	setRight: function () {

		this.setStyle( 'right', arguments );

		return this;

	},

	setBottom: function () {

		this.setStyle( 'bottom', arguments );

		return this;

	},

	setWidth: function () {

		this.setStyle( 'width', arguments );

		return this;

	},

	setHeight: function () {

		this.setStyle( 'height', arguments );

		return this;

	},

	//

	setBorder: function () {

		this.setStyle( 'border', arguments );

		return this;

	},

	setBorderTop: function () {

		this.setStyle( 'borderTop', arguments );

		return this;

	},

	setBorderBottom: function () {

		this.setStyle( 'borderBottom', arguments );

		return this;

	},

	setBorderLeft: function () {

		this.setStyle( 'borderLeft', arguments );

		return this;

	},

	setBorderRight: function () {

		this.setStyle( 'borderRight', arguments );

		return this;

	},

	//

	setMargin: function () {

		this.setStyle( 'margin', arguments );

		return this;

	},

	setMarginTop: function () {

		this.setStyle( 'marginTop', arguments );

		return this;

	},

	setMarginBottom: function () {

		this.setStyle( 'marginBottom', arguments );

		return this;

	},

	setMarginLeft: function () {

		this.setStyle( 'marginLeft', arguments );

		return this;

	},

	setMarginRight: function () {

		this.setStyle( 'marginRight', arguments );

		return this;

	},

	//

	setPadding: function () {

		this.setStyle( 'padding', arguments );

		return this;

	},

	//

	setFloat: function () {

		this.setStyle( 'float', arguments );

		return this;

	},

	//

	setFontSize: function () {

		this.setStyle( 'fontSize', arguments );

		return this;

	},

	setFontWeight: function () {

		this.setStyle( 'fontWeight', arguments );

		return this;

	},

	//

	setColor: function () {

		this.setStyle( 'color', arguments );

		return this;

	},

	setBackgroundColor: function () {

		this.setStyle( 'backgroundColor', arguments );

		return this;

	},

	setDisplay: function () {

		this.setStyle( 'display', arguments );

		return this;

	},

	setOverflow: function () {

		this.setStyle( 'overflow', arguments );

		return this;

	},

	//

	setCursor: function () {

		this.setStyle( 'cursor', arguments );

		return this;

	},

	// content

	setTextContent: function ( value ) {

		this.dom.textContent = value;

		return this;

	},

	// events

	onMouseOver: function ( callback ) {

		this.dom.addEventListener( 'mouseover', callback, false );

		return this;

	},

	onMouseOut: function ( callback ) {

		this.dom.addEventListener( 'mouseout', callback, false );

		return this;

	},

	onClick: function ( callback ) {

		this.dom.addEventListener( 'click', callback, false );

		return this;

	}

}


// Panel

UI.Panel = function ( position ) {

	UI.Element.call( this );

	var dom = document.createElement( 'div' );
	dom.style.position = position || 'relative';
	dom.style.marginBottom = '10px';

	dom.style.userSelect = 'none';
	dom.style.WebkitUserSelect = 'none';
	dom.style.MozUserSelect = 'none';

	this.dom = dom;

	return this;
};

UI.Panel.prototype = Object.create( UI.Element.prototype );

UI.Panel.prototype.add = function () {

	for ( var i = 0; i < arguments.length; i ++ ) {

		this.dom.appendChild( arguments[ i ].dom );

	}

	return this;

};


// Text

UI.Text = function ( position ) {

	UI.Element.call( this );

	var dom = document.createElement( 'span' );
	dom.style.position = position || 'relative';
	dom.style.cursor = 'default';

	this.dom = dom;

	return this;

};

UI.Text.prototype = Object.create( UI.Element.prototype );

UI.Text.prototype.setValue = function ( value ) {

	this.dom.textContent = value;

	return this;

};


// Input

UI.Input = function ( position ) {

	UI.Element.call( this );

	var scope = this;

	var dom = document.createElement( 'input' );
	dom.style.position = position || 'relative';
	dom.style.padding = '2px';
	dom.style.marginTop = '-2px';
	dom.style.marginLeft = '-2px';
	dom.style.border = '1px solid #ccc';

	this.dom = dom;

	this.onChangeCallback = null;

	this.dom.addEventListener( 'change', function ( event ) {

		if ( scope.onChangeCallback ) scope.onChangeCallback();

	}, false );

	return this;

};

UI.Input.prototype = Object.create( UI.Element.prototype );

UI.Input.prototype.getValue = function () {

	return this.dom.value;

};

UI.Input.prototype.setValue = function ( value ) {

	this.dom.value = value;

	return this;

};

UI.Input.prototype.onChange = function ( callback ) {

	this.onChangeCallback = callback;

	return this;

};


// Select

UI.Select = function ( position ) {

	UI.Element.call( this );

	var scope = this;

	var dom = document.createElement( 'select' );
	dom.style.position = position || 'relative';
	dom.style.width = '64px';
	dom.style.height = '16px';
	dom.style.border = '0px';
	dom.style.padding = '0px';

	this.dom = dom;

	this.onChangeCallback = null;

	this.dom.addEventListener( 'change', function ( event ) {

		if ( scope.onChangeCallback ) scope.onChangeCallback();

	}, false );

	return this;

};

UI.Select.prototype = Object.create( UI.Element.prototype );

UI.Select.prototype.setMultiple = function ( boolean ) {

	this.dom.multiple = boolean;

	return this;

};

UI.Select.prototype.setOptions = function ( options ) {

	while ( this.dom.children.length > 0 ) {

		this.dom.removeChild( this.dom.firstChild );

	}

	for ( var key in options ) {

		var option = document.createElement( 'option' );
		option.value = key;
		option.innerHTML = options[ key ];
		this.dom.appendChild( option );

	}

	return this;

};

UI.Select.prototype.getValue = function () {

	return this.dom.value;

};

UI.Select.prototype.setValue = function ( value ) {

	this.dom.value = value;

	return this;

};

UI.Select.prototype.onChange = function ( callback ) {

	this.onChangeCallback = callback;

	return this;

};

// FancySelect

UI.FancySelect = function ( position ) {

	UI.Element.call( this );

	var scope = this;

	var dom = document.createElement( 'div' );
	dom.style.position = position || 'relative';
	dom.style.background = '#fff';
	dom.style.border = '1px solid #ccc';
	dom.style.padding = '0';
	dom.style.cursor = 'default';
	dom.style.overflow = 'auto';

	this.dom = dom;

	this.onChangeCallback = null;

	this.options = [];
	this.selectedValue = null;

	return this;

};

UI.FancySelect.prototype = Object.create( UI.Element.prototype );

UI.FancySelect.prototype.setOptions = function ( options ) {

	var scope = this;

	while ( scope.dom.children.length > 0 ) {

		scope.dom.removeChild( scope.dom.firstChild );

	}

	scope.options = [];

	var generateOptionCallback = function ( element, value ) {

		return function ( event ) {

			for ( var i = 0; i < scope.options.length; i ++ ) {

				scope.options[ i ].style.backgroundColor = '#f0f0f0';

			}

			element.style.backgroundColor = '#f0f0f0';

			scope.selectedValue = value;

			if ( scope.onChangeCallback ) scope.onChangeCallback();

		}

	};

	for ( var key in options ) {

		var option = document.createElement( 'div' );
		option.style.padding = '4px';
		option.style.whiteSpace = 'nowrap';
		option.innerHTML = options[ key ];
		option.value = key;
		scope.dom.appendChild( option );

		scope.options.push( option );
		option.addEventListener( 'click', generateOptionCallback( option, key ), false );

	}

	return scope;

};

UI.FancySelect.prototype.getValue = function () {

	return this.selectedValue;

};

UI.FancySelect.prototype.setValue = function ( value ) {

	// must convert raw value into string for compatibility with UI.Select
	// which uses string values (initialized from options keys)

	var key = value ? value.toString() : value;

	for ( var i = 0; i < this.options.length; i ++ ) {

		var element = this.options[ i ];

		if ( element.value === key ) {

			element.style.backgroundColor = '#f0f0f0';

		} else {

			element.style.backgroundColor = '';

		}

	}

	this.selectedValue = value;

	return this;

};

UI.FancySelect.prototype.onChange = function ( callback ) {

	this.onChangeCallback = callback;

	return this;

};

// Checkbox

UI.Checkbox = function ( position ) {

	UI.Element.call( this );

	var scope = this;

	var dom = document.createElement( 'input' );
	dom.type = 'checkbox';
	dom.style.position = position || 'relative';

	this.dom = dom;

	this.onChangeCallback = null;

	this.dom.addEventListener( 'change', function ( event ) {

		if ( scope.onChangeCallback ) scope.onChangeCallback();

	}, false );

	return this;

};

UI.Checkbox.prototype = Object.create( UI.Element.prototype );

UI.Checkbox.prototype.getValue = function () {

	return this.dom.checked;

};

UI.Checkbox.prototype.setValue = function ( value ) {

	this.dom.checked = value;

	return this;

};

UI.Checkbox.prototype.onChange = function ( callback ) {

	this.onChangeCallback = callback;

	return this;

};


// Color

UI.Color = function ( position ) {

	UI.Element.call( this );

	var scope = this;

	var dom = document.createElement( 'input' );
	dom.type = 'color';
	dom.style.position = position || 'relative';
	dom.style.width = '64px';
	dom.style.height = '16px';
	dom.style.border = '0px';
	dom.style.padding = '0px';
	dom.style.backgroundColor = 'transparent';

	this.dom = dom;

	this.onChangeCallback = null;

	this.dom.addEventListener( 'change', function ( event ) {

		if ( scope.onChangeCallback ) scope.onChangeCallback();

	}, false );

	return this;

};

UI.Color.prototype = Object.create( UI.Element.prototype );

UI.Color.prototype.getValue = function () {

	return this.dom.value;

};

UI.Color.prototype.getHexValue = function () {

	return parseInt( this.dom.value.substr( 1 ), 16 );

};

UI.Color.prototype.setValue = function ( value ) {

	this.dom.value = value;

	return this;

};

UI.Color.prototype.setHexValue = function ( hex ) {

	this.dom.value = "#" + ( '000000' + hex.toString( 16 ) ).slice( -6 );

	return this;

};

UI.Color.prototype.onChange = function ( callback ) {

	this.onChangeCallback = callback;

	return this;

};


// Number

UI.Number = function ( position ) {

	UI.Element.call( this );

	var scope = this;

	var dom = document.createElement( 'input' );
	dom.style.position = position || 'relative';
	dom.style.color = '#0080f0';
	dom.style.fontSize = '12px';
	dom.style.backgroundColor = 'transparent';
	dom.style.border = '1px solid transparent';
	dom.style.marginTop = '-2px';
	dom.style.marginLegt = '-2px';
	dom.style.padding = '2px';
	dom.style.cursor = 'col-resize';
	dom.value = '0.00';

	this.dom = dom;

	this.min = - Infinity;
	this.max = Infinity;

	this.precision = 2;
	this.step = 1;

	this.onChangeCallback = null;

	var distance = 0;
	var onMouseDownValue = 0;

	var onMouseDown = function ( event ) {

		event.preventDefault();

		distance = 0;

		onMouseDownValue = parseFloat( dom.value );

		document.addEventListener( 'mousemove', onMouseMove, false );
		document.addEventListener( 'mouseup', onMouseUp, false );

	};

	var onMouseMove = function ( event ) {

		var movementX = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
		var movementY = event.movementY || event.webkitMovementY || event.mozMovementY || 0;

		distance += movementX - movementY;

		var number = onMouseDownValue + ( distance / ( event.shiftKey ? 10 : 100 ) ) * scope.step;

		dom.value = Math.min( scope.max, Math.max( scope.min, number ) ).toFixed( scope.precision );

		if ( scope.onChangeCallback ) scope.onChangeCallback();

	};

	var onMouseUp = function ( event ) {

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		if ( Math.abs( distance ) < 2 ) {

			dom.focus();
			dom.select();

		}

	};

	var onChange = function ( event ) {

		var number = parseFloat( dom.value );

		if ( isNaN( number ) === false ) {

			dom.value = number;

			if ( scope.onChangeCallback ) scope.onChangeCallback();

		}

	};

	var onKeyDown = function( event ) {
		var key = event.keyCode || event.which;
		if( key == 27 || key == 13 ) { // ESCape and Return respectively
			dom.blur();
			return false;
		}
		return true;

	}

	var onFocus = function ( event ) {

		dom.style.backgroundColor = '';
		dom.style.borderColor = '#ccc';
		dom.style.cursor = '';

	};

	var onBlur = function ( event ) {

		dom.style.backgroundColor = 'transparent';
		dom.style.borderColor = 'transparent';
		dom.style.cursor = 'col-resize';

	};

	dom.addEventListener( 'mousedown', onMouseDown, false );
	dom.addEventListener( 'change', onChange, false );
	dom.addEventListener( 'focus', onFocus, false );
	dom.addEventListener( 'blur', onBlur, false );
	dom.addEventListener( 'keydown', onKeyDown, false );

	return this;

};

UI.Number.prototype = Object.create( UI.Element.prototype );

UI.Number.prototype.getValue = function () {

	return parseFloat( this.dom.value );

};

UI.Number.prototype.setValue = function ( value ) {

	this.dom.value = value.toFixed( this.precision );

	return this;

};

UI.Number.prototype.setRange = function ( min, max ) {

	this.min = min;
	this.max = max;

	return this;

};

UI.Number.prototype.setPrecision = function ( precision ) {

	this.precision = precision;

	if ( precision > 2 ) {

		this.step = Math.pow( 10, -( precision - 1 ) );

	}

	return this;

};

UI.Number.prototype.onChange = function ( callback ) {

	this.onChangeCallback = callback;

	return this;

};


// Break

UI.Break = function () {

	UI.Element.call( this );

	var dom = document.createElement( 'br' );

	this.dom = dom;

	return this;

};

UI.Break.prototype = Object.create( UI.Element.prototype );


// HorizontalRule

UI.HorizontalRule = function ( position ) {

	UI.Element.call( this );

	var dom = document.createElement( 'hr' );
	dom.style.position = position || 'relative';

	this.dom = dom;

	return this;

};

UI.HorizontalRule.prototype = Object.create( UI.Element.prototype );


// Button

UI.Button = function ( position ) {

	UI.Element.call( this );

	var scope = this;

	var dom = document.createElement( 'button' );
	dom.style.position = position || 'relative';

	this.dom = dom;

	this.onClickCallback = null;

	this.dom.addEventListener( 'click', function ( event ) {

		scope.onClickCallback();

	}, false );

	return this;

};

UI.Button.prototype = Object.create( UI.Element.prototype );

UI.Button.prototype.setLabel = function ( value ) {

	this.dom.textContent = value;

	return this;

};

UI.Button.prototype.onClick = function ( callback ) {

	this.onClickCallback = callback;

	return this;

};
// StringFormat.js r2 - http://github.com/sole/StringFormat.js
var StringFormat = {
	pad: function(number, minimumLength, paddingCharacter) {
		
		var sign = number >= 0 ? 1 : -1,
			minimumLength = minimumLength !== undefined ? minimumLength : 1,
			paddingCharacter = paddingCharacter !== undefined ? paddingCharacter : ' ',
			str = Math.abs(number).toString(),
			actualMinimumLength = minimumLength;

		if(sign < 0) {
			actualMinimumLength--;
		}

		while(str.length < actualMinimumLength) {
			str = paddingCharacter + str;
		}

		if(sign < 0) {
			str = '-' + str;
		}

		return str;
	},
	
	toFixed: function(number, numberDecimals) {
		
		var numberDecimals = numberDecimals !== undefined ? numberDecimals : 2,
		multiplier = Math.pow( 10 , numberDecimals );

		return Math.floor( Math.round( number * multiplier ) ) / multiplier;
	}
}
SOROLLET.VoiceGUI = function( signals ) {
	'use strict';

	var scope = this;

	this.synth = null;
	
	var container = new UI.Panel( 'relative' );
	container.setWidth( '250px' );
	container.setBackgroundColor( '#eee' );
	container.setOverflow( 'auto' );

	var oscillatorPanel1 = new SOROLLET.OscillatorGUI(0);
	container.add( oscillatorPanel1 );
	oscillatorPanel1.addEventListener('change', function(e) {
		
		if(scope.synth == null) {
			console.log('Not attached to any synth');
			return;
		}

		scope.synth.wave1Volume = e.volume;
		scope.synth.wave1Octave = e.octave;
		scope.synth.wave1Phase = e.phase;
		scope.synth.wave1Function = SOROLLET.VoiceGUI.prototype.WAVE_FUNCTIONS[ e.waveType ];

	}, false);

	var oscillatorPanel2 = new SOROLLET.OscillatorGUI(1);
	container.add( oscillatorPanel2 );
	oscillatorPanel2.addEventListener('change', function(e) {
		
		if(scope.synth == null) {
			console.log('Not attached to any synth');
			return;
		}

		scope.synth.wave2Volume = e.volume;
		scope.synth.wave2Octave = e.octave;
		scope.synth.wave2Phase = e.phase;
		scope.synth.wave2Function = SOROLLET.VoiceGUI.prototype.WAVE_FUNCTIONS[ e.waveType ];

	}, false);

	var mixPanel = new UI.Panel(),
		mixRow = new UI.Panel(),
		mixSelect = new UI.Select()
			.setOptions( SOROLLET.VoiceGUI.prototype.WAVE_MIX_NAMES)
			.onChange( function() {
				scope.synth.waveMixFunction = SOROLLET.VoiceGUI.prototype.WAVE_MIX_FUNCTIONS[ mixSelect.getValue() ];
			} );
	mixPanel.add( new UI.Text().setValue( 'OSCILLATOR MIX' ));
	mixPanel.add( mixRow );
	mixRow.add( new UI.Text().setValue( 'Type' ) );
	mixRow.add( mixSelect );
	
	container.add( mixPanel );

	// Noise
	var noiseConfigPanel = new UI.Panel();
	noiseConfigPanel.add( new UI.Text().setValue( 'NOISE' ) );

	var noiseRow = new UI.Panel(),
		noiseAmountInput = new UI.Number();
	noiseRow.add( new UI.Text().setValue( 'Amount' ) );
	noiseAmountInput.min = 0;
	noiseAmountInput.max = 1;
	noiseAmountInput.setWidth( '40px' );
	noiseAmountInput.onChange( function() {
		scope.synth.noiseAmount = noiseAmountInput.getValue();
	});
	noiseRow.add( noiseAmountInput );
	noiseConfigPanel.add( noiseRow );

	var noiseMixRow = new UI.Panel(),
		noiseMixType = new UI.Select( 'absolute' )
			.setOptions( SOROLLET.VoiceGUI.prototype.NOISE_MIX_NAMES )
			.onChange( function() {
				scope.synth.noiseMixFunction = SOROLLET.VoiceGUI.prototype.NOISE_MIX_FUNCTIONS[ noiseMixType.getValue() ];
			});

	//noiseMixRow.add( new UI.Text().setValue( 'Mix type' ) );
	//noiseMixRow.add( noiseMixType );
	noiseRow.add( new UI.Text().setValue( 'Mix type' ) );
	noiseRow.add( noiseMixType );
	//noiseConfigPanel.add( noiseMixRow );
	container.add( noiseConfigPanel );
	
	
	// Envelopes
	
	var ampEnvGUI = new SOROLLET.ADSRGUI('VOLUME ENVELOPE');
	container.add( ampEnvGUI );
	ampEnvGUI.addEventListener( 'change', function( e ) {
		var env = scope.synth.ampADSR;

		env.setAttack( e.attack );
		env.setDecay( e.decay );
		env.setSustainLevel( e.sustain );
		env.setRelease( e.release );
		env.setOutputRange( e.outputMin, e.outputMax );
		env.setTimeScale( e.timeScale );
		
		scope.updateEnvelopeLengths();
		
	});

	var pitchEnvGUI = new SOROLLET.ADSRGUI('PITCH ENVELOPE');
	container.add( pitchEnvGUI );
	pitchEnvGUI.addEventListener( 'change', function( e ) {
		// TODO refactor this and above functions
		var env = scope.synth.pitchADSR;

		env.setAttack( e.attack );
		env.setDecay( e.decay );
		env.setSustainLevel( e.sustain );
		env.setRelease( e.release );
		env.setOutputRange( e.outputMin, e.outputMax );
		env.setTimeScale( e.timeScale );
		
		scope.updateEnvelopeLengths();
	});




	// Making stuff 'public'
	this.dom = container.dom;
	this.oscillatorPanel1 = oscillatorPanel1;
	this.oscillatorPanel2 = oscillatorPanel2;
	this.waveMix = mixSelect;
	this.noiseAmount = noiseAmountInput;
	this.noiseMix = noiseMixType;
	this.ampEnvGUI = ampEnvGUI;
	this.pitchEnvGUI = pitchEnvGUI;


}

SOROLLET.VoiceGUI.prototype = {

	constructor: SOROLLET.VoiceGUI,

	valueToKey: function( obj, value ) {
		for( var key in obj ) {
			if( value == obj[key] ) {
				return key;
			}
		}
	},

	attachTo: function( synth ) {

		this.oscillatorPanel1.volume.setValue( synth.wave1Volume );
		this.oscillatorPanel1.octave.setValue( synth.wave1Octave );
		this.oscillatorPanel1.phase.setValue( synth.wave1Phase );
		this.oscillatorPanel1.waveType.setValue( this.valueToKey( this.WAVE_FUNCTIONS, synth.wave1Function ) );

		this.oscillatorPanel2.volume.setValue( synth.wave2Volume );
		this.oscillatorPanel2.octave.setValue( synth.wave2Octave );
		this.oscillatorPanel2.phase.setValue( synth.wave2Phase );
		this.oscillatorPanel2.waveType.setValue( this.valueToKey( this.WAVE_FUNCTIONS, synth.wave2Function ) );

		this.waveMix.setValue( this.valueToKey( this.WAVE_MIX_FUNCTIONS, synth.waveMixFunction ) );

		this.noiseAmount.setValue( synth.noiseAmount );
		this.noiseMix.setValue( this.valueToKey( this.NOISE_MIX_FUNCTIONS, synth.noiseMixFunction ) );

		// TODO refactor
		this.ampEnvGUI.attack.setValue( synth.ampADSR.__unscaledAttackLength );
		this.ampEnvGUI.decay.setValue( synth.ampADSR.__unscaledDecayLength );
		this.ampEnvGUI.sustain.setValue( synth.ampADSR.sustainLevel );
		this.ampEnvGUI.release.setValue( synth.ampADSR.__unscaledReleaseLength );
		this.ampEnvGUI.timeScale.setValue( synth.ampADSR.timeScale );
		this.ampEnvGUI.outputMin.setValue( synth.ampADSR.outputMinimumValue );
		this.ampEnvGUI.outputMax.setValue( synth.ampADSR.outputMaximumValue );

		this.pitchEnvGUI.attack.setValue( synth.pitchADSR.__unscaledAttackLength );
		this.pitchEnvGUI.decay.setValue( synth.pitchADSR.__unscaledDecayLength );
		this.pitchEnvGUI.sustain.setValue( synth.pitchADSR.sustainLevel );
		this.pitchEnvGUI.release.setValue( synth.pitchADSR.__unscaledReleaseLength );
		this.pitchEnvGUI.timeScale.setValue( synth.pitchADSR.timeScale );
		this.pitchEnvGUI.outputMin.setValue( synth.pitchADSR.outputMinimumValue );
		this.pitchEnvGUI.outputMax.setValue( synth.pitchADSR.outputMaximumValue );


		this.synth = synth;

		this.updateEnvelopeLengths();	
	
	},

	updateEnvelopeLengths: function() {
		var synth = this.synth,
			ampEnvGUI = this.ampEnvGUI,
			ampADSR = synth.ampADSR,
			pitchEnvGUI = this.pitchEnvGUI,
			pitchADSR = synth.pitchADSR;

		ampEnvGUI.attackLength.setValue( StringFormat.toFixed( ampADSR.attackLength ) );
		ampEnvGUI.decayLength.setValue( StringFormat.toFixed( ampADSR.decayLength ) );
		ampEnvGUI.releaseLength.setValue( StringFormat.toFixed( ampADSR.releaseLength ) );
		pitchEnvGUI.attackLength.setValue( StringFormat.toFixed( pitchADSR.attackLength ) );
		pitchEnvGUI.decayLength.setValue( StringFormat.toFixed( pitchADSR.decayLength ) );
		pitchEnvGUI.releaseLength.setValue( StringFormat.toFixed( pitchADSR.releaseLength ) );


	},

	WAVE_NAMES: {
		0: 'Sine',
		1: 'Triangle',
		2: 'Square',
		3: 'Sawtooth'
	},

	WAVE_FUNCTIONS: {
		0: SOROLLET.Voice.prototype.getSineBuffer,
		1: SOROLLET.Voice.prototype.getTriangleBuffer,
		2: SOROLLET.Voice.prototype.getSquareBuffer,
		3: SOROLLET.Voice.prototype.getSawtoothBuffer,
	},

	WAVE_MIX_NAMES: {
		0: 'Add',
		1: 'Substract',
		2: 'Multiply',
		3: 'Divide'
	},

	WAVE_MIX_FUNCTIONS: {
		0: SOROLLET.Voice.prototype.mixAdd,
		1: SOROLLET.Voice.prototype.mixSubstract,
		2: SOROLLET.Voice.prototype.mixMultiply,
		3: SOROLLET.Voice.prototype.mixDivide
	},

	NOISE_MIX_NAMES: {
		0: 'Add',
		1: 'Mix',
		2: 'Multiply'
	},

	NOISE_MIX_FUNCTIONS: {
		0: SOROLLET.Voice.prototype.noiseAdd,
		1: SOROLLET.Voice.prototype.noiseMix,
		2: SOROLLET.Voice.prototype.noiseMultiply
	}
};

SOROLLET.OscillatorGUI = function( oscillatorIndex ) {

	var labelName = 'OSCILLATOR ' + (oscillatorIndex + 1),
		panel = new UI.Panel( 'relative' );

	panel.add( new UI.Text().setValue( labelName ) );
	panel.add( new UI.Break() );

	var indent = '90px',
		labelColor = '#666';

	var waveTypeRow = new UI.Panel(),
		waveTypeSelect = new UI.Select( 'absolute' )
		.setLeft( indent )
		.setWidth( '150px' )
		.setOptions( SOROLLET.VoiceGUI.prototype.WAVE_NAMES )
		.onChange( onChange );

	waveTypeRow.add( new UI.Text().setValue( 'Wave type' ).setColor( labelColor ) );
	waveTypeRow.add( waveTypeSelect );
	panel.add( waveTypeRow );

	var volumeRow = new UI.Panel(),
		volumeInput = new UI.Number( 'absolute' )
			.setLeft( indent )
			.onChange( onChange );

	volumeInput.min = 0.0;
	volumeInput.max = 1.0;

	volumeRow.add( new UI.Text().setValue( 'Volume' ) ).setColor( labelColor );
	volumeRow.add( volumeInput );
	panel.add( volumeRow );
	
	var octaveRow = new UI.Panel(),
		octaveInput = new UI.Number( 'absolute' )
			.setLeft( indent )
			.onChange( onChange );

	octaveInput.min = 0;
	octaveInput.max = 9;
	octaveInput.step = 1;
	octaveInput.precision = 0;
	
	octaveRow.add( new UI.Text().setValue( 'Octave' ) ).setColor( labelColor );
	octaveRow.add( octaveInput );
	panel.add( octaveRow );


	var phaseRow = new UI.Panel(),
		phaseInput = new UI.Number( 'absolute' )
			.setLeft( indent )
			.onChange( onChange );

	phaseInput.min = - Math.PI;
	phaseInput.max = Math.PI;
	
	phaseRow.add( new UI.Text().setValue( 'Phase' ) ).setColor( labelColor );
	phaseRow.add( phaseInput );
	panel.add( phaseRow );

	//
	
	this.waveType = waveTypeSelect;
	this.octave = octaveInput;
	this.volume = volumeInput;
	this.phase = phaseInput;

	EventTarget.call( this );

	var dispatchEvent = this.dispatchEvent;

	function onChange() {
		dispatchEvent({
			type: 'change',
			waveType: waveTypeSelect.getValue(),
			octave: octaveInput.getValue(),
			volume: volumeInput.getValue(),
			phase: phaseInput.getValue()
		});
	}

	this.dom = panel.dom;

}

SOROLLET.ADSRGUI = function( label ) {
	var panel = new UI.Panel(),
		tipSize = '10px',
		indent = '50px';

	panel.add( new UI.Text().setValue( label ) );

	var attackRow = new UI.Panel(),
		attackInput = new UI.Number().setLeft( indent ),
		attackLength = new UI.Text().setValue( 0 ).setFontSize( tipSize );

	panel.add(attackRow);
	attackRow.add( new UI.Text().setValue( 'Attack' ) );
	attackRow.add( attackInput );
	attackRow.add( attackLength );

	attackInput.min = 0.0;
	attackInput.max = 1.0;
	attackInput.onChange( onChange );

	//

	var decayRow = new UI.Panel(),
		decayInput = new UI.Number().setLeft( indent ),
		decayLength = new UI.Text().setValue( 0 ).setFontSize( tipSize );

	panel.add(decayRow);
	decayRow.add( new UI.Text().setValue( 'Decay' ) );
	decayRow.add( decayInput );
	decayRow.add( decayLength );

	decayInput.min = 0.0;
	decayInput.max = 1.0;
	decayInput.onChange( onChange );

	//
	
	var sustainRow = new UI.Panel(),
		sustainInput = new UI.Number().setLeft( indent );

	panel.add(sustainRow);
	sustainRow.add( new UI.Text().setValue( 'Sustain' ) );
	sustainRow.add( sustainInput );

	sustainInput.min = 0.0;
	sustainInput.max = 1.0;
	sustainInput.onChange( onChange );

	//
	
	var releaseRow = new UI.Panel(),
		releaseInput = new UI.Number().setLeft( indent ),
		releaseLength = new UI.Text().setValue( 0 ).setFontSize( tipSize );

	panel.add(releaseRow);
	releaseRow.add( new UI.Text().setValue( 'Release' ) );
	releaseRow.add( releaseInput );
	releaseRow.add( releaseLength );

	releaseInput.min = 0.0;
	releaseInput.max = 1.0;
	releaseInput.onChange( onChange );

	//
	
	var timeScaleRow = new UI.Panel(),
		timeScaleInput = new UI.Number().setLeft( indent );

	panel.add(timeScaleRow);
	timeScaleRow.add( new UI.Text().setValue( 'Time scale' ) );
	timeScaleRow.add( timeScaleInput );

	timeScaleInput.min = 0.0;
	timeScaleInput.max = 100.0;
	timeScaleInput.onChange( onChange );
	
	//
	
	var outputRow = new UI.Panel(),
		outputMinInput = new UI.Number().setWidth( '50px' ), //.setLeft( indent ),
		outputMaxInput = new UI.Number().setWidth( '50px' );

	panel.add(outputRow);
	outputRow.add( new UI.Text().setValue( 'Output range' ) );
	outputRow.add( outputMinInput );
	outputRow.add( outputMaxInput );

	var min = -100,
		max = 100;

	outputMinInput.min = min;
	outputMinInput.max = max;
	outputMinInput.onChange( onChange );
	outputMaxInput.min = min;
	outputMaxInput.max = max;
	outputMaxInput.onChange( onChange );

	//

	EventTarget.call( this );

	this.dom = panel.dom;
	this.attack = attackInput;
	this.attackLength = attackLength;
	this.decay = decayInput;
	this.decayLength = decayLength;
	this.sustain = sustainInput;
	this.release = releaseInput;
	this.releaseLength = releaseLength;
	this.timeScale = timeScaleInput;
	this.outputMin = outputMinInput;
	this.outputMax = outputMaxInput;

	var dispatchEvent = this.dispatchEvent;
	function onChange() {
		dispatchEvent({
			type: 'change',
			attack: attackInput.getValue(),
			decay: decayInput.getValue(),
			sustain: sustainInput.getValue(),
			release: releaseInput.getValue(),
			timeScale: timeScaleInput.getValue(),
			outputMin: outputMinInput.getValue(),
			outputMax: outputMaxInput.getValue()
		});
	}

}
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
