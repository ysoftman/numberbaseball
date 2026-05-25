const MAX_ATTEMPTS = 10;

const state = {
  answerLength: 3,
  allowZero: true,
  answer: [],
  currentGuess: [],
  guesses: [],
  isGameOver: false,
};

const elements = {
  attemptCount: document.querySelector("#attemptCount"),
  remainingCount: document.querySelector("#remainingCount"),
  bestScore: document.querySelector("#bestScore"),
  resultCallout: document.querySelector("#resultCallout"),
  digitDisplay: document.querySelector("#digitDisplay"),
  statusText: document.querySelector("#statusText"),
  keypad: document.querySelector("#keypad"),
  submitButton: document.querySelector("#submitButton"),
  deleteButton: document.querySelector("#deleteButton"),
  newGameButton: document.querySelector("#newGameButton"),
  allowZeroToggle: document.querySelector("#allowZeroToggle"),
  answerLengthLabel: document.querySelector("#answerLengthLabel"),
  historyList: document.querySelector("#historyList"),
  emptyHistory: document.querySelector("#emptyHistory"),
  revealButton: document.querySelector("#revealButton"),
  themeToggle: document.querySelector("#themeToggle"),
  themeIcon: document.querySelector("#themeToggle .theme-icon"),
  buildVersion: document.querySelector("#buildVersion"),
  buildTime: document.querySelector("#buildTime"),
  segments: [...document.querySelectorAll(".segment")],
};

const THEME_STORAGE_KEY = "number-baseball-theme";
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function createAnswer() {
  const pool = Array.from({ length: 10 }, (_, index) => String(index)).filter(
    (digit) => state.allowZero || digit !== "0",
  );
  const answer = [];

  while (answer.length < state.answerLength) {
    const digit = pool[Math.floor(Math.random() * pool.length)];
    if (!answer.includes(digit)) {
      answer.push(digit);
    }
  }

  return answer;
}

function getStorageKey() {
  return `number-baseball-best-${state.answerLength}-${state.allowZero ? "zero" : "no-zero"}`;
}

function getBestScore() {
  try {
    const saved = Number(localStorage.getItem(getStorageKey()));
    return Number.isFinite(saved) && saved > 0 ? saved : null;
  } catch {
    return null;
  }
}

function saveBestScore(attempts) {
  const best = getBestScore();
  if (best && attempts >= best) {
    return;
  }

  try {
    localStorage.setItem(getStorageKey(), String(attempts));
  } catch {
    setStatus("성공했지만 브라우저가 최고 기록 저장을 막았습니다.", "success");
  }
}

function evaluateGuess(guess) {
  let strikes = 0;
  let balls = 0;

  guess.forEach((digit, index) => {
    if (state.answer[index] === digit) {
      strikes += 1;
      return;
    }

    if (state.answer.includes(digit)) {
      balls += 1;
    }
  });

  return { strikes, balls };
}

function formatResult(result) {
  if (result.strikes === 0 && result.balls === 0) {
    return "OUT";
  }

  const parts = [];
  if (result.strikes > 0) {
    parts.push(`${result.strikes}S`);
  }
  if (result.balls > 0) {
    parts.push(`${result.balls}B`);
  }

  return parts.join(" ");
}

function formatResultBadges(result) {
  if (result.strikes === 0 && result.balls === 0) {
    return `<span class="history-badge is-out">OUT</span>`;
  }

  const badges = [];
  if (result.strikes > 0) {
    badges.push(
      `<span class="history-badge is-strike">${result.strikes}S</span>`,
    );
  }
  if (result.balls > 0) {
    badges.push(`<span class="history-badge is-ball">${result.balls}B</span>`);
  }

  return badges.join("");
}

function setStatus(message, tone = "normal") {
  elements.statusText.textContent = message;
  elements.statusText.classList.toggle("is-error", tone === "error");
  elements.statusText.classList.toggle("is-success", tone === "success");
}

function updateCallout(label, value) {
  elements.resultCallout.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
}

function renderDigits() {
  elements.digitDisplay.style.setProperty(
    "--answer-length",
    state.answerLength,
  );
  elements.digitDisplay.innerHTML = "";

  for (let index = 0; index < state.answerLength; index += 1) {
    const slot = document.createElement("div");
    slot.className = "digit-slot";
    slot.textContent = state.currentGuess[index] ?? "";
    slot.classList.toggle("is-filled", Boolean(state.currentGuess[index]));
    elements.digitDisplay.append(slot);
  }
}

function renderKeypad() {
  elements.keypad.innerHTML = "";

  for (let digit = 0; digit <= 9; digit += 1) {
    const value = String(digit);
    const button = document.createElement("button");
    button.className = "digit-key";
    button.type = "button";
    button.textContent = value;
    button.disabled =
      state.isGameOver ||
      (!state.allowZero && value === "0") ||
      state.currentGuess.includes(value) ||
      state.currentGuess.length >= state.answerLength;
    button.addEventListener("click", () => addDigit(value));
    elements.keypad.append(button);
  }
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  elements.emptyHistory.classList.toggle("is-hidden", state.guesses.length > 0);

  state.guesses.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "history-item";
    item.innerHTML = `
      <span class="history-number">${index + 1}</span>
      <span class="history-guess">${entry.guess.join("")}</span>
      <span class="history-result">${formatResultBadges(entry.result)}</span>
    `;
    elements.historyList.prepend(item);
  });
}

function renderSettings() {
  elements.answerLengthLabel.textContent = `${state.answerLength}자리`;
  elements.allowZeroToggle.checked = state.allowZero;
  elements.segments.forEach((segment) => {
    const isActive = Number(segment.dataset.length) === state.answerLength;
    segment.classList.toggle("is-active", isActive);
    segment.setAttribute("aria-pressed", String(isActive));
  });
}

function renderStats() {
  const attempts = state.guesses.length;
  const best = getBestScore();

  elements.attemptCount.textContent = attempts;
  elements.remainingCount.textContent = Math.max(MAX_ATTEMPTS - attempts, 0);
  elements.bestScore.textContent = best ? `${best}회` : "-";
}

function renderControls() {
  const canSubmit =
    !state.isGameOver && state.currentGuess.length === state.answerLength;
  const canDelete = !state.isGameOver && state.currentGuess.length > 0;

  elements.submitButton.disabled = !canSubmit;
  elements.deleteButton.disabled = !canDelete;
  elements.revealButton.disabled = false;
}

function renderInput() {
  renderDigits();
  renderKeypad();
  renderControls();
}

function render() {
  renderInput();
  renderHistory();
  renderSettings();
  renderStats();
}

function startGame(message = "서로 다른 숫자를 입력하세요.") {
  state.answer = createAnswer();
  state.currentGuess = [];
  state.guesses = [];
  state.isGameOver = false;
  elements.revealButton.textContent = "정답 보기";
  setStatus(message);
  updateCallout("플레이 볼", "정답을 맞혀보세요");
  render();
}

function addDigit(digit) {
  if (state.isGameOver) {
    return;
  }

  if (!state.allowZero && digit === "0") {
    setStatus("현재 설정에서는 0을 사용할 수 없습니다.", "error");
    return;
  }

  if (state.currentGuess.includes(digit)) {
    setStatus("같은 숫자는 한 번만 입력할 수 있습니다.", "error");
    return;
  }

  if (state.currentGuess.length >= state.answerLength) {
    setStatus(`${state.answerLength}자리까지만 입력할 수 있습니다.`, "error");
    return;
  }

  state.currentGuess.push(digit);
  setStatus("입력 중입니다.");
  renderInput();
}

function deleteDigit() {
  if (state.isGameOver) {
    return;
  }

  if (state.currentGuess.length === 0) {
    setStatus("지울 숫자가 없습니다.", "error");
    return;
  }

  state.currentGuess.pop();
  setStatus("마지막 숫자를 지웠습니다.");
  renderInput();
}

function endGame(hasWon) {
  state.isGameOver = true;

  if (hasWon) {
    saveBestScore(state.guesses.length);
    setStatus(
      `정답입니다. ${state.guesses.length}번 만에 성공했습니다.`,
      "success",
    );
    updateCallout("홈런", `${state.guesses.length}회 성공`);
  } else {
    setStatus(
      `기회가 끝났습니다. 정답은 ${state.answer.join("")} 입니다.`,
      "error",
    );
    updateCallout("게임 종료", `정답 ${state.answer.join("")}`);
  }

  render();
}

function submitGuess() {
  if (state.isGameOver) {
    return;
  }

  if (state.currentGuess.length !== state.answerLength) {
    setStatus(`${state.answerLength}자리 숫자를 모두 입력하세요.`, "error");
    return;
  }

  const result = evaluateGuess(state.currentGuess);
  state.guesses.push({
    guess: [...state.currentGuess],
    result,
  });

  state.currentGuess = [];
  updateCallout("심판 판정", formatResult(result));

  if (result.strikes === state.answerLength) {
    endGame(true);
    return;
  }

  if (state.guesses.length >= MAX_ATTEMPTS) {
    endGame(false);
    return;
  }

  setStatus(`${formatResult(result)}. 다음 숫자를 입력하세요.`);
  render();
}

function revealAnswer() {
  if (!state.isGameOver) {
    const confirmed = window.confirm(
      "정답을 보면 이번 게임은 종료됩니다. 계속할까요?",
    );
    if (!confirmed) {
      return;
    }
    endGame(false);
    return;
  }

  const answer = state.answer.join("");
  const isRevealed = elements.revealButton.textContent === answer;
  elements.revealButton.textContent = isRevealed ? "정답 보기" : answer;
}

function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function getEffectiveTheme() {
  return getStoredTheme() ?? (prefersDark.matches ? "dark" : "light");
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function renderThemeToggle() {
  const effective = getEffectiveTheme();
  const isDark = effective === "dark";
  elements.themeIcon.textContent = isDark ? "☀" : "☾";
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  const label = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";
  elements.themeToggle.setAttribute("aria-label", label);
  elements.themeToggle.title = label;
}

function toggleTheme() {
  const next = getEffectiveTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {}
  applyTheme(next);
  renderThemeToggle();
}

elements.themeToggle.addEventListener("click", toggleTheme);

prefersDark.addEventListener("change", () => {
  if (!getStoredTheme()) {
    renderThemeToggle();
  }
});

elements.newGameButton.addEventListener("click", () =>
  startGame("새 게임을 시작했습니다."),
);
elements.submitButton.addEventListener("click", submitGuess);
elements.deleteButton.addEventListener("click", deleteDigit);
elements.revealButton.addEventListener("click", revealAnswer);

elements.allowZeroToggle.addEventListener("change", (event) => {
  state.allowZero = event.target.checked;
  startGame("설정이 바뀌어 새 게임을 시작했습니다.");
});

elements.segments.forEach((segment) => {
  segment.addEventListener("click", () => {
    const length = Number(segment.dataset.length);
    if (state.answerLength === length) {
      return;
    }

    state.answerLength = length;
    startGame("자리수가 바뀌어 새 게임을 시작했습니다.");
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key >= "0" && event.key <= "9") {
    addDigit(event.key);
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    deleteDigit();
    return;
  }

  if (event.key === "Enter") {
    submitGuess();
  }
});

function isTokenLiteral(value) {
  return !value || value.startsWith("__");
}

function renderBuildInfo() {
  const versionAttr = elements.buildVersion.dataset.buildVersion;
  elements.buildVersion.textContent = isTokenLiteral(versionAttr)
    ? "local"
    : versionAttr;

  const timeAttr = elements.buildTime.dataset.buildTime;
  const source = isTokenLiteral(timeAttr) ? document.lastModified : timeAttr;
  const date = new Date(source);

  if (Number.isNaN(date.getTime())) {
    elements.buildTime.textContent = "알 수 없음";
    elements.buildTime.removeAttribute("datetime");
    return;
  }

  elements.buildTime.textContent = `${new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date)} KST`;
  elements.buildTime.dateTime = date.toISOString();
}

renderThemeToggle();
renderBuildInfo();
startGame();
