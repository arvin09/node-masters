/**
 * route request handlers
 */

// Dependencies
var _data = require('./data');
var helpers = require('./helpers');
var config = require('./config');

//Container for route handlers
var handlers = {};

/**
 * HTML Handlers
 */

 // Index handler
 handlers.index = function(data, callback){
     // Reject any request that isn't get
     if(data.method == 'get') {
         // Read in a template as a string
         helpers.getTemplate('index', function(err, str) {
             if(!err && str) {
                // Read in the index template
                callback(200, str, 'html');
             } else {
                callback(500, null, 'html');
             }
         })
     } else {
        callback(405, null, 'html');
     }
 }


/**
 * JSOM API Routes
 */

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
    var phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;

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
handlers._users.delete = function (data, callback) {
    // Check for valid phone number
    var phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.length == 10 ? data.queryStringObject.phone : false;
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
                                // Delete each of the users check associated with the user
                                // checks of the user
                                var userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                                var checksToDelete = userChecks.length;
                                if (checksToDelete > 0) {
                                    var deletionErrors = false;
                                    var checksDeleted = 0;
                                    //Loop through user checks
                                    userChecks.forEach(function (checkId) {
                                        // Delete the checks
                                        _data.delete('checks', checkId, function (err) {
                                            if (err) {
                                                deletionErrors = false
                                            }
                                            checksDeleted++;
                                            if (checksDeleted == checksToDelete) {
                                                if (!deletionErrors) {
                                                    callback(200)
                                                } else {
                                                    callback(500, { 'Error': 'Errors encountered while attempting to delete all of the users checks, all checks may not have been seleted from the system successfully' })
                                                }
                                            }
                                        });
                                    });
                                }

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

// Checks
handlers.checks = function (data, callback) {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._checks[data.method](data, callback);
    } else {
        callback(405)
    }
}

// Container for all the checks sub routes
handlers._checks = {}

// Checks - post
// Required data - protocol, url, method, successCodes, timeoutSeconds
// Optional data - none
handlers._checks.post = function (data, callback) {
    // Check for valid data
    var protocol = typeof (data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol.trim() : false;
    var url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false
    var method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method.trim() : false;
    var successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 0 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    if (protocol && url && method && successCodes && timeoutSeconds) {
        // Get the token from the header
        var token = typeof (data.headers.token) == 'string' && data.headers.token.length > 0 ? data.headers.token : false;

        // Look the user phone using the provided token
        _data.read('tokens', token, function (err, tokenData) {
            if (!err && tokenData) {
                var userPhone = tokenData.phone;
                // Look up for the user data using phone
                _data.read('users', userPhone, function (err, userData) {
                    if (!err && userData) {
                        var userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                        // Verify that the user has less than number of max checks
                        if (userChecks.length < config.maxChecks) {
                            // Create a random id for the check
                            var checkId = helpers.createRandomString(20);

                            // Create a check object, and include the user's phone
                            var checkObject = {
                                'id': checkId,
                                'userPhone': userPhone,
                                'protocol': protocol,
                                'url': url,
                                'method': method,
                                'successCodes': successCodes,
                                'timeoutSeconds': timeoutSeconds
                            }

                            // Store the object
                            _data.create('checks', checkId, checkObject, function (err) {
                                if (!err) {
                                    // Add the check id to the user object
                                    userData.checks = userChecks;
                                    userData.checks.push(checkId);

                                    _data.update('users', userPhone, userData, function (err) {
                                        if (!err) {
                                            callback(200, checkObject);
                                        } else {
                                            callback(500, { 'Error': 'Could not update the user with new check' });
                                        }
                                    });
                                } else {
                                    callback(500, { 'Error': 'Could not create new check' });
                                }
                            })
                        } else {
                            callback(400, { 'Error': 'User already has the max number of checks (' + config.maxChecks + ')' })
                        }
                    } else {
                        callback(403, { 'Error': 'Provided token did not correspond to real user' });
                    }
                })
            } else {
                callback(403)
            }
        });
    } else {
        callback(400, { 'Error': 'Missing input fields or input fields are invalid' });
    }
}

// Checks - get
// Required data - id,
// Optional data - none 
handlers._checks.get = function (data, callback) {
    // Check for valid phone number
    var id = typeof (data.queryStringObject.id == 'string') && data.queryStringObject.id && data.queryStringObject.id.length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        // Lookup the user by provided id
        _data.read('checks', id, function (err, checkData) {
            if (!err && checkData) {
                // Get the token from the headers
                var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
                // Verify that the given token is valid for the phone number
                handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
                    if (tokenIsValid) {
                        // Return the check data
                        callback(200, checkData);
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(404);
            }
        });

    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
}

// Checks - put
// Required data - id,
// Optional data - protocol, url, method, successCodes, timeoutSeconds 
handlers._checks.put = function (data, callback) {

    // Check for valid id
    var id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

    // Check for valid data
    var protocol = typeof (data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol.trim() : false;
    var url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false
    var method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method.trim() : false;
    var successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 0 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    // Check to make sure id is valid
    if (id) {
        // Check to make sure atleast one of the field is provided for update
        if (protocol || url || method || successCodes || timeoutSeconds) {
            // Lookup checks for the id
            _data.read('checks', id, function (err, checkData) {
                if (!err && checkData) {

                    // Get the token from the headers
                    var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
                    // Verify that the given token is valid for the phone number
                    handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
                        if (tokenIsValid) {
                            // Update the check data 
                            if (protocol) {
                                checkData.protocol = protocol
                            }
                            if (url) {
                                checkData.url = url
                            }
                            if (successCodes) {
                                checkData.successCodes = successCodes
                            }
                            if (method) {
                                checkData.method = method
                            }
                            if (timeoutSeconds) {
                                checkData.timeoutSeconds = timeoutSeconds
                            }

                            // Store the updated check
                            _data.update('checks', id, checkData, function (err) {
                                if (!err) {
                                    callback(200, checkData);
                                } else {
                                    callback(500, { 'Error': 'Could not update the check' });
                                }
                            })
                        } else {
                            callback(403);
                        }
                    });

                } else {
                    callback(400, { 'Error': 'check id does not exist' });
                }
            });

        } else {
            callback(400, { 'Error': 'Missing field to be updated' });
        }
    } else {
        callback(400, { 'Error': 'Missing required field, invalid id' });
    }



}

// Checks - delete
// Required data: id
// Optional data: none
handlers._checks.delete = function (data, callback) {
    // Check for valid phone number
    var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        //Lookup checks
        _data.read('checks', id, function (err, checkData) {
            if (!err && checkData) {
                // Get the token from the headers
                var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
                // Verify that the given token is valid for the phone number
                handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
                    if (tokenIsValid) {
                        // Delete the check data
                        _data.delete('checks', id, function (err) {
                            if (!err) {
                                // Look up the user
                                _data.read('users', checkData.userPhone, function (err, userData) {
                                    if (!err && userData) {
                                        // checks of the user
                                        var userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                                        // Remove the deleted check from the user list of checks
                                        var checksPosition = userChecks.indexOf(id);
                                        if (checksPosition > -1) {
                                            userChecks.splice(checksPosition, 1);
                                            // Re-save the user's data
                                            _data.update('users', checkData.userPhone, userData, function (err) {
                                                if (!err) {
                                                    callback(200)
                                                } else {
                                                    callback(500, {
                                                        'Error': 'Could not update the specified user'
                                                    });
                                                }
                                            });
                                        } else {
                                            callback(500, {
                                                'Error': 'Could find th echeck on the user object, so could not remove it'
                                            });
                                        }
                                    } else {
                                        callback(500, {
                                            'Error': 'Could not find the user who created the check, so could not delete the check from the user object'
                                        });
                                    }
                                });
                            } else {
                                callback(500, { 'Error': 'Could not delete the check' });
                            }
                        })
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(400, { 'Error': 'Missing required field, invalid id' });
            }
        })
    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
}

// Export the module
module.exports = handlers;