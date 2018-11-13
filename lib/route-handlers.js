/**
 * route request handlers
 */

// Dependencies
var _data = require('./data');
var helpers = require('./helpers');

//Container for route handlers
var handlers = {};

// Users
handlers.users = function (data, callback) {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
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
handlers._users.post = function (data, callback) {
    // Check all required fields are filled out
    var firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName : false;
    var lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName : false;
    var phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone : false;
    var password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password : false;
    var tosAgreement = typeof (data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

    if (firstName && lastName && phone && password && tosAgreement) {
        // make sure the user does not already exist
        _data.read('users', phone, function (err, data) {
            if (err) {
                // Hash the password
                var hashedPassword = helpers.hash(password);
                if (hashedPassword) {
                    // Create the user object
                    var userObject = {
                        firstName: firstName,
                        lastName: lastName,
                        phone: phone,
                        password: hashedPassword,
                        tosAgreement: true
                    }

                    // Store the user
                    _data.create('users', phone, userObject, function (err) {
                        if (!err) {
                            callback(200);
                        } else {
                            callback(500, {
                                'Error': 'Could not create the new user \n' + err
                            });
                        }
                    })
                } else {
                    callback(500, {
                        'Error': 'Could hash the user\'s password \n' + err
                    });
                }

            } else {
                callback(400, {
                    'Error': 'A user with that phone number already exists \n' + err
                });
            }
        })

    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
}

// Users - get
// Required data: phone
// Optional data: none
handlers._users.get = function (data, callback) {
    // Check for valid phone number
    var phone = typeof (data.queryStringObject.phone == 'string') && data.queryStringObject.phone && data.queryStringObject.phone.length == 10 ? data.queryStringObject.phone : false;
    if (phone) {
        // Get the token from the headers
        var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
            if (tokenIsValid) {
                // Look up the user
                _data.read('users', phone, function (err, userData) {
                    if (!err && userData) {
                        // Remove the hashed password from the user object before returning it to the requester
                        delete userData.password;
                        callback(200, userData);
                    } else {
                        callback(404);
                    }
                });
            } else {
                callback(403, {
                    'Error': 'Missing required token in header, or token is expired'
                })
            }
        })
    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
}

// Users - put
// Required data: phone
// optional data: firstName, lastName, phone, password, tosAgreement (at least one must be specified)
handlers._users.put = function (data, callback) {
    // Check for valid phone number
    var phone = typeof (data.payload.phone == 'string') && data.payload.phone && data.payload.phone.length == 10 ? data.payload.phone : false;

    // check for valid data to update
    var firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName : false;
    var lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName : false;
    var password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password : false;

    // Errror if the phone is invalid
    if (phone) {
        if (firstName || lastName || password) {
            // Get the token from the headers
            var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

            // Verify that the given token is valid for the phone number
            handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
                if (tokenIsValid) {
                    // Look up the user
                    _data.read('users', phone, function (err, userData) {
                        if (!err && userData) {
                            // Update the fields necessary
                            if (firstName) {
                                userData.firstName = firstName;
                            }

                            if (lastName) {
                                userData.lastName = lastName;
                            }

                            if (password) {
                                // Hash the password before storing it
                                userData.password = helpers.hashedPassword(password);
                            }

                            // Store the new updates
                            _data.update('users', phone, userData, function (err) {
                                if (!err) {
                                    callback(200);
                                } else {
                                    console.log(err)
                                    callback(500, {
                                        'Error': 'Could not update the user'
                                    });
                                }
                            });

                        } else {
                            callback(400, {
                                'Error': 'specified user does not exist'
                            });
                        }
                    });
                } else {
                    callback(403, {
                        'Error': 'Missing required token in header, or token is expired'
                    });
                }
            });
        } else {
            callback(400, {
                'Error': 'Missing fields to update'
            });
        }
    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
}

// Users - delete
// Required data: phone
// Optional data: none
// @TODO Cleanup (delete) any other data files associated with this user
handlers._users.delete = function (data, callback) {
    // Check for valid phone number
    var phone = typeof (data.queryStringObject.phone == 'string') && data.queryStringObject.phone && data.queryStringObject.phone.length == 10 ? data.queryStringObject.phone : false;
    if (phone) {

        // Get the token from the headers
        var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
            if (tokenIsValid) {
                // Look up the user
                _data.read('users', phone, function (err, userData) {
                    if (!err && userData) {
                        // Delete the user object
                        _data.delete('users', phone, function (err) {
                            if (!err) {
                                callback(200)
                            } else {
                                callback(500, {
                                    'Error': 'Could not delete the specified user'
                                });
                            }
                        });
                    } else {
                        callback(400, {
                            'Error': 'Could not find the specified user'
                        });
                    }
                });
            } else {
                callback(403, {
                    'Error': 'Missing required token in header, or token is expired'
                });
            }
        });
    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
}

// Tokens
handlers.tokens = function (data, callback) {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._tokens[data.method](data, callback);
    } else {
        callback(405)
    }
}

// Container for all the tokens methods
handlers._tokens = {}

// Tokens -post
// Required data : phone, password
// Optional data : none
handlers._tokens.post = function (data, callback) {
    // Check if all required fields are provided
    var phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone : false;
    var password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password : false;

    if (password && phone) {
        // Look up the user who matches that phone number
        _data.read('users', phone, function (err, userData) {
            if (!err && userData) {
                // Hash the sent password, and compar eit to the password stored in the user object
                var hashedPassword = helpers.hash(password)
                if (hashedPassword == userData.password) {
                    // If valid create a token with expiration set to one hour in future
                    var tokenId = helpers.createRandomString(20);
                    var expires = Date.now() + 1000 * 60 * 60;

                    var tokenObject = {
                        'phone': phone,
                        'id': tokenId,
                        'expires': expires
                    }

                    // Store the token
                    _data.create('tokens', tokenId, tokenObject, function (err) {
                        if (!err) {
                            callback(200, tokenObject);
                        } else {
                            callback(500, {
                                'Error': 'Could not create the new token'
                            });
                        }
                    })

                } else {
                    callback(400, {
                        'Error': 'Password did not match the specified user\'s stored password'
                    });
                }
            } else {
                callback(400, {
                    'Error': 'Could not find the specified phone number'
                });
            }

        })
    } else {
        callback(400, {
            'Error': 'Missing required fields'
        })
    }
}

// Tokens -get
// Required data: id
// Optional data: none
handlers._tokens.get = function (data, callback) {
    // Check for valid id
    var id = typeof (data.queryStringObject.id == 'string') && data.queryStringObject.id && data.queryStringObject.id.length == 20 ? data.queryStringObject.id : false;
    if (id) {
        // Look up the user
        _data.read('tokens', id, function (err, tokenData) {
            if (!err && tokenData) {
                callback(200, tokenData);
            } else {
                callback(404, {
                    'Error': 'Could not found specidfied token'
                });
            }
        });
    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
}

// Tokens - put
// Required data: id, extend
// Optional data: none
handlers._tokens.put = function (data, callback) {
    // Check for valid id and extend
    var id = typeof (data.payload.id == 'string') && data.payload.id && data.payload.id.length == 20 ? data.payload.id : false;
    var extend = typeof (data.payload.extend == 'boolean') && data.payload.extend == true ? true : false;

    if (id && extend) {
        // Lookup the token
        _data.read('tokens', id, function (err, tokenData) {
            if (!err && tokenData) {
                // Check to make sure the token is not already expired

                if (tokenData.expires > Date.now()) {
                    // Set the expiration and hour from now
                    tokenData.expires = Date.now() + 1000 * 60 * 60;

                    // Store the updated expiration
                    _data.update('tokens', id, tokenData, function (err) {
                        if (!err) {
                            callback(200);
                        } else {
                            callback(500, {
                                'Error': 'Could not update the token\'s expiration'
                            });
                        }
                    });
                } else {
                    callback(400, {
                        'Error': 'The token has already exired, and cannot be extended'
                    });
                }
            } else {
                callback(404, {
                    'Error': 'Could not found specidfied token'
                });
            }
        });

    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
}

// Tokens -delete
// Required data: id
// Optional data: none
handlers._tokens.delete = function (data, callback) {
    // Check for valid phone number
    var id = typeof (data.queryStringObject.id == 'string') && data.queryStringObject.id && data.queryStringObject.id.length == 20 ? data.queryStringObject.id : false;
    if (id) {
        // Look up the user
        _data.read('tokens', id, function (err, tokenData) {
            if (!err && tokenData) {
                // Delete the token object
                _data.delete('tokens', id, function (err) {
                    if (!err) {
                        callback(200)
                    } else {
                        callback(500, {
                            'Error': 'Could not delete the specified token'
                        });
                    }
                });
            } else {
                callback(400, {
                    'Error': 'Could not find the specified token'
                });
            }
        });
    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
}

// Verify if the given token id is currently valid for given user
handlers._tokens.verifyToken = function (id, phone, callback) {
    //Lookup the token
    _data.read('tokens', id, function (err, tokenData) {
        if (!err && tokenData) {
            // Check the token is for the given user and has not expired
            if (tokenData.phone == phone && tokenData.expires > Date.now()) {
                callback(true);
            } else {
                callback(false);
            }
        } else {
            callback(false);
        }
    });
}

// Ping handler
handlers.ping = function (data, callback) {
    callback(200);
}

// Not found handler
handlers.notFound = function (data, callback) {
    callback(406)
}

// Export the module
module.exports = handlers;