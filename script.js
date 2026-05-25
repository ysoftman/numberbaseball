const ATTEMPT_OPTIONS = [10, 15, 20];
const DEFAULT_MAX_ATTEMPTS = 10;
const ATTEMPTS_STORAGE_KEY = "number-baseball-max-attempts";

function loadMaxAttempts() {
  try {
    const saved = Number(localStorage.getItem(ATTEMPTS_STORAGE_KEY));
    if (ATTEMPT_OPTIONS.includes(saved)) {
      return saved;
    }
  } catch {}
  return DEFAULT_MAX_ATTEMPTS;
}

const state = {
  answerLength: 3,
  allowZero: true,
  maxAttempts: loadMaxAttempts(),
  answer: [],
  currentGuess: [],
  guesses: [],
  isGameOver: false,
};

const elements = {
  remainingCount: document.querySelector("#remainingCount"),
  bestScore: document.querySelector("#bestScore"),
  resultCallout: document.querySelector("#resultCallout"),
  fieldSlots: document.querySelector("#fieldSlots"),
  statusText: document.querySelector("#statusText"),
  keypad: document.querySelector("#keypad"),
  submitButton: document.querySelector("#submitButton"),
  deleteButton: document.querySelector("#deleteButton"),
  newGameButton: document.querySelector("#newGameButton"),
  allowZeroToggle: document.querySelector("#allowZeroToggle"),
  historyList: document.querySelector("#historyList"),
  revealButton: document.querySelector("#revealButton"),
  rulesButton: document.querySelector("#rulesButton"),
  rulesTooltip: document.querySelector("#rulesTooltip"),
  themeToggle: document.querySelector("#themeToggle"),
  themeIcon: document.querySelector("#themeToggle .theme-icon"),
  muteToggle: document.querySelector("#muteToggle"),
  muteIcon: document.querySelector("#muteToggle .mute-icon"),
  buildVersion: document.querySelector("#buildVersion"),
  buildTime: document.querySelector("#buildTime"),
  segments: [...document.querySelectorAll(".segment[data-length]")],
  attemptsRadios: [...document.querySelectorAll('input[name="maxAttempts"]')],
};

const THEME_STORAGE_KEY = "number-baseball-theme";
const MUTE_STORAGE_KEY = "number-baseball-muted";
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

let audioCtx = null;
let isMuted = (() => {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
})();

function ensureAudio() {
  if (isMuted) return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone({
  freq,
  duration = 0.12,
  type = "sine",
  volume = 0.12,
  attack = 0.005,
  startAt = 0,
}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + startAt;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain).connect(ctx.destination);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const SOUND_PRESETS = {
  key: [{ freq: 720, duration: 0.09, type: "triangle", volume: 0.28 }],
  delete: [{ freq: 360, duration: 0.11, type: "triangle", volume: 0.3 }],
  strike: [
    { freq: 660, duration: 0.14, type: "sine", volume: 0.4 },
    { freq: 990, duration: 0.2, type: "sine", volume: 0.4, startAt: 0.1 },
  ],
  ball: [{ freq: 520, duration: 0.25, type: "triangle", volume: 0.38 }],
  out: [{ freq: 180, duration: 0.4, type: "sawtooth", volume: 0.42 }],
  win: [
    { freq: 523, duration: 0.18, type: "triangle", volume: 0.42 },
    {
      freq: 659,
      duration: 0.18,
      type: "triangle",
      volume: 0.42,
      startAt: 0.14,
    },
    {
      freq: 784,
      duration: 0.18,
      type: "triangle",
      volume: 0.42,
      startAt: 0.28,
    },
    {
      freq: 1047,
      duration: 0.42,
      type: "triangle",
      volume: 0.46,
      startAt: 0.42,
    },
  ],
  lose: [
    { freq: 440, duration: 0.22, type: "sawtooth", volume: 0.38 },
    {
      freq: 330,
      duration: 0.24,
      type: "sawtooth",
      volume: 0.38,
      startAt: 0.18,
    },
    { freq: 220, duration: 0.5, type: "sawtooth", volume: 0.42, startAt: 0.38 },
  ],
};

function playSound(name) {
  if (isMuted) return;
  const preset = SOUND_PRESETS[name];
  if (!preset) return;
  preset.forEach((note) => playTone(note));
}

const BASE_ORDER_BY_LENGTH = {
  3: ["third", "second", "first"],
  4: ["third", "second", "home", "first"],
};

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
  return `number-baseball-best-${state.answerLength}-${state.allowZero ? "zero" : "no-zero"}-${state.maxAttempts}`;
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

function updateCallout(label, value, tone = "normal") {
  elements.resultCallout.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  elements.resultCallout.classList.toggle("is-win", tone === "win");
  elements.resultCallout.classList.toggle("is-lose", tone === "lose");
}

function renderDigits() {
  const bases = BASE_ORDER_BY_LENGTH[state.answerLength] ?? [];
  const slots = elements.fieldSlots.querySelectorAll(".digit-slot");

  slots.forEach((slot) => {
    const position = bases.indexOf(slot.dataset.base);
    const text = slot.querySelector("text");

    if (position === -1) {
      slot.classList.add("is-hidden-slot");
      slot.classList.remove("is-filled");
      text.textContent = "";
      return;
    }

    const digit = state.currentGuess[position] ?? "";
    slot.classList.remove("is-hidden-slot");
    slot.classList.toggle("is-filled", Boolean(digit));
    text.textContent = digit;
  });
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
  elements.allowZeroToggle.checked = state.allowZero;
  elements.segments.forEach((segment) => {
    const isActive = Number(segment.dataset.length) === state.answerLength;
    segment.classList.toggle("is-active", isActive);
    segment.setAttribute("aria-pressed", String(isActive));
  });
  elements.attemptsRadios.forEach((radio) => {
    radio.checked = Number(radio.value) === state.maxAttempts;
  });
}

function renderStats() {
  const attempts = state.guesses.length;
  const best = getBestScore();

  elements.remainingCount.textContent = Math.max(
    state.maxAttempts - attempts,
    0,
  );
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
  playSound("key");
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
  playSound("delete");
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
    updateCallout("홈런", `${state.guesses.length}번 만에 정답!`, "win");
  } else {
    setStatus("", "error");
    updateCallout("패배", `정답은 ${state.answer.join("")}`, "lose");
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

  updateCallout("심판 판정", formatResult(result));

  if (result.strikes === state.answerLength) {
    playSound("win");
    endGame(true);
    return;
  }

  state.currentGuess = [];

  if (state.guesses.length >= state.maxAttempts) {
    playSound("lose");
    endGame(false);
    return;
  }

  if (result.strikes > 0) {
    playSound("strike");
  } else if (result.balls > 0) {
    playSound("ball");
  } else {
    playSound("out");
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

function renderMuteToggle() {
  elements.muteIcon.textContent = isMuted ? "🔇" : "🔊";
  elements.muteToggle.setAttribute("aria-pressed", String(isMuted));
  const label = isMuted ? "효과음 켜기" : "효과음 끄기";
  elements.muteToggle.setAttribute("aria-label", label);
  elements.muteToggle.title = label;
}

function toggleMute() {
  isMuted = !isMuted;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(isMuted));
  } catch {}
  renderMuteToggle();
  if (!isMuted) {
    playSound("key");
  }
}

elements.muteToggle.addEventListener("click", toggleMute);

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

function setRulesTooltipOpen(open) {
  elements.rulesTooltip.hidden = !open;
  elements.rulesButton.setAttribute("aria-expanded", String(open));
}

elements.rulesButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setRulesTooltipOpen(elements.rulesTooltip.hidden);
});

document.addEventListener("click", (event) => {
  if (elements.rulesTooltip.hidden) {
    return;
  }
  if (
    !elements.rulesTooltip.contains(event.target) &&
    event.target !== elements.rulesButton
  ) {
    setRulesTooltipOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.rulesTooltip.hidden) {
    setRulesTooltipOpen(false);
    elements.rulesButton.focus();
  }
});

elements.allowZeroToggle.addEventListener("change", (event) => {
  state.allowZero = event.target.checked;
  startGame("설정이 바뀌어 새 게임을 시작했습니다.");
});

elements.attemptsRadios.forEach((radio) => {
  radio.addEventListener("change", (event) => {
    const next = Number(event.target.value);
    if (!ATTEMPT_OPTIONS.includes(next) || next === state.maxAttempts) {
      return;
    }
    state.maxAttempts = next;
    try {
      localStorage.setItem(ATTEMPTS_STORAGE_KEY, String(next));
    } catch {}
    startGame(`기회가 ${next}회로 바뀌어 새 게임을 시작했습니다.`);
  });
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
renderMuteToggle();
renderBuildInfo();
startGame();
