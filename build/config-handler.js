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
Object.defineProperty(exports, "__esModule", { value: true });
var ApiExLib = require("./api-ex");
var message_queue_1 = require("./message-queue");
var fs = require("fs");
var path = require("path");
var RED;
function setRED(globalRED) {
    RED = globalRED;
}
exports.setRED = setRED;
/**
 * Called by Node-RED to create a 'pac-device' node.
 */
function createSnapPacDeviceNode(config) {
    // Create the node. This will also return the credential information attached to 'this'.
    RED.nodes.createNode(this, config);
    var address = config.address;
    var protocol = config.protocol.toLowerCase();
    var useHttps = protocol !== 'http'; // default to HTTPS unless HTTP is specified.
    var isLocalhost = address === 'localhost';
    var key = this.credentials.key;
    var secret = this.credentials.secret;
    var publicCertPath = this.credentials.publicCertPath;
    var caCertPath = this.credentials.caCertPath;
    // Make sure we have values and that they're clean enough to continue.
    key = key ? key : '';
    secret = secret ? secret : '';
    publicCertPath = publicCertPath ? publicCertPath.trim() : '';
    caCertPath = caCertPath ? caCertPath.trim() : '';
    var publicCertFile;
    var caCertFile;
    if (key === '' || secret === '') {
        RED.log.error('Missing API key for ' + address);
    }
    if (useHttps && !isLocalhost) {
        if (caCertPath.length === 0) {
            RED.log.error('Missing SSL CA certificate for ' + address);
        }
        try {
            publicCertFile = getCertFile(publicCertPath);
            caCertFile = getCertFile(caCertPath);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                RED.log.error('Cannot open certifcate file at \'' + err.path + '\'.');
            }
            else if (err.code === 'EACCES') {
                RED.log.error('Cannot open certifcate file at \'' + err.path + '\' due to file permissions.');
            }
            else {
                RED.log.error(err);
            }
        }
    }
    var ctrl = exports.controllerConnections.createControllerConnection(address, useHttps, key, secret, publicCertFile, caCertFile, config.id, false);
    this.on('close', function () {
        ctrl.queue.dump(); // dump all but the current in-progress message for this connection.
    });
}
exports.createSnapPacDeviceNode = createSnapPacDeviceNode;
function getCertFile(certPath) {
    if (certPath && certPath.length > 0) {
        // See if we have an absolute or relative path
        if (!path.isAbsolute(certPath)) {
            // For relative paths, start from Node-RED's userDir + "/certs".
            certPath = path.join(RED.settings.userDir, 'certs', certPath);
        }
        return fs.readFileSync(certPath);
    }
}
// Holder for controller connections and message queues.
var ControllerConnection = /** @class */ (function () {
    function ControllerConnection(ctrl, queue) {
        this.ctrl = ctrl;
        this.queue = queue;
    }
    return ControllerConnection;
}());
var ControllerConnections = /** @class */ (function () {
    function ControllerConnections() {
        this.controllerCache = [];
    }
    ControllerConnections.prototype.createControllerConnection = function (address, useHttps, key, secret, publicCertFile, caCertFile, id, testing) {
        var scheme = useHttps ? 'https' : 'http';
        var fullAddress = scheme + '://' + address;
        // Create the connection to the controller.
        var ctrl = new ApiExLib.ControllerApiEx(key, secret, fullAddress, address, useHttps, publicCertFile, caCertFile, testing);
        // Cache it, using the Configuration node's id property.
        this.controllerCache[id] = new ControllerConnection(ctrl, new message_queue_1.default(500));
        return this.controllerCache[id];
    };
    ControllerConnections.prototype.getController = function (id) {
        return this.controllerCache[id];
    };
    return ControllerConnections;
}());
exports.ControllerConnections = ControllerConnections;
// Global cache of controller connections.
exports.controllerConnections = new ControllerConnections();
//# sourceMappingURL=config-handler.js.map