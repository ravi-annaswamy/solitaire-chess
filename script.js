// Global variables
var board = [];             // current board state (4x4 array)
var originalBoard = [];     // puzzle's original state (for reset)
var solutionMoves = [];     // solution moves: each move: {from: {r, c}, to: {r, c}}
var selected = null;        // currently selected cell {r, c}
var isAnimating = false;    // disable clicks during animation

// Mode flag: false = EASY, true = TOUGH.
var toughMode = false;

// Map piece letters to black chess piece image URLs (all black)
// Updated King link per request.
var pieceImages = {
  "K": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
  "Q": "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
  "R": "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
  "B": "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
  "N": "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
  "P": "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg"
};

const PIECES = ["K", "Q", "R", "B", "N", "P"];
const TOUGH_ALLOWED = ["K", "R", "B", "N", "P"]; // No Queens in tough mode

// ------------------------------
// Board utility functions
// ------------------------------
function createEmptyBoard() {
  var b = [];
  for (var r = 0; r < 4; r++) {
    b.push(new Array(4).fill(" "));
  }
  return b;
}
function cloneBoard(b) {
  return b.map(function(row) { return row.slice(); });
}
function countPieces(b) {
  var count = 0;
  for (var r = 0; r < 4; r++){
    for (var c = 0; c < 4; c++){
      if (b[r][c] !== " ") count++;
    }
  }
  return count;
}
// Algebraic notation: row0 → rank1, col0 → a, etc.
function algebraic(r, c) {
  var files = "abcd";
  return files[c] + (r + 1);
}

// ------------------------------
// Move generation & application
// ------------------------------
function getCaptures(b, r, c, piece) {
  var captures = [];
  var knightMoves = [
    {dr: -2, dc: -1}, {dr: -2, dc: 1},
    {dr: -1, dc: -2}, {dr: -1, dc: 2},
    {dr:  1, dc: -2}, {dr:  1, dc: 2},
    {dr:  2, dc: -1}, {dr:  2, dc: 1}
  ];
  var kingDirs = [
    {dr: -1, dc: -1}, {dr: -1, dc: 0}, {dr: -1, dc: 1},
    {dr:  0, dc: -1},                {dr:  0, dc: 1},
    {dr:  1, dc: -1}, {dr:  1, dc: 0}, {dr:  1, dc: 1}
  ];
  var rookDirs = [
    {dr: -1, dc: 0}, {dr: 1, dc: 0}, {dr: 0, dc: -1}, {dr: 0, dc: 1}
  ];
  var bishopDirs = [
    {dr: -1, dc: -1}, {dr: -1, dc: 1}, {dr: 1, dc: -1}, {dr: 1, dc: 1}
  ];
  var queenDirs = rookDirs.concat(bishopDirs);
  if (piece === "K") {
    kingDirs.forEach(function(d) {
      var nr = r + d.dr, nc = c + d.dc;
      if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && b[nr][nc] !== " ") {
        captures.push({r: nr, c: nc});
      }
    });
  } else if (piece === "N") {
    knightMoves.forEach(function(d) {
      var nr = r + d.dr, nc = c + d.dc;
      if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && b[nr][nc] !== " ") {
        captures.push({r: nr, c: nc});
      }
    });
  } else if (piece === "P") {
    // Pawn captures diagonally upward (r+1)
    [{dr: 1, dc: -1}, {dr: 1, dc: 1}].forEach(function(d) {
      var nr = r + d.dr, nc = c + d.dc;
      if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && b[nr][nc] !== " ") {
        captures.push({r: nr, c: nc});
      }
    });
  } else if (piece === "R" || piece === "B" || piece === "Q") {
    var dirs = [];
    if (piece === "R") dirs = rookDirs;
    else if (piece === "B") dirs = bishopDirs;
    else if (piece === "Q") dirs = queenDirs;
    dirs.forEach(function(d) {
      var nr = r + d.dr, nc = c + d.dc;
      while (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) {
        if (b[nr][nc] !== " ") {
          captures.push({r: nr, c: nc});
          break;
        }
        nr += d.dr;
        nc += d.dc;
      }
    });
  }
  return captures;
}
function generateMoves(b) {
  var moves = [];
  for (var r = 0; r < 4; r++){
    for (var c = 0; c < 4; c++){
      var piece = b[r][c];
      if (piece === " ") continue;
      var targets = getCaptures(b, r, c, piece);
      targets.forEach(function(target) {
        moves.push({from: {r: r, c: c}, to: {r: target.r, c: target.c}});
      });
    }
  }
  return moves;
}
function applyMove(b, move) {
  var newB = cloneBoard(b);
  var r1 = move.from.r, c1 = move.from.c;
  var r2 = move.to.r, c2 = move.to.c;
  newB[r2][c2] = newB[r1][c1];
  newB[r1][c1] = " ";
  return newB;
}

// ------------------------------
// Solver: Backtracking search
// ------------------------------
function solvePuzzle(b, movesSoFar, solutions, limit) {
  movesSoFar = movesSoFar || [];
  solutions = solutions || [];
  limit = limit || 2;
  if (countPieces(b) === 1) {
    solutions.push(movesSoFar);
    return;
  }
  var moves = generateMoves(b);
  for (var i = 0; i < moves.length; i++){
    var nextB = applyMove(b, moves[i]);
    solvePuzzle(nextB, movesSoFar.concat([moves[i]]), solutions, limit);
    if (solutions.length >= limit) return;
  }
}

// ------------------------------
// Puzzle Generation: Unique Puzzle (random method)
// Accepts a parameter "allowedPieces" (if not provided, uses all PIECES)
function randomPuzzle(numPieces, allowedPieces) {
  var b = createEmptyBoard();
  var positions = [];
  for (var i = 0; i < 16; i++) positions.push(i);
  positions.sort(function(){ return Math.random() - 0.5; });
  allowedPieces = allowedPieces || PIECES;
  for (var i = 0; i < numPieces; i++){
    var pos = positions[i];
    var r = Math.floor(pos / 4), c = pos % 4;
    b[r][c] = allowedPieces[Math.floor(Math.random() * allowedPieces.length)];
  }
  return b;
}
function generateUniquePuzzle(numPieces, allowedPieces) {
  var attempts = 0;
  while (attempts < 1000) {
    attempts++;
    var b = randomPuzzle(numPieces, allowedPieces);
    var solutions = [];
    solvePuzzle(b, [], solutions, 2);
    if (solutions.length === 1) {
      return {board: b, solution: solutions[0]};
    }
  }
  return null;
}

// ------------------------------
// UI Rendering & Event Handling
// ------------------------------
function renderBoard() {
  var container = document.getElementById("board-container");
  container.innerHTML = "";
  var table = document.createElement("table");
  for (var r = 3; r >= 0; r--) {
    var tr = document.createElement("tr");
    for (var c = 0; c < 4; c++) {
      var td = document.createElement("td");
      td.dataset.row = r;
      td.dataset.col = c;
      td.style.backgroundColor = ((r + c) % 2 === 0) ? "white" : "lightblue";
      if (board[r][c] !== " ") {
        var img = document.createElement("img");
        img.className = "piece";
        img.src = pieceImages[board[r][c]];
        td.appendChild(img);
      }
      td.addEventListener("click", onCellClick);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  container.appendChild(table);
}
function updateHighlights() {
  var cells = document.querySelectorAll("td");
  cells.forEach(function(cell) {
    cell.classList.remove("selected");
    cell.classList.remove("capture");
  });
  if (selected) {
    var selCell = document.querySelector("td[data-row='" + selected.r + "'][data-col='" + selected.c + "']");
    if (selCell) selCell.classList.add("selected");
    var moves = generateMoves(board).filter(function(mv) {
      return mv.from.r === selected.r && mv.from.c === selected.c;
    });
    moves.forEach(function(mv) {
      var targetCell = document.querySelector("td[data-row='" + mv.to.r + "'][data-col='" + mv.to.c + "']");
      if (targetCell) targetCell.classList.add("capture");
    });
  }
}
function onCellClick() {
  if (isAnimating) return;
  var r = parseInt(this.dataset.row);
  var c = parseInt(this.dataset.col);
  if (selected) {
    var moves = generateMoves(board).filter(function(mv) {
      return mv.from.r === selected.r && mv.from.c === selected.c;
    });
    var move = moves.find(function(mv) {
      return mv.to.r === r && mv.to.c === c;
    });
    if (move) {
      board = applyMove(board, move);
      selected = null;
      renderBoard();
      updateHighlights();
      return;
    }
  }
  if (board[r][c] !== " ") {
    selected = {r: r, c: c};
  } else {
    selected = null;
  }
  updateHighlights();
}
function animateSolution(moves) {
  board = cloneBoard(originalBoard);
  renderBoard();
  selected = null;
  updateHighlights();
  var i = 0;
  isAnimating = true;
  function nextMove() {
    if (i < moves.length) {
      board = applyMove(board, moves[i]);
      renderBoard();
      i++;
      setTimeout(nextMove, 500);
    } else {
      isAnimating = false;
      document.getElementById("solve-btn").textContent = "New";
    }
  }
  setTimeout(nextMove, 500);
}
function resetPuzzle() {
  board = cloneBoard(originalBoard);
  renderBoard();
  selected = null;
  updateHighlights();
}
// ------------------------------
// Mode display update
// ------------------------------
function updateModeDisplay() {
  var modeEl = document.getElementById("mode-display");
  modeEl.textContent = "Current Mode: " + (toughMode ? "TOUGH" : "EASY");
}
// ------------------------------
// Initialization functions
// ------------------------------
function initPuzzle() {
  toughMode = false; // EASY mode
  var result = generateUniquePuzzle(4, PIECES);
  if (!result) {
    document.getElementById("message").textContent = "Failed to generate puzzle.";
    return;
  }
  board = result.board;
  originalBoard = cloneBoard(board);
  solutionMoves = result.solution;
  renderBoard();
  updateHighlights();
  document.getElementById("message").textContent = "Puzzle generated. Click a piece to see capture options.";
  document.getElementById("solve-btn").textContent = "Solve";
  selected = null;
  updateModeDisplay();
}
function initToughPuzzle() {
  toughMode = true;
  // TOUGH mode: no queens, and at least 5 pieces.
  var numPieces = Math.floor(Math.random() * 3) + 5; // random between 5 and 7
  var result = generateUniquePuzzle(numPieces, TOUGH_ALLOWED);
  if (!result) {
    document.getElementById("message").textContent = "Failed to generate tough puzzle.";
    return;
  }
  board = result.board;
  originalBoard = cloneBoard(board);
  solutionMoves = result.solution;
  renderBoard();
  updateHighlights();
  document.getElementById("message").textContent = "Tough puzzle generated (no queens, 5+ pieces). Click a piece to see capture options.";
  document.getElementById("solve-btn").textContent = "Solve";
  selected = null;
  updateModeDisplay();
}
function toggleMode() {
  // Toggle toughMode flag and generate new puzzle accordingly.
  if (toughMode) {
    initPuzzle();
  } else {
    initToughPuzzle();
  }
}
// ------------------------------
// Event listeners
// ------------------------------
document.addEventListener("DOMContentLoaded", function(){
  initPuzzle();
  document.getElementById("solve-btn").addEventListener("click", function(){
    if (this.textContent === "Solve") {
      board = cloneBoard(originalBoard);
      renderBoard();
      animateSolution(solutionMoves);
    } else { // "New"
      if (toughMode) {
        initToughPuzzle();
      } else {
        initPuzzle();
      }
    }
  });
  document.getElementById("reset-btn").addEventListener("click", function(){
    resetPuzzle();
  });
  document.getElementById("toggle-mode-btn").addEventListener("click", function(){
    // Toggle between EASY and TOUGH modes.
    toughMode = !toughMode;
    if (toughMode) {
      initToughPuzzle();
    } else {
      initPuzzle();
    }
  });
});
