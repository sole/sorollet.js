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
	this.repeat = true;
	this.finished = false;

	this.voices = [];
	this.patterns = [];
	this.orderList = [];
	this.eventsList = [];
	this.nextEventPosition = 0; // TODO position->index? or position ~~~ samples?
	this.timePosition = 0;
	this.position = 0;
	
	EventTarget.call( this );

	updateRowTiming();

	function updateRowTiming() {
		secondsPerRow = 60.0 / (scope.linesPerBeat * scope.bpm);
		secondsPerTick = secondsPerRow / scope.ticksPerLine;
	}

	this.play = function() {
		// having an updated event list is ESSENTIAL to playing!
		this.buildEventsList();
	}

	this.stop = function() {
		this.position = 0;
		this.nextEventPosition = 0;
		this.playOrder( 0, 0 );
	}

	this.getBuffer = function( numSamples ) {
	
		outBuffer = [];

		for(var i = 0; i < numSamples; i++) {
			outBuffer[i] = 0;
		}

		if( this.finished ) {
			return outBuffer;
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
				var nextOrder = order + 1;

				if( !this.repeat && nextOrder >= this.orderList.length ) {
					this.dispatchEvent({ type: 'finished' });
					this.finished = true;
					return outBuffer;
				} else {
					order = nextOrder % this.orderList.length;
				}

				//order = ++order % this.orderList.length;

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

	this.buildEventsList = function() {
		var t = 0,
			orderIndex = 0,
			patternIndex,
			pattern,
			samples = 0,
			samplesPerRow,
			trackCount = this.voices.length, // TODO it doesn't need to be a 1:1 correspondence
			lastTrackInstrument = new Array( trackCount ),
			lastTrackNote = new Array( trackCount );

		for (var i = 0; i < trackCount; i++) {
			lastTrackInstrument[i] = null;
			lastTrackNote[i] = null;
		}

		this.eventsList = [];
		this.nextEventPosition = 0;

		samplesPerRow = (secondsPerRow * samplingRate + 0.5) >> 0; // Note: this should change if speed commands are implemented

		while ( orderIndex < this.orderList.length ) {

			var orderEv = new SOROLLET.PlayerEvent();
			orderEv.timestamp = t;
			orderEv.timestampSamples = samples;
			orderEv.type = orderEv.TYPE_ORDER_POSITION_CHANGE;
			orderEv.order = orderIndex;
			this.eventsList.push( orderEv );

			patternIndex = this.orderList[ orderIndex ];

			var ev = new SOROLLET.PlayerEvent();
			ev.timestamp = t;
			ev.timestampSamples = samples;
			ev.type = ev.TYPE_PATTERN_CHANGE;
			ev.pattern = patternIndex;
			this.eventsList.push( ev );

			pattern = this.patterns[ patternIndex ];

			for( var i = 0; i < pattern.rows.length; i++ ) {
				var ev = new SOROLLET.PlayerEvent();
				ev.timestamp = t;
				ev.timestampSamples = samples;
				ev.type = ev.TYPE_ROW_CHANGE;
				ev.row = i;
				
				this.eventsList.push( ev );

				for (var j = 0; j < trackCount; j++) {
					var cell = pattern.getCell(i, j);

					// ~~ NOTE ON ~~ //
					if( cell.note !== null && cell.noteOff !== true /* TODO && pCell->getInstrument() != INSTRUMENT_NULL*/ ) {
						// TODO instrument = pCell->getInstrument();

						var ev = new SOROLLET.PlayerEvent();
						ev.timestamp = t;
						ev.timestampSamples = samples;
						ev.type = ev.TYPE_NOTE_ON;
						ev.note = cell.note
						// TODO ev.instrument = instrument;
						ev.instrument = j; // TODO tmp (see above)
						ev.volume = cell.volume;
					
						this.eventsList.push( ev );

						// TODO buildArpeggios(pCell, t, samples, mfSecondsPerRow, samplesPerRow, instrument, note, fVolume);

						// TODO Store this for later, so that if we get a new volume event we know to which instrument it applies
						// lastTrackInstrument[j] = instrument;
						// lastTrackNote[j] = note;
					}
					// ~~ NEW VOLUME ~~ //
					/* TODO else if (
							(NOTE_NULL == pCell->getNote() || NOTE_OFF == pCell->getNote()) &&
							INSTRUMENT_NULL == pCell->getInstrument() &&
							VOLUME_NULL != pCell->getVolume())
					{
						if (lastTrackInstrument[j] != INSTRUMENT_NULL)
						{
							event = new SorolletPlayerEvent();
							event->timestamp = t;
							event->timestampSamples = samples;
							event->type = SOROLLET_EVENT_VOLUME;
							event->instrument = lastTrackInstrument[j];
							event->volume = fVolume;

							addEvent(event);

							if (lastTrackNote[j] != NOTE_NULL)
							{
								buildArpeggios(pCell, t, samples, mfSecondsPerRow, samplesPerRow, instrument, lastTrackNote[j], fVolume);
							}
						}
					}*/
					// ~~ NOTE OFF ~~ //
					else if( cell.noteOff === true ) {
						// TODO if (lastTrackInstrument[j] != INSTRUMENT_NULL) {
							var ev = new SOROLLET.PlayerEvent();
							ev.timestamp = t;
							ev.timestampSamples = samples;
							ev.type = ev.TYPE_NOTE_OFF;
							// TODO ev.instrument = lastTrackInstrument[j];

							this.eventsList.push( ev );
						// }
					}
					/* TODO else if (pCell->getNote() != NOTE_OFF && lastTrackNote[j] != NOTE_NULL && lastTrackInstrument[j] != INSTRUMENT_NULL)
					{
						buildArpeggios(pCell, t, samples, mfSecondsPerRow, samplesPerRow, lastTrackInstrument[j], lastTrackNote[j], 1.0f);
					}*/
				}

				t += secondsPerRow;
				samples += samplesPerRow;
			}

			orderIndex++;
		}

		// End of the song --there can only be one of these events!!!
		var ev = new SOROLLET.PlayerEvent();
		ev.timestamp = t;
		ev.timestampSamples = samples;
		ev.type = ev.TYPE_SONG_END;
		this.eventsList.push( ev );

		this.currentRow = 0;
		this.currentOrder = 0;
		this.currentPattern = this.orderList[0];

	}

	this.getOfflineBuffer = function( numSamples ) {
		
		var outBuffer = [],
			remainingSamples = numSamples,
			bufferEndTime = this.timePosition + numSamples * inverseSamplingRate,
			bufferEndSamples = this.position + numSamples,
			segmentStartTime = this.timePosition,
			segmentStartSamples = this.position,
			currentEvent,
			intervalSamples,
			bufferPosition = 0;

			
		for( var i = 0; i < numSamples; i++ ) {
			outBuffer[i] = 0;
		}

		do {

			if( this.nextEventPosition == this.eventsList.length ) {
				return outBuffer;
			}

			currentEvent = this.eventsList[ this.nextEventPosition ];

			if( currentEvent.timestampSamples >= bufferEndSamples ) {
				break;
			}

			intervalSamples = currentEvent.timestampSamples - segmentStartSamples;

			// Get buffer UNTIL the event
			if (intervalSamples > 0) {
	
				processBuffer(outBuffer, intervalSamples, bufferPosition );
				
				remainingSamples -= intervalSamples;
				segmentStartSamples = currentEvent.timestampSamples;
				this.position += intervalSamples;
				bufferPosition += intervalSamples;
			}

			// Apply the event
			if( currentEvent.TYPE_ORDER_POSITION_CHANGE == currentEvent.type ) {
				changeToOrder( currentEvent.order );
			/*} else if( currentEvent.TYPE_PATTERN_CHANGE == currentEvent.type ) {
				//this.currentPattern = currentEvent.pattern;
				changeToPattern( currentEvent.pattern );
			*/
			} else if( currentEvent.TYPE_ROW_CHANGE == currentEvent.type ) {

				//this.dispatchEvent({ type: 'rowChanged', order: this.currentOrder, pattern: this.currentPattern, row: currentEvent.row, previousRow: this.currentRow });
				changeToRow( currentEvent.row );

				//this.currentRow = currentEvent.row;

			} else if( currentEvent.TYPE_NOTE_ON == currentEvent.type) {

				var voice = this.voices[ currentEvent.instrument ];
				voice.sendNoteOn( currentEvent.note, currentEvent.volume );

			/*} TODO else if( currentEvent.TYPE_EVENT_VOLUME == currentEvent.type ) {
				var voice = this.voices[ currentEvent.instrument ];
				voice.sendCurrentNoteVolume( currentEvent.volume );*/
			} else if( currentEvent.TYPE_NOTE_OFF == currentEvent.type ) {

				var voice = this.voices[ currentEvent.instrument ];
				voice.sendNoteOff();

			} else if( currentEvent.TYPE_SONG_END == currentEvent.type ) {
				// this.finished = true;
				if( this.repeat ) {
					this.playOrder( 0, 0 );
				} else {
					this.finished = true;
				}
			}

			this.nextEventPosition++;

		} while ( this.nextEventPosition < this.eventsList.length && remainingSamples > 0 );

		if(remainingSamples > 0) {
			processBuffer( outBuffer, remainingSamples, bufferPosition );
		}

		this.position += remainingSamples;
		this.timePosition += numSamples * inverseSamplingRate;

		return outBuffer;

	}

	function processBuffer( buffer, numSamples, startPosition ) {

		var tmpBuffer = [],
			endPosition = startPosition + numSamples;

		// Process envelopes, if applicable
		/* TODO SorolletPattern* pPattern = &mPatterns[miCurrentPattern];
		for (i = 0; i < miTrackCount; i++)
		{
			if (pPattern->trackHasEnvelopes(i) && mTracksAutomationDevices[i].isActive())
			{
				SorolletDeviceAutomation* deviceAutomation = &(mTracksAutomationDevices[i]);
				SorolletEnvelope** vEnvelopes = pPattern->getTrackEnvelopes(i);
				int numEnvelopes = pPattern->getTrackEnvelopesNumber(i);

				for (j = 0; j < numEnvelopes; j++)
				{
					SorolletEnvelope* pEnvelope = vEnvelopes[j];

					int instrumentIndex = deviceAutomation->getInstrumentIndex();
					int automationParameterIndex = pEnvelope->getAutomationParameterIndex();
					int instrumentParameterIndex = deviceAutomation->getParameterMappings()[automationParameterIndex];
					float value = pEnvelope->getValueAtRow(miCurrentRow);

					mVoices[i].setVSTParameter(instrumentParameterIndex, value);
				}
			}
		}*/

		// ~~~~

		for( var i = startPosition; i < endPosition; i++ ) {
			buffer[ i ] = 0;
		}

		for (var i = 0; i < scope.voices.length; i++) {
			
			var voice = scope.voices[i];

			tmpBuffer = voice.getBuffer( numSamples );

			for (var j = 0; j < numSamples; j++) {
				buffer[ j + startPosition ] += tmpBuffer[ j ];
			}
		}

		for (var i = startPosition; i < endPosition; i++) {
			buffer[i] = SOROLLET.Math.clip( buffer[i], -1.0, 1.0 );
		}
	}

	function changeToRow( value ) {
		var previousValue = scope.currentRow;
		
		scope.currentRow = value;
		scope.dispatchEvent({ type: 'rowChanged', row: value, previousRow: previousValue, pattern: scope.currentPattern, order: scope.currentOrder });
	}

	function changeToPattern( value ) {
		var previousValue = scope.currentPattern;
		
		scope.currentPattern = value;
		scope.dispatchEvent({ type: 'patternChanged', pattern: value, previousPattern: previousValue, order: scope.currentOrder, row: scope.currentRow });
	}
	
	function changeToOrder( value ) {
		var previousValue = scope.currentOrder;
		
		scope.currentOrder = value;
		scope.dispatchEvent({ type: 'orderChanged', order: value, previousOrder: previousValue, pattern: scope.currentPattern, row: scope.currentRow });

		changeToPattern( scope.orderList[ value ] );
	}

	this.setBPM = function( value ){
		this.bpm = value;
		updateRowTiming();
		this.dispatchEvent({ type: 'bpmChanged', bpm: value });
	}

	this.getSecondsPerRow = function() {
		return secondsPerRow;
	}

	this.getCurrentPattern = function() {
		return this.patterns[ this.currentPattern ];
	}

	this.addPattern = function( pattern ) {
		this.patterns.push( pattern );
		this.dispatchEvent({ type: 'change', player: this });
		return this.patterns.length - 1;
	}

	this.addToOrderList = function( patternIndex ) {
		this.orderList.push( patternIndex );
		this.dispatchEvent({ type: 'change', player: this });
	}

	this.addToOrderListAfter = function( patternIndex, orderListIndex ) {
		this.orderList.splice( orderListIndex, 0, patternIndex );
		this.dispatchEvent({ type: 'change', player: this });
	}

	this.removeFromOrderList = function( orderListIndex ) {
		this.orderList.splice( orderListIndex, 1 );
		this.dispatchEvent({ type: 'change', player: this });
	}

	this.playOrder = function( orderIndex, row ) {
		// TODO if the new pattern to play has less rows than the current one,
		// make sure we don't play out of index
		/*this.currentOrder = orderIndex;
		this.currentPattern = this.orderList[ orderIndex ];
		this.dispatchEvent({ type: 'orderChanged', order: orderIndex });
		this.dispatchEvent({ type: 'patternChanged', pattern: this.currentPattern });*/
		changeToOrder( orderIndex );

		if( row !== undefined ) {
			//this.currentRow = row;
			//this.dispatchEvent({ type: 'rowChanged', row: row });
			changeToRow( row );
		}
	}

	this.setOrderValueAt = function( orderIndex, value ) {
		if( this.orderList.length <= orderIndex ) {
			console.error( 'Sorollet.Player.setOrderValueAt: trying to set value for non-existing order', orderIndex);
			return;
		} else if( this.patterns.length <= value ) {
			console.error( 'Sorollet.Player.setOrderValueAt: trying to set value for non-existing pattern', orderIndex);

		}

		this.orderList[ orderIndex ] = value;
		this.currentPattern = this.orderList[ orderIndex ];

		this.dispatchEvent({ type: 'change', player: this });

	}

}

SOROLLET.PlayerEvent = function() {
	this.timestamp = 0;
	this.timestampSamples = 0;
	this.type = null;
	this.instrument = null;
	this.volume = 0;
};

SOROLLET.PlayerEvent.prototype = {
	TYPE_NULL: 0,
	TYPE_NOTE_OFF: 1,
	TYPE_NOTE_ON: 2,
	TYPE_VOLUME: 3,
	TYPE_EFFECT: 4,
	TYPE_ROW_CHANGE: 5,
	TYPE_PATTERN_CHANGE: 6,
	TYPE_ORDER_POSITION_CHANGE: 7,
	TYPE_SONG_END: 8
};
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
