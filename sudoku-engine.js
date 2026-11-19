(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.SudokuEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DIFFICULTIES = Object.freeze({
    easy: Object.freeze({ label: "轻松", clues: 42 }),
    medium: Object.freeze({ label: "进阶", clues: 34 }),
    hard: Object.freeze({ label: "挑战", clues: 28 }),
  });

  const LEVEL_ORDER = Object.freeze(["easy", "medium", "hard"]);
  const FULL_MASK = 0x1ff;
  const BIT_TO_DIGIT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  function shuffle(values, random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function boxIndex(row, column) {
    return Math.floor(row / 3) * 3 + Math.floor(column / 3);
  }

  function createSolution(random) {
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
    const rowGroups = shuffle([0, 1, 2], random);
    const columnGroups = shuffle([0, 1, 2], random);
    const rows = rowGroups.flatMap((group) =>
      shuffle([0, 1, 2], random).map((offset) => group * 3 + offset)
    );
    const columns = columnGroups.flatMap((group) =>
      shuffle([0, 1, 2], random).map((offset) => group * 3 + offset)
    );

    const solution = new Array(81);
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        const pattern =
          (3 * (rows[row] % 3) + Math.floor(rows[row] / 3) + columns[column]) %
          9;
        solution[row * 9 + column] = digits[pattern];
      }
    }
    return solution;
  }

  function countSolutions(board, limit) {
    const solutionLimit = limit || 2;
    const values = board.slice();
    const rowMasks = new Array(9).fill(0);
    const columnMasks = new Array(9).fill(0);
    const boxMasks = new Array(9).fill(0);
    let solutions = 0;

    for (let index = 0; index < 81; index += 1) {
      const value = values[index];
      if (!value) continue;
      const row = Math.floor(index / 9);
      const column = index % 9;
      const box = boxIndex(row, column);
      const bit = 1 << (value - 1);
      if (
        (rowMasks[row] & bit) ||
        (columnMasks[column] & bit) ||
        (boxMasks[box] & bit)
      ) {
        return 0;
      }
      rowMasks[row] |= bit;
      columnMasks[column] |= bit;
      boxMasks[box] |= bit;
    }

    function search() {
      if (solutions >= solutionLimit) return;

      let bestIndex = -1;
      let bestMask = 0;
      let bestCount = 10;

      for (let index = 0; index < 81; index += 1) {
        if (values[index]) continue;
        const row = Math.floor(index / 9);
        const column = index % 9;
        const box = boxIndex(row, column);
        const mask =
          FULL_MASK &
          ~(rowMasks[row] | columnMasks[column] | boxMasks[box]);
        let count = 0;
        let remaining = mask;
        while (remaining) {
          remaining &= remaining - 1;
          count += 1;
        }
        if (count === 0) return;
        if (count < bestCount) {
          bestCount = count;
          bestIndex = index;
          bestMask = mask;
          if (count === 1) break;
        }
      }

      if (bestIndex === -1) {
        solutions += 1;
        return;
      }

      const row = Math.floor(bestIndex / 9);
      const column = bestIndex % 9;
      const box = boxIndex(row, column);
      let candidates = bestMask;

      while (candidates && solutions < solutionLimit) {
        const bit = candidates & -candidates;
        candidates ^= bit;
        const digit = BIT_TO_DIGIT[Math.log2(bit) + 1];
        values[bestIndex] = digit;
        rowMasks[row] |= bit;
        columnMasks[column] |= bit;
        boxMasks[box] |= bit;
        search();
        values[bestIndex] = 0;
        rowMasks[row] &= ~bit;
        columnMasks[column] &= ~bit;
        boxMasks[box] &= ~bit;
      }
    }

    search();
    return solutions;
  }

  function removeClues(solution, targetClues, random) {
    const puzzle = solution.slice();
    const positions = shuffle(
      Array.from({ length: 81 }, (_, index) => index),
      random
    );
    let clueCount = 81;

    for (const index of positions) {
      if (clueCount <= targetClues) break;
      const saved = puzzle[index];
      puzzle[index] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        clueCount -= 1;
      } else {
        puzzle[index] = saved;
      }
    }
    return puzzle;
  }

  function generatePuzzle(level, random) {
    const difficulty = DIFFICULTIES[level] ? level : "easy";
    const rng = typeof random === "function" ? random : Math.random;
    const solution = createSolution(rng);
    const puzzle = removeClues(
      solution,
      DIFFICULTIES[difficulty].clues,
      rng
    );
    const clues = puzzle.reduce(
      (count, value) => count + (value === 0 ? 0 : 1),
      0
    );
    return { difficulty, puzzle, solution, clues };
  }

  function isValidSolution(board) {
    if (!Array.isArray(board) || board.length !== 81) return false;
    const expected = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);

    for (let row = 0; row < 9; row += 1) {
      const rowValues = new Set(board.slice(row * 9, row * 9 + 9).map(String));
      if (rowValues.size !== 9 || ![...expected].every((value) => rowValues.has(value))) {
        return false;
      }
    }

    for (let column = 0; column < 9; column += 1) {
      const columnValues = new Set();
      for (let row = 0; row < 9; row += 1) {
        columnValues.add(String(board[row * 9 + column]));
      }
      if (
        columnValues.size !== 9 ||
        ![...expected].every((value) => columnValues.has(value))
      ) {
        return false;
      }
    }

    for (let box = 0; box < 9; box += 1) {
      const boxValues = new Set();
      const startRow = Math.floor(box / 3) * 3;
      const startColumn = (box % 3) * 3;
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          boxValues.add(String(board[(startRow + row) * 9 + startColumn + column]));
        }
      }
      if (
        boxValues.size !== 9 ||
        ![...expected].every((value) => boxValues.has(value))
      ) {
        return false;
      }
    }
    return true;
  }

  return {
    DIFFICULTIES,
    LEVEL_ORDER,
    countSolutions,
    generatePuzzle,
    isValidSolution,
  };
});
