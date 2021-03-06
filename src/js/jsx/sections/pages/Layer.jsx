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

define(function (require, exports, module) {
    "use strict";

    var React = require("react"),
        Immutable = require("immutable");

    var LayerFace = require("jsx!./LayerFace");

    var Layer = React.createClass({

        shouldComponentUpdate: function (nextProps) {
            var getDescendants = function (props) {
                var doc = props.document,
                    layer = props.layer;

                return doc && doc.layers.descendants(layer);
            };

            return this.props.dragTarget !== nextProps.dragTarget ||
                this.props.dropTarget !== nextProps.dropTarget ||
                this.props.dragPosition !== nextProps.dragPosition ||
                !Immutable.is(getDescendants(this.props), getDescendants(nextProps));
        },
        render: function () {
            var doc = this.props.document,
                layer = this.props.layer,
                childLayers = doc ? doc.layers.children(layer) : Immutable.List();
            var childListItemComponents = childLayers
                .toSeq()
                .filter(function (layer) {
                    return layer.kind !== layer.layerKinds.GROUPEND;
                })
                .map(function (child) {
                    // Check to see if any child layers are the dropTarget or dragTarget
                    // We should be able to remove this when we flatten the layers
                    var childLayerIndex = doc.layers.descendants(child).indexOf(this.props.dropTarget.keyObject),
                        shouldPassDropTarget = !!(child && this.props.dropTarget && childLayerIndex !== -1),
                        shouldPassDragTarget = false;

                    if (this.props.dragTarget) {
                        // Should be false if the layer and the layers children do not appear in this list
                        shouldPassDragTarget = this.props.dragTarget.some(function (dragT) {
                            return child && doc.layers.descendants(child).indexOf(dragT) !== -1;
                        });
                    }

                    return (
                        <li key={child.key} className="layer">
                            <Layer
                                {...this.props}
                                document={doc}
                                layer={child}
                                layerIndex={doc.layers.indexOf(child)}
                                dragTarget={ shouldPassDragTarget && this.props.dragTarget}
                                dropTarget={ shouldPassDropTarget && this.props.dropTarget}
                                dragPosition={ (shouldPassDropTarget || shouldPassDragTarget) &&
                                    this.props.dragPosition}
                                dropBounds={ shouldPassDropTarget && this.props.dropBounds}
                            />
                        </li>
                    );
                }, this)
                .toList();

            var childLayerComponents;
            if (childListItemComponents.isEmpty()) {
                childLayerComponents = null;
            } else {
                childLayerComponents = (
                    <ul>
                        {childListItemComponents}
                    </ul>
                );
            }

            var faceComponent = (
                <LayerFace
                    {...this.props}
                    document={doc}
                    layer={layer}
                    dragTarget={this.props.dragTarget && this.props.dragTarget.indexOf(layer) !== -1}
                    dropTarget={this.props.dropTarget && this.props.dropTarget.keyObject === layer}
                    dropBounds={this.props.dropTarget && this.props.dropBounds}
                />
            );

            return (
                <div>
                    {faceComponent}
                    {childLayerComponents}
                </div>
            );
        }
    });

    module.exports = Layer;
});
