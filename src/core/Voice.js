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

};

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
};

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
	{ func: SOROLLET.Voice.prototype.mixDivide, name: 'divide' }
];

SOROLLET.Voice.prototype.noiseMixFunctions = [
	{ func: SOROLLET.Voice.prototype.noiseAdd, name: 'add' },
	{ func: SOROLLET.Voice.prototype.noiseMix, name: 'mix' },
	{ func: SOROLLET.Voice.prototype.noiseMultiply, name: 'multiply' }
];

