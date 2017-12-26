Oolong.prototype.resetState = function()
{
    //altered during the match
    this.currentPickedPiece = -1;
    this.currentPickedDish = -1;
    this.newPick = false;
    this.moveIsValid = false;
    this.currentPlayer = "none";
    this.currentPlayerType = false;
    this.winner = "none";
    this.winnerIsSet = false;
    this.aiMove = null;
    this.aiMoveReady = false;
    this.startedMoving = false;
    this.board = null;
    this.doneUpdating = false;
    this.move = null;
    this.retry = false;
    this.startCamera = false;
    this.cameraPanning = false;

    //state machine breakpoints
    this.readyForTurn = false;
    this.readyForChoice = false;
    this.readyForMove = false;
    this.readyForAnimation = false;
    this.readyForVictory = false;
    this.readyForUpdate = false;

    //server request flags
    this.requestedMove = false;
    this.requestedMovePiece = false;
    this.requestedPlayer = false;
    this.requestedPlayerType = false;
    this.requestedWinner = false;
    this.requestedWaiterTable = false;
    this.requestedBoard = false;
};

Oolong.prototype.stateTurn = function(time)
{
    if (!this.requestedPlayerType)
    {
        this.request("current_player_type");
        this.requestedPlayerType = true;
    }

    if (!this.requestedPlayer)
    {
        this.request("current_player");
        this.requestedPlayer = true;
    }

    if (!this.requestedWaiterTable)
    {
        this.request("waiter_pos");
        this.requestedWaiterTable = true;
    }

    if (this.startCamera)
    {
        let startTable = this.previousWaiter.table;
        let endTable = this.waiter.table;

        if (startTable == endTable)
        {
            this.readyForTurn = false;
            this.readyForChoice = true;
            return;
        }

        this.cameraPan = new CameraOrbiter(startTable, endTable, 0.003);
        this.baseTime = time;
        this.cameraPanning = true;
        this.startCamera = false;
    }

    if (this.cameraPanning)
    {
        time -=  this.baseTime;
        let angle = this.cameraPan.calculateAngle(time);

        if (angle != null)
            this.cameraAngle = angle;
        else
        {
            this.readyForTurn = false;
            this.readyForChoice = true;
        }
    }
};

Oolong.prototype.stateChoice = function()
{
    //if current player is human, get position from him
    if (this.currentPlayerType == "human")
    {
        console.log("In Human");

        let piece = this.getPickedPiece();
        let dish = this.getPickedDish();

        if (piece == null || dish == null)
            return;

        if (!this.requestedMove)
        {
            this.request("move_human(" + dish.table + "-" + dish.pos + ")");
            this.requestedMove = true;
        }
        if (this.moveIsValid)
        {
            console.log("valid human move");
            this.currentPickedDish = dish;
            this.currentPickedPiece = piece;
            this.readyForChoice = false;
            this.readyForMove = true;
            this.move = dish.pos;
        }
    }
    //if current player is AI, ask the logic to generate a move
    if (this.currentPlayerType == "ai")
    {
        this.currentPickedDish = -1;
        this.currentPickedPiece = -1;
        this.newPick = false;

        if (!this.requestedMove)
        {
            this.request("move_AI");
            this.requestedMove = true;
        }
        if (this.aiMoveReady == true)
        {
            this.aiMoveReady = false;
            console.log("Making AI move " + this.aiMove);
            this.currentPickedDish = this.dishes[this.waiter.table][this.aiMove];
            this.currentPickedPiece = this.getRandomPiece();
            this.readyForChoice = false;
            this.readyForMove = true;
            this.move = this.aiMove;
        }
    }
};

Oolong.prototype.stateMove = function(time)
{
    if (!this.requestedMovePiece)
    {
        this.request("move(" + this.move + ")");
        this.requestedMovePiece = true;
    }

    if (!this.startedMoving && this.readyForAnimation)
    {
        let origin = this.currentPickedPiece.coord;
        let dest = this.currentPickedDish.coord;

        let p1 = [origin.x, origin.y, origin.z];
        let p2 = [origin.x, origin.y + 1, origin.z];
        let p3 = [dest.x, dest.y + 1, dest.z];
        let p4 = [dest.x, dest.y + 0.1, dest.z];

        this.bezier = new BezierAnimation(0.002, [p1, p2, p3, p4]);
        this.baseTime = time;
        this.startedMoving = true;
    }
    if (this.startedMoving && this.readyForAnimation)
    {
        time -= this.baseTime;
        let mat = this.bezier.calculateMatrix(time);
        if (mat != null)
            this.matrix = mat;
        else
        {
            this.readyForAnimation = false;
            this.matrix = mat4.identity(mat4.create());
            this.readyForMove = false;
            this.readyForVictory = true;
            let pos = this.currentPickedDish.pos;
            let table = this.currentPickedDish.table;
            let coord = this.calculateCoord(table, pos);
            this.currentPickedPiece.place(table, pos, coord);
        }
    }
};

Oolong.prototype.stateVictory = function()
{
    this.readyForVictory = false;
    this.request("victory");
    this.requestedWinner = true;
};

Oolong.prototype.stateUpdate = function()
{
    //request board
    if (!this.requestedBoard)
    {
        this.request("board");
        this.requestedBoard = true;
    }

    if (this.board != null)
    {
        console.log("updating board...");
        let board = this.parseBoardState(this.board);
        this.doneUpdating = true;
    }

    if (this.doneUpdating)
    {
        this.resetState();
        //back at beginning
        this.readyForTurn = true;
    }
};

Oolong.prototype.update = function(time)
{
    if (!this.running)
        return;

    //get current player and its type
    if (this.readyForTurn)
        this.stateTurn(time);

    //current player chooses a piece and a position
    if (this.readyForChoice)
        this.stateChoice();

    //move the piece
    if (this.readyForMove)
        this.stateMove(time);

    //check for victory
    if (!this.requestedWinner && this.readyForVictory)
        this.stateVictory();

    //end game if one of the players wins
    if (this.winnerIsSet)
    {
        if (this.winner == "black" || this.winner == "green")
        {
            console.log(this.winner + " player wins!");
            this.running = false;
        }
    }

    //update board
    if (this.readyForUpdate)
        this.stateUpdate();
};