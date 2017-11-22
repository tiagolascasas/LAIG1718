function LinearAnimation(v, points)
{
	Animation.call(this, v);

	this.simpleLinears = [];
	this.simpleEndTimes = [];
	for (let i = 0; i < points.length - 1; i++)
	{
		let anim = new SimpleLinearAnimation(v, points[i], points[i + 1]);
		this.simpleLinears.push(anim);

		let sumOfPreviousTimes = this.sum();
		this.simpleEndTimes.push(sumOfPreviousTimes + anim.getEndTime());
	}
	console.log(this.simpleEndTimes);
};

LinearAnimation.prototype = Object.create(Animation.prototype);
LinearAnimation.prototype.constructor=LinearAnimation;

LinearAnimation.prototype.sum = function()
{
	let n = 0;
	for (let i = 0; i < this.simpleEndTimes.length; i++)
		n += this.simpleEndTimes[i];
	return n;
};

LinearAnimation.prototype.calculateMatrix = function(time)
{
	for (let i = 0; i < this.simpleLinears.length; i++)
	{
		if (time < this.simpleEndTimes[i])
		{
			let delta = i == 0 ? time : time - this.simpleEndTimes[i - 1];
			return this.simpleLinears[i].calculateMatrix(delta);
		}
	}
	return null;
};
