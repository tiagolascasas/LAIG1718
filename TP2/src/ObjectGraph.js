/**
  * Represents a scene graph, holding information about its nodes, textures and materials
  * @constructor
  * @param {CGFScene} scene - the scene that will use this graph
  */
function ObjectGraph(scene)
{
	this.scene = scene;
	this.obj = [];
	this.mat = {};
	this.tex = {};
	this.animations = {};
	this.animationsIndexed = [];
	this.selectableNodes = [];
	this.selectedNode = null;
	this.matStack = [];
	this.texStack = [];
	this.defaultMaterial = null;
	this.rootID = null;
};

/**
  * Adds a material to the graph
  * @param {string} id - the unique material identifier
  * @param {CGFAppearance} material - the material
  */
ObjectGraph.prototype.addMaterial = function(id, material)
{
	this.mat[id] = material;
};

/**
  * Adds a texture object, holding a texture and its scale factors, to the graph
  * @param {string} id - the unique texture identifier
  * @param {ObjectTexture} tex - the texture object
  */
ObjectGraph.prototype.addTexture = function(id, tex)
{
	this.tex[id] = tex;
};

/**
  * Adds an animation object
  * @param {String} type - the type of animation
  * @param {String} id - the id of the animation
  * @param {Number} velocity - the velocity of the animation
  * @param {Array} args - an array with the arguments specific to the animatiom
  */
ObjectGraph.prototype.addAnimation = function(type, id, velocity, args)
{
	let anim;
	switch(type)
	{
		case 'linear':
			anim = new LinearAnimation(velocity, args[0]);
			this.animations[id] = anim;
			this.animationsIndexed.push(anim);
			break;
		case 'circular':
			anim = new CircularAnimation(velocity, args[0], args[1], args[2], args[3]);
			this.animations[id] = anim;
			this.animationsIndexed.push(anim);
			break;
		case 'bezier':
			anim = new BezierAnimation(velocity, args[0]);
			this.animations[id] = anim;
			this.animationsIndexed.push(anim);
			break;
		case 'combo':
			let animations = [];
			for (let i = 0; i < args[0].length; i++)
				animations.push(this.animations[args[0][i]]);
			anim = new ComboAnimation(animations);
			this.animations[id] = anim;
			this.animationsIndexed.push(anim);
			break;
		default:
			break;
	}
};

/**
  * Adds a new node to the graph
  * @param {ObjectNode} object - the node to add to the graph
  */
ObjectGraph.prototype.addObject = function(object)
{
	if (object.selectable)
	{
		this.selectableNodes.push(object.id);
	}
	this.obj.push(object);
};

/**
  * Defines a new root node for the graph though its id
  * @param {string} id - the id of the new root node
  */
ObjectGraph.prototype.setRootID = function(id)
{
	this.rootID = id;
};

/**
  * Gets the node whose id is provided
  * @param {string} id - the id of the node
  * @return {ObjectNode} the node whose id was provided
  */
ObjectGraph.prototype.getNodeByID = function(id)
{
	for (var i = 0; i < this.obj.length; i++)
	{
		if (this.obj[i].id == id)
			return this.obj[i];
	}
	return null;
};

/**
  * Gets all nodes marked as selectable and their current active status
  * @return {Array} an associative array with the id of selectable nodes
  * and whether they are active or not
  */
ObjectGraph.prototype.getSelectableNodes = function()
{
	return this.selectableNodes;
};

/**
  * Updates the current time of all nodes
  * @param {number} currTime - the system time in milliseconds
  */
ObjectGraph.prototype.update = function(currTime)
{
	for (let i = 0; i < this.obj.length; i++)
		this.obj[i].update(currTime);
};

/**
  * Starts the display process of the graph by resetting the
  * textures and materials stacks and by initiating a recursive
  * depth-first search through the graph from the root node
  */
ObjectGraph.prototype.display = function()
{
	this.texStack.length = 0;
	this.matStack.length = 0;
	this.displayObjects(this.rootID);
};

/**
  * Recursive depth-first search function that displays the
  * objects of the graph, applying their transformations,
  * textures and materials accordingly
  * @param {ObjectNode} node - the current node
  */
ObjectGraph.prototype.displayObjects = function(node)
{
	var currNode = this.getNodeByID(node);

	this.scene.pushMatrix();

	let changedShader = this.applyShader(currNode);
	this.applyAppearences(currNode);
	currNode.applyTransformations(this.animations);
	currNode.displayPrimitives(this.texStack[this.texStack.length - 1]);
	if (changedShader)
		this.scene.setActiveShader(this.scene.defaultShader);

	var children = currNode.children;
	for (var i = 0; i < children.length; i++)
		this.displayObjects(children[i]);

	this.scene.popMatrix();

	if (this.texStack.length > 0){
		this.texStack[this.texStack.length - 1].tex.unbind();
		this.texStack.pop();
	}
	if (this.matStack.length > 0)
		this.matStack.pop();
};

/**
  * Applies a custom shader to the scene if a node is the current selected nodes
  * @param {ObjectNode} node - the node to check
  * @return true if it was the current active selected node, false otherwise
  */
ObjectGraph.prototype.applyShader = function(node)
{
	if (node.id == this.selectedNode)
	{
		this.scene.setActiveShader(this.scene.customShader);
		return true;
	}
	else
		return false;
};

/**
  * Applies the appearances (materials and textures) of
  * the given node, taking into consideration the inheritance
  * mechanisms.
  * @param {ObjectNode} node - the node whose appearances will be applied
  */
ObjectGraph.prototype.applyAppearences = function(node)
{
	var lastMat = this.matStack[this.matStack.length - 1];
	switch(node.material)
	{
		case "null":
			if (this.matStack.length > 0){
				this.matStack.push(lastMat);
				lastMat.apply();
			}
			break;
		default:
			this.matStack.push(this.mat[node.material]);
			this.mat[node.material].apply();
			break;
	}

	var lastTex = this.texStack[this.texStack.length - 1];
	switch(node.texture)
	{
		case "null":
			if (this.texStack.length > 0){
				this.texStack.push(lastTex);
				lastTex.tex.bind();
			}
			break;
		case "clear":
			if (this.texStack.length > 0)
			{
				this.texStack.push(lastTex);
				lastTex.tex.unbind();
			}
			break;
		default:
			this.texStack.push(this.tex[node.texture]);
			this.tex[node.texture].tex.bind();
			break;
	}
};
