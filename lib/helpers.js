/**
 * Helpers for various task
 * 
 */

//Dependencies
var crypto = require('crypto');
var config = require('./config');

// Container for all the helpers
 var helpers = {}

// Create a SHA256 hash
 helpers.hash = function(str) {
     if(typeof(str) == 'string' && str.trim().length > 0) {
        var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
        return hash;
     } else {
         return false;
     }
 };

 // Parse a Json to an object in all cases, without throwing
 helpers.parseJsonToObject = function(str) {
     try {
         var obj = JSON.parse(str);
         return obj;
     }
     catch(e) {
         return {};
     }
 };

 // Create a string of random alphanumeric chartcters, of a given length
 helpers.createRandomString = function(strLength) {
    strLength = typeof(strLength) == 'number' && strLength > 0  ? strLength : false;
    if(strLength) {
        // Define all the possible characters that could go into a string
        var possibleCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

        // Start the final string
        var str = '';
        for(var i = 1;  i <= strLength; i++){
            // get a randowm character from the possibleCharacters string
            var randonCharacter = possibleCharacters.charAt(Math.floor(Math.random()*possibleCharacters.length));
            str += randonCharacter;
        }

        // Return the final string
        return str;
    }
 }

 // Export the module
 module.exports = helpers
