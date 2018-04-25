"use strict";
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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var ApiLib = require("./api");
var http = require("http");
var https = require("https");
var ControllerApi = ApiLib.AllApi;
var pathForSnap = '/api/v1';
var pathForEpic = '/pac';
// The TypeScript client generated with swagger-codegen does not allow us to add our own
// options to the Request library. However, there is an empty and useless default 
// authentication field which we can override and use it as a general extension point.
var RequestOptionsModifier = /** @class */ (function () {
    function RequestOptionsModifier(publicCertFile, caCertFile, agent, https, isLocalhost, testing) {
        this.publicCertFile = publicCertFile;
        this.caCertFile = caCertFile;
        this.agent = agent;
        this.https = https;
        this.isLocalhost = isLocalhost;
        this.testing = testing;
    }
    RequestOptionsModifier.prototype.applyToRequest = function (requestOptions) {
        if (this.https) {
            // Add the required options. Wish there was a more official way to do this.
            // An alternative is to customize the template used by the swagger-codegen tool.
            // This is good enough for now.
            if (this.publicCertFile) {
                requestOptions.cert = this.publicCertFile;
            }
            if (this.caCertFile) {
                requestOptions.ca = this.caCertFile;
            }
            // Local connections do not require certificates for HTTPS.
            // When testing, ignore HTTPS errors.
            if ((!this.publicCertFile && !this.caCertFile && this.isLocalhost) || this.testing) {
                requestOptions.rejectUnauthorized = false;
            }
            requestOptions.port = 443;
        }
        else {
            requestOptions.port = 80;
        }
        requestOptions.forever = true;
        requestOptions.agent = this.agent;
        requestOptions.timeout = 30000;
    };
    return RequestOptionsModifier;
}());
var ControllerApiEx = /** @class */ (function (_super) {
    __extends(ControllerApiEx, _super);
    function ControllerApiEx(username, password, fullAddress, address, https, publicCertFile, caCertFile, testing) {
        var _this = 
        // Assume that the target is SNAP ("/api/v1"), not EPIC ("/pac").
        _super.call(this, username, password, fullAddress + pathForSnap) || this;
        _this.originalFullAddress = fullAddress;
        _this.hasDeterminedSystemType = false;
        _this.isTargetSnap = false;
        _this.isTargetEpic = false;
        _this.apiKeyId = username;
        _this.apiKeyValue = password;
        _this.origApiKeyId = username;
        _this.origApiKeyValue = password;
        _this.https = https;
        _this.publicCertFile = publicCertFile;
        _this.caCertFile = caCertFile;
        _this.testing = testing;
        if (address.trim().toLowerCase() === 'localhost') {
            _this.isLocalHost = true;
        }
        _this.replaceDefaultAuthWithCustomRequestOptions();
        return _this;
    }
    // The TypeScript client generated with swagger-codegen does not allow us to add our own
    // options to the Request library. However, there is an empty and useless default 
    // authentication field which we can override and use it as a general extension point.
    ControllerApiEx.prototype.replaceDefaultAuthWithCustomRequestOptions = function () {
        if (this.https) {
            var httpsAgent = new https.Agent({
                keepAlive: true,
                maxSockets: 1 // might not be needed anymore, since we now use MessageQueue.
            });
            // Cast from the HTTPS to the HTTP agent. The node.d.ts typing file doesn't define
            // https.Agent as being derived from http.Agent.
            this.httpAgent = httpsAgent;
            // Replace the default authentication handler.
            this.authentications.default = new RequestOptionsModifier(this.publicCertFile, this.caCertFile, httpsAgent, this.https, this.isLocalHost, this.testing);
        }
        else {
            var httpAgent = new http.Agent({
                keepAlive: true,
                maxSockets: 1 // might not be needed anymore, since we now use MessageQueue.
            });
            this.httpAgent = httpAgent;
            // Replace the default authentication handler.
            this.authentications.default = new RequestOptionsModifier(null, null, httpAgent, this.https, this.isLocalHost, this.testing);
        }
    };
    ControllerApiEx.prototype.setToSnap = function () {
        this.basePath = this.originalFullAddress + pathForSnap;
        this.apiKeyId = this.origApiKeyId;
        delete this.defaultHeaders.apiKey;
    };
    ControllerApiEx.prototype.setToGroov = function () {
        this.basePath = this.originalFullAddress + pathForEpic;
        this.apiKeyId = 'groov-epic-pac-skip-reqoptions-auth';
        this.defaultHeaders['apiKey'] = this.apiKeyValue;
    };
    /**
     * Determines the type of control engine we're communicating with.
     * First tries the SNAP PAC method, and then Groov EPIC method.
     * Both might fail, since the device may be unreachable.
     * Once determined, the type is cached.
     */
    ControllerApiEx.prototype.getDeviceType = function (node, callback) {
        var _this = this;
        if (this.hasDeterminedSystemType) {
            process.nextTick(callback);
        }
        else {
            if (node) {
                node.status({ fill: "green", shape: "ring", text: 'determining device type' });
            }
            // console.log('getDeviceType: Determining server type');
            this.readDeviceDetails()
                .then(function (fullfilledResponse) {
                if (fullfilledResponse.body && fullfilledResponse.body.controllerType) {
                    _this.isTargetSnap = true;
                    _this.hasDeterminedSystemType = true;
                    // console.log('getDeviceType: Determined server type is SNAP');
                    callback();
                }
                else {
                    // Try the Groov EPIC path
                    _this.setToGroov();
                    // console.log('getDeviceType: Trying Groov style of server 1');
                    // See if Groov EPIC works
                    _this.readDeviceDetails()
                        .then(function (fullfilledResponse) {
                        // console.log('getDeviceType: Got a response (1). ' + fullfilledResponse.response.statusCode);
                        if (fullfilledResponse.body && fullfilledResponse.body.controllerType) {
                            _this.isTargetEpic = true;
                            _this.hasDeterminedSystemType = true;
                            // console.log('getDeviceType: Determined server type is Groov 1');
                            callback();
                        }
                        else {
                            _this.setToSnap(); // Reset to default
                            // console.log('getDeviceType: Resetting to SNAP 1');
                            callback(); // error ?
                        }
                    })
                        .catch(function (error) {
                        _this.setToSnap(); // Reset to default
                        // console.log('getDeviceType: Caught an error (1). ' + error.message);
                        // console.log('getDeviceType: Resetting to SNAP 2.');
                        // Neither worked.
                        callback(error);
                    });
                }
            })
                .catch(function (error) {
                // console.log('getDeviceType: Caught an error (2). ' + error.message);
                // For certain errors, don't even continue.
                if (error && (error.code == 'ETIMEDOUT' || error.code == 'ENETUNREACH')) {
                    // console.log('getDeviceType: done trying after error.');
                    // We're done. No reason to try again.
                    callback(error);
                    return;
                }
                // Try the EPIC path
                _this.setToGroov();
                // console.log('getDeviceType: Trying Groov style of server 2');
                // See if Groov EPIC works
                _this.readDeviceDetails()
                    .then(function (fullfilledResponse) {
                    // console.log('getDeviceType: Got a response (2). ' + fullfilledResponse.response.statusCode);
                    if (fullfilledResponse.body && fullfilledResponse.body.controllerType) {
                        _this.isTargetEpic = true;
                        _this.hasDeterminedSystemType = true;
                        // console.log('getDeviceType: Determined server type is Groov 2');
                        callback();
                    }
                    else {
                        // Reset to SNAP
                        _this.setToSnap();
                        // console.log('getDeviceType: Resetting to SNAP 3.');
                        callback(); // error ?
                    }
                })
                    .catch(function (error) {
                    // console.log('getDeviceType: Caught an error (3). ' + error.message);
                    _this.setToSnap(); // Reset to SNAP
                    // Neither worked.
                    callback(error);
                });
            });
        }
    };
    ControllerApiEx.prototype.hasConfigError = function () {
        if (this.configError === undefined) {
            // Check for bad API keys
            if (!this.apiKeyValue) {
                this.configError = true; // Bad API key ID or Value
            }
            else if (this.https === true) {
                if (!this.testing) {
                    // Make sure we have at least a CA certificate file, which also covers self-signed certs.
                    if (!this.isLocalHost) {
                        if (!this.caCertFile) {
                            this.configError = true;
                        }
                    }
                }
            }
            else {
                this.configError = false;
            }
        }
        return this.configError;
    };
    return ControllerApiEx;
}(ControllerApi));
exports.ControllerApiEx = ControllerApiEx;
//# sourceMappingURL=api-ex.js.map