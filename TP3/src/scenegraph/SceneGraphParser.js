"use strict";

// Order of the groups in the XML document.
let INITIALS_INDEX = 0;
let ILLUMINATION_INDEX = 1;
let LIGHTS_INDEX = 2;
let TEXTURES_INDEX = 3;
let MATERIALS_INDEX = 4;
let ANIMATIONS_INDEX = 5;
let NODES_INDEX = 6;

/**
 * SceneGraphParser class, which parses a xml file with a scene graph and builds
 * an ObjectGraph with the nodes information, and also holds all the configuration and lights
 * definitions
 * @constructor
 * @param {String} filename - the name of the LSX file containing the graph information
 * @param {CGFscene} scene - the scene to bind this graph to
 * @param {Boolean} initScene - indicates whether the initials, illumination and lights information of the file should be applied to the scene or ignored
 */
function SceneGraphParser(filename, scene, initScene)
{
    this.loadedOk = null;

    // Establish bidirectional references between scene and graph.
    this.scene = scene;
    scene.graph = this;

    this.initScene = initScene;

	this.objGraph = new ObjectGraph(this.scene);	//Scene graph proper

    this.nodes = [];		//id of the nodes, to check if there are duplicates
	this.textures = [];		//id of the textures, to check if there are duplicates
	this.materials = []; 	//id of the materials, to check if there are duplicates
	this.animations = [];	//id of the animations, to check if there are duplicates

    this.axisCoords = [];
    this.axisCoords['x'] = [1, 0, 0];
    this.axisCoords['y'] = [0, 1, 0];
    this.axisCoords['z'] = [0, 0, 1];

    // File reading
    this.reader = new CGFXMLreader();

    /*
	 * Read the contents of the xml file, and refer to this class for loading and error handlers.
	 * After the file is read, the reader calls onXMLReady on this object.
	 * If any error occurs, the reader calls onXMLError on this object, with an error message
	 */

    this.reader.open('scenes/' + filename, this);
};

/*
 * Callback to be executed after successful reading
 */
SceneGraphParser.prototype.onXMLReady = function()
{
    console.log("XML Loading finished.");
    let rootElement = this.reader.xmlDoc.documentElement;

    // Here should go the calls for different functions to parse the various blocks
    let error = this.parseLSXFile(rootElement);

    if (error != null ) {
        this.onXMLError(error);
        return;
    }

    this.loadedOk = true;

    if (this.initScene)
    {
        // As the graph loaded ok, signal the scene so that any additional initialization depending on the graph can take place
        this.scene.onGraphLoaded();
    }
};

/**
 * Parses the LSX file, processing each block.
 */
SceneGraphParser.prototype.parseLSXFile = function(rootElement)
{
    if (rootElement.nodeName != "SCENE")
        return "root tag <SCENE> missing";

    let nodes = rootElement.children;
    console.log(nodes);

    // Reads the names of the nodes to an auxiliary buffer.
    let nodeNames = [];

    for (let i = 0; i < nodes.length; i++) {
        nodeNames.push(nodes[i].nodeName);
    }

    let error;
    let index;

    // Processes each node, verifying errors.

    if (this.initScene)
    {
        // <INITIALS>
        if ((index = nodeNames.indexOf("INITIALS")) == -1)
            return "tag <INITIALS> missing";
        else {
            if (index != INITIALS_INDEX)
                this.onXMLMinorError("tag <INITIALS> out of order");

            if ((error = this.parseInitials(nodes[index])) != null )
                return error;
        }

        // <ILLUMINATION>
        if ((index = nodeNames.indexOf("ILLUMINATION")) == -1)
            return "tag <ILLUMINATION> missing";
        else {
            if (index != ILLUMINATION_INDEX)
                this.onXMLMinorError("tag <ILLUMINATION> out of order");

            if ((error = this.parseIllumination(nodes[index])) != null )
                return error;
        }

        // <LIGHTS>
        if ((index = nodeNames.indexOf("LIGHTS")) == -1)
            return "tag <LIGHTS> missing";
        else {
            if (index != LIGHTS_INDEX)
                this.onXMLMinorError("tag <LIGHTS> out of order");

            if ((error = this.parseLights(nodes[index])) != null )
                return error;
        }
    }

    // <TEXTURES>
    if ((index = nodeNames.indexOf("TEXTURES")) == -1)
        return "tag <TEXTURES> missing";
    else {
        if (index != TEXTURES_INDEX)
            this.onXMLMinorError("tag <TEXTURES> out of order");

        if ((error = this.parseTextures(nodes[index])) != null )
            return error;
    }

    // <MATERIALS>
    if ((index = nodeNames.indexOf("MATERIALS")) == -1)
        return "tag <MATERIALS> missing";
    else {
        if (index != MATERIALS_INDEX)
            this.onXMLMinorError("tag <MATERIALS> out of order");

        if ((error = this.parseMaterials(nodes[index])) != null )
            return error;
    }

	// <ANIMATIONS>
	if ((index = nodeNames.indexOf("ANIMATIONS")) == -1)
		console.log("No animations declared");
	else {
		if (index != ANIMATIONS_INDEX)
			this.onXMLMinorError("tag <ANIMATIONS> out of order");

		if ((error = this.parseAnimations(nodes[index])) != null )
			return error;
	}

    // <NODES>
    if ((index = nodeNames.indexOf("NODES")) == -1)
        return "tag <NODES> missing";
    else {
        if (index != NODES_INDEX)
            this.onXMLMinorError("tag <NODES> out of order");

        if ((error = this.parseNodes(nodes[index])) != null )
            return error;
    }

};

/**
 * Parses the <INITIALS> block.
 */
SceneGraphParser.prototype.parseInitials = function(initialsNode)
{
    let children = initialsNode.children;

    let nodeNames = [];

    for (let i = 0; i < children.length; i++)
        nodeNames.push(children[i].nodeName);

    // Frustum planes.
    this.near = 0.1;
    this.far = 500;
    let indexFrustum = nodeNames.indexOf("frustum");
    if (indexFrustum == -1) {
        this.onXMLMinorError("frustum planes missing; assuming 'near = 0.1' and 'far = 500'");
    }
    else {
        this.near = this.reader.getFloat(children[indexFrustum], 'near');
        this.far = this.reader.getFloat(children[indexFrustum], 'far');

        if (this.near == null ) {
            this.near = 0.1;
            this.onXMLMinorError("unable to parse value for near plane; assuming 'near = 0.1'");
        }
        else if (this.far == null ) {
            this.far = 500;
            this.onXMLMinorError("unable to parse value for far plane; assuming 'far = 500'");
        }
        else if (isNaN(this.near)) {
            this.near = 0.1;
            this.onXMLMinorError("non-numeric value found for near plane; assuming 'near = 0.1'");
        }
        else if (isNaN(this.far)) {
            this.far = 500;
            this.onXMLMinorError("non-numeric value found for far plane; assuming 'far = 500'");
        }
        else if (this.near <= 0) {
            this.near = 0.1;
            this.onXMLMinorError("'near' must be positive; assuming 'near = 0.1'");
        }

        if (this.near >= this.far)
            return "'near' must be smaller than 'far'";
    }

    // Checks if at most one translation, three rotations, and one scaling are defined.
    if (initialsNode.getElementsByTagName('translation').length > 1)
        return "no more than one initial translation may be defined";

    if (initialsNode.getElementsByTagName('rotation').length > 3)
        return "no more than three initial rotations may be defined";

    if (initialsNode.getElementsByTagName('scale').length > 1)
        return "no more than one scaling may be defined";

    // Initial transforms.
    this.initialTranslate = [];
    this.initialScaling = [];
    this.initialRotations = [];

    // Gets indices of each element.
    let translationIndex = nodeNames.indexOf("translation");
    let thirdRotationIndex = nodeNames.indexOf("rotation");
    let secondRotationIndex = nodeNames.indexOf("rotation", thirdRotationIndex + 1);
    let firstRotationIndex = nodeNames.lastIndexOf("rotation");
    let scalingIndex = nodeNames.indexOf("scale");

    // Checks if the indices are valid and in the expected order.
    // Translation.
    this.initialTransforms = mat4.create();
    mat4.identity(this.initialTransforms);
    if (translationIndex == -1)
        this.onXMLMinorError("initial translation undefined; assuming T = (0, 0, 0)");
    else {
        let tx = this.reader.getFloat(children[translationIndex], 'x');
        let ty = this.reader.getFloat(children[translationIndex], 'y');
        let tz = this.reader.getFloat(children[translationIndex], 'z');

        if (tx == null ) {
            tx = 0;
            this.onXMLMinorError("failed to parse x-coordinate of initial translation; assuming tx = 0");
        }
        else if (isNaN(tx)) {
            tx = 0;
            this.onXMLMinorError("found non-numeric value for x-coordinate of initial translation; assuming tx = 0");
        }

        if (ty == null ) {
            ty = 0;
            this.onXMLMinorError("failed to parse y-coordinate of initial translation; assuming ty = 0");
        }
        else if (isNaN(ty)) {
            ty = 0;
            this.onXMLMinorError("found non-numeric value for y-coordinate of initial translation; assuming ty = 0");
        }

        if (tz == null ) {
            tz = 0;
            this.onXMLMinorError("failed to parse z-coordinate of initial translation; assuming tz = 0");
        }
        else if (isNaN(tz)) {
            tz = 0;
            this.onXMLMinorError("found non-numeric value for z-coordinate of initial translation; assuming tz = 0");
        }

        if (translationIndex > thirdRotationIndex || translationIndex > scalingIndex)
            this.onXMLMinorError("initial translation out of order; result may not be as expected");

        mat4.translate(this.initialTransforms, this.initialTransforms, [tx, ty, tz]);
    }

    // Rotations.
    let initialRotations = [];
    initialRotations['x'] = 0;
    initialRotations['y'] = 0;
    initialRotations['z'] = 0;

    let rotationDefined = [];
    rotationDefined['x'] = false;
    rotationDefined['y'] = false;
    rotationDefined['z'] = false;

    let axis;
    let rotationOrder = [];

    // Third rotation (first rotation defined).
    if (thirdRotationIndex != -1) {
        axis = this.reader.getItem(children[thirdRotationIndex], 'axis', ['x', 'y', 'z']);
        if (axis != null ) {
            let angle = this.reader.getFloat(children[thirdRotationIndex], 'angle');
            if (angle != null && !isNaN(angle)) {
                initialRotations[axis] += angle;
                if (!rotationDefined[axis])
                    rotationOrder.push(axis);
                rotationDefined[axis] = true;
            }
            else this.onXMLMinorError("failed to parse third initial rotation 'angle'");
        }
    }

    // Second rotation.
    if (secondRotationIndex != -1) {
        axis = this.reader.getItem(children[secondRotationIndex], 'axis', ['x', 'y', 'z']);
        if (axis != null ) {
            let angle = this.reader.getFloat(children[secondRotationIndex], 'angle');
            if (angle != null && !isNaN(angle)) {
                initialRotations[axis] += angle;
                if (!rotationDefined[axis])
                    rotationOrder.push(axis);
                rotationDefined[axis] = true;
            }
            else this.onXMLMinorError("failed to parse second initial rotation 'angle'");
        }
    }

    // First rotation.
    if (firstRotationIndex != -1) {
        axis = this.reader.getItem(children[firstRotationIndex], 'axis', ['x', 'y', 'z']);
        if (axis != null ) {
            let angle = this.reader.getFloat(children[firstRotationIndex], 'angle');
            if (angle != null && !isNaN(angle)) {
                initialRotations[axis] += angle;
                if (!rotationDefined[axis])
                    rotationOrder.push(axis);
                rotationDefined[axis] = true;
            }
            else this.onXMLMinorError("failed to parse first initial rotation 'angle'");
        }
    }

    // Checks for undefined rotations.
    if (!rotationDefined['x'])
        this.onXMLMinorError("rotation along the Ox axis undefined; assuming Rx = 0");
    else if (!rotationDefined['y'])
        this.onXMLMinorError("rotation along the Oy axis undefined; assuming Ry = 0");
    else if (!rotationDefined['z'])
        this.onXMLMinorError("rotation along the Oz axis undefined; assuming Rz = 0");

    // Updates transform matrix.
    for (let i = 0; i < rotationOrder.length; i++)
        mat4.rotate(this.initialTransforms, this.initialTransforms, DEGREE_TO_RAD * initialRotations[rotationOrder[i]], this.axisCoords[rotationOrder[i]]);

    // Scaling.
    if (scalingIndex == -1)
        this.onXMLMinorError("initial scaling undefined; assuming S = (1, 1, 1)");
    else {
        let sx = this.reader.getFloat(children[scalingIndex], 'sx');
        let sy = this.reader.getFloat(children[scalingIndex], 'sy');
        let sz = this.reader.getFloat(children[scalingIndex], 'sz');

        if (sx == null ) {
            sx = 1;
            this.onXMLMinorError("failed to parse x parameter of initial scaling; assuming sx = 1");
        }
        else if (isNaN(sx)) {
            sx = 1;
            this.onXMLMinorError("found non-numeric value for x parameter of initial scaling; assuming sx = 1");
        }

        if (sy == null ) {
            sy = 1;
            this.onXMLMinorError("failed to parse y parameter of initial scaling; assuming sy = 1");
        }
        else if (isNaN(sy)) {
            sy = 1;
            this.onXMLMinorError("found non-numeric value for y parameter of initial scaling; assuming sy = 1");
        }

        if (sz == null ) {
            sz = 1;
            this.onXMLMinorError("failed to parse z parameter of initial scaling; assuming sz = 1");
        }
        else if (isNaN(sz)) {
            sz = 1;
            this.onXMLMinorError("found non-numeric value for z parameter of initial scaling; assuming sz = 1");
        }

        if (scalingIndex < firstRotationIndex)
            this.onXMLMinorError("initial scaling out of order; result may not be as expected");

        mat4.scale(this.initialTransforms, this.initialTransforms, [sx, sy, sz]);
    }

    // ----------
    // Reference length.
    this.referenceLength = 1;

    let indexReference = nodeNames.indexOf("reference");
    if (indexReference == -1)
        this.onXMLMinorError("reference length undefined; assuming 'length = 1'");
    else {
        // Reads the reference length.
        let length = this.reader.getFloat(children[indexReference], 'length');

        if (length != null ) {
            if (isNaN(length))
                this.onXMLMinorError("found non-numeric value for reference length; assuming 'length = 1'");
            else if (length <= 0)
                this.onXMLMinorError("reference length must be a positive value; assuming 'length = 1'");
            else
                this.referenceLength = length;
        }
        else
            this.onXMLMinorError("unable to parse reference length; assuming 'length = 1'");

    }

    console.log("Parsed initials");

    return null ;
};

/**
 * Parses the <ILLUMINATION> block.
 */
SceneGraphParser.prototype.parseIllumination = function(illuminationNode)
{
    // Reads the ambient and background values.
    let children = illuminationNode.children;
    let nodeNames = [];
    for (let i = 0; i < children.length; i++)
        nodeNames.push(children[i].nodeName);

    // Retrieves the global ambient illumination.
    this.ambientIllumination = [0, 0, 0, 1];
    let ambientIndex = nodeNames.indexOf("ambient");
    if (ambientIndex != -1) {
        // R.
        let r = this.reader.getFloat(children[ambientIndex], 'r');
        if (r != null ) {
            if (isNaN(r))
                return "ambient 'r' is a non numeric value on the ILLUMINATION block";
            else if (r < 0 || r > 1)
                return "ambient 'r' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.ambientIllumination[0] = r;
        }
        else
            this.onXMLMinorError("unable to parse R component of the ambient illumination; assuming R = 0");

        // G.
        let g = this.reader.getFloat(children[ambientIndex], 'g');
        if (g != null ) {
            if (isNaN(g))
                return "ambient 'g' is a non numeric value on the ILLUMINATION block";
            else if (g < 0 || g > 1)
                return "ambient 'g' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.ambientIllumination[1] = g;
        }
        else
            this.onXMLMinorError("unable to parse G component of the ambient illumination; assuming G = 0");

        // B.
        let b = this.reader.getFloat(children[ambientIndex], 'b');
        if (b != null ) {
            if (isNaN(b))
                return "ambient 'b' is a non numeric value on the ILLUMINATION block";
            else if (b < 0 || b > 1)
                return "ambient 'b' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.ambientIllumination[2] = b;
        }
        else
            this.onXMLMinorError("unable to parse B component of the ambient illumination; assuming B = 0");

        // A.
        let a = this.reader.getFloat(children[ambientIndex], 'a');
        if (a != null ) {
            if (isNaN(a))
                return "ambient 'a' is a non numeric value on the ILLUMINATION block";
            else if (a < 0 || a > 1)
                return "ambient 'a' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.ambientIllumination[3] = a;
        }
        else
            this.onXMLMinorError("unable to parse A component of the ambient illumination; assuming A = 1");
    }
    else
        this.onXMLMinorError("global ambient illumination undefined; assuming Ia = (0, 0, 0, 1)");

    // Retrieves the background clear color.
    this.background = [0, 0, 0, 1];
    let backgroundIndex = nodeNames.indexOf("background");
    if (backgroundIndex != -1) {
        // R.
        let r = this.reader.getFloat(children[backgroundIndex], 'r');
        if (r != null ) {
            if (isNaN(r))
                return "background 'r' is a non numeric value on the ILLUMINATION block";
            else if (r < 0 || r > 1)
                return "background 'r' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.background[0] = r;
        }
        else
            this.onXMLMinorError("unable to parse R component of the background colour; assuming R = 0");

        // G.
        let g = this.reader.getFloat(children[backgroundIndex], 'g');
        if (g != null ) {
            if (isNaN(g))
                return "background 'g' is a non numeric value on the ILLUMINATION block";
            else if (g < 0 || g > 1)
                return "background 'g' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.background[1] = g;
        }
        else
            this.onXMLMinorError("unable to parse G component of the background colour; assuming G = 0");

        // B.
        let b = this.reader.getFloat(children[backgroundIndex], 'b');
        if (b != null ) {
            if (isNaN(b))
                return "background 'b' is a non numeric value on the ILLUMINATION block";
            else if (b < 0 || b > 1)
                return "background 'b' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.background[2] = b;
        }
        else
            this.onXMLMinorError("unable to parse B component of the background colour; assuming B = 0");

        // A.
        let a = this.reader.getFloat(children[backgroundIndex], 'a');
        if (a != null ) {
            if (isNaN(a))
                return "background 'a' is a non numeric value on the ILLUMINATION block";
            else if (a < 0 || a > 1)
                return "background 'a' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.background[3] = a;
        }
        else
            this.onXMLMinorError("unable to parse A component of the background colour; assuming A = 1");
    }
    else
        this.onXMLMinorError("background clear colour undefined; assuming (R, G, B, A) = (0, 0, 0, 1)");

   console.log("Parsed illumination");

    return null ;
};

/**
 * Parses the <LIGHTS> node.
 */
SceneGraphParser.prototype.parseLights = function(lightsNode)
{
    let children = lightsNode.children;

    this.lights = [];
    let numLights = 0;

    let grandChildren = [];
    let nodeNames = [];

    // Any number of lights.
    for (let i = 0; i < children.length; i++) {

        if (children[i].nodeName != "LIGHT") {
            this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
            continue;
        }

        // Get id of the current light.
        let lightId = this.reader.getString(children[i], 'id');
        if (lightId == null )
            return "no ID defined for light";

        // Checks for repeated IDs.
        if (this.lights[lightId] != null )
            return "ID must be unique for each light (conflict: ID = " + lightId + ")";

        grandChildren = children[i].children;
        // Specifications for the current light.

        nodeNames = [];
        for (let j = 0; j < grandChildren.length; j++) {
            console.log(grandChildren[j].nodeName);
            nodeNames.push(grandChildren[j].nodeName);
        }

        // Gets indices of each element.
        let enableIndex = nodeNames.indexOf("enable");
        let positionIndex = nodeNames.indexOf("position");
        let ambientIndex = nodeNames.indexOf("ambient");
        let diffuseIndex = nodeNames.indexOf("diffuse");
        let specularIndex = nodeNames.indexOf("specular");

        // Light enable/disable
        let enableLight = true;
        if (enableIndex == -1) {
            this.onXMLMinorError("enable value missing for ID = " + lightId + "; assuming 'value = 1'");
        }
        else {
            let aux = this.reader.getFloat(grandChildren[enableIndex], 'value');
            if (aux == null ) {
                this.onXMLMinorError("unable to parse value component of the 'enable light' field for ID = " + lightId + "; assuming 'value = 1'");
            }
            else if (isNaN(aux))
                return "'enable value' is a non numeric value on the LIGHTS block";
            else if (aux != 0 &&     aux != 1)
                return "'enable value' must be 0 or 1 on the LIGHTS block"
            else
                enableLight = aux == 0 ? false : true;
        }

        // Retrieves the light position.
        let positionLight = [];
        if (positionIndex != -1) {
            // x
            let x = this.reader.getFloat(grandChildren[positionIndex], 'x');
            if (x != null ) {
                if (isNaN(x))
                    return "'x' is a non numeric value on the LIGHTS block";
                else
                    positionLight.push(x);
            }
            else
                return "unable to parse x-coordinate of the light position for ID = " + lightId;

            // y
            let y = this.reader.getFloat(grandChildren[positionIndex], 'y');
            if (y != null ) {
                if (isNaN(y))
                    return "'y' is a non numeric value on the LIGHTS block";
                else
                    positionLight.push(y);
            }
            else
                return "unable to parse y-coordinate of the light position for ID = " + lightId;

            // z
            let z = this.reader.getFloat(grandChildren[positionIndex], 'z');
            if (z != null ) {
                if (isNaN(z))
                    return "'z' is a non numeric value on the LIGHTS block";
                else
                    positionLight.push(z);
            }
            else
                return "unable to parse z-coordinate of the light position for ID = " + lightId;

            // w
            let w = this.reader.getFloat(grandChildren[positionIndex], 'w');
            if (w != null ) {
                if (isNaN(w))
                    return "'w' is a non numeric value on the LIGHTS block";
                else if (w < 0 || w > 1)
                    return "'w' must be a value between 0 and 1 on the LIGHTS block"
                else
                    positionLight.push(w);
            }
            else
                return "unable to parse w-coordinate of the light position for ID = " + lightId;
        }
        else
            return "light position undefined for ID = " + lightId;

        // Retrieves the ambient component.
        let ambientIllumination = [];
        if (ambientIndex != -1) {
            // R
            let r = this.reader.getFloat(grandChildren[ambientIndex], 'r');
            if (r != null ) {
                if (isNaN(r))
                    return "ambient 'r' is a non numeric value on the LIGHTS block";
                else if (r < 0 || r > 1)
                    return "ambient 'r' must be a value between 0 and 1 on the LIGHTS block"
                else
                    ambientIllumination.push(r);
            }
            else
                return "unable to parse R component of the ambient illumination for ID = " + lightId;

            // G
            let g = this.reader.getFloat(grandChildren[ambientIndex], 'g');
            if (g != null ) {
                if (isNaN(g))
                    return "ambient 'g' is a non numeric value on the LIGHTS block";
                else if (g < 0 || g > 1)
                    return "ambient 'g' must be a value between 0 and 1 on the LIGHTS block"
                else
                    ambientIllumination.push(g);
            }
            else
                return "unable to parse G component of the ambient illumination for ID = " + lightId;

            // B
            let b = this.reader.getFloat(grandChildren[ambientIndex], 'b');
            if (b != null ) {
                if (isNaN(b))
                    return "ambient 'b' is a non numeric value on the LIGHTS block";
                else if (b < 0 || b > 1)
                    return "ambient 'b' must be a value between 0 and 1 on the LIGHTS block"
                else
                    ambientIllumination.push(b);
            }
            else
                return "unable to parse B component of the ambient illumination for ID = " + lightId;

            // A
            let a = this.reader.getFloat(grandChildren[ambientIndex], 'a');
            if (a != null ) {
                if (isNaN(a))
                    return "ambient 'a' is a non numeric value on the LIGHTS block";
                else if (a < 0 || a > 1)
                    return "ambient 'a' must be a value between 0 and 1 on the LIGHTS block"
                ambientIllumination.push(a);
            }
            else
                return "unable to parse A component of the ambient illumination for ID = " + lightId;
        }
        else
            return "ambient component undefined for ID = " + lightId;

        // Retrieves the diffuse component
        let diffuseIllumination = [];
        if (diffuseIndex != -1) {
            // R
            let r = this.reader.getFloat(grandChildren[diffuseIndex], 'r');
            if (r != null ) {
                if (isNaN(r))
                    return "diffuse 'r' is a non numeric value on the LIGHTS block";
                else if (r < 0 || r > 1)
                    return "diffuse 'r' must be a value between 0 and 1 on the LIGHTS block"
                else
                    diffuseIllumination.push(r);
            }
            else
                return "unable to parse R component of the diffuse illumination for ID = " + lightId;

            // G
            let g = this.reader.getFloat(grandChildren[diffuseIndex], 'g');
            if (g != null ) {
                if (isNaN(g))
                    return "diffuse 'g' is a non numeric value on the LIGHTS block";
                else if (g < 0 || g > 1)
                    return "diffuse 'g' must be a value between 0 and 1 on the LIGHTS block"
                else
                    diffuseIllumination.push(g);
            }
            else
                return "unable to parse G component of the diffuse illumination for ID = " + lightId;

            // B
            let b = this.reader.getFloat(grandChildren[diffuseIndex], 'b');
            if (b != null ) {
                if (isNaN(b))
                    return "diffuse 'b' is a non numeric value on the LIGHTS block";
                else if (b < 0 || b > 1)
                    return "diffuse 'b' must be a value between 0 and 1 on the LIGHTS block"
                else
                    diffuseIllumination.push(b);
            }
            else
                return "unable to parse B component of the diffuse illumination for ID = " + lightId;

            // A
            let a = this.reader.getFloat(grandChildren[diffuseIndex], 'a');
            if (a != null ) {
                if (isNaN(a))
                    return "diffuse 'a' is a non numeric value on the LIGHTS block";
                else if (a < 0 || a > 1)
                    return "diffuse 'a' must be a value between 0 and 1 on the LIGHTS block"
                else
                    diffuseIllumination.push(a);
            }
            else
                return "unable to parse A component of the diffuse illumination for ID = " + lightId;
        }
        else
            return "diffuse component undefined for ID = " + lightId;

        // Retrieves the specular component
        let specularIllumination = [];
        if (specularIndex != -1) {
            // R
            let r = this.reader.getFloat(grandChildren[specularIndex], 'r');
            if (r != null ) {
                if (isNaN(r))
                    return "specular 'r' is a non numeric value on the LIGHTS block";
                else if (r < 0 || r > 1)
                    return "specular 'r' must be a value between 0 and 1 on the LIGHTS block"
                else
                    specularIllumination.push(r);
            }
            else
                return "unable to parse R component of the specular illumination for ID = " + lightId;

            // G
            let g = this.reader.getFloat(grandChildren[specularIndex], 'g');
            if (g != null ) {
                if (isNaN(g))
                    return "specular 'g' is a non numeric value on the LIGHTS block";
                else if (g < 0 || g > 1)
                    return "specular 'g' must be a value between 0 and 1 on the LIGHTS block"
                else
                    specularIllumination.push(g);
            }
            else
                return "unable to parse G component of the specular illumination for ID = " + lightId;

            // B
            let b = this.reader.getFloat(grandChildren[specularIndex], 'b');
            if (b != null ) {
                if (isNaN(b))
                    return "specular 'b' is a non numeric value on the LIGHTS block";
                else if (b < 0 || b > 1)
                    return "specular 'b' must be a value between 0 and 1 on the LIGHTS block"
                else
                    specularIllumination.push(b);
            }
            else
                return "unable to parse B component of the specular illumination for ID = " + lightId;

            // A
            let a = this.reader.getFloat(grandChildren[specularIndex], 'a');
            if (a != null ) {
                if (isNaN(a))
                    return "specular 'a' is a non numeric value on the LIGHTS block";
                else if (a < 0 || a > 1)
                    return "specular 'a' must be a value between 0 and 1 on the LIGHTS block"
                else
                    specularIllumination.push(a);
            }
            else
                return "unable to parse A component of the specular illumination for ID = " + lightId;
        }
        else
            return "specular component undefined for ID = " + lightId;

        // Light global information.
        this.lights[lightId] = [enableLight, positionLight, ambientIllumination, diffuseIllumination, specularIllumination];
        numLights++;
    }

    if (numLights == 0)
        return "at least one light must be defined";
    else if (numLights > 8)
        this.onXMLMinorError("too many lights defined; WebGL imposes a limit of 8 lights");

    console.log("Parsed lights");

    return null ;
};

/**
 * Parses the <TEXTURES> block.
 */
SceneGraphParser.prototype.parseTextures = function(texturesNode)
{
	let eachTexture = texturesNode.children;
    // Each texture.

    let oneTextureDefined = false;

    for (let i = 0; i < eachTexture.length; i++) {
        let nodeName = eachTexture[i].nodeName;
        if (nodeName == "TEXTURE") {
            // Retrieves texture ID.
            let textureID = this.reader.getString(eachTexture[i], 'id');
            if (textureID == null )
                return "failed to parse texture ID";
            // Checks if ID is valid.
            if (this.textures[textureID] != null )
                return "texture ID must unique (conflict with ID = " + textureID + ")";

            let texSpecs = eachTexture[i].children;
            let filepath = null ;
            let amplifFactorS = null ;
            let amplifFactorT = null ;
            // Retrieves texture specifications.
            for (let j = 0; j < texSpecs.length; j++) {
                let name = texSpecs[j].nodeName;
                if (name == "file") {
                    if (filepath != null )
                        return "duplicate file paths in texture with ID = " + textureID;

                    filepath = this.reader.getString(texSpecs[j], 'path');
                    if (filepath == null )
                        return "unable to parse texture file path for ID = " + textureID;
                }
                else if (name == "amplif_factor") {
                    if (amplifFactorS != null  || amplifFactorT != null )
                        return "duplicate amplification factors in texture with ID = " + textureID;

                    amplifFactorS = this.reader.getFloat(texSpecs[j], 's');
                    amplifFactorT = this.reader.getFloat(texSpecs[j], 't');

                    if (amplifFactorS == null  || amplifFactorT == null )
                        return "unable to parse texture amplification factors for ID = " + textureID;
                    else if (isNaN(amplifFactorS))
                        return "'amplifFactorS' is a non numeric value";
                    else if (isNaN(amplifFactorT))
                        return "'amplifFactorT' is a non numeric value";
                    else if (amplifFactorS <= 0 || amplifFactorT <= 0)
                        return "value for amplifFactor must be positive";
                }
                else
                    this.onXMLMinorError("unknown tag name <" + name + ">");
            }

            if (filepath == null )
                return "file path undefined for texture with ID = " + textureID;
            else if (amplifFactorS == null )
                return "s amplification factor undefined for texture with ID = " + textureID;
            else if (amplifFactorT == null )
                return "t amplification factor undefined for texture with ID = " + textureID;

			//add texture to scene graph
            let texture = new CGFtexture(this.scene,"./scenes/" + filepath);
			let textureObj = new ObjectTexture(texture, amplifFactorS, amplifFactorT);
			this.objGraph.addTexture(textureID, textureObj);

			this.textures[textureID] = textureID;
            oneTextureDefined = true;
        }
        else
            this.onXMLMinorError("unknown tag name <" + nodeName + ">");
    }

    if (!oneTextureDefined)
        return "at least one texture must be defined in the TEXTURES block";

    console.log("Parsed textures");
};


/**
 * Parses the <ANIMATIONS> block, instatiating each animations and
 * adding it to the graph, and checks if the arguments and XML synthax
 * are valid as well.
 */
SceneGraphParser.prototype.parseAnimations = function(animationsNode)
{
	let eachAnim = animationsNode.children;

    for (let i = 0; i < eachAnim.length; i++) {
        let nodeName = eachAnim[i].nodeName;
        if (nodeName == "ANIMATION") {
            // Retrieves animation ID.
            let animID = this.reader.getString(eachAnim[i], 'id');
            if (animID == null)
                return "failed to parse animation ID";
            // Checks if ID is valid.
            if (this.animations[animID] != null )
                return "animation ID must unique (conflict with ID = " + animID + ")";

			let args = [];
			let type = this.reader.getString(eachAnim[i], 'type');
			if (type == null)
	            return "unable to parse animation type value for animation with ID = " + animID;
            let speed = 0;
			let points = [];
			let pointsMat = [];

			switch(type)
			{
				case 'linear':
                    speed = this.reader.getString(eachAnim[i], 'speed');
					if (speed == null )
			            return "unable to parse speed value for animation with ID = " + animID;
                    points = eachAnim[i].children;
                    pointsMat = [];
					if (points.length < 2)
						return "at least two points must be specified for linear animation with ID = " + animID;

    				for (let j = 0; j < points.length; j++)
    				{
						if (points[j].nodeName != "controlpoint")
							return "invalid inner tag name " + points[j].nodeName + " in animation with id " + animID;

    					let x = this.reader.getString(points[j], 'xx');
                        let y = this.reader.getString(points[j], 'yy');
                        let z = this.reader.getString(points[j], 'zz');
						if (x == null || isNaN(x))
				            return "unable to parse xx value for animation with ID = " + animID;
						if (y == null || isNaN(y))
				            return "unable to parse yy value for animation with ID = " + animID;
						if (z == null || isNaN(z))
				            return "unable to parse zz value for animation with ID = " + animID;
                        pointsMat.push([+x, +y, +z]);
    				}

					if (+speed <= 0)
						return "speed must be bigger than 0 in animation with ID =" + animID;

                    args.push(pointsMat);
                    this.objGraph.addAnimation(type, animID, +speed, args);
                    break;

				case 'circular':
					speed = this.reader.getString(eachAnim[i], 'speed');
					if (speed == null || isNaN(speed))
			            return "unable to parse speed value for animation with ID = " + animID;
					let cx = this.reader.getString(eachAnim[i], 'centerx');
					if (cx == null || isNaN(cx))
			            return "unable to parse cx value for animation with ID = " + animID;
					let cy = this.reader.getString(eachAnim[i], 'centery');
					if (cy == null || isNaN(cy))
			            return "unable to parse cy value for animation with ID = " + animID;
					let cz = this.reader.getString(eachAnim[i], 'centerz');
					if (cz == null || isNaN(cz))
			            return "unable to parse cz value for animation with ID = " + animID;
					let radius = this.reader.getString(eachAnim[i], 'radius');
					if (radius == null || isNaN(radius))
			            return "unable to parse radius value for animation with ID = " + animID;
					let startang = this.reader.getString(eachAnim[i], 'startang');
					if (startang == null || isNaN(startang))
			            return "unable to parse startang value for animation with ID = " + animID;
					let rotang = this.reader.getString(eachAnim[i], 'rotang');
					if (rotang == null|| isNaN(rotang))
			            return "unable to parse rotang value for animation with ID = " + animID;

					if (+radius <= 0)
						return "radius must be bigger than 0 in animation with ID =" + animID;
					if (+speed <= 0)
						return "speed must be bigger than 0 in animation with ID =" + animID;

					args.push([+cx, +cy, +cz], +radius, +startang, +rotang);
					this.objGraph.addAnimation(type, animID, +speed, args);
					break;

                case 'bezier':
                    speed = this.reader.getString(eachAnim[i], 'speed');
					if (speed == null)
			            return "unable to parse speed value for animation with ID = " + animID;
                    points = eachAnim[i].children;
                    pointsMat = [];
    				for (let j = 0; j < points.length; j++)
    				{
						if (points[j].nodeName != "controlpoint")
							return "invalid inner tag name " + points[j].nodeName + " in animation with id " + animID;

    					let x = this.reader.getString(points[j], 'xx');
                        let y = this.reader.getString(points[j], 'yy');
                        let z = this.reader.getString(points[j], 'zz');
						if (x == null || isNaN(x))
				            return "unable to parse xx value for animation with ID = " + animID;
						if (y == null || isNaN(y))
				            return "unable to parse yy value for animation with ID = " + animID;
						if (z == null || isNaN(z))
				            return "unable to parse zz value for animation with ID = " + animID;
                        pointsMat.push([+x, +y, +z]);
    				}

					if (+speed <= 0)
						return "speed must be bigger than 0 in animation with ID =" + animID;
					if (pointsMat.length != 4)
						return "wrong number of points for bezier animation with ID =" + animID;

                    args.push(pointsMat);
                    this.objGraph.addAnimation(type, animID, +speed, args);
                    break;
				case 'combo':
					speed = 0;
                    let refs = eachAnim[i].children;
                    let refsList = [];
    				for (let j = 0; j < refs.length; j++)
    				{
						if (refs[j].nodeName != "SPANREF")
							return "invalid inner tag name " + refs[j].nodeName + " in combo animation with id " + animID;
    					let reference = this.reader.getString(refs[j], 'id');
						if (reference == null)
							return "unable to parse animation reference value for animation with ID = " + animID;
						if (this.animations[reference] == null)
			                return "animation reference to non-existing animation in combo animation with ID =" + animID;
                        refsList.push(reference);
    				}
                    args.push(refsList);
                    this.objGraph.addAnimation(type, animID, +speed, args);
                    break;
			}


			this.animations[animID] = animID;
        }
        else
            this.onXMLMinorError("unknown tag name <" + nodeName + ">");
    }

    console.log("Parsed animations");
};

/**
 * Parses the <MATERIALS> node.
 */
SceneGraphParser.prototype.parseMaterials = function(materialsNode)
{
    let children = materialsNode.children;
    // Each material.

    let oneMaterialDefined = false;

    for (let i = 0; i < children.length; i++) {
        if (children[i].nodeName != "MATERIAL") {
            this.onXMLMinorError("unknown tag name <" + children[i].nodeName + ">");
            continue;
        }

        let materialID = this.reader.getString(children[i], 'id');
        if (materialID == null )
            return "no ID defined for material";

        if (this.materials[materialID] != null )
            return "ID must be unique for each material (conflict: ID = " + materialID + ")";

        let materialSpecs = children[i].children;

        let nodeNames = [];

        for (let j = 0; j < materialSpecs.length; j++)
            nodeNames.push(materialSpecs[j].nodeName);

        // Determines the values for each field.
        // Shininess.
        let shininessIndex = nodeNames.indexOf("shininess");
        if (shininessIndex == -1)
            return "no shininess value defined for material with ID = " + materialID;
        let shininess = this.reader.getFloat(materialSpecs[shininessIndex], 'value');
        if (shininess == null )
            return "unable to parse shininess value for material with ID = " + materialID;
        else if (isNaN(shininess))
            return "'shininess' is a non numeric value";
        else if (shininess <= 0)
            return "'shininess' must be positive";

        // Specular component.
        let specularIndex = nodeNames.indexOf("specular");
        if (specularIndex == -1)
            return "no specular component defined for material with ID = " + materialID;
        let specularComponent = [];
        // R.
        let r = this.reader.getFloat(materialSpecs[specularIndex], 'r');
        if (r == null )
            return "unable to parse R component of specular reflection for material with ID = " + materialID;
        else if (isNaN(r))
            return "specular 'r' is a non numeric value on the MATERIALS block";
        else if (r < 0 || r > 1)
            return "specular 'r' must be a value between 0 and 1 on the MATERIALS block"
        specularComponent.push(r);
        // G.
        let g = this.reader.getFloat(materialSpecs[specularIndex], 'g');
        if (g == null )
           return "unable to parse G component of specular reflection for material with ID = " + materialID;
        else if (isNaN(g))
           return "specular 'g' is a non numeric value on the MATERIALS block";
        else if (g < 0 || g > 1)
           return "specular 'g' must be a value between 0 and 1 on the MATERIALS block";
        specularComponent.push(g);
        // B.
        let b = this.reader.getFloat(materialSpecs[specularIndex], 'b');
        if (b == null )
            return "unable to parse B component of specular reflection for material with ID = " + materialID;
        else if (isNaN(b))
            return "specular 'b' is a non numeric value on the MATERIALS block";
        else if (b < 0 || b > 1)
            return "specular 'b' must be a value between 0 and 1 on the MATERIALS block";
        specularComponent.push(b);
        // A.
        let a = this.reader.getFloat(materialSpecs[specularIndex], 'a');
        if (a == null )
            return "unable to parse A component of specular reflection for material with ID = " + materialID;
        else if (isNaN(a))
            return "specular 'a' is a non numeric value on the MATERIALS block";
        else if (a < 0 || a > 1)
            return "specular 'a' must be a value between 0 and 1 on the MATERIALS block";
        specularComponent.push(a);

        // Diffuse component.
        let diffuseIndex = nodeNames.indexOf("diffuse");
        if (diffuseIndex == -1)
            return "no diffuse component defined for material with ID = " + materialID;
        let diffuseComponent = [];
        // R.
        r = this.reader.getFloat(materialSpecs[diffuseIndex], 'r');
        if (r == null )
            return "unable to parse R component of diffuse reflection for material with ID = " + materialID;
        else if (isNaN(r))
            return "diffuse 'r' is a non numeric value on the MATERIALS block";
        else if (r < 0 || r > 1)
            return "diffuse 'r' must be a value between 0 and 1 on the MATERIALS block";
        diffuseComponent.push(r);
        // G.
        g = this.reader.getFloat(materialSpecs[diffuseIndex], 'g');
        if (g == null )
            return "unable to parse G component of diffuse reflection for material with ID = " + materialID;
        else if (isNaN(g))
            return "diffuse 'g' is a non numeric value on the MATERIALS block";
        else if (g < 0 || g > 1)
            return "diffuse 'g' must be a value between 0 and 1 on the MATERIALS block";
        diffuseComponent.push(g);
        // B.
        b = this.reader.getFloat(materialSpecs[diffuseIndex], 'b');
        if (b == null )
            return "unable to parse B component of diffuse reflection for material with ID = " + materialID;
        else if (isNaN(b))
            return "diffuse 'b' is a non numeric value on the MATERIALS block";
        else if (b < 0 || b > 1)
            return "diffuse 'b' must be a value between 0 and 1 on the MATERIALS block";
        diffuseComponent.push(b);
        // A.
        a = this.reader.getFloat(materialSpecs[diffuseIndex], 'a');
        if (a == null )
            return "unable to parse A component of diffuse reflection for material with ID = " + materialID;
        else if (isNaN(a))
            return "diffuse 'a' is a non numeric value on the MATERIALS block";
        else if (a < 0 || a > 1)
            return "diffuse 'a' must be a value between 0 and 1 on the MATERIALS block";
        diffuseComponent.push(a);

        // Ambient component.
        let ambientIndex = nodeNames.indexOf("ambient");
        if (ambientIndex == -1)
            return "no ambient component defined for material with ID = " + materialID;
        let ambientComponent = [];
        // R.
        r = this.reader.getFloat(materialSpecs[ambientIndex], 'r');
        if (r == null )
            return "unable to parse R component of ambient reflection for material with ID = " + materialID;
        else if (isNaN(r))
            return "ambient 'r' is a non numeric value on the MATERIALS block";
        else if (r < 0 || r > 1)
            return "ambient 'r' must be a value between 0 and 1 on the MATERIALS block";
        ambientComponent.push(r);
        // G.
        g = this.reader.getFloat(materialSpecs[ambientIndex], 'g');
        if (g == null )
            return "unable to parse G component of ambient reflection for material with ID = " + materialID;
        else if (isNaN(g))
            return "ambient 'g' is a non numeric value on the MATERIALS block";
        else if (g < 0 || g > 1)
            return "ambient 'g' must be a value between 0 and 1 on the MATERIALS block";
        ambientComponent.push(g);
        // B.
        b = this.reader.getFloat(materialSpecs[ambientIndex], 'b');
        if (b == null )
             return "unable to parse B component of ambient reflection for material with ID = " + materialID;
        else if (isNaN(b))
             return "ambient 'b' is a non numeric value on the MATERIALS block";
        else if (b < 0 || b > 1)
             return "ambient 'b' must be a value between 0 and 1 on the MATERIALS block";
        ambientComponent.push(b);
        // A.
        a = this.reader.getFloat(materialSpecs[ambientIndex], 'a');
        if (a == null )
            return "unable to parse A component of ambient reflection for material with ID = " + materialID;
        else if (isNaN(a))
            return "ambient 'a' is a non numeric value on the MATERIALS block";
        else if (a < 0 || a > 1)
            return "ambient 'a' must be a value between 0 and 1 on the MATERIALS block";
        ambientComponent.push(a);

        // Emission component.
        let emissionIndex = nodeNames.indexOf("emission");
        if (emissionIndex == -1)
            return "no emission component defined for material with ID = " + materialID;
        let emissionComponent = [];
        // R.
        r = this.reader.getFloat(materialSpecs[emissionIndex], 'r');
        if (r == null )
            return "unable to parse R component of emission for material with ID = " + materialID;
        else if (isNaN(r))
            return "emisson 'r' is a non numeric value on the MATERIALS block";
        else if (r < 0 || r > 1)
            return "emisson 'r' must be a value between 0 and 1 on the MATERIALS block";
        emissionComponent.push(r);
        // G.
        g = this.reader.getFloat(materialSpecs[emissionIndex], 'g');
        if (g == null )
            return "unable to parse G component of emission for material with ID = " + materialID;
        if (isNaN(g))
            return "emisson 'g' is a non numeric value on the MATERIALS block";
        else if (g < 0 || g > 1)
            return "emisson 'g' must be a value between 0 and 1 on the MATERIALS block";
        emissionComponent.push(g);
        // B.
        b = this.reader.getFloat(materialSpecs[emissionIndex], 'b');
        if (b == null )
            return "unable to parse B component of emission for material with ID = " + materialID;
        else if (isNaN(b))
            return "emisson 'b' is a non numeric value on the MATERIALS block";
        else if (b < 0 || b > 1)
            return "emisson 'b' must be a value between 0 and 1 on the MATERIALS block";
        emissionComponent.push(b);
        // A.
        a = this.reader.getFloat(materialSpecs[emissionIndex], 'a');
        if (a == null )
            return "unable to parse A component of emission for material with ID = " + materialID;
        else if (isNaN(a))
            return "emisson 'a' is a non numeric value on the MATERIALS block";
        else if (a < 0 || a > 1)
            return "emisson 'a' must be a value between 0 and 1 on the MATERIALS block";
        emissionComponent.push(a);

        // Creates material with the specified characteristics.
        let newMaterial = new CGFappearance(this.scene);
        newMaterial.setShininess(shininess);
        newMaterial.setAmbient(ambientComponent[0], ambientComponent[1], ambientComponent[2], ambientComponent[3]);
        newMaterial.setDiffuse(diffuseComponent[0], diffuseComponent[1], diffuseComponent[2], diffuseComponent[3]);
        newMaterial.setSpecular(specularComponent[0], specularComponent[1], specularComponent[2], specularComponent[3]);
        newMaterial.setEmission(emissionComponent[0], emissionComponent[1], emissionComponent[2], emissionComponent[3]);

		//adds the material to the scene graph
		this.objGraph.addMaterial(materialID, newMaterial);

		this.materials[materialID] = materialID;
		oneMaterialDefined = true;
    }

    if (!oneMaterialDefined)
        return "at least one material must be defined on the MATERIALS block";

    // Generates a default material.
    this.generateDefaultMaterial();

    console.log("Parsed materials");
};


/**
 * Parses the <NODES> block.
 */
SceneGraphParser.prototype.parseNodes = function(nodesNode)
{
    // Traverses nodes.
    let children = nodesNode.children;

    for (let i = 0; i < children.length; i++) {
        let nodeName;
        if ((nodeName = children[i].nodeName) == "ROOT") {
            // Retrieves root node.
            if (this.idRoot != null )
                return "there can only be one root node";
            else {
                let root = this.reader.getString(children[i], 'id');
                if (root == null )
                    return "failed to retrieve root node ID";

				//set root of scene graph
				this.objGraph.setRootID(root);

            }
        }
        else if (nodeName == "NODE")
		{
            // Retrieves node ID.
            let nodeID = this.reader.getString(children[i], 'id');
            if (nodeID == null )
                return "failed to retrieve node ID";
            // Checks if ID is valid.
            if (this.nodes[nodeID] != null )
                return "node ID must be unique (conflict: ID = " + nodeID + ")";

			let selectable = this.reader.getString(children[i], 'selectable', false);
            if (selectable == null )
                selectable = "false";
			if (selectable != "true" && selectable != "false")
			{
				this.onXMLMinorError("unknown selectable value " + selectable + ", assuming false");
				selectable = false;
			}
			else
				selectable = (selectable == 'true');	//cast to boolean

			// Creates node
			let obj = new ObjectNode(nodeID, this.scene, this.objGraph, selectable);
            this.log("Processing node "+nodeID);

			//registers the node id to keep track of duplicates
			this.nodes[nodeID] = nodeID;

            // Gathers child nodes.
            let nodeSpecs = children[i].children;
            let specsNames = [];
            let possibleValues = ["MATERIAL", "TEXTURE", "TRANSLATION", "ROTATION", "SCALE", "DESCENDANTS", "ANIMATIONREFS"];
            for (let j = 0; j < nodeSpecs.length; j++) {
                let name = nodeSpecs[j].nodeName;
                specsNames.push(nodeSpecs[j].nodeName);
                // Warns against possible invalid tag names.
                if (possibleValues.indexOf(name) == -1)
                    this.onXMLMinorError("unknown tag <" + name + ">");
            }

            // Retrieves material ID.
            let materialIndex = specsNames.indexOf("MATERIAL");
            if (materialIndex == -1)
                return "material must be defined (node ID = " + nodeID + ")";
            let materialID = this.reader.getString(nodeSpecs[materialIndex], 'id');
            if (materialID == null )
                return "unable to parse material ID (node ID = " + nodeID + ")";
            if (materialID != "null" && this.materials[materialID] == null )
                return "ID does not correspond to a valid material (node ID = " + nodeID + ")";

            //this.nodes[nodeID].materialID = materialID;
			obj.material = materialID;

            // Retrieves texture ID.
            let textureIndex = specsNames.indexOf("TEXTURE");
            if (textureIndex == -1)
                return "texture must be defined (node ID = " + nodeID + ")";
            let textureID = this.reader.getString(nodeSpecs[textureIndex], 'id');
            if (textureID == null )
                return "unable to parse texture ID (node ID = " + nodeID + ")";
            if (textureID != "null" && textureID != "clear" && this.textures[textureID] == null )
                return "ID does not correspond to a valid texture (node ID = " + nodeID + ")";

            //this.nodes[nodeID].textureID = textureID;
			obj.texture = textureID;


			// Retrieves animations IDs.
            let animationsIndex = specsNames.indexOf("ANIMATIONREFS");
            if (animationsIndex != -1)
            {
				let anims = nodeSpecs[animationsIndex].children;
				for (let i = 0; i < anims.length; i++)
				{
					if (anims[i].nodeName != "ANIMATIONREF")
						return "invalid inner node name " + anims[i].nodeName + " in ANIMATIONREFS of node with id =" + nodeID;
					let id = this.reader.getString(anims[i], 'id');
					if (id == null)
						return "unable to parse animationref ID (node ID = " + nodeID + ")";
					obj.addAnimation(id);
					console.log("added animation " + id + " to node " + nodeID);
				}
			}

            // Retrieves possible transformations.
            for (let j = 0; j < nodeSpecs.length; j++) {
                switch (nodeSpecs[j].nodeName) {
                case "TRANSLATION":
                    // Retrieves translation parameters.
                    let x = this.reader.getFloat(nodeSpecs[j], 'x');
                    if (x == null ) {
                        this.onXMLMinorError("unable to parse x-coordinate of translation; discarding transform");
                        break;
                    }
                    else if (isNaN(x))
                        return "non-numeric value for x-coordinate of translation (node ID = " + nodeID + ")";

                    let y = this.reader.getFloat(nodeSpecs[j], 'y');
                    if (y == null ) {
                        this.onXMLMinorError("unable to parse y-coordinate of translation; discarding transform");
                        break;
                    }
                    else if (isNaN(y))
                        return "non-numeric value for y-coordinate of translation (node ID = " + nodeID + ")";

                    let z = this.reader.getFloat(nodeSpecs[j], 'z');
                    if (z == null ) {
                        this.onXMLMinorError("unable to parse z-coordinate of translation; discarding transform");
                        break;
                    }
                    else if (isNaN(z))
                        return "non-numeric value for z-coordinate of translation (node ID = " + nodeID + ")";

					mat4.translate(obj.matrix, obj.matrix, [x, y, z]);
                    break;
                case "ROTATION":
                    // Retrieves rotation parameters.
                    let axis = this.reader.getItem(nodeSpecs[j], 'axis', ['x', 'y', 'z']);
                    if (axis == null ) {
                        this.onXMLMinorError("unable to parse rotation axis; discarding transform");
                        break;
                    }
                    let angle = this.reader.getFloat(nodeSpecs[j], 'angle');
                    if (angle == null ) {
                        this.onXMLMinorError("unable to parse rotation angle; discarding transform");
                        break;
                    }
                    else if (isNaN(angle))
                        return "non-numeric value for rotation angle (node ID = " + nodeID + ")";

					mat4.rotate(obj.matrix, obj.matrix, angle * DEGREE_TO_RAD, this.axisCoords[axis]);
                    break;
                case "SCALE":
                    // Retrieves scale parameters.
                    let sx = this.reader.getFloat(nodeSpecs[j], 'sx');
                    if (sx == null ) {
                        this.onXMLMinorError("unable to parse x component of scaling; discarding transform");
                        break;
                    }
                    else if (isNaN(sx))
                        return "non-numeric value for x component of scaling (node ID = " + nodeID + ")";

                    let sy = this.reader.getFloat(nodeSpecs[j], 'sy');
                    if (sy == null ) {
                        this.onXMLMinorError("unable to parse y component of scaling; discarding transform");
                        break;
                    }
                    else if (isNaN(sy))
                        return "non-numeric value for y component of scaling (node ID = " + nodeID + ")";

                    let sz = this.reader.getFloat(nodeSpecs[j], 'sz');
                    if (sz == null ) {
                        this.onXMLMinorError("unable to parse z component of scaling; discarding transform");
                        break;
                    }
                    else if (isNaN(sz))
                        return "non-numeric value for z component of scaling (node ID = " + nodeID + ")";

					mat4.scale(obj.matrix, obj.matrix, [sx, sy, sz]);
                    break;
                default:
                    break;
                }
            }

            // Retrieves information about children.
            let descendantsIndex = specsNames.indexOf("DESCENDANTS");
            if (descendantsIndex == -1)
                return "an intermediate node must have descendants";

            let descendants = nodeSpecs[descendantsIndex].children;

            let sizeChildren = 0;
            for (let j = 0; j < descendants.length; j++) {
                if (descendants[j].nodeName == "NODEREF")
				{

					let curId = this.reader.getString(descendants[j], 'id');

					this.log("   Descendant: "+curId);

                    if (curId == null )
                        this.onXMLMinorError("unable to parse descendant id");
                    else if (curId == nodeID)
                        return "a node may not be a child of its own";
                    else {
                        //adds child to the current node
						obj.addChild(curId);
                        sizeChildren++;
                    }
                }
                else
				if (descendants[j].nodeName == "LEAF")
				{
					let type=this.reader.getItem(descendants[j], 'type', ['rectangle', 'cylinder', 'sphere', 'triangle', 'patch']);
					if (type != null)
						this.log("   Leaf: "+ type);
					else
						this.warn("Error in leaf");

					let args=this.reader.getString(descendants[j], 'args');
					if (type != null)
						this.log("args = " + args);
					else
						this.warn("No arguments were specified for primitive");

					let ar = args.split(" ");
					for(let a = 0; a < ar.length; a++)
						ar[a] = +ar[a];

					if (type == 'patch')
					{
						console.log("Processing a patch");
						let points = [];
						let currPoint = 0;
						let vpointsSize = null;

						let upoints = descendants[j].children;
						for (let u = 0; u < upoints.length; u++)
						{
							if (upoints[u].nodeName != "CPLINE")
								this.onXMLError("unknown tag <" + upoints[u].nodeName + ">");
							let umat = [];
							let vpoints = upoints[u].children;

							if (vpointsSize == null)
								vpointsSize = vpoints.length;
							else if (vpointsSize != vpoints.length)
								this.onXMLError("Wrong number of points in a V dimension of a patch");

							for (let v = 0; v < vpoints.length; v++)
							{
								if (vpoints[v].nodeName != "CPOINT")
									this.onXMLError("unknown tag <" + vpoints[v].nodeName + ">");

								let vvec = [];

								let x = this.reader.getFloat(vpoints[v], 'xx');
								if (x == null ) {
									this.onXMLMinorError("unable to parse x component of v point; discarding");
									break;
								}
								else if (isNaN(x))
									return "non-numeric value for x component of v point of patch (node ID = " + nodeID + ")";

								let y = this.reader.getFloat(vpoints[v], 'yy');
								if (y == null ) {
									this.onXMLMinorError("unable to parse y component of v point; discarding");
									break;
								}
								else if (isNaN(y))
									return "non-numeric value for y component of v point of patch (node ID = " + nodeID + ")";

								let z = this.reader.getFloat(vpoints[v], 'zz');
								if (z == null ) {
									this.onXMLMinorError("unable to parse z component of v point; discarding");
									break;
								}
								else if (isNaN(z))
									return "non-numeric value for z component of v point of patch (node ID = " + nodeID + ")";

								let w = this.reader.getFloat(vpoints[v], 'ww');
								if (w == null ) {
									this.onXMLMinorError("unable to parse w component of v point; discarding");
									break;
								}
								else if (isNaN(w))
									return "non-numeric value for w component of v point of patch (node ID = " + nodeID + ")";

								vvec.push(x, y, z, w);
								umat.push(vvec);
							}
							points.push(umat);
						}
						ar.push(points);
						console.log(points);
					}

					obj.addLeaf(type, ar);
					sizeChildren++;
				}
				else
					this.onXMLMinorError("unknown tag <" + descendants[j].nodeName + ">");
            }
            if (sizeChildren == 0)
                return "at least one descendant must be defined for each intermediate node";

			//adds the node to the scene graph
			this.objGraph.addObject(obj);
        }
        else
            this.onXMLMinorError("unknown tag name <" + nodeName);
    }
    console.log("Parsed nodes");
    return null;
};

/*
 * Callback to be executed on any read error
 */
SceneGraphParser.prototype.onXMLError = function(message)
{
    console.error("XML Loading Error: " + message);
    this.loadedOk = false;
};

/**
 * Callback to be executed on any minor error, showing a warning on the console.
 */
SceneGraphParser.prototype.onXMLMinorError = function(message)
{
    console.warn("Warning: " + message);
};

SceneGraphParser.prototype.log = function(message)
{
    console.log("   " + message);
};

/**
 * Generates a default material, with a random name. This material will be passed onto the root node, which
 * may override it.
 */
SceneGraphParser.prototype.generateDefaultMaterial = function()
{
    let materialDefault = new CGFappearance(this.scene);
    materialDefault.setShininess(1);
    materialDefault.setSpecular(0, 0, 0, 1);
    materialDefault.setDiffuse(0.5, 0.5, 0.5, 1);
    materialDefault.setAmbient(0, 0, 0, 1);
    materialDefault.setEmission(0, 0, 0, 1);

    // Generates random material ID not currently in use.
    this.defaultMaterialID = null;
    do this.defaultMaterialID = SceneGraphParser.generateRandomString(5);
    while (this.materials[this.defaultMaterialID] != null);
	this.materials[this.defaultMaterialID] = materialDefault;

	//sets a default material on the scene graph
	this.objGraph.defaultMaterial = materialDefault;
};

/**
 * Generates a random string of the specified length.
 */
SceneGraphParser.generateRandomString = function(length)
{
    // Generates an array of random integer ASCII codes of the specified length
    // and returns a string of the specified length.
    let numbers = [];
    for (let i = 0; i < length; i++)
        numbers.push(Math.floor(Math.random() * 256));          // Random ASCII code.

    return String.fromCharCode.apply(null, numbers);
};

/**
 * Displays the scene graph by calling its display method
 */
SceneGraphParser.prototype.displayScene = function()
{
	this.objGraph.display();
};
