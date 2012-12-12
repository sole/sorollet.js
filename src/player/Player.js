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
	this.nextEventPosition = 0; // TODO position->index?
	
	EventTarget.call( this );

	updateRowTiming();


	function updateRowTiming() {
		secondsPerRow = 60.0 / (scope.linesPerBeat * scope.bpm);
		secondsPerTick = secondsPerRow / scope.ticksPerLine;
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

		/*

		 */ 
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

	this.playOrder = function( orderIndex ) {
		// TODO if the new pattern to play has less rows than the current one,
		// make sure we don't play out of index
		this.currentOrder = orderIndex;
		this.currentPattern = this.orderList[ orderIndex ];
		this.dispatchEvent({ type: 'orderChanged', order: orderIndex });
		this.dispatchEvent({ type: 'patternChanged', pattern: this.currentPattern });
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
