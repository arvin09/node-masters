/**
 * This are workers related task
 */

 // Dependencies
 var path = require('path');
 var fs = require('fs');
 var http = require('http');
 var https = require('https');
 var url = require('url');
 var _data = require('./data');
 var helpers = require ('./helpers');
 var _logs = require('./logs.js');

// Instantiate the worker module object
var workers = {};

// Lookup all checks, get their data, send to validator
workers.gatherAllChecks = function(){
  // Get all the checks
  _data.list('checks',function(err,checks){
    if(!err && checks && checks.length > 0){
      checks.forEach(function(check){
        // Read in the check data
        _data.read('checks',check,function(err,originalCheckData){
          if(!err && originalCheckData){
            // Pass it to the check validator, and let that function continue the function or log the error(s) as needed
            workers.validateCheckData(originalCheckData);
          } else {
            console.log("Error reading one of the check's data: ",err);
          }
        });
      });
    } else {
      console.log('Error: Could not find any checks to process');
    }
  });


};

// Sanity-check the check-data,
workers.validateCheckData = function(originalCheckData){
    originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
    originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
    originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
    originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['http','https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
    originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
    originalCheckData.method = typeof(originalCheckData.method) == 'string' &&  ['post','get','put','delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
    originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
    originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;
    // Set the keys that may not be set (if the workers have never seen this check before)
    originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up','down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;
  
    // If all checks pass, pass the data along to the next step in the process
    if(originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol &&
    originalCheckData.url &&
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds){
      workers.performCheck(originalCheckData);
    } else {
      // If checks fail, log the error and fail silently
      console.log("Error: one of the checks is not properly formatted. Skipping.");
    }
  };

// perform the check, send the originalCheckData and the outcome of the check process to the next process
workers.performCheck = function(originalCheckData) {
    
    // Prepare the initial check outcome
    var checkOutcome = {
        'error' : false,
        'responseCode': false
    }

    // Mark that the outcome has not been sent yet
    var outcomeSent = false;


    // Parse the hpstname amd the path out of the orignal check data
    var parsedUrl = url.parse(originalCheckData.protocol+'://'+ originalCheckData.url, true);
    var hostName = parsedUrl.hostname;
    var path = parsedUrl.path; // Using path and not pathname nbecause we want the full query string (/path || /Path?a=b)

    var requestDetails = {
        'protocol': originalCheckData.protocol+':',
        'hostname': hostName,
        'method': originalCheckData.method.toUpperCase(),
        'path': path,
        'timeout': originalCheckData.timeoutSeconds * 1000
    }

    // Instantiate the request object  ( using either http or https)
    var _moduleToUse = originalCheckData.protocol == 'http' ? http : https;

    var req = _moduleToUse.request(requestDetails, function(res) {
        // Grab the status code
        var status = res.statusCode;

        // Update tje checkOutcome  and pass the data along
        checkOutcome.responseCode = status;
        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // Bind to the error event so it doesno't get thrown
    req.on('error', function(){
        // update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error': true,
            'value': e
        }

        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // Bind to the timeout event
    req.on('timeout', function(e){
        // update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error': true,
            'value': 'timeout'
        };
        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // End the request
    req.end();
}

// Process the check outcome, update the check data as needed, triggeran aletrt ot the user if needed
// Special logic for accomaodating a check which has never has been tested before (don't want to alert on that)

workers.processCheckOutcome = function (originalCheckData, checkOutcome) {
    // Decide if the check is considered up or down
    var state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

    // Decide if an alert is warranted
    var alertWarranted = originalCheckData.lastChecked && originalCheckData.state != state ? true : false;

    // Log the outcome
    var timeOfCheck = Date.now();
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

    // Update the check data
    var newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = Date.now();

    

    // Save the updates
    _data.update('checks', newCheckData.id, newCheckData, function(err) {
        if(!err) {
            // Send the new check data to the next phase of the process
            if(alertWarranted){
                workers.alertUserToStatusChange(newCheckData);
            } else {
                console.log('Check outcome has not changed so no alert needed');
            }
        } else {
            console.log("Error trying to save updates to one of the checks");
        }
    })
}

// Logging
workers.log = function(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) {
    // Create the log data
    var logData = {
        'check': originalCheckData,
        'outcome': checkOutcome,
        'state': state,
        'alert': alertWarranted,
        'time': timeOfCheck
    }

    // Convert data to a string
    var logString = JSON.stringify(logData);

    // Determine the name of the log file
    var logFileName = originalCheckData.id;

    // Append the log string to the file
    _logs.append(logFileName, logString, function(err){
        if(!err) {
            console.log('Logging the log to the file');
        } else {
            console.log('Error in loging the log to the file');
        }
    })
}


// Alert the user as to a change in their check status
workers.alertUserToStatusChange = function(newCheckData) {
    var msg = 'Alert: Your check for ' + newCheckData.method.toUpperCase() + ' ' + newCheckData.protocol+'://'+newCheckData.url+' is currently '+ newCheckData.state;
    helpers.sendTwilioSms(newCheckData.userPhone, msg, function(err, callback) {
        if(!err) {
            console.log('Success: User was alerted to a status change in their check, via sms ', msg);
        } else {
            console.log('Error : Could not send sms alert to the user to status cheange in their check');
        }
    })
}

// Timer to execte the wroker-process once per minute
workers.loop = function(){
    setInterval(() => {
        workers.gatherAllChecks();
    }, 1000 * 60);
}

// Rotate (compress) the log files
workers.rotateLogs =  function(){
    // List all the (non-compressed) log files
    _logs.list(false, function(err, logs) {
        if(!err && logs && logs.length > 0) {
            logs.forEach(function(logName) {
                // Compress the data to a different file
                var logId = logName.replace('.log','');
                var newFileld = logId+'-'+Date.now();
                _logs.compress(logId, newFileld, function(err){
                    if(!err) {
                        // Truncating the log
                        _logs.truncate(logId, function(err) {
                            if(!err) {
                                console.log('Success truncating log file');
                            } else {
                                console.log('Error truncating log file');
                            }
                        });
                    } else {
                        console.log(' Error : compressing one of the log files', err);
                    }
                })
            });
        } else {
            console.log('Error: could not find any logs to rotate');
        }
    });
}

// Timer to execte the log-rotattion preocess once per day
workers.logRotationLoop = function(){
    setInterval(() => {
        workers.rotateLogs();
    }, 1000 * 60 * 60 * 24);
}

// Init worker
workers.init = function() {
    // Execute all the checks immediately
    workers.gatherAllChecks();

    // Call the loop so the checks will execute later on
    workers.loop();

    // Compress all the logs immediately
    workers.rotateLogs();

    // Call the compression loop so logs will compressed later on
    workers.logRotationLoop();


}

// Export the object
module.exports = workers