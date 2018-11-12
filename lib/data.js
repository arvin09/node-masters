/*
* Library to store and retrive data
*
*/

// Depedencies
var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');

// Container for the module (to be exported)
var lib = {}

// Base directory of the data folder
lib.baseDir = path.join(__dirname,'/../.data/');

// Write data to file
lib.create = function(dir, file, data, callback) {
    // open the file for writing
    fs.open(lib.baseDir+dir+'/'+file+'.json', 'wx', function(err, fileDescriptor) {
        if(!err && fileDescriptor) {
            // Convert data to string
            var stringData = JSON.stringify(data);

            // Write the file and close it
            fs.writeFile(fileDescriptor, stringData, function(err) {
                if(!err) {
                    fs.close(fileDescriptor, function(err){
                        if(!err) {
                            callback(false);
                        } else {
                            callback('Error closing new file');
                        }
                    });
                } else {
                    callback('Error writing to new file');
                }
            });
        } else {
            callback('Could not create new file, it may already exist'+ err);
        }
    })
}

// Read data from the file
lib.read = function(dir, file, callback) {
    fs.readFile(lib.baseDir+dir+'/'+file+'.json', 'utf8', function(err, data) {
        if(!err) {
            var parsedData = helpers.parseJsonToObject(data);
            callback(false, parsedData);
        } else {
            callback(err, data);
        }
    })
}

// Update data to file
lib.update = function(dir, file, data, callback) {
    // open the file for writing
    fs.open(lib.baseDir+dir+'/'+file+'.json', 'r+', function(err, fileDescriptor) {
        if(!err && fileDescriptor) {
            // Convert data to string
            var stringData = JSON.stringify(data);

            // Truncate the file
            fs.truncate(fileDescriptor, function(err){
                if(!err) {
                    // Write the file and close it
                    fs.writeFile(fileDescriptor, stringData, function(err) {
                        if(!err) {
                            fs.close(fileDescriptor, function(err){
                                if(!err) {
                                    callback(false);
                                } else {
                                    callback('Error closing existing file');
                                }
                            });
                        } else {
                            callback('Error writing to existing file');
                        }
                    });
                } else {
                    callback('Error truncatiing the file');
                }
            });
        } else {
            callback('Could not open the file for updating, it may not exist yet'+ err)
        }
    })
}

// Delete the file
lib.delete = function(dir, file, callback) {
    // unlink the file from fs
    fs.unlink(lib.baseDir+dir+'/'+file+'.json', function(err){
        if(!err) {
            callback(false);
        } else {
            console.log('Error in deleting file');
        }
    })
}


// Export the module
module.exports = lib;