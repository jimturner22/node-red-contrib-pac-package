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
/**
 * Class for throttling messages associated with an external resource.
 * The owner of the queue can manage the relationship between its resource and the queue.
 * The SNAP PAC nodes need it so that we can control certain error conditions, and also not overwhelm a
 * slower controller when using HTTPS.
 */
var MessageQueue = (function () {
    function MessageQueue(maxLength) {
        // The queue, as an array.
        this.queue = [];
        // The current message.
        this.currentMessage = null;
        // Map of nodes (node.id) to message count.
        this.numMessagesPerNode = [];
        this.maxLength = maxLength;
    }
    /**
     * Empty the queue.
     */
    MessageQueue.prototype.dump = function () {
        this.queue = [];
    };
    /**
     * Returns the current message.
     */
    MessageQueue.prototype.getCurrentMessage = function () {
        return this.currentMessage;
    };
    /**
     * Adds a message for the given node.
     */
    MessageQueue.prototype.add = function (msg, node, inputEventObject, inputEventCallback) {
        if (this.queue.length >= this.maxLength) {
            return -1;
        }
        // Initialize and/or increment the count of messages for this node.
        this.numMessagesPerNode[node.id] = (this.numMessagesPerNode[node.id] || 0) + 1;
        var messageHolder = { msg: msg, node: node, inputEventObject: inputEventObject, inputEventCallback: inputEventCallback };
        // See if the message can be processed immediately.
        var messageSentImmediately = false;
        if (this.currentMessage === null) {
            messageSentImmediately = true;
            this.currentMessage = messageHolder;
            setImmediate(function () {
                inputEventCallback.call(inputEventObject, msg);
            });
        }
        else {
            this.queue.push(messageHolder);
        }
        // Return the remaining number of queued messages for this node, not including
        // the message that might have been sent immediately.
        // This will be 0 if the node was immediately processed.
        return this.numMessagesPerNode[node.id] - (messageSentImmediately ? 1 : 0);
    };
    /**
     *  Must be called by the node handler when it's done with the message.
     */
    MessageQueue.prototype.done = function (delay) {
        var node = this.currentMessage.node;
        this.numMessagesPerNode[node.id] = this.numMessagesPerNode[node.id] - 1;
        this.currentMessage = null;
        // See if there's another message to be handled.
        if (this.queue.length > 0) {
            var next = this.queue.shift();
            this.currentMessage = next;
            // TODO: setImmediate() or process.nextTick() might be better when delay === 0.
            setTimeout(function () {
                // Call the callback, on the given object and passing in the message.
                next.inputEventCallback.call(next.inputEventObject, next.msg);
            }, delay);
        }
        return this.numMessagesPerNode[node.id]; // return the remaining number of queued messages for this node
    };
    return MessageQueue;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MessageQueue;
//# sourceMappingURL=message-queue.js.map