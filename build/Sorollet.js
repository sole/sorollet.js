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
		lastPlayedTime = 0, // XXX KILL
		lastRowTime = 0, // XXX KILL
		loopStart = 0,
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
		loopStart = 0;
		//this.nextEventPosition = 0;
		this.jumpToOrder( 0, 0 );
	}

	this.jumpToOrder = function( orderIndex, row ) {
		// TODO if the new pattern to play has less rows than the current one,
		// make sure we don't play out of index
		changeToOrder( orderIndex );

		if( row === undefined ) {
			row = this.currentRow;
		}

		changeToRow( row );
		
		this.updateNextEventToOrderRow( orderIndex, row );
		var prevPosition = this.position;
		this.position = this.eventsList[ this.nextEventPosition ].timestampSamples + loopStart;
	}


	this.updateNextEventPosition = function() {
		var p = 0;

		for(var i = 0; i < this.eventsList.length; i++ ) {
		
			var ev = this.eventsList[i];

			if( ev.timestampSamples >= this.position ) {
				break;
			}

			p = i;
		}

		this.nextEventPosition = p;
	}

	this.updateNextEventToOrderRow = function( order, row ) {
		var p = 0;
		
		for(var i = 0; i < this.eventsList.length; i++) {
			var ev = this.eventsList[i];
			p = i;
			if( ev.TYPE_ROW_CHANGE == ev.type && ev.row == row && ev.order == order ) {
				break;
			}
		}
		this.nextEventPosition = p;
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
				ev.order = orderIndex;
				
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

	}

	this.getBuffer = function( numSamples ) {
		
		var outBuffer = [],
			remainingSamples = numSamples,
			bufferEndSamples = this.position + numSamples,
			segmentStartSamples = this.position,
			currentEvent,
			currentEventStart,
			intervalSamples,
			bufferPosition = 0;

			
		for( var i = 0; i < numSamples; i++ ) {
			outBuffer[i] = 0;
		}


		do {

			if( this.finished && this.repeat ) {
				this.jumpToOrder( 0, 0 );
				this.finished = false;
			}

			if( this.nextEventPosition == this.eventsList.length ) {
				return outBuffer;
			}

			currentEvent = this.eventsList[ this.nextEventPosition ];
			currentEventStart = loopStart + currentEvent.timestampSamples;

			if( currentEventStart >= bufferEndSamples ) {
				break;
			}

			intervalSamples = currentEventStart - segmentStartSamples;

			// Get buffer UNTIL the event
			if (intervalSamples > 0) {
	
				processBuffer(outBuffer, intervalSamples, bufferPosition );
				
				remainingSamples -= intervalSamples;
				segmentStartSamples = currentEventStart;
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

				changeToRow( currentEvent.row );

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
				
				loopStart = currentEventStart;
				this.finished = true;

				changeToEnd();
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

	function changeToEnd() {
		scope.dispatchEvent({ type: 'songEnded' });
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
SOROLLET.ADSRGUI = function( params ) {

	var params = params || {},
		label = params.label || '',
		outMin = params.outMin || 0,
		outMax = params.outMax || 1,
		step = params.step || 0.5,
		timeMin = params.timeMin || 0,
		timeMax = params.timeMax || 100,
		width = params.width || 220,
		//
		panel = new UI.Panel(),
		subPanel = new UI.Panel().setClass('ADSR_GUI'),
		leftDiv = document.createElement( 'div' ),
		rightDiv = document.createElement( 'div' ),
		outputMinKnob = new SOROLLET.KnobGUI({ label: 'MIN', min: outMin, max: outMax, step: step }),
		outputMaxKnob = new SOROLLET.KnobGUI({ label: 'MAX', min: outMin, max: outMax, step: step }),
		knobsDiv = document.createElement( 'div' ),
		attackKnob = new SOROLLET.KnobGUI({ label: 'ATTACK' }),
		decayKnob = new SOROLLET.KnobGUI({ label: 'DECAY' }),
		sustainKnob = new SOROLLET.KnobGUI({ label: 'SUSTAIN' }),
		releaseKnob = new SOROLLET.KnobGUI({ label: 'RELEASE' }),
		timeScaleKnob = new SOROLLET.KnobGUI({ label: 'TIME SCALE' });

	panel.add( new UI.Text().setValue( label ).setClass( 'section_label'  ));
	
	panel.add( subPanel );
	subPanel.dom.appendChild( leftDiv );
	subPanel.dom.appendChild( rightDiv );
	leftDiv.className = 'output_range';
	rightDiv.className = 'graph_controls';

	leftDiv.appendChild( outputMaxKnob.dom );
	leftDiv.appendChild( outputMinKnob.dom );

	outputMinKnob.onChange( onChange );
	outputMaxKnob.onChange( onChange );

	// TODO refactor canvas & handling into ADSR_Graph
	var canvas = document.createElement( 'canvas' ),
		ctx = canvas.getContext( '2d' ),
		canvasW = width,
		canvasH = width - 100;

	canvas.width = canvasW;
	canvas.height = canvasH;
	
	rightDiv.appendChild( canvas );
	rightDiv.appendChild( knobsDiv );

	knobsDiv.className = 'controls_row';
	knobsDiv.appendChild( attackKnob.dom );
	knobsDiv.appendChild( decayKnob.dom );
	knobsDiv.appendChild( sustainKnob.dom );
	knobsDiv.appendChild( releaseKnob.dom );
	knobsDiv.appendChild( timeScaleKnob.dom );

	[ attackKnob, decayKnob, sustainKnob, releaseKnob ].forEach(function( elem ) {
		elem.min = 0.0;
		elem.max = 1.0;
		elem.onChange( onChange );
	});

	timeScaleKnob.min = timeMin;
	timeScaleKnob.max = timeMax;
	timeScaleKnob.step = 10;
	timeScaleKnob.onChange( onChange );
	
	//

	EventTarget.call( this );

	this.dom = panel.dom;
	this.attack = attackKnob;
	this.attackLength = 0;
	this.decay = decayKnob;
	this.decayLength = 0;
	this.sustain = sustainKnob;
	this.release = releaseKnob;
	this.releaseLength = 0;
	this.timeScale = timeScaleKnob;
	this.outputMin = outputMinKnob;
	this.outputMax = outputMaxKnob;

	var dispatchEvent = this.dispatchEvent;
	function onChange() {
		dispatchEvent({
			type: 'change',
			attack: attackKnob.getValue(),
			decay: decayKnob.getValue(),
			sustain: sustainKnob.getValue(),
			release: releaseKnob.getValue(),
			timeScale: timeScaleKnob.getValue(),
			outputMin: outputMinKnob.getValue(),
			outputMax: outputMaxKnob.getValue()
		});
	}

	function updateGraph() {
		var darkStrokeStyle = '#222222',
			lightStrokeStyle = '#666666';

		ctx.clearRect( 0, 0, canvasW, canvasH );

		ctx.save();
		ctx.translate(0, canvasH);
		ctx.scale(1, -1);
		
		var padW = 30,
			padH = 20,
			ox = padW,
			oy = padH,
			w = canvasW - padW * 2,
			h = canvasH - padH * 2,
			segW = w / 4,
			ax = ox + attackKnob.getValue() * segW,
			ay = oy + h,
			dx = ax + decayKnob.getValue() * segW,
			dy = oy + sustainKnob.getValue() * h,
			sx = w - releaseKnob.getValue() * segW + ox,
			rx = w + ox,
			ry = oy;
		
		// Axis
		ctx.strokeStyle = lightStrokeStyle;

		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo( ox, oy + h + padH * 0.5 );
		ctx.lineTo( ox, oy );
		ctx.lineTo( w + ox*1.5, oy );
		ctx.stroke();

		ctx.lineWidth = 1;
		ctx.strokeStyle = darkStrokeStyle;

		// Dashed hints (if supported)
		if( ctx.setLineDash ) {
			ctx.setLineDash([1, 1, 0, 1]);
		}
		var hints = [];
	
		hints.push([ [ox, ay], [ax, ay] ]);
		if( ax != ox ) {
			hints.push([ [ax, oy], [ax, ay] ]);
		}

		if( ax != dx ) {
			hints.push([ [dx, oy], [dx, dy] ]);
		}
		if( ay != dy ) {
			hints.push([ [ox, dy], [dx, dy] ]); 
		}

		if( sx != rx ) {
			hints.push([ [sx, oy], [sx, dy] ]);
		}

		hints.forEach(function(pair) {
			var src = pair[0],
				dst = pair[1];
			ctx.beginPath();
			ctx.moveTo( src[0], src[1] );
			ctx.lineTo( dst[0], dst[1] );
			ctx.stroke();
		});

		
		// ADSR 'proper'

		if( ctx.setLineDash) {
			ctx.setLineDash( null );
		}
		ctx.beginPath();
		ctx.moveTo( ox, oy );
		ctx.lineTo( ax, ay );
		ctx.lineTo( dx, dy );
		ctx.lineTo( sx, dy );
		ctx.lineTo( rx, ry );
		ctx.stroke();

		ctx.restore();

		// Labels
		// (getting out of translated/scale coord system because otherwise
		// the text shows upside down ò_ó)
		var textHeight = 10,
			xAxisY = oy + h + textHeight,
			yAxisX = ox - 3,
			yAxisY = oy + h;

		ctx.strokeStyle = darkStrokeStyle;
		ctx.textAlign = 'center';
		ctx.font = 'normal ' + textHeight + 'px Helvetica, Arial, sans-serif';

		ctx.strokeText( this.attackLength, (ox + ax) / 2, xAxisY );

		if( ax != dx ) {
			ctx.strokeText( this.decayLength, (ax+dx) / 2, xAxisY );
		}

		ctx.strokeText( this.releaseLength, (sx+rx) / 2, xAxisY );

		ctx.textAlign = 'end';
		ctx.strokeText( outputMinKnob.getValue(), yAxisX, yAxisY );
		ctx.strokeText( outputMaxKnob.getValue(), yAxisX, yAxisY - h );

		if( sustainKnob.getValue()*1 < 1) {
			var min = outputMinKnob.getValue() * 1,
				max = outputMaxKnob.getValue() * 1,
				sustainValue = sustainKnob.getValue() * 1,
				diff = max - min,
				middle = StringFormat.toFixed( min + (diff) * sustainValue );

			ctx.strokeText( middle, yAxisX, yAxisY - h * sustainValue );
		}
		
	}

	this.updateGraph = updateGraph;
	
	updateGraph();


}
SOROLLET.VoiceGUI = function( params ) {
	'use strict';

	var scope = this;
	this.synth = null;
	
	var params = params || {},
		width = params.width !== undefined ? params.width : 300,
		envelopeWidth = width - 80,
		container = new UI.Panel( 'relative' );

	container.setWidth( width + 'px' );
	container.setBackgroundColor( '#eee' );
	container.setPadding( '1em' );
	container.setOverflow( 'auto' );

	function updateOscillatorWithGUI( ev, index ) {
		if(scope.synth == null) {
			console.log('Not attached to any synth');
			return;
		}

		var prefix = 'wave' + index;

		scope.synth[prefix + 'Volume'] = ev.volume;
		scope.synth[prefix + 'Octave'] = ev.octave;
		scope.synth[prefix + 'Phase'] = ev.phase;
		scope.synth[prefix + 'Function'] = SOROLLET.VoiceGUI.prototype.WAVE_FUNCTIONS[ ev.waveType ];
	}

	var oscillatorPanel1 = new SOROLLET.OscillatorGUI(0);
	container.add( oscillatorPanel1 );
	oscillatorPanel1.addEventListener('change', function(e) {
		updateOscillatorWithGUI( e, 1 );
		voiceGUIChanged();
	}, false);

	var oscillatorPanel2 = new SOROLLET.OscillatorGUI(1);
	container.add( oscillatorPanel2 );
	oscillatorPanel2.addEventListener('change', function(e) {
		updateOscillatorWithGUI( e, 2 );
		voiceGUIChanged();
	}, false);

	var mixPanel = new UI.Panel(),
		mixRow = new UI.Panel(),
		mixSelect = new UI.Select()
			.setOptions( SOROLLET.VoiceGUI.prototype.WAVE_MIX_NAMES)
			.onChange( function() {
				scope.synth.waveMixFunction = SOROLLET.VoiceGUI.prototype.WAVE_MIX_FUNCTIONS[ mixSelect.getValue() ];
				voiceGUIChanged();
			} );
	mixPanel.add( new UI.Text().setValue( 'OSCILLATOR MIX' ).setClass( 'section_label'  ));
	mixPanel.add( mixRow );
	mixRow.add( new UI.Text().setValue( 'Type' ) );
	mixRow.add( mixSelect );
	
	container.add( mixPanel );

	// Noise
	var noiseConfigPanel = new UI.Panel();
	noiseConfigPanel.add( new UI.Text().setValue( 'NOISE' ).setClass('section_label')   );

	var noiseRow = new UI.Panel(),
		noiseAmountInput = new UI.Number();
	noiseRow.add( new UI.Text().setValue( 'Amount' ) );
	noiseAmountInput.min = 0;
	noiseAmountInput.max = 1;
	noiseAmountInput.setWidth( '40px' );
	noiseAmountInput.onChange( function() {
		scope.synth.noiseAmount = noiseAmountInput.getValue();
		voiceGUIChanged();
	});
	noiseRow.add( noiseAmountInput );
	noiseConfigPanel.add( noiseRow );

	var noiseMixRow = new UI.Panel(),
		noiseMixType = new UI.Select( 'absolute' )
			.setOptions( SOROLLET.VoiceGUI.prototype.NOISE_MIX_NAMES )
			.onChange( function() {
				scope.synth.noiseMixFunction = SOROLLET.VoiceGUI.prototype.NOISE_MIX_FUNCTIONS[ noiseMixType.getValue() ];
				voiceGUIChanged();
			});

	noiseRow.add( new UI.Text().setValue( 'Mix type' ) );
	noiseRow.add( noiseMixType );
	container.add( noiseConfigPanel );
	
	
	// Envelopes
	function updateEnvelopeWithGUI( ev, env, gui ) {
		env.setAttack( ev.attack );
		env.setDecay( ev.decay );
		env.setSustainLevel( ev.sustain );
		env.setRelease( ev.release );
		env.setOutputRange( ev.outputMin, ev.outputMax );
		env.setTimeScale( ev.timeScale );
		
		gui.updateGraph();
		
		scope.updateEnvelopeLengths();
	}

	var volumeEnvGUI = new SOROLLET.ADSRGUI({
		label: 'VOLUME ENVELOPE',
		outMin: 0,
		outMax: 8,
		step: 1,
		timeMin: 0,
		timeMax: 32,
		width: envelopeWidth
	});
	container.add( volumeEnvGUI );
	volumeEnvGUI.addEventListener( 'change', function( e ) {
		updateEnvelopeWithGUI( e, scope.synth.volumeEnvelope, volumeEnvGUI );
		voiceGUIChanged();
	}, false );

	var pitchEnvGUI = new SOROLLET.ADSRGUI({
		label: 'PITCH ENVELOPE',
		outMin: -48,
		outMax: 48,
		step: 12,
		timeMin: 0,
		timeMax: 32,
		width: envelopeWidth
	});
	container.add( pitchEnvGUI );
	pitchEnvGUI.addEventListener( 'change', function( e ) {
		updateEnvelopeWithGUI( e, scope.synth.pitchEnvelope, pitchEnvGUI );
		voiceGUIChanged();
	}, false );

	// Events
	EventTarget.call( this );
	function voiceGUIChanged() {
		scope.dispatchEvent({ type: 'change', synthParams: scope.synth.getParams() });
	}


	// Making stuff 'public'
	this.dom = container.dom;
	this.oscillatorPanel1 = oscillatorPanel1;
	this.oscillatorPanel2 = oscillatorPanel2;
	this.waveMix = mixSelect;
	this.noiseAmount = noiseAmountInput;
	this.noiseMix = noiseMixType;
	this.volumeEnvGUI = volumeEnvGUI;
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

		function updateADSRGUIWithEnvelope( gui, env ) {
			gui.attack.setValue( env.__unscaledAttackLength );
			gui.decay.setValue( env.__unscaledDecayLength );
			gui.sustain.setValue( env.sustainLevel );
			gui.release.setValue( env.__unscaledReleaseLength );
			gui.timeScale.setValue( env.timeScale );
			gui.outputMin.setValue( env.outputMinimumValue );
			gui.outputMax.setValue( env.outputMaximumValue );
		}

		updateADSRGUIWithEnvelope( this.volumeEnvGUI, synth.volumeEnvelope );
		updateADSRGUIWithEnvelope( this.pitchEnvGUI, synth.pitchEnvelope );

		this.synth = synth;

		this.updateEnvelopeLengths();	
		
		this.volumeEnvGUI.updateGraph();
		this.pitchEnvGUI.updateGraph();
	},

	updateEnvelopeLengths: function() {
		var synth = this.synth,
			volumeEnvGUI = this.volumeEnvGUI,
			volumeEnvelope = synth.volumeEnvelope,
			pitchEnvGUI = this.pitchEnvGUI,
			pitchEnvelope = synth.pitchEnvelope;

		volumeEnvGUI.attackLength = StringFormat.toFixed( volumeEnvelope.attackLength );
		volumeEnvGUI.decayLength = StringFormat.toFixed( volumeEnvelope.decayLength );
		volumeEnvGUI.releaseLength = StringFormat.toFixed( volumeEnvelope.releaseLength );
		pitchEnvGUI.attackLength = StringFormat.toFixed( pitchEnvelope.attackLength );
		pitchEnvGUI.decayLength = StringFormat.toFixed( pitchEnvelope.decayLength );
		pitchEnvGUI.releaseLength = StringFormat.toFixed( pitchEnvelope.releaseLength );
	},

	// TODO: refactor this, probably use the arrays in Voice.js
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

	panel.add( new UI.Text().setValue( labelName ).setClass( 'section_label'  ) );

	var row = new UI.Panel(),
		div = document.createElement('div'),
		waveTypeSelect = new SOROLLET.WaveTypeSelectGUI( )
			.setOptions( SOROLLET.VoiceGUI.prototype.WAVE_NAMES, SOROLLET.VoiceGUI.prototype.WAVE_FUNCTIONS )
			.onChange( onChange ),
		volumeInput = new SOROLLET.KnobGUI({ label: 'Volume', min: 0.0, max: 1.0 })
			.onChange( onChange ),
		octaveInput = new SOROLLET.KnobGUI({ label: 'Octave', min: 0, max: 9, step: 1, precision: 0 })
			.onChange( onChange ),
		phaseInput = new SOROLLET.KnobGUI({ label: 'Phase', min: -Math.PI, max: Math.PI })
			.onChange( onChange );


	panel.add( row );
	row.setClass('controls_row');

	row.add( waveTypeSelect );
	row.add( volumeInput );
	row.add( octaveInput );
	row.add( phaseInput );
	
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
SOROLLET.KnobGUI = function( params ) {
	var params = params || {},
		labelTxt = params.label || '',
		minValue = params.min !== undefined ? params.min : 0.0,
		maxValue = params.max !== undefined ? params.max : 1.0,
		stepValue = params.step !== undefined ? params.step : 0.1,
		precisionValue = params.precision !== undefined ? params.precision : 2,
		knobWidth = params.knobWidth || 30,
		knobHeight = params.knobHeight || knobWidth,
		strokeStyle = params.strokeStyle || '#000000',
		value = 0,
		onChangeHandler = function() { },
		dom = document.createElement( 'div' ),
		canvas = document.createElement( 'canvas' ),
		ctx = canvas.getContext( '2d' ),
		label = document.createElement( 'div' ),
		scope = this;

	dom.className = 'control';

	dom.appendChild( canvas );
	canvas.width = knobWidth;
	canvas.height = knobHeight;

	label.className = 'label';
	label.innerHTML = labelTxt;
	dom.appendChild( label );

	//
	
	var distance = 0,
		onMouseDownValue = 0;

	function onMouseDown( e ) {
		e.preventDefault();
		distance = 0;
		onMouseDownValue = parseFloat( value );
		document.addEventListener( 'mouseup', onMouseUp, false );
		document.addEventListener( 'mousemove', onMouseMove, false );
	}

	function onMouseMove( e ) {
		var movementX = e.movementX || e.webkitMovementX || e.mozMovementX || 0,
			movementY = e.movementY || e.webkitMovementY || e.mozMovementY || 0;

		distance += movementX - movementY;

		var number = onMouseDownValue + ( distance / ( e.shiftKey ? 10 : 100 ) ) * scope.step;

		value = Math.min( scope.max, Math.max( scope.min, number ) ).toFixed( scope.precision ) * 1;

		if( onChangeHandler ) {
			onChangeHandler();
		}

		updateGraph();
	}

	function onMouseUp( e ) {
		document.removeEventListener( 'mouseup', onMouseUp, false );
		document.removeEventListener( 'mousemove', onMouseMove, false );
	}

	canvas.addEventListener( 'mousedown', onMouseDown, false);

	this.setValue = function( v ) {
		value = v;
		updateGraph();
	}

	this.getValue = function( ) {
		return value;
	}

	function updateGraph() {
		ctx.clearRect( 0, 0, knobWidth, knobHeight );

		ctx.strokeStyle = strokeStyle;
		ctx.lineWidth = 2;

		var cx = knobWidth * 0.5,
			cy = knobHeight * 0.5,
			r = Math.min( cx, cy ) * 0.8,
			minAngle = Math.PI / 3,
			maxAngle = Math.PI * 6 / 3,
			angle = ( SOROLLET.Math.map( value, scope.min, scope.max, minAngle, maxAngle )) + Math.PI / 3;

		ctx.beginPath();
		ctx.arc( cx, cy, r, 0, Math.PI * 2, true );
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo( cx, cy );
		ctx.lineTo( cx + r * Math.cos( angle ), cy + r * Math.sin( angle ) );
		ctx.stroke();
	}
	this.updateGraph = updateGraph;

	this.onChange = function( newOnChangeHandler ) {
		onChangeHandler = newOnChangeHandler;
		return this;
	}

	this.dom = dom;

	this.min = minValue;
	this.max = maxValue;
	this.step = stepValue;
	this.precision = precisionValue;

	return this;
}
SOROLLET.WaveTypeSelectGUI = function( params ) {
	'use strict';

	var params = params || {},
		graphWidth = params.graphWidth !== undefined ? params.graphWidth : 50,
		graphHeight = params.graphHeight !== undefined ? params.graphHeight : 30,
		backgroundStyle = params.backgroundStyle !== undefined ? params.backgroundStyle : null,
		strokeStyle = params.strokeStyle !== undefined ? params.strokeStyle : '#000000',
		lineWidth = params.strokeWidth !== undefined ? params.lineWidth : 2,
		div = document.createElement( 'div' ),
		canvas = document.createElement( 'canvas' ),
		ctx = canvas.getContext( '2d' ),
		label = document.createElement( 'div' ),
		value,
		waveFunctions = null, waveNames = null, numWaveFunctions = 0,
		onChangeHandler = function( ) { };

	div.className = 'control';

	canvas.width = graphWidth;
	canvas.height = graphHeight;

	label.className = 'label';

	div.appendChild( canvas );
	div.appendChild( label );

	this.dom = div;

	canvas.addEventListener('click', onCanvasClick, false);

	function onCanvasClick( e ) {
		var x = e.offsetX,
			w = e.srcElement.offsetWidth;

		e.preventDefault();
		e.stopPropagation();

		if( x < w / 2 ) {
			usePreviousWaveType();
		} else {
			useNextWaveType();
		}
	}

	function usePreviousWaveType() {
		var newValue = value - 1;
		
		if( newValue < 0 ) {
			newValue = numWaveFunctions - 1;
		}
		setValue( newValue );
		onChangeHandler( newValue );
	}

	function useNextWaveType() {
		var newValue = (value + 1) % numWaveFunctions;
		setValue( newValue );
		onChangeHandler( newValue );
	}

	function drawGraph() {
	
		var angleIncrement = Math.PI * 2.0 / graphWidth,
			x = 1, y, angle = 0,
			graphHeightRange = graphHeight * 0.7;

		if( backgroundStyle === null) {
			ctx.clearRect( 0, 0, graphWidth, graphHeight );
		} else {
			ctx.fillStyle = backgroundStyle;
			ctx.fillRect( 0, 0, graphWidth, graphHeight );
		}

		ctx.save();
		
		ctx.translate( -lineWidth * 0.5, 0 );

		ctx.strokeStyle = strokeStyle;
		ctx.lineWidth = lineWidth;

		if( waveFunctions === null ) {
			return;
		}

		var voice = new SOROLLET.Voice(),
			plotBuffer = [],
			plotFunction = waveFunctions[ value ];
		
		voice.setSamplingRate( graphWidth );
	
		plotFunction.call( voice, plotBuffer, graphWidth, 0, 2, 0 );

		ctx.beginPath();

		for( var i = 0; i <= graphWidth; i++) {
			y = plotBuffer[i] * graphHeightRange * .5 + graphHeight * 0.5;

			if( x == 0 ) {
				ctx.moveTo( x, y );
			}

			ctx.lineTo( x, y );
			angle += angleIncrement;
			x++;
		}

		ctx.stroke();
		ctx.restore();

	}
	this.drawGraph = drawGraph;

	this.setOptions = function( names, functions ) {
		waveNames = names;
		waveFunctions = functions;

		numWaveFunctions = 0;

		for(var prop in waveFunctions) {
			numWaveFunctions++;
		}
		return this;
	}


	function setValue( v ) {
		value = v >> 0;

		drawGraph();

		label.innerHTML = waveNames[ v ];
	}
	this.setValue = setValue;

	this.getValue = function( ) {
		return value;
	}

	this.onChange = function( newOnChangeHandler ) {
		onChangeHandler = newOnChangeHandler;
		return this;
	}

	return this;
}
SOROLLET.MultipleStatePushButton = function( params ) {
	'use strict';
	var params = params || {},
		width = params.width !== undefined ? params.width : 32,
		height = width,
		numberOfStates = params.numberOfStates !== undefined ? params.numberOfStates : 2,
		activeFillStyle = params.activeFillStyle !== undefined ? params.activeFillStyle : '#eeffff',
		inactiveFillStyle = params.inactiveFillStyle !== undefined ? params.inactiveFillStyle : '#eeeeee',
		hoverFillStyle = params.hoverFillStyle !== undefined ? params.hoverFillStyle : '#ffffee',
		canvas = document.createElement('canvas'),
		ctx = canvas.getContext( '2d' ),
		value = 0,
		scope = this;

	canvas.width = width;
	canvas.height = height;
	canvas.dataset['control'] = this; // TODO ???

	canvas.addEventListener( 'click', function( e ) {
		e.preventDefault();
		nextValue();
	}, false );

	canvas.addEventListener( 'mouseover', function() {
		scope.hovered = true;
		updateGraph();
	}, false );

	canvas.addEventListener( 'mouseout', function() {
		scope.hovered = false;
		updateGraph();
	}, false );

	this.dom = canvas;
	this.active = false;
	this.hovered = false;
	
	EventTarget.call( this );

	function updateGraph() {

		ctx.clearRect(0, 0, width, height);
		
		var radius = (value * width * 0.5) / numberOfStates,
			cx = width * 0.5,
			cy = height * 0.5;

		if( scope.hovered ) {
			ctx.fillStyle = hoverFillStyle;
		} else if( scope.active ) {
			ctx.fillStyle = activeFillStyle;
		} else {
			ctx.fillStyle = inactiveFillStyle;
		}
		//ctx.fillStyle = '#eeeeee';
		ctx.beginPath();
		ctx.arc( cx, cy, width * 0.5, 0, Math.PI * 2, true );
		ctx.fill();

		if( radius > 0 ) {
			ctx.strokeStyle = '#000000';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc( cx, cy, radius, 0, Math.PI * 2, true );
			ctx.stroke();
		}

	}

	function nextValue() {
		var newValue = (value+1) % numberOfStates;
		setValue( newValue );
	}
	
	function setValue( v, eventDispatchingAllowed ) {
		eventDispatchingAllowed = eventDispatchingAllowed !== undefined ? eventDispatchingAllowed : true;

		value = Math.round( v ) % numberOfStates;
		updateGraph();

		if( eventDispatchingAllowed ) {
			dispatchEvent({
				type: 'change',
				value: value
			});
		}
	}
	this.setValue = setValue;

	this.getValue = function() {
		return value;
	}

	this.setActive = function( v ) {
		this.active = v;
		updateGraph();
	}

	var dispatchEvent = this.dispatchEvent;



	return this;
}
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
