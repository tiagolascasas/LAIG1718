function CircularAnimation(center, v, radius, initialAngle, rotationAngle)
{
	Animation.call(this, v);

	console.log(initialAngle);
	console.log(rotationAngle );
	console.log(radius);

	this.center = center;
	this.radius = radius;
	this.initialAngle = initialAngle * DEGREE_TO_RAD;
	this.rotationAngle = rotationAngle * DEGREE_TO_RAD;
	this.w = v / radius;
	this.time = 0;
	this.baseTime = 0;
	this.matrix = mat4.create();
	this.da = 0;
	mat4.identity(this.matrix);
};

CircularAnimation.prototype = Object.create(Animation.prototype);
CircularAnimation.prototype.constructor=CircularAnimation;

CircularAnimation.prototype.update = function(time)
{
	console.log("da = " + this.da + " rotationAngle = " + this.rotationAngle);
	if (this.da >= this.rotationAngle + this.initialAngle)
		return;

	if (this.baseTime == 0)
		this.baseTime = time;
	else
		this.time = (time - this.baseTime);

	console.log(this.time);
	this.da = this.initialAngle + this.w * this.time;

	let matrix = mat4.create();
	mat4.identity(matrix);
	mat4.translate(matrix, matrix, this.center);
	mat4.rotate(matrix, matrix, this.da, [0, 1, 0]);
	mat4.translate(matrix, matrix, [this.radius, 0, 0]);
	mat4.rotate(matrix, matrix, Math.PI / 2, [0, 1, 0]);

	this.matrix = matrix;
};

CircularAnimation.prototype.getCurrentMatrix = function () {
	return this.matrix;
};