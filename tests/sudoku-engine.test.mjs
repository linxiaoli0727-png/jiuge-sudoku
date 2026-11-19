import { createRequire } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const Engine = require("../sudoku-engine.js");

function seededRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

test("generates valid uniquely solvable puzzles for every difficulty", () => {
  for (const [index, level] of Engine.LEVEL_ORDER.entries()) {
    const game = Engine.generatePuzzle(level, seededRandom(100 + index));
    assert.equal(game.difficulty, level);
    assert.equal(game.solution.length, 81);
    assert.equal(game.puzzle.length, 81);
    assert.ok(Engine.isValidSolution(game.solution));
    assert.equal(Engine.countSolutions(game.puzzle, 2), 1);
    assert.ok(
      game.clues <= Engine.DIFFICULTIES[level].clues,
      `${level} should not have more than its clue target`
    );
    for (let cell = 0; cell < 81; cell += 1) {
      if (game.puzzle[cell]) {
        assert.equal(game.puzzle[cell], game.solution[cell]);
      }
    }
  }
});

test("difficulty targets produce progressively fewer clues", () => {
  const counts = Engine.LEVEL_ORDER.map((level) => {
    const game = Engine.generatePuzzle(level, seededRandom(42));
    return game.clues;
  });
  assert.ok(counts[0] > counts[1]);
  assert.ok(counts[1] > counts[2]);
});

test("different random seeds produce different boards", () => {
  const first = Engine.generatePuzzle("medium", seededRandom(1));
  const second = Engine.generatePuzzle("medium", seededRandom(2));
  assert.notDeepEqual(first.puzzle, second.puzzle);
  assert.notDeepEqual(first.solution, second.solution);
});

test("reports duplicate digits as zero solutions", () => {
  const invalid = new Array(81).fill(0);
  invalid[0] = 1;
  invalid[1] = 1;
  assert.equal(Engine.countSolutions(invalid, 2), 0);
});
