/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

define(function (require, exports) {
    "use strict";

    var Promise = require("bluebird"),
        CCLibraries = require("file://shared/libs/cc-libraries-api.min.js"),
        descriptor = require("adapter/ps/descriptor");

    var events = require("../events"),
        libraries = Promise.promisifyAll(CCLibraries);

    var _accessToken = null;

    var getAccessToken = function (callback) {
        if (_accessToken) {
            callback(null, _accessToken);
        } else {
            throw new Error("Access token not ready");
        }
    };

    var beforeStartup = function () {
        var dependencies = {
            vulcanCall: function (requestType, requestPayload, responseType, callback) {
                debugger;
            }
        };

        CCLibraries.configure({}, {
            STORAGE_API_KEY: "CreativeCloudWeb1"
        });

        return descriptor.getProperty("application", "imsStatus")
            .then(function (imsStatus) {
                _accessToken = imsStatus._value.imsAccessToken;
            })
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [];

    /**
     * After startup, load the libraries
     * 
     * @return {Promise}
     */
    var afterStartup = function () {
        var options = {
            STORAGE_HOSTNAME: "cc-api-storage-stage.adobe.io",
            WAIT_FOR: "all",
            getAccessToken: getAccessToken
        };
        
        return libraries.loadLibraryCollectionAsync(options)
            .bind(this)
            .then(function (libraryCollection) {
                // Print out the names of all the libraries:
                var payload = {
                    libraries: libraryCollection.libraries
                };
                this.dispatch(events.libraries.LIBRARIES_UPDATED, payload);
            });
    };
    afterStartup.reads = [];
    afterStartup.writes = [];

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
});
