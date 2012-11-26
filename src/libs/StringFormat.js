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
