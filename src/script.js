// Difficulty settings: goal, round length, and time between cans
const DIFFICULTIES = {
  easy: { label: "Easy", goal: 12, seconds: 40, spawnDelay: 1400 },
  normal: { label: "Normal", goal: 20, seconds: 30, spawnDelay: 1000 },
  hard: { label: "Hard", goal: 25, seconds: 25, spawnDelay: 700 }
};

const MISS_PENALTY = 1;

// Sound cues made with the browser's Web Audio API
const soundNotes = {
  start: [523],
  collect: [784],
  miss: [220],
  milestone: [659, 784],
  win: [523, 659, 784, 1047],
  lose: [330, 262]
};

// Milestones are based on the selected goal
const milestoneMessages = [
  { fraction: 0.5, message: "Halfway there! Keep going!" },
  { fraction: 0.75, message: "Almost there! You're so close to the goal!" }
];

const winningMessages = [
  "Quest complete! You made every drop count!",
  "Amazing work! You reached the clean-water goal!",
  "You did it! That was a splash-worthy score!",
  "Incredible tapping! Goal reached!"
];

const losingMessages = [
  "Nice try! See if you can reach {goal} cans next round.",
  "The quest isn't over. Try again and collect {goal} cans!",
  "Almost there! Play another round and beat your score.",
  "Keep going! You can reach the {goal}-can goal next time."
];

// Find the HTML elements the game updates
const grid = document.querySelector(".game-grid");
const scoreDisplay = document.getElementById("current-cans");
const goalDisplay = document.getElementById("goal-cans");
const timerDisplay = document.getElementById("timer");
const achievements = document.getElementById("achievements");
const startButton = document.getElementById("start-game");
const resetButton = document.getElementById("reset-game");
const difficultySelect = document.getElementById("difficulty-level");
const difficultySummary = document.getElementById("difficulty-summary");
const soundToggle = document.getElementById("sound-toggle");
const progressFill = document.getElementById("progress-fill");
const progressTrack = document.querySelector(".progress-track");
const confettiContainer = document.getElementById("confetti");

// Game state
let currentCans = 0;
let timeLeft = DIFFICULTIES.normal.seconds;
let gameActive = false;
let currentCell = null;
let spawnInterval;
let timerInterval;
let confettiTimeout;
let audioContext;
let activeDifficulty = DIFFICULTIES.normal;
let reachedMilestones = new Set();

// Create the nine clickable tiles
function createGrid() {
  grid.innerHTML = "";

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");

    cell.className = "grid-cell";
    cell.setAttribute("role", "button");
    cell.setAttribute("tabindex", "0");
    cell.setAttribute("aria-label", `Empty tile ${i + 1}`);

    cell.addEventListener("click", () => handleCellClick(cell));

    // Allow keyboard users to activate tiles with Enter or Space
    cell.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCellClick(cell);
      }
    });

    grid.appendChild(cell);
  }
}

// Update the score and progress bar
function updateScore() {
  scoreDisplay.textContent = currentCans;

  const progress = Math.min(
    (currentCans / activeDifficulty.goal) * 100,
    100
  );

  progressFill.style.width = `${progress}%`;
  progressTrack.setAttribute("aria-valuenow", currentCans);
  progressTrack.setAttribute("aria-valuemax", activeDifficulty.goal);
}

function updateTimer() {
  timerDisplay.textContent = timeLeft;
}

// Update the displayed goal, timer, and difficulty description
function updateDifficulty() {
  if (gameActive) return;

  activeDifficulty =
    DIFFICULTIES[difficultySelect.value] || DIFFICULTIES.normal;

  timeLeft = activeDifficulty.seconds;
  goalDisplay.textContent = activeDifficulty.goal;
  timerDisplay.textContent = timeLeft;

  difficultySummary.textContent =
    `${activeDifficulty.label}: collect ${activeDifficulty.goal} cans in ` +
    `${activeDifficulty.seconds} seconds. A new can appears every ` +
    `${activeDifficulty.spawnDelay / 1000} seconds.`;

  updateScore();
}

// Play a short sound cue, if sound effects are enabled
function playSound(type) {
  if (!soundToggle.checked) return;

  const frequencies = soundNotes[type];
  if (!frequencies) return;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    frequencies.forEach((frequency, index) => {
      const startAt = audioContext.currentTime + index * 0.11;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.07, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(startAt);
      oscillator.stop(startAt + 0.19);
    });
  } catch (error) {
    // The game still works if sound isn't supported.
    console.info("Sound effects are unavailable in this browser.", error);
  }
}

// Place a can in a randomly selected tile
function spawnWaterCan() {
  if (!gameActive) return;

  // An uncollected can counts as a miss
  if (currentCell) {
    applyPenalty("Missed can!");
  }

  const cells = document.querySelectorAll(".grid-cell");

  cells.forEach((cell, index) => {
    cell.innerHTML = "";
    cell.setAttribute("aria-label", `Empty tile ${index + 1}`);
  });

  const randomIndex = Math.floor(Math.random() * cells.length);
  currentCell = cells[randomIndex];

  currentCell.setAttribute(
    "aria-label",
    "Jerry can. Activate to collect one point."
  );

  currentCell.innerHTML = `
    <div class="water-can-wrapper">
      <div class="water-can" aria-hidden="true"></div>
    </div>
  `;
}

// Show a milestone message when the player reaches one
function announceMilestone() {
  const milestone = milestoneMessages.find(({ fraction }) => {
    const target = Math.ceil(activeDifficulty.goal * fraction);

    return (
      currentCans === target &&
      !reachedMilestones.has(target)
    );
  });

  if (!milestone) return false;

  const target = Math.ceil(activeDifficulty.goal * milestone.fraction);
  reachedMilestones.add(target);
  achievements.textContent = milestone.message;
  playSound("milestone");

  return true;
}

// Collect a can or apply a penalty for an empty tile
function handleCellClick(cell) {
  if (!gameActive) return;

  const canIsHere = cell.querySelector(".water-can");

  if (!canIsHere) {
    applyPenalty("Empty tile!");
    return;
  }

  currentCans += 1;
  currentCell = null;

  // Remove the can immediately after it's collected
  cell.innerHTML = "";
  cell.setAttribute("aria-label", "Empty tile");

  updateScore();
  playSound("collect");

  if (!announceMilestone()) {
    achievements.textContent = "Can collected! Find the next one.";
  }
}

// Deduct a point without allowing the score to go below zero
function applyPenalty(message) {
  currentCans = Math.max(0, currentCans - MISS_PENALTY);

  updateScore();
  achievements.textContent = `${message} One point deducted.`;
  playSound("miss");
}

// Start a new round
function startGame() {
  if (gameActive) return;

  clearInterval(spawnInterval);
  clearInterval(timerInterval);
  clearTimeout(confettiTimeout);
  confettiContainer.innerHTML = "";

  activeDifficulty =
    DIFFICULTIES[difficultySelect.value] || DIFFICULTIES.normal;

  currentCans = 0;
  timeLeft = activeDifficulty.seconds;
  currentCell = null;
  reachedMilestones = new Set();

  createGrid();
  updateScore();
  updateTimer();

  gameActive = true;
  difficultySelect.disabled = true;
  startButton.disabled = true;
  startButton.textContent = "Game in progress...";
  resetButton.hidden = false;
  achievements.textContent = "Tap the yellow can before it moves!";

  playSound("start");

  // Show a can immediately, then keep spawning cans
  spawnWaterCan();
  spawnInterval = setInterval(
    spawnWaterCan,
    activeDifficulty.spawnDelay
  );

  // Count down once per second; end the round at zero
  timerInterval = setInterval(() => {
    timeLeft = Math.max(0, timeLeft - 1);
    updateTimer();

    if (timeLeft === 0) {
      endGame();
    }
  }, 1000);
}

// End the round and show a random result message
function endGame() {
  if (!gameActive) return;

  gameActive = false;
  currentCell = null;

  clearInterval(spawnInterval);
  clearInterval(timerInterval);

  document.querySelectorAll(".grid-cell").forEach(cell => {
    cell.innerHTML = "";
    cell.setAttribute("aria-label", "Round over");
  });

  const won = currentCans >= activeDifficulty.goal;
  const messages = won ? winningMessages : losingMessages;
  const randomIndex = Math.floor(Math.random() * messages.length);

  achievements.textContent = messages[randomIndex].replaceAll(
    "{goal}",
    activeDifficulty.goal
  );

  difficultySelect.disabled = false;
  startButton.disabled = false;
  startButton.textContent = won ? "Play Again" : "Try Again";
  resetButton.hidden = true;

  playSound(won ? "win" : "lose");

  if (won) {
    celebrateWin();
  }
}

// Reset the board, score, and timer
function resetGame() {
  clearInterval(spawnInterval);
  clearInterval(timerInterval);
  clearTimeout(confettiTimeout);

  gameActive = false;
  currentCans = 0;
  currentCell = null;
  reachedMilestones = new Set();

  difficultySelect.disabled = false;
  updateDifficulty();
  createGrid();
  updateScore();

  achievements.textContent =
    "Choose a difficulty, then press Start Game when you're ready.";
  startButton.disabled = false;
  startButton.textContent = "Start Game";
  resetButton.hidden = true;
  confettiContainer.innerHTML = "";
}

// Celebrate a win with confetti
function celebrateWin() {
  const colors = [
    "#FFC907",
    "#2E9DF7",
    "#8BD1CB",
    "#4FCB53",
    "#FF902A"
  ];

  confettiContainer.innerHTML = "";

  for (let i = 0; i < 50; i++) {
    const piece = document.createElement("div");

    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;

    confettiContainer.appendChild(piece);
  }

  confettiTimeout = setTimeout(() => {
    confettiContainer.innerHTML = "";
  }, 3000);
}

// Connect the controls and initialize the page
startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);
difficultySelect.addEventListener("change", updateDifficulty);

createGrid();
updateDifficulty();