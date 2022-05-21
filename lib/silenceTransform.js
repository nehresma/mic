var Transform = require('stream').Transform;
var util = require("util");

function IsSilence(options) {
    var that = this;
    if (options && options.debug) {
      that.debug = options.debug;
      delete options.debug;
    }
    Transform.call(that, options);
    var consecSilenceCount = 0;
    var numSilenceFramesExitThresh = 0;

    that.getNumSilenceFramesExitThresh = function getNumSilenceFramesExitThresh() {
        return numSilenceFramesExitThresh;
    };

    that.getConsecSilenceCount = function getConsecSilenceCount() {
        return consecSilenceCount;
    };

    that.setNumSilenceFramesExitThresh = function setNumSilenceFramesExitThresh(numFrames) {
        numSilenceFramesExitThresh = numFrames;
        return;
    };

    that.incrConsecSilenceCount = function incrConsecSilenceCount() {
        consecSilenceCount++;
        return consecSilenceCount;
    };

    that.resetConsecSilenceCount = function resetConsecSilenceCount() {
        consecSilenceCount = 0;
        return;
    };
};
util.inherits(IsSilence, Transform);

IsSilence.prototype._transform = function(chunk, encoding, callback) {
    var i;
    var speechSample;
    var silenceLength = 0;
    var abs = 0;
    var chunkMax = 0;
    var chunkAmplitudeSumOfSquares = 0;
    var self = this;
    var debug = self.debug;
    var alreadyReset = false;
    var consecutiveSilence = self.getConsecSilenceCount();
    var numSilenceFramesExitThresh = self.getNumSilenceFramesExitThresh();
    var incrementConsecSilence = self.incrConsecSilenceCount;
    var resetConsecSilence = self.resetConsecSilenceCount;

    if(numSilenceFramesExitThresh) {
        for(i=0; i<chunk.length; i=i+2) {
            if(chunk[i+1] >= 128) {
                speechSample = (chunk[i+1] - 256) * 256;
            } else {
                speechSample = chunk[i+1] * 256;
            }
            speechSample += chunk[i];

            abs = Math.abs(speechSample);
            if(abs > 2000) {
                if (!alreadyReset) {
                    if (debug) {
                      console.log("Found speech block");
                    }
                    //emit 'sound' if we hear a sound after a silence
                    if (consecutiveSilence > numSilenceFramesExitThresh) self.emit('sound');
                    resetConsecSilence();
                    alreadyReset = true;
                }
            } else {
                silenceLength++;
            }
            if (abs > chunkMax) {
              chunkMax = abs;
            }
            chunkAmplitudeSumOfSquares += (abs * abs);
        }
        // Emit the root mean square of the chunk's amplitude and a simple percent
        // of the maximum amplitude in the chunk over the max possible amplitude
        // (16 bit PCM).
        self.emit('soundLevel', Math.sqrt((1/chunk.length) * chunkAmplitudeSumOfSquares), 100 * chunkMax / 32768);
        if(silenceLength == chunk.length/2) {
            consecutiveSilence = incrementConsecSilence();
            if (debug) {
              console.log("Found silence block: %d of %d", consecutiveSilence, numSilenceFramesExitThresh);
            }
            //emit 'silence' only once each time the threshold condition is met
            if(consecutiveSilence === numSilenceFramesExitThresh) {
                self.emit('silence');
            }
        }
    }
    // I believe the push here is a memory leak.  Commenting out.
    // this.push(chunk);
    callback(null, chunk);
};

module.exports = IsSilence;
