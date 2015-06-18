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
        CCLibraries = require("ccLibraries");

    var descriptor = require("adapter/ps/descriptor"),
        libraryAdapter = require("adapter/lib/libraries");

    var events = require("../events"),
        locks = require("../locks");

    // var _accessToken = null,
    //     _userGUID = null;

    var createElementFromSelectedLayer = function () {
        var appStore = this.flux.store("application"),
            libStore = this.flux.store("library"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary(),
            currentLayers = currentDocument.layers.selected;

        if (currentLayers.count() !== 1) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.first(),
            IMAGE_ELEMENT_TYPE = "application/vnd.adobe.element.image+dcx",
            REPRESENTATION_TYPE = "image/vnd.adobe.photoshop";

        
        currentLibrary.beginOperation();

        var newElement = currentLibrary.createElement(currentLayer.name, IMAGE_ELEMENT_TYPE),
            representation = newElement.createRepresentation(REPRESENTATION_TYPE, "primary");

        var exportObj = libraryAdapter.exportLayer("/tmp/", "/tmp/preview.png", currentLayer.name);

        return descriptor.playObject(exportObj)
            .then(function (saveData) {
                var path = saveData.in._path;

                return Promise.fromNode(function (cb) {
                    representation.updateContentFromPath(path, false, cb);
                });
            })
            .finally(function () {
                currentLibrary.endOperation();
            });
    };
    createElementFromSelectedLayer.reads = [locks.JS_DOC];
    createElementFromSelectedLayer.writes = [];

    /**
     * Given a library instance, will prepare the elements of the library
     * in a way we can use them in LibraryPanel
     *
     * For now, we grab: name, type, displayName, reference, and rendition path
     *
     * Because rendition path is async, we need this as an action
     *
     * @param {number} id ID of library to prepare
     *
     * @return {Immutable.List<Object>} [description]
     */
    var prepareLibrary = function (id) {
        var library = this.flux.store("library").getLibraryByID(id);

        if (!library) {
            return Promise.reject();
        }

        var payload = {
                library: library,
                elements: []
            };

        if (library.elements.length === 0) {
            return this.dispatchAsync(events.libraries.LIBRARY_PREPARED, payload);
        }

        var firstItem = library.elements[0],
            getRenditionAsync = Promise.promisify(firstItem.getRenditionPath);
        
        return Promise.map(library.elements, function (element) {
            return getRenditionAsync.call(element, 40)
                .then(function (renditionPath) {
                    return {
                        name: element.name,
                        type: element.type,
                        displayName: element.displayName,
                        reference: element.getReference(),
                        renditionPath: renditionPath
                    };
                });
        }).bind(this).then(function (itemList) {
            payload.elements = itemList;
            return this.dispatchAsync(events.libraries.LIBRARY_PREPARED, payload);
        });
    };
    prepareLibrary.reads = [];
    prepareLibrary.writes = [];

    var beforeStartup = function () {
        var dependencies = {
            vulcanCall: function (requestType, requestPayload, responseType, callback) {
                // FIXME: Eventually we need to acquire the actual port, preferably exporting it through PS
                callback(JSON.stringify({ port: 12666 }));
            }
        };

        // SHARED_LOCAL_STORAGE flag forces websocket use
        CCLibraries.configure(dependencies, {
            SHARED_LOCAL_STORAGE: true
        });

        return Promise.resolve();
        
        // Currently unused
        // return descriptor.getProperty("application", "designSpaceLibrariesIMSInfo")
        //     .then(function (imsStatus) {
        //         _accessToken = imsStatus.imsAccessToken;
        //         _userGUID = imsStatus.user;
        //     });
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [locks.JS_LIBRARIES];

    /**
     * After startup, load the libraries
     * 
     * @return {Promise}
     */
    var afterStartup = function () {
        var libraryCollection = CCLibraries.getLoadedCollections();

        if (!libraryCollection || !libraryCollection[0]) {
            return this.dispatchAsync(events.libraries.CONNECTION_FAILED);
        }

        // FIXME: Do we eventually need to handle other collections?
        var payload = {
            libraries: libraryCollection[0].libraries
        };
        return this.dispatchAsync(events.libraries.LIBRARIES_UPDATED, payload);
    };
    afterStartup.reads = [locks.JS_LIBRARIES];
    afterStartup.writes = [locks.JS_LIBRARIES];

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.prepareLibrary = prepareLibrary;

    exports.createElementFromSelectedLayer = createElementFromSelectedLayer;
});
