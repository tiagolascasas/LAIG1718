"use strict";

/**
 * Primitive that represents a regular polygon with a given
 * number of edges
 * @constructor
 * @param {CGFscene} scene - the scene to which this primitive will belong
 * @param {Number} [edges=3] - the number of edges of this polygon
 */
function PrimitivePolygon(scene, edges)
{
	CGFobject.call(this, scene);

	if (edges != null)
		this.edges = edges;
	else
		this.edges = 3;

	this.initBuffers();
};

PrimitivePolygon.prototype = Object.create(CGFobject.prototype);
PrimitivePolygon.prototype.constructor=PrimitivePolygon;

PrimitivePolygon.prototype.initBuffers = function ()
{
	this.vertices = [
		0, 0, 0
	];

	this.normals = [
		0, 0, 1
	];

	this.texCoords = [
		0.5, 0.5
	];

	this.indices = [];

	for (let i = 0; i < this.edges; i++)
	{
		this.vertices.push(Math.cos(i*2*Math.PI/this.edges));
		this.vertices.push(Math.sin(i*2*Math.PI/this.edges));
		this.vertices.push(0);

		this.texCoords.push(0.5 + Math.cos(i*2*Math.PI/this.edges)/2);
		this.texCoords.push(0.5 - Math.sin(i*2*Math.PI/this.edges)/2);

		this.normals.push(0);
		this.normals.push(0);
		this.normals.push(1);
	}

    let i;
	for (i = 0; i < this.edges - 1; i++)
	{
		this.indices.push(0);
		this.indices.push(i + 1);
		this.indices.push(i + 2);
	}
	this.indices.push(0);
	this.indices.push(i + 1);
	this.indices.push(1);

	this.primitiveType=this.scene.gl.TRIANGLES;
	this.initGLBuffers();
};
