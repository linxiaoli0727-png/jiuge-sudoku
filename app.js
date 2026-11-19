(function () {
  "use strict";

  const Engine = window.SudokuEngine;
  const STORAGE_KEY = "jiuge-sudoku-profile-v1";
  const LEVELS = Engine.LEVEL_ORDER;
  const LEVEL_LABELS = {
    easy: "轻松",
    medium: "进阶",
    hard: "挑战",
  };
  const WIN_TARGET = 5;
  const MAX_MISTAKES = 5;

  const elements = {
    brandButton: document.getElementById("brandButton"),
    welcomeScreen: document.getElementById("welcomeScreen"),
    gameScreen: document.getElementById("gameScreen"),
    headerBest: document.getElementById("headerBest"),
    menuStreak: document.getElementById("menuStreak"),
    difficultyList: document.getElementById("difficultyList"),
    startButton: document.getElementById("startButton"),
    menuButton: document.getElementById("menuButton"),
    levelLabel: document.getElementById("levelLabel"),
    levelProgress: document.getElementById("levelProgress"),
    gameNumber: document.getElementById("gameNumber"),
    sudokuBoard: document.getElementById("sudokuBoard"),
    mistakeCard: document.querySelector(".mistake-card"),
    mistakeCount: document.getElementById("mistakeCount"),
    mistakeDots: document.getElementById("mistakeDots"),
    mistakeMessage: document.getElementById("mistakeMessage"),
    numberPad: document.getElementById("numberPad"),
    selectedValue: document.getElementById("selectedValue"),
    eraseButton: document.getElementById("eraseButton"),
    toast: document.getElementById("toast"),
    resultModal: document.getElementById("resultModal"),
    resultKicker: document.getElementById("resultKicker"),
    resultTitle: document.getElementById("resultTitle"),
    resultDescription: document.getElementById("resultDescription"),
    resultStreak: document.getElementById("resultStreak"),
    resultMistakes: document.getElementById("resultMistakes"),
    resultContinue: document.getElementById("resultContinue"),
    resultMenu: document.getElementById("resultMenu"),
    resultClose: document.getElementById("resultClose"),
  };

  let profile = loadProfile();
  let game = null;
  let isGenerating = false;
  let toastTimer = null;

  function defaultProfile() {
    return {
      difficulty: "easy",
      streak: 0,
      levelWins: 0,
      bestStreak: 0,
      gamesPlayed: 0,
    };
  }

  function loadProfile() {
    const defaults = defaultProfile();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return defaults;
      return {
        difficulty: LEVELS.includes(saved.difficulty)
          ? saved.difficulty
          : defaults.difficulty,
        streak: Number.isFinite(saved.streak) ? Math.max(0, saved.streak) : 0,
        levelWins: Number.isFinite(saved.levelWins)
          ? Math.max(0, saved.levelWins)
          : 0,
        bestStreak: Number.isFinite(saved.bestStreak)
          ? Math.max(0, saved.bestStreak)
          : 0,
        gamesPlayed: Number.isFinite(saved.gamesPlayed)
          ? Math.max(0, saved.gamesPlayed)
          : 0,
      };
    } catch (_error) {
      return defaults;
    }
  }

  function saveProfile() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (_error) {
      // The game remains fully playable when local storage is unavailable.
    }
  }

  function buildStaticControls() {
    for (let digit = 1; digit <= 9; digit += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "number-key";
      button.dataset.number = String(digit);
      button.textContent = String(digit);
      button.setAttribute("aria-label", `填入数字 ${digit}`);
      button.addEventListener("click", () => enterNumber(digit));
      elements.numberPad.appendChild(button);
    }

    for (let index = 0; index < MAX_MISTAKES; index += 1) {
      elements.mistakeDots.appendChild(document.createElement("span"));
    }

    elements.difficultyList.addEventListener("change", () => {
      updateSelectedDifficulty();
    });
    elements.startButton.addEventListener("click", beginFromMenu);
    elements.numberPad.addEventListener("click", () => {});
    elements.eraseButton.addEventListener("click", eraseSelected);
    elements.menuButton.addEventListener("click", showWelcome);
    elements.brandButton.addEventListener("click", showWelcome);
    elements.resultContinue.addEventListener("click", continueAfterResult);
    elements.resultMenu.addEventListener("click", showWelcomeFromModal);
    elements.resultClose.addEventListener("click", closeResultModal);
    document.addEventListener("keydown", handleKeyboard);
  }

  function updateSelectedDifficulty() {
    const checked = document.querySelector(
      'input[name="difficulty"]:checked'
    );
    if (!checked) return;
    const changed = checked.value !== profile.difficulty;
    elements.startButton.querySelector("span").textContent = changed
      ? `以${LEVEL_LABELS[checked.value]}难度开始`
      : "开始新局";
    if (changed) {
      return;
    }
    elements.menuStreak.textContent = `连胜 ${profile.streak}`;
  }

  function updateProfileDisplay() {
    elements.headerBest.textContent = String(profile.bestStreak);
    elements.menuStreak.textContent = `连胜 ${profile.streak}`;
    const checked = document.querySelector(
      'input[name="difficulty"]:checked'
    );
    if (checked) {
      elements.startButton.querySelector("span").textContent =
        checked.value === profile.difficulty
          ? "开始新局"
          : `以${LEVEL_LABELS[checked.value]}难度开始`;
    }
  }

  function selectDifficultyInMenu(level) {
    const input = document.querySelector(
      `input[name="difficulty"][value="${level}"]`
    );
    if (input) input.checked = true;
  }

  function beginFromMenu() {
    if (isGenerating) return;
    const checked = document.querySelector(
      'input[name="difficulty"]:checked'
    );
    const level = checked ? checked.value : profile.difficulty;

    if (level !== profile.difficulty) {
      profile.difficulty = level;
      profile.streak = 0;
      profile.levelWins = 0;
      saveProfile();
      updateProfileDisplay();
    }
    startGame(level);
  }

  function startGame(level) {
    if (isGenerating) return;
    isGenerating = true;
    elements.startButton.disabled = true;
    elements.startButton.querySelector("span").textContent = "正在生成新题…";

    window.setTimeout(() => {
      const generated = Engine.generatePuzzle(level);
      game = {
        difficulty: level,
        solution: generated.solution,
        puzzle: generated.puzzle,
        board: generated.puzzle.slice(),
        clues: generated.clues,
        selected: generated.puzzle.findIndex((value) => value === 0),
        mistakes: 0,
        wrongCells: new Set(),
        status: "playing",
        upgraded: false,
        continueLevel: level,
      };
      profile.gamesPlayed += 1;
      saveProfile();
      isGenerating = false;
      elements.startButton.disabled = false;
      elements.startButton.querySelector("span").textContent = "开始新局";
      elements.welcomeScreen.classList.add("is-hidden");
      elements.gameScreen.classList.remove("is-hidden");
      closeResultModal(true);
      renderBoard();
      renderGameStatus();
      syncInputs();
      elements.gameScreen.scrollIntoView({ block: "start", behavior: "smooth" });
      focusSelectedCell();
    }, 45);
  }

  function renderBoard() {
    elements.sudokuBoard.replaceChildren();
    if (!game) return;

    const selectedValue =
      game.selected !== null && game.selected >= 0
        ? game.board[game.selected]
        : 0;
    const selectedRow =
      game.selected !== null && game.selected >= 0
        ? Math.floor(game.selected / 9)
        : -1;
    const selectedColumn =
      game.selected !== null && game.selected >= 0
        ? game.selected % 9
        : -1;
    const selectedBox =
      selectedRow >= 0
        ? Math.floor(selectedRow / 3) * 3 + Math.floor(selectedColumn / 3)
        : -1;

    for (let index = 0; index < 81; index += 1) {
      const row = Math.floor(index / 9);
      const column = index % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
      const cell = document.createElement("button");
      const value = game.board[index];
      const isClue = game.puzzle[index] !== 0;
      const isWrong = game.wrongCells.has(index);
      const isPeer =
        selectedRow >= 0 &&
        index !== game.selected &&
        (row === selectedRow || column === selectedColumn || box === selectedBox);

      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = String(index);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute(
        "aria-label",
        `第 ${row + 1} 行，第 ${column + 1} 列，${
          value ? `数字 ${value}` : "空格"
        }${isClue ? "，题目数字" : ""}${isWrong ? "，填写错误" : ""}`
      );
      if (column === 2 || column === 5) cell.classList.add("box-right");
      if (row === 2 || row === 5) cell.classList.add("box-bottom");
      if (column === 8) cell.classList.add("last-column");
      if (row === 8) cell.classList.add("last-row");
      if (isClue) cell.classList.add("clue");
      if (!isClue && value) cell.classList.add("user-value");
      if (isPeer) cell.classList.add("peer");
      if (
        selectedValue &&
        value === selectedValue &&
        index !== game.selected
      ) {
        cell.classList.add("same-value");
      }
      if (index === game.selected) cell.classList.add("selected");
      if (isWrong) cell.classList.add("wrong");
      if (game.status !== "playing") cell.disabled = true;

      cell.textContent = value ? String(value) : "";
      if (!isClue && game.status === "playing") {
        cell.addEventListener("click", () => selectCell(index));
      }
      elements.sudokuBoard.appendChild(cell);
    }
  }

  function renderGameStatus() {
    if (!game) return;
    elements.levelLabel.textContent = LEVEL_LABELS[game.difficulty];
    elements.levelProgress.textContent =
      game.difficulty === "hard"
        ? "无限挑战 · 连续胜场"
        : `本级连胜 ${profile.levelWins} / ${WIN_TARGET}`;
    elements.gameNumber.textContent = `第 ${profile.gamesPlayed} 局`;
    elements.mistakeCount.textContent = String(game.mistakes);

    [...elements.mistakeDots.children].forEach((dot, index) => {
      dot.classList.toggle("used", index < game.mistakes);
    });

    const remaining = MAX_MISTAKES - game.mistakes;
    if (remaining <= 0) {
      elements.mistakeMessage.textContent = "本局机会已用完";
    } else if (remaining === 1) {
      elements.mistakeMessage.textContent = "最后 1 次机会";
    } else {
      elements.mistakeMessage.textContent = `还有 ${remaining} 次机会`;
    }
    elements.mistakeCard.classList.remove("is-critical");
    if (remaining <= 1) {
      void elements.mistakeCard.offsetWidth;
      elements.mistakeCard.classList.add("is-critical");
    }
  }

  function syncInputs() {
    const canPlay = Boolean(game && game.status === "playing");
    const selectedCell =
      canPlay &&
      game.selected !== null &&
      game.selected >= 0 &&
      game.board[game.selected] !== game.puzzle[game.selected];
    const selected = canPlay && game.selected >= 0 ? game.selected : null;
    const selectedHasValue = selected !== null && game.board[selected] !== 0;

    [...elements.numberPad.querySelectorAll("button")].forEach((button) => {
      button.disabled = !selectedCell;
    });
    elements.eraseButton.disabled = !selectedHasValue;

    if (!canPlay) {
      elements.selectedValue.textContent = "本局已结束";
    } else if (selected === null) {
      elements.selectedValue.textContent = "未选择";
    } else {
      const row = Math.floor(selected / 9) + 1;
      const column = (selected % 9) + 1;
      elements.selectedValue.textContent = `第 ${row} 行 · ${column} 列`;
    }
  }

  function selectCell(index, shouldFocus) {
    if (!game || game.status !== "playing" || game.puzzle[index]) return;
    game.selected = index;
    renderBoard();
    syncInputs();
    if (shouldFocus) focusSelectedCell();
  }

  function enterNumber(digit) {
    if (!game || game.status !== "playing") return;
    if (
      game.selected === null ||
      game.selected < 0 ||
      game.puzzle[game.selected] !== 0
    ) {
      showToast("先选择一个空格");
      return;
    }

    const index = game.selected;
    game.board[index] = digit;
    game.wrongCells.delete(index);

    if (digit !== game.solution[index]) {
      game.mistakes += 1;
      game.wrongCells.add(index);
      renderBoard();
      renderGameStatus();
      syncInputs();
      shakeCell(index);
      if (game.mistakes >= MAX_MISTAKES) {
        game.status = "lost";
        profile.streak = 0;
        profile.levelWins = 0;
        saveProfile();
        updateProfileDisplay();
        renderBoard();
        syncInputs();
        window.setTimeout(() => showResult(false), 320);
      } else {
        showToast(`这个数字不对 · 还剩 ${MAX_MISTAKES - game.mistakes} 次机会`);
      }
      return;
    }

    renderBoard();
    renderGameStatus();
    syncInputs();
    focusSelectedCell();
    if (game.board.every((value, cellIndex) => value === game.solution[cellIndex])) {
      finishWin();
    }
  }

  function eraseSelected() {
    if (!game || game.status !== "playing") return;
    const index = game.selected;
    if (index === null || index < 0 || game.puzzle[index] !== 0) return;
    game.board[index] = 0;
    game.wrongCells.delete(index);
    renderBoard();
    syncInputs();
    focusSelectedCell();
  }

  function finishWin() {
    game.status = "won";
    profile.streak += 1;
    profile.levelWins += 1;
    profile.bestStreak = Math.max(profile.bestStreak, profile.streak);

    let nextLevel = game.difficulty;
    if (game.difficulty !== "hard" && profile.levelWins >= WIN_TARGET) {
      const currentIndex = LEVELS.indexOf(game.difficulty);
      nextLevel = LEVELS[currentIndex + 1];
      profile.difficulty = nextLevel;
      profile.levelWins = 0;
      game.upgraded = true;
    }
    game.continueLevel = nextLevel;
    saveProfile();
    updateProfileDisplay();
    renderBoard();
    renderGameStatus();
    syncInputs();
    window.setTimeout(() => showResult(true), 280);
  }

  function showResult(won) {
    if (!game) return;
    const upgraded = won && game.upgraded;
    elements.resultKicker.textContent = won ? "本局完成" : "五次错误";
    elements.resultTitle.textContent = won
      ? upgraded
        ? "连胜五局，升阶成功"
        : "九格填满"
      : "本局结束";
    elements.resultDescription.textContent = won
      ? upgraded
        ? `下一局进入${LEVEL_LABELS[game.continueLevel]}难度。连续胜场会保留，继续向上挑战。`
        : game.difficulty === "hard"
          ? "无限挑战仍在继续。这局做得漂亮，下一局又是全新的棋盘。"
          : `再赢 ${Math.max(0, WIN_TARGET - profile.levelWins)} 局，就会自动进入${LEVEL_LABELS[LEVELS[LEVELS.indexOf(game.difficulty) + 1]]}难度。`
      : "本局累计填错 5 次，连胜已清零。调整一下，再用同一难度开始新局。";
    elements.resultStreak.textContent = String(profile.streak);
    elements.resultMistakes.textContent = String(game.mistakes);
    elements.resultContinue.querySelector("span").textContent = won
      ? upgraded
        ? `进入${LEVEL_LABELS[game.continueLevel]}`
        : "再来一局"
      : "同难度再来一局";
    elements.resultModal.classList.remove("is-hidden");
    window.setTimeout(() => elements.resultContinue.focus(), 60);
  }

  function closeResultModal(silent) {
    elements.resultModal.classList.add("is-hidden");
    if (!silent && game && game.status === "playing") {
      focusSelectedCell();
    }
  }

  function continueAfterResult() {
    if (!game) return;
    const level = game.status === "won" ? game.continueLevel : game.difficulty;
    closeResultModal(true);
    startGame(level);
  }

  function showWelcome() {
    if (isGenerating) return;
    closeResultModal(true);
    game = null;
    elements.gameScreen.classList.add("is-hidden");
    elements.welcomeScreen.classList.remove("is-hidden");
    selectDifficultyInMenu(profile.difficulty);
    updateProfileDisplay();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showWelcomeFromModal() {
    showWelcome();
  }

  function handleKeyboard(event) {
    if (
      !elements.resultModal.classList.contains("is-hidden") ||
      elements.gameScreen.classList.contains("is-hidden") ||
      !game ||
      game.status !== "playing"
    ) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      enterNumber(Number(event.key));
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      eraseSelected();
      return;
    }

    const directions = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (!directions[event.key]) return;
    event.preventDefault();

    const current =
      game.selected === null || game.selected < 0
        ? { row: 0, column: 0 }
        : {
            row: Math.floor(game.selected / 9),
            column: game.selected % 9,
          };
    const [rowStep, columnStep] = directions[event.key];
    let row = current.row;
    let column = current.column;

    for (let attempts = 0; attempts < 9; attempts += 1) {
      row = (row + rowStep + 9) % 9;
      column = (column + columnStep + 9) % 9;
      const nextIndex = row * 9 + column;
      if (game.puzzle[nextIndex] === 0) {
        selectCell(nextIndex, true);
        return;
      }
    }
  }

  function shakeCell(index) {
    const cell = elements.sudokuBoard.querySelector(`[data-index="${index}"]`);
    if (cell) {
      cell.classList.remove("shake");
      void cell.offsetWidth;
      cell.classList.add("shake");
    }
  }

  function focusSelectedCell() {
    if (!game || game.selected === null || game.selected < 0) return;
    const cell = elements.sudokuBoard.querySelector(
      `[data-index="${game.selected}"]`
    );
    if (cell && !cell.disabled) cell.focus({ preventScroll: true });
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("show");
    }, 2200);
  }

  buildStaticControls();
  selectDifficultyInMenu(profile.difficulty);
  updateProfileDisplay();
})();
