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

    var Fluxxor = require("fluxxor");

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
        
        initialize: function () {
            this.bindActions(
                events.libraries.FAKE_DATA, this._handleFakeData
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
        },

        _handleFakeData: function () {
            var libraryOne = {
                    name: "Test Library 1",
                    id: "00001",
                    elements: []
                },
                libraryTwo = {
                    name: "Test Library 2",
                    id: "00002",
                    elements: []
                },
                itemsOne = [
                    {
                        type: "color",
                        name: "Red",
                        representations: ["application/vnd.adobe.element.color+dcx"],
                        library: libraryOne
                    },
                    {
                        type: "color",
                        name: "Green",
                        representations: ["application/vnd.adobe.element.color+dcx"],
                        library: libraryOne
                    },
                    {
                        type: "textstyle",
                        name: "Windings",
                        representations: ["application/vnd.adobe.element.characterstyle+dcx"],
                        library: libraryOne
                    }
                ],
                itemsTwo = [
                    {
                        type: "color",
                        name: "Green",
                        representations: ["application/vnd.adobe.element.color+dcx"],
                        library: libraryTwo
                    },
                    {
                        type: "brush",
                        name: "Bristles",
                        representations: ["application/vnd.adobe.element.brush+dcx"],
                        library: libraryTwo
                    },
                    {
                        type: "image",
                        name: "The Moon",
                        representations: ["application/vnd.adobe.element.image+dcx"],
                        library: libraryTwo
                    }
                ];

            libraryOne.elements = itemsOne;
            libraryTwo.elements = itemsTwo;


            this.libraries = [libraryOne, libraryTwo];
            this.emit("change");
        }
    });

    module.exports = LibraryStore;
});
