/**
 *  Server-related tasks
 * 
 */

 

// Dependecies
var http = require('http');
var https = require('https');
var url = require('url');
var StringDecoder = require('string_decoder').StringDecoder;
var config = require('./config');
var fs = require('fs');
var handlers = require('./route-handlers');
var helpers = require('./helpers');
var path = require('path');
var util = require('util');
var debug = util.debuglog('server');

// Instiater the Server
var server = {};

// Instantiate HTTP server
server.httpServer = http.createServer(function(req, res) {
    server.unifiedServer(req,res);
});


// Instantiate HTTPS server
server.httpsServeroptions = {
    'key': fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    'cert': fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
}
server.httpsServer = https.createServer(server.httpsServeroptions, function(req, res) {
    server.unifiedServer(req,res);
});

server.unifiedServer = function(req, res) {
    // Get the URL and parse it
    var parsedUrl = url.parse(req.url, true);

    // Get the path
    var path = parsedUrl.pathname;
    var trimmedPath = path.replace(/\/+|\/+$/g, '');

    // Get the HTTP method
    var method = req.method.toLowerCase();

    // Get query string as an object
    var queryStringObject = parsedUrl.query

    // Get the headers as an object
    var headers = req.headers;

    // Get the payload, if any 
    var decoder = new StringDecoder('utf-8');
    // payload are sent as streams so we need to accumlate it 
    var buffer = '';

    req.on('data', function(data) { // event called only when payload is present
        buffer += decoder.write(data)
    });

    req.on('end', function() { // event called all the time when payload is present or not
        buffer += decoder.end();

        // Chose the handler this request should go to. If one is not found should use the notFound handler
        var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

        // Construct the data object to send to the handler
        var data = {
            'trimmedPath': trimmedPath,
            'queryStringObject': queryStringObject,
            'method': method,
            'headers': headers,
            'payload': helpers.parseJsonToObject(buffer)
        }

        // Route the request to the handler specified in the router
        chosenHandler(data, function(statusCode, payload, contentType) {

            // Determine the content type
            contentType = typeof(contentType) == 'string' ? contentType : 'json'

            // Use the status code called back by the handler, or deffault to 200
            statusCode = typeof(statusCode) === 'number' ? statusCode : 200;

            
            var payloadString = '';

            if(contentType == 'json') {
                // Return the response
                res.setHeader('Content-Type', 'application/json');

                // Use the payload callled back by the handler, or default to an empty object
                payload = typeof(payload) === 'object' ? payload : {};

                // Convert the object payload to a string to send the user
                payloadString = JSON.stringify(payload);
            }

            if(contentType  == 'html') {
                 // Return the response
                 res.setHeader('Content-Type', 'text/html');

                 // Use the payload called back by the handler, or default to an empty string
                 payloadString = typeof(payload) === 'string' ? payload : '';
            }

            // Return response part which are common  to all content-types
            res.writeHead(statusCode);
            res.end(payloadString);

            // Log the response in green for success and red on failure
            if([200,201].indexOf(statusCode) > -1){
                debug('\x1b[32m%s\x1b[0m',method.toUpperCase()+' /'+trimmedPath+' '+ statusCode);
            } else {
                debug('\x1b[31m%s\x1b[0m',method.toUpperCase()+' /'+trimmedPath+' '+ statusCode);
            }
            
        });
    });
    // Get the payload, if any 
}

// Define the request router
server.router = {
    '': handlers.index,
    'account/create': handlers.accountCreate,
    'acount/edit': handlers.accountEdit,
    'account/delete': handlers.accountDelete,
    'session/create': handlers.sessionCreate,
    'session/delete': handlers.sessionDelete,
    'checks/all': handlers.checkList,
    'chedks/create': handlers.checksCreate,
    'checks/edit': handlers.checksEdit,
    'ping': handlers.ping,
    'users': handlers.users,
    'tokens': handlers.tokens,
    'checks': handlers.checks
}

server.init = function() {
    
    // Start the HTTP server
    server.httpServer.listen(config.httpPort, function() {
        console.log('\x1b[35m%s\x1b[0m', 'Server is listening on port ' + config.httpPort);
    });

    // Start HTTPS server
    server.httpsServer.listen(config.httpsPort, function() {
        console.log('\x1b[36m%s\x1b[0m', 'Server is listening on port ' + config.httpsPort);
    });

}

// Export the server
module.exports = server;