/*
   Copyright 2016 Opto 22

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
"use strict";
var ErrorDetails = (function () {
    function ErrorDetails(nodeShortErrorMsg, logLongErrorMsg) {
        this.nodeShortErrorMsg = nodeShortErrorMsg;
        this.logLongErrorMsg = logLongErrorMsg;
    }
    return ErrorDetails;
}());
exports.ErrorDetails = ErrorDetails;
/**
 * Handler for HTTP response errors.
 */
var ResponseErrorMessages = (function () {
    function ResponseErrorMessages() {
    }
    /**
     * Returns textual descriptions of the given error.
     */
    ResponseErrorMessages.getErrorMsg = function (error) {
        var shortError = 'Error';
        var longError = 'Error';
        if (error.code !== undefined) {
            shortError = ResponseErrorMessages.errors[error.code];
            // Format the errors nicely, depending upon whether or not we have a description of the error code.
            if (shortError === undefined) {
                shortError = error.code;
                longError = 'Error code: ' + error.code;
            }
            else {
                longError = shortError + '. Error code: ' + error.code;
            }
            // See if there's a syscall property to tag on. It might be helpfull.
            if (error.syscall !== undefined) {
                longError = longError + ' from system call "' + error.syscall + '"';
            }
        }
        else if (error.reason !== undefined) {
            shortError = error.reason;
            longError = 'Error : ' + error.reason;
        }
        return new ErrorDetails(shortError, longError);
    };
    // Some common errors, with very short descriptions.
    // These will be visible underneath the node.
    // Some are socket errors, while others are SSL x509 errors.
    // Many Node.js errors are created with util._errnoException(), so there's code, errno, and syscall properties.
    // Node.js's handling of x509 errors is in https://github.com/nodejs/node/blob/master/src/node_crypto.cc
    // A list of x509 error descriptions it at https://www.openssl.org/docs/manmaster/crypto/X509_STORE_CTX_get_error.html
    ResponseErrorMessages.errors = {
        // Socket errors
        'ECONNREFUSED': 'Connection refused',
        'ETIMEDOUT': 'Timeout',
        'EHOSTUNREACH': 'PAC unreachable',
        'ENOTFOUND': 'Address not found',
        'EINVAL': 'Invalid argument',
        'EAI_AGAIN': 'Address not found',
        // SSL errors
        'DEPTH_ZERO_SELF_SIGNED_CERT': 'Problem with the security certificate',
    };
    return ResponseErrorMessages;
}());
/**
 * Handler for errors coming from the PAC.
 */
var PacErrorMessages = (function () {
    function PacErrorMessages() {
    }
    PacErrorMessages.getPacErrorMsg = function (error) {
        var shortError = PacErrorMessages.errors[error.errorCode];
        if (shortError === undefined) {
            // Some of the messages include too much for us here, like a comment to look in the user manual.
            // Just take up to the first period character. This is a bit risky and might not work out.
            var trimmedMessage = error.message.split('.')[0] + '.';
            shortError = 'PAC error ' + error.errorCode + '. ' + trimmedMessage;
        }
        var longError = 'PAC response error : ' + error.errorCode + '. ' + error.message;
        return new ErrorDetails(shortError, longError);
    };
    // Some common errors, with very short descriptions.
    // These will be visible underneath the node.
    PacErrorMessages.errors = {
        '-28': 'Tag undefined',
        '-8': 'Invalid data',
        '-1': 'No strategy in PAC',
        '-12': 'Invalid table index',
        '-17': 'PAC busy',
        '-20': 'PAC busy',
        '-109': 'Read-only permission'
    };
    return PacErrorMessages;
}());
/**
 * Handler for HTTP Status codes.
 */
var StatusCodeMessages = (function () {
    function StatusCodeMessages() {
    }
    StatusCodeMessages.getErrorMsg = function (statusCode) {
        var shortError = StatusCodeMessages.errors[statusCode];
        if (shortError === undefined) {
            shortError = 'Status code ' + statusCode;
        }
        var longError = shortError + '. HTTP response error : ' + statusCode;
        return new ErrorDetails(shortError, longError);
    };
    // Some common errors, with very short descriptions.
    // These will be visible underneath the node.
    StatusCodeMessages.errors = {
        '400': 'Bad request',
        '401': 'Bad API key',
        '404': 'Not found',
    };
    return StatusCodeMessages;
}());
/**
 * Hanldes errors for the given message and node.
 */
function handleErrorResponse(error, msg, node) {
    var errorDetails;
    if (error !== undefined) {
        // Map the error type to the appropriate handler.
        if (error.response !== undefined) {
            if (error.response.body.errorCode !== undefined) {
                errorDetails = PacErrorMessages.getPacErrorMsg(error.response.body);
            }
            else {
                errorDetails = StatusCodeMessages.getErrorMsg(error.response.statusCode);
            }
            // Add some error info to the message.
            msg.pacError = {
                statusCode: error.response.statusCode,
                body: error.response.body
            };
        }
        else {
            // There's no response, so this is probably a ETIMEDOUT or connection error.
            errorDetails = ResponseErrorMessages.getErrorMsg(error);
            // Add some error info to the message.
            msg.reqError = error;
        }
    }
    // Update the node's status.
    node.status({ fill: "red", shape: "dot", text: errorDetails.nodeShortErrorMsg });
    // Announce the error and move on.
    node.error(errorDetails.logLongErrorMsg, msg);
}
exports.handleErrorResponse = handleErrorResponse;
//# sourceMappingURL=error-handling.js.map