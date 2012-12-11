// sorollet.js - http://github.com/sole/sorollet.js
var SOROLLET = SOROLLET || { 
        REVISION: '2'
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

	this.volumeEnvelope = new SOROLLET.ADSR(0.5, 0, 1, 1, 1);
	this.pitchEnvelope = new SOROLLET.ADSR(0, 0, 1, 0, 1);

	this.volumeEnvelope.setOutputRange( 0, 1 );
	this.pitchEnvelope.setOutputRange( 0, 0 );

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
		this.volumeEnvelope.beginAttack(t);
		this.pitchEnvelope.beginAttack(t);
	},

	sendNoteOff: function() {
		var t = this.getTime();
		this.volumeEnvelope.beginRelease(t);
		this.pitchEnvelope.beginRelease(t);
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

		if( this.volumeEnvelope.state == SOROLLET.ADSR.STATE_DONE ) {
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
			var pitchEnv = this.pitchEnvelope.update(bufferTime),
				sampleNote = currentNote + pitchEnv;

			bufferPitch1[i] = this.noteToFrequency(sampleNote, wave1Octave);
			bufferPitch2[i] = this.noteToFrequency(sampleNote, wave2Octave);
			bufferAmp[i] = this.volumeEnvelope.update(bufferTime);
			
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
	},

	functionToIndex: function(f, functionsList ) {
		for( var i = 0; i < functionsList.length; i++) {
			var o = functionsList[i];
			if( o.func == f ) {
				return i;
			}
		}
		return -1;
	},

	getParams: function() {
		return {
			wave1Function: this.functionToIndex( this.wave1Function, this.waveFunctions ),
			wave1Octave: this.wave1Octave,
			wave1Volume: this.wave1Volume,
			wave1Phase: this.wave1Phase,
			wave2Function: this.functionToIndex( this.wave2Function, this.waveFunctions ),
			wave2Octave: this.wave2Octave,
			wave2Volume: this.wave2Volume,
			wave2Phase: this.wave2Phase,
			waveMixFunction: this.functionToIndex( this.waveMixFunction, this.waveMixFunctions ),
			noiseAmount: this.noiseAmount,
			noiseMixFunction: this.functionToIndex( this.noiseMixFunction, this.noiseMixFunctions ),
			volumeEnvelope: this.volumeEnvelope.getParams(),
			pitchEnvelope: this.pitchEnvelope.getParams()
		};
	},

	setParams: function( params ) {
		this.wave1Function = this.waveFunctions[ params.wave1Function ].func;
		this.wave1Octave = params.wave1Octave;
		this.wave1Volume = params.wave1Volume;
		this.wave1Phase = params.wave1Phase;
		
		this.wave2Function = this.waveFunctions[ params.wave2Function ].func;
		this.wave2Octave = params.wave2Octave;
		this.wave2Volume = params.wave2Volume;
		this.wave2Phase = params.wave2Phase;

		this.waveMixFunction = this.waveMixFunctions[ params.waveMixFunction ].func;
		this.noiseAmount = params.noiseAmount;
		this.noiseMixFunction = this.noiseMixFunctions[ params.noiseMixFunction ].func;

		this.volumeEnvelope.setParams( params.volumeEnvelope );
		this.pitchEnvelope.setParams( params.pitchEnvelope );
	}
}

SOROLLET.Voice.prototype.waveFunctions = [
	{ func: SOROLLET.Voice.prototype.getSineBuffer, name: 'sine' },
	{ func: SOROLLET.Voice.prototype.getTriangleBuffer, name: 'triangle' },
	{ func: SOROLLET.Voice.prototype.getSquareBuffer, name: 'square' },
	{ func: SOROLLET.Voice.prototype.getSawtoothBuffer, name: 'sawtooth' }
];

SOROLLET.Voice.prototype.waveMixFunctions = [
	{ func: SOROLLET.Voice.prototype.mixAdd, name: 'add' },	
	{ func: SOROLLET.Voice.prototype.mixSubstract, name: 'substract' },
	{ func: SOROLLET.Voice.prototype.mixMultiply, name: 'multiply' },
	{ func: SOROLLET.Voice.prototype.mixDivide, name: 'divide' },
];

SOROLLET.Voice.prototype.noiseMixFunctions = [
	{ func: SOROLLET.Voice.prototype.noiseAdd, name: 'add' },
	{ func: SOROLLET.Voice.prototype.noiseMix, name: 'mix' },
	{ func: SOROLLET.Voice.prototype.noiseMultiply, name: 'multiply' }
];

'use strict';
SOROLLET.ADSR = function( attackLength, decayLength, sustainLevel, releaseLength, timeScale ) {
	this.state = this.STATE_DONE;
	this.timeScale = timeScale;

	this.attackStartTime = 0;
	this.attackEndTime = 0;
	this.decayEndTime = 0;
	this.releaseStartTime = 0;
	this.releaseEndValue = 0;
	this.releaseStartValue = 0;
	
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
		this.releaseStartValue = this.lastValue;
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
				scaledValue = map( time, this.releaseStartTime, this.releaseEndTime, this.releaseStartValue, this.outputMinimumValue );
			}

		}

		this.lastValue = scaledValue;

		return scaledValue;
	},

	getParams: function() {
		return {
			attack: this.__unscaledAttackLength,
			decay: this.__unscaledDecayLength,
			sustain: this.sustainLevel,
			release: this.__unscaledReleaseLength,
			outputMin: this.outputMinimumValue,
			outputMax: this.outputMaximumValue,
			timeScale: this.timeScale
		};
	},

	setParams: function( params ) {
		this.timeScale = params.timeScale;
		this.setOutputRange( params.outputMin, params.outputMax );
		this.setAttack( params.attack );
		this.setDecay( params.decay );
		this.setSustainLevel( params.sustain );
		this.setRelease( params.release );
	}

};
SOROLLET.Player = function( _samplingRate ) {
	'use strict';

	var samplingRate = _samplingRate,
		inverseSamplingRate = 1.0 / samplingRate,
		secondsPerRow, secondsPerTick,
		lastPlayedTime = 0,
		lastRowTime = 0,
		outBuffer = [],
		scope = this;

	this.bpm = 100;
	this.linesPerBeat = 4;
	this.ticksPerLine = 12;
	this.currentRow = 0;
	this.currentOrder = 0;
	this.currentPattern = 0;
	this.repeat = false;

	this.voices = [];
	this.patterns = [];
	this.orderList = [];
	
	EventTarget.call( this );

	updateRowTiming();


	function updateRowTiming() {
		secondsPerRow = 60.0 / (scope.linesPerBeat * scope.bpm);
		secondsPerTick = secondsPerRow / scope.ticksPerLine;
	}


	this.getBuffer = function(numSamples) {
		
		for(var i = 0; i < numSamples; i++) {
			outBuffer[i] = 0;
		}

		var samplesPerRow = (secondsPerRow * samplingRate + 0.5) >> 0,
			now = Date.now() / 1000,
			deltaTime = now - lastPlayedTime,
			deltaRowTime = now - lastRowTime,
			previousPattern = this.currentPattern,
			previousRow = this.currentRow;
		
		lastPlayedTime = now;

		if(deltaRowTime >= secondsPerRow) {
			// New row!
			var row = this.currentRow + 1,
				pattern = this.patterns[this.currentPattern],
				order = this.currentOrder;

			if(row == pattern.rows.length) {
				this.dispatchEvent({ type: 'patternFinished', order: order });
			}

			if(row >= pattern.rows.length) {
				// Next order! as we have finished with the current pattern
				// TODO this always loops - this.repeats is not honored
				order = ++order % this.orderList.length;

				this.dispatchEvent({ type: 'orderChanged', order: order });

				row = 0;
				var patternNumber = this.orderList[order];
				pattern = this.patterns[patternNumber];
				this.currentPattern = patternNumber;
				this.dispatchEvent({ type: 'patternChanged', pattern: patternNumber });
			}
		
			this.dispatchEvent({ type: 'rowChanged', order: order, pattern: this.currentPattern, row: row, previousPattern: previousPattern, previousRow: previousRow });

			this.currentRow = row;
			this.currentOrder = order;

			// Fire all notes & etc in this row
			
			for(var i = 0, currentRow = pattern.rows[row]; i < currentRow.length; i++) {
				var cell = currentRow[i],
					voice = this.voices[i];

				// one track <-> one voice
				if(cell.noteOff) {
					
					voice.sendNoteOff();
				
				} else if( cell.note !== null ) {

					voice.sendNoteOn(cell.note, cell.volume);
					this.dispatchEvent({ type: 'noteOn', row: row, track: i, note: cell.note });

				}
			}

			lastRowTime = now;
		}


		for(var j = 0; j < this.voices.length; j++) {
			var tmpBuffer = this.voices[j].getBuffer(numSamples);

			for(var i = 0; i < numSamples; i++) {
				outBuffer[i] += tmpBuffer[i];
			}
		}

		return outBuffer;

	}

	this.setBPM = function(value){
		this.bpm = value;
		updateRowTiming();
	}

	this.getSecondsPerRow = function() {
		return secondsPerRow;
	}

	this.getCurrentPattern = function() {
		return this.patterns[ this.currentPattern ];
	}

}
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
