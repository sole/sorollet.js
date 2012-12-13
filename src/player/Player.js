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
