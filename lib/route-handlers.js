/**
 * route request handlers
 */

 // Dependencies
var _data = require('./data');
var helpers = require('./helpers');

 //Container for route handlers
var handlers = {};

// Users
handlers.users = function(data, callback) {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1) {
        handlers._users[data.method](data, callback);
    } else {
        callback(405)
    }
}

// Container for users sub routes
handlers._users = {};

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// optional data: none
handlers._users.post = function(data, callback) {
    // Check all required fields are filled out
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ?  data.payload.firstName : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ?  data.payload.lastName : false;
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ?  data.payload.phone : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ?  data.payload.password : false;
    var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ?  true : false;

    if(firstName && lastName && phone && password && tosAgreement) {
        // make sure the user does not already exist
        _data.read('users',phone, function(err, data){
            if(err) {
                // Hash the password
                var hashedPassword = helpers.hash(password);
                if(hashedPassword) {
                    // Create the user object
                    var userObject = {
                        firstName: firstName,
                        lastName: lastName,
                        phone: phone,
                        password: hashedPassword,
                        tosAgreement: true
                    }

                    // Store the user
                    _data.create('users', phone, userObject, function(err) {
                        if(!err) {
                            callback(200);
                        } else {
                            callback(500, {'Error': 'Could not create the new user \n' + err});
                        }
                    })
                } else {
                    callback(500, {'Error': 'Could hash the user\'s password \n' + err});
                }

            } else {
                callback(400, {'Error': 'A user with that phone number already exists \n' + err});
            }
        })

    } else {
        callback(400, {'Error': 'Missing required fields'});
    }
}

// Users - get
// Required data: phone
// Optional data: none
// @TODO only let authenticated users to access there own data and not others data
handlers._users.get = function(data, callback) {
    // Check for valid phone number
    var phone = typeof(data.queryStringObject.phone == 'string') && data.queryStringObject.phone && data.queryStringObject.phone.length == 10 ? data.queryStringObject.phone : false;
    if(phone) {
        // Look up the user
        _data.read('users', phone, function(err, userData) {
            if(!err && userData) {
                // Remove the hashed password from the user object before returning it to the requester
                delete userData.password;
                callback(200, userData);
            } else {
                callback(404);
            }
        });
    } else {
        callback(400, {'Error': 'Missing required fields'});
    }
}

// Users - put
// Required data: phone
// optional data: firstName, lastName, phone, password, tosAgreement (at least one must be specified)
// @TODO only authenticated users can update their own object, Don't let them update anyone else's
handlers._users.put = function(data, callback) {
    // Check for valid phone number
    var phone = typeof(data.payload.phone == 'string') && data.payload.phone && data.payload.phone.length == 10 ? data.payload.phone : false;

    // check for valid data to update
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ?  data.payload.firstName : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ?  data.payload.lastName : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ?  data.payload.password : false;

    // Errror if the phone is invalid
    if(phone) {
        if(firstName || lastName || password){
            // Look up the user
            _data.read('users',phone, function(err, userData) {
                if(!err && userData) {
                    // Update the fields necessary
                    if(firstName){
                        userData.firstName = firstName;
                    }

                    if(lastName){
                        userData.lastName = lastName;
                    }

                    if(password){
                        // Hash the password before storing it
                        userData.password = helpers.hashedPassword(password);
                    }

                    // Store the new updates
                    _data.update('users', phone, userData, function(err) {
                        if(!err) {
                            callback(200);
                        } else {
                            console.log(err)
                            callback(500, {'Error': 'Could not update the user'});
                        }
                    });
                    
                } else {
                    callback(400, {'Error' : 'specified user does not exist'});
                }
            })
        } else {
            callback(400, {'Error': 'Missing fields to update'});    
        }
    } else {
        callback(400, {'Error': 'Missing required fields'});
    }
}

// Users - delete
// Required data: phone
// Optional data: none
// @TODO Only authenticated user can delete their object. Dont let them delete anyone else's
// @TODO Cleanup (delete) any other data files associated with this user
handlers._users.delete = function(data, callback) {
    // Check for valid phone number
    var phone = typeof(data.queryStringObject.phone == 'string') && data.queryStringObject.phone && data.queryStringObject.phone.length == 10 ? data.queryStringObject.phone : false;
    if(phone) {
        // Look up the user
        _data.read('users', phone, function(err, userData) {
            if(!err && userData) {
                // Delete the user object
                _data.delete('users', phone, function(err) {
                    if(!err){
                        callback(200)
                    } else {
                        callback(500, {'Error': 'Could not delete the specified user'});
                    }
                });
            } else {
                callback(400, {'Error': 'Could not find the specified user'});
            }
        });
    } else {
        callback(400, {'Error': 'Missing required fields'});
    }
}

// Ping handler
handlers.ping = function(data, callback) {
  callback(200);
}

// Not found handler
handlers.notFound = function(data, callback) {
 callback(406)
}

// Export the module
module.exports = handlers;