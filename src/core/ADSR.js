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
