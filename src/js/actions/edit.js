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
        Immutable = require("immutable");

    var os = require("adapter").os;

    var events = require("../events"),
        locks = require("../locks"),
        layers = require("../actions/layers"),
        collection = require("../util/collection"),
        headlights = require("../util/headlights"),
        history = require("../actions/history");

    /**
     * Native menu command IDs for Photoshop edit commands.
     * 
     * @const     
     * @private
     * @type {number}
     */
    var CUT_NATIVE_MENU_COMMMAND_ID = 103,
        COPY_NATIVE_MENU_COMMMAND_ID = 104,
        PASTE_NATIVE_MENU_COMMMAND_ID = 105,
        SELECT_ALL_NATIVE_MENU_COMMMAND_ID = 1017;

    var LAYER_CLIPBOARD_FORMAT = "com.adobe.photoshop.spaces.design.layers";

    /**
     * Determines whether the given element is an HTML input element.
     * 
     * @private
     * @param {HTMLElement} el
     * @return boolean
     */
    var _isInput = function (el) {
        return el instanceof window.HTMLInputElement;
    };

    /**
     * Determines whether the given input element is a textual element.
     * 
     * @private
     * @param {HTMLInputElement} el
     * @return boolean
     */
    var _isTextInput = function (el) {
        switch (el.type) {
            case "text":
            case "search":
            case "url":
            case "tel":
            case "password":
                return true;
            default:
                return false;
        }
    };

    /**
     * Execute a native cut command.
     *
     * @private
     * @return {Promise}
     */
    var nativeCutCommand = function () {
        return this.flux.actions.menu.nativeModal({
            commandID: CUT_NATIVE_MENU_COMMMAND_ID
        });
    };

    /**
     * Execute a native copy command.
     *
     * @private
     * @return {Promise}
     */
    var nativeCopyCommand = function () {
        return this.flux.actions.menu.nativeModal({
            commandID: COPY_NATIVE_MENU_COMMMAND_ID
        });
    };

    /**
     * Execute a native paste command.
     *
     * @private
     * @return {Promise}
     */
    var nativePasteCommand = function () {
        return this.flux.actions.menu.nativeModal({
            commandID: PASTE_NATIVE_MENU_COMMMAND_ID
        });
    };

    /**
     * Execute a native selectAll command.
     *
     * @private
     * @param {boolean} waitForCompletion Flag for nativeModal
     * @return {Promise}
     */
    var nativeSelectAllCommand = function (waitForCompletion) {
        waitForCompletion = waitForCompletion || false;

        return this.flux.actions.menu.nativeModal({
            commandID: SELECT_ALL_NATIVE_MENU_COMMMAND_ID,
            waitForCompletion: waitForCompletion
        });
    };

    /**
     * Execute either a cut or copy operation, depending on the value of the parameter.
     *
     * @private
     * @param {boolean} cut If true, perform a cut operation; otherwise, a copy.
     * @return {Promise}
     */
    var _cutOrCopyCommand = function (cut) {
        return os.hasKeyboardFocus()
            .bind(this)
            .then(function (cefHasFocus) {
                var el = window.document.activeElement,
                    data;

                if (cefHasFocus && _isInput(el)) {
                    if (_isTextInput(el)) {
                        data = el.value.substring(el.selectionStart, el.selectionEnd);
                        if (cut) {
                            el.setRangeText("");
                        }
                    } else {
                        data = el.value;
                    }
                } else {
                    // Even if CEF doesn't have focus, a disabled input could have a selection
                    var selection = window.document.getSelection();
                    if (selection.type === "Range") {
                        data = selection.toString();
                    }
                }

                if (typeof data === "string") {
                    var cutCopyEvent = new window.Event(cut ? "cut" : "copy", { bubbles: true });
                    el.dispatchEvent(cutCopyEvent);

                    return os.clipboardWrite(data);
                }

                // If we're on modal state (type edit), we should go with native copy/cut
                if (this.flux.store("tool").getModalToolState()) {
                    if (cut) {
                        this.flux.actions.edit.nativeCut();
                    } else {
                        this.flux.actions.edit.nativeCopy();
                    }
                } else if (!cut) {
                    var applicationStore = this.flux.store("application"),
                        document = applicationStore.getCurrentDocument();

                    if (!document || document.unsupported) {
                        return;
                    }

                    var layerIDs = collection.pluck(document.layers.selectedNormalized, "id"),
                        payload = {
                            document: document.id,
                            layers: layerIDs
                        },
                        rawPayload = JSON.stringify(payload);

                    headlights.logEvent("edit", "layers", "copy_layers");
                    return os.clipboardWrite(rawPayload, LAYER_CLIPBOARD_FORMAT);
                }
            });
    };

    /**
     * Execute a cut operation on the currently active HTML element.
     *
     * @private
     * @return {Promise}
     */
    var cutCommand = function () {
        return _cutOrCopyCommand.call(this, true);
    };

    /**
     * Execute a copy operation on the currently active HTML element.
     *
     * @private
     * @return {Promise}
     */
    var copyCommand = function () {
        return _cutOrCopyCommand.call(this, false);
    };

    /**
     * Execute a paste operation on the currently active HTML element.
     *
     * @private
     * @return {Promise}
     */
    var pasteCommand = function () {
        return os.hasKeyboardFocus()
            .bind(this)
            .then(function (cefHasFocus) {
                var el = window.document.activeElement;
                if (cefHasFocus && _isInput(el)) {
                    return os.clipboardRead()
                        .then(function (result) {
                            var data = result.data,
                                format = result.format;

                            if (format !== "string") {
                                return;
                            }

                            if (_isTextInput(el)) {
                                var selectionStart = el.selectionStart;
                                el.setRangeText(data);
                                el.setSelectionRange(selectionStart + data.length, selectionStart + data.length);
                            } else {
                                el.value = data;
                            }

                            var pasteEvent = new window.Event("paste", { bubbles: true });
                            el.dispatchEvent(pasteEvent);
                        });
                } else {
                    return os.clipboardRead([LAYER_CLIPBOARD_FORMAT])
                        .bind(this)
                        .then(function (result) {
                            var format = result.format;
                            if (format !== LAYER_CLIPBOARD_FORMAT) {
                                this.flux.actions.edit.nativePaste();
                                return Promise.resolve();
                            }

                            var applicationStore = this.flux.store("application"),
                                document = applicationStore.getCurrentDocument();

                            if (!document || document.unsupported) {
                                return;
                            }

                            var data = result.data,
                                payload = JSON.parse(data),
                                documentID = payload.document,
                                documentStore = this.flux.store("document"),
                                fromDocument = documentStore.getDocument(documentID);

                            if (!fromDocument || fromDocument.unsupported) {
                                return;
                            }

                            var layerIDs = payload.layers,
                                fromLayers = Immutable.List(layerIDs.reduce(function (layers, layerID) {
                                    var layer = fromDocument.layers.byID(layerID);
                                    if (layer) {
                                        layers.push(layer);
                                    }
                                    return layers;
                                }, []));

                            headlights.logEvent("edit", "layers", "paste_layers");
                            return this.transfer(layers.duplicate, document, fromDocument, fromLayers);
                        });
                }
            });
    };

    /**
     * Execute a select operation on the currently active HTML element.
     *
     * @private
     * @return {Promise}
     */
    var selectAllCommand = function () {
        return os.hasKeyboardFocus()
            .bind(this)
            .then(function (cefHasFocus) {
                var el = window.document.activeElement;
                if (cefHasFocus && _isInput(el)) {
                    if (_isTextInput(el)) {
                        el.setSelectionRange(0, el.value.length);
                    }
                } else {
                    var toolStore = this.flux.store("tool");
                    if (toolStore.getModalToolState()) {
                        this.flux.actions.edit.nativeSelectAll();
                    } else {
                        this.flux.actions.layers.selectAll();
                    }
                }
            });
    };

    /**
     * Step Backwards by transferring to the appropriate history action
     *
     * @private
     * @return {Promise}
     */
    var undoCommand = function () {
        var currentDocument = this.flux.store("application").getCurrentDocument();
        if (!currentDocument) {
            return Promise.resolve();
        } else {
            return Promise.join(
                this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false }),
                this.transfer(history.decrementHistory, currentDocument),
                function () {
                    return this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: true });
                }.bind(this));
        }
    };

    /**
     * Step Forward by transferring to the appropriate history action
     *
     * @private
     * @return {Promise}
     */
    var redoCommand = function () {
        var currentDocument = this.flux.store("application").getCurrentDocument();
        if (!currentDocument) {
            return Promise.resolve();
        } else {
            return Promise.join(
                this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: false }),
                this.transfer(history.incrementHistory, currentDocument),
                function () {
                    return this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: true });
                }.bind(this));
        }
    };


    /**
     * @type {Action}
     */
    var cut = {
        command: cutCommand,
        modal: true,
        reads: [],
        writes: [locks.JS_DOC, locks.PS_DOC]
    };

    /**
     * @type {Action}
     */
    var copy = {
        command: copyCommand,
        modal: true,
        reads: [locks.JS_DOC],
        writes: []
    };

    /**
     * @type {Action}
     */
    var paste = {
        command: pasteCommand,
        modal: true,
        reads: [],
        writes: [locks.JS_DOC, locks.PS_DOC]
    };

    /**
     * @type {Action}
     */
    var selectAll = {
        command: selectAllCommand,
        modal: true,
        reads: [],
        writes: []
    };

    /**
     * @type {Action}
     */
    var nativeCut = {
        command: nativeCutCommand,
        modal: true,
        reads: [],
        writes: []
    };

    /**
     * @type {Action}
     */
    var nativeCopy = {
        command: nativeCopyCommand,
        modal: true,
        reads: [],
        writes: []
    };

    /**
     * @type {Action}
     */
    var nativePaste = {
        command: nativePasteCommand,
        modal: true,
        reads: [],
        writes: []
    };

    /**
     * @type {Action}
     */
    var nativeSelectAll = {
        command: nativeSelectAllCommand,
        modal: true,
        reads: [],
        writes: []
    };

    var undo = {
        command: undoCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC, locks.JS_HISTORY]
    };

    var redo = {
        command: redoCommand,
        reads: [locks.PS_DOC],
        writes: [locks.JS_DOC, locks.JS_HISTORY]
    };

    exports.nativeCut = nativeCut;
    exports.nativeCopy = nativeCopy;
    exports.nativePaste = nativePaste;
    exports.nativeSelectAll = nativeSelectAll;
    exports.cut = cut;
    exports.copy = copy;
    exports.paste = paste;
    exports.selectAll = selectAll;
    exports.undo = undo;
    exports.redo = redo;
});
