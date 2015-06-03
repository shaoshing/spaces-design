/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

define(function (require, exports, module) {
    "use strict";

    var Fluxxor = require("fluxxor"),
        _ = require("lodash");

    var events = require("../events");

    /**
     * Empty store that simply emits change events when the history state changes.
     * Components can use this to cleanly reload or refresh their state on undo/redo.
     */
    var LibraryStore = Fluxxor.createStore({
        
        /**
         * @type {AdobeLibraryCollection}
         */
        _libraries: null,

        /**
         * @type {{id: Array.<Item>}}
         */
        _libraryItems: null,
        
        initialize: function () {
            this.bindActions(
                events.libraries.LIBRARIES_UPDATED, this._handleLibraryData,
                events.libraries.LIBRARY_PREPARED, this._handleLibraryPrepared
            );

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._libraries = [];
            this._libraryItems = {};
        },

        _handleLibraryData: function (payload) {
            this._libraries = payload.libraries;

            this.emit("change");
        },

        _handleLibraryPrepared: function (payload) {
            this._libraryItems[payload.library.id] = payload.elements;

            this.emit("change");
        },

        getLibraries: function () {
            return this._libraries;
        },

        getLibraryByID: function (id) {
            return _.find(this._libraries, "id", id);
        },

        getLibraryItems: function (id) {
            return this._libraryItems[id];
        }
    });

    module.exports = LibraryStore;
});
