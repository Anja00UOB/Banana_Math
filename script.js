//CONFIGURATION & COOKIES
const CONFIG = {
    API_ENDPOINT: 'https://marcconrad.com/uob/banana/api.php',
    POINTS_PER_CORRECT: 10,
    STREAK_BONUS: 5,
    SKIP_PENALTY: 2,
    STORAGE_KEYS: {
        HIGH_SCORE: 'banana_high_score',
        TOTAL_GAMES: 'banana_total_games',
        TOTAL_CORRECT: 'banana_total_correct',
        LEADERBOARD: 'banana_leaderboard'
    }
};

// Session Storage Management System for Banana Game
function persistPlayerSession(playerUsername) {
    const sessionExpiryDays = 1;
    const expiryConfig = buildExpiryTimestamp(sessionExpiryDays);
    
    if (navigator.cookieEnabled) {
        const formattedCookieString = `banana_active_player=${playerUsername}${expiryConfig}; path=/; SameSite=Strict`;
        document.cookie = formattedCookieString;
    } else {
        localStorage.setItem("playerSession", playerUsername);
    }
}

function retrievePlayerSession() {
    if (navigator.cookieEnabled) {
        return extractSessionFromCookies("banana_active_player");
    }
    return localStorage.getItem("playerSession");
}

function terminatePlayerSession() {
    if (navigator.cookieEnabled) {
        document.cookie = 'banana_active_player=; Max-Age=-99999999; path=/;';
    }
    localStorage.removeItem("playerSession");
}

function buildExpiryTimestamp(daysValid) {
    if (!daysValid) return "";
    const futureDate = new Date();
    futureDate.setTime(futureDate.getTime() + (daysValid * 24 * 60 * 60 * 1000));
    return `; expires=${futureDate.toUTCString()}`;
}

function extractSessionFromCookies(cookieName) {
    const cookieSearchKey = `${cookieName}=`;
    const allCookies = document.cookie.split(';');
    
    for (let cookieChunk of allCookies) {
        cookieChunk = cookieChunk.replace(/^\s+/, '');
        if (cookieChunk.startsWith(cookieSearchKey)) {
            return cookieChunk.substring(cookieSearchKey.length);
        }
    }
    return null;
}

//GAME STATE MANAGEMENT
let gameState = {
    score: 0,
    streak: 0,
    bestStreak: 0,
    puzzlesSolved: 0,
    puzzlesAttempted: 0,
    currentPuzzle: null,
    timer: null,
    timeLeft: 30, // Default 30s, will be overwritten by difficulty selection
    difficulty: 'Medium',
    isPlaying: false,
    isAnswering: false
};

let elements = {};

//INITIALIZATION LOGIC
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('login-screen')) {
        initAuth();
    } else if (document.querySelector('.game-container')) {
        initGame();
    }
    setupEventListeners();
});

//AUTH & MENU LOGIC - Banana Game Authentication System
function initAuth() {
    const authenticatedPlayer = retrievePlayerSession();
    if (authenticatedPlayer) {
        displayPlayerMainMenu(authenticatedPlayer);
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-menu').style.display = 'none';
    }
}

function handleSignIn() {
    const inputUsername = document.getElementById('login-username').value.trim();
    const inputPassword = document.getElementById('login-password').value;

    if (!inputUsername) {
        alert("Please enter a username!");
        return;
    }
    if (!inputPassword) {
        alert("Please enter a password!");
        return;
    }

    // Access banana game player registry from local storage
    const playerRegistry = JSON.parse(localStorage.getItem('banana_player_registry')) || {};

    if (!playerRegistry[inputUsername] || playerRegistry[inputUsername] !== inputPassword) {
        alert('Incorrect username or password.');
        return;
    }

    // Establish active player session through helper system
    persistPlayerSession(inputUsername);
    displayPlayerMainMenu(inputUsername);
}

function handleRegister() {
    const inputUsername = document.getElementById('login-username').value.trim();
    const inputPassword = document.getElementById('login-password').value;

    if (!inputUsername) {
        alert("Please enter a username!");
        return;
    }
    if (!inputPassword) {
        alert("Please enter a password!");
        return;
    }

    const playerRegistry = JSON.parse(localStorage.getItem('banana_player_registry')) || {};
    if (playerRegistry[inputUsername]) {
        alert('Username already exists. Please sign in instead.');
        return;
    }

    // Register new player account in registry
    playerRegistry[inputUsername] = inputPassword;
    localStorage.setItem('banana_player_registry', JSON.stringify(playerRegistry));

    // Automatically authenticate player after successful registration
    persistPlayerSession(inputUsername);
    displayPlayerMainMenu(inputUsername);
}

function handleLogout() {
    terminatePlayerSession();
    window.location.reload();
}

function displayPlayerMainMenu(playerName) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    document.getElementById('display-username').textContent = playerName;
    
    elements.menuHighScore = document.getElementById('menu-high-score');
    if (elements.menuHighScore) {
        elements.menuHighScore.textContent = retrieveGameMetric(CONFIG.STORAGE_KEYS.HIGH_SCORE) || 0;
    }
}

function startCustomGame() {
    const selectedDifficulty = document.getElementById('difficulty-select').value;
    localStorage.setItem('banana_chosen_difficulty', selectedDifficulty);
    window.location.href = 'game.html';
}

//GAME LOGIC
function initGame() {
    // Verify player authentication before launching game
    if (!extractSessionFromCookies("banana_active_player")) {
        window.location.href = 'index.html';
        return;
    }
    //DOM element references for game interaction and display updates
    elements = {
        gameTimer: document.getElementById('game-timer'),
        timerDisplay: document.getElementById('timer-display'),
        currentScore: document.getElementById('current-score'),
        currentStreak: document.getElementById('current-streak'),
        bestStreak: document.getElementById('best-streak'),
        puzzleCount: document.getElementById('puzzle-count'),
        difficultyBadge: document.getElementById('difficulty-badge'),
        puzzleImage: document.getElementById('puzzle-image'),
        loadingSpinner: document.getElementById('loading-spinner'),
        answerInput: document.getElementById('answer-input'),
        submitBtn: document.getElementById('submit-btn'),
        skipBtn: document.getElementById('skip-btn'),
        feedbackContainer: document.getElementById('feedback-container'),
        feedbackSuccess: document.getElementById('feedback-success'),
        feedbackError: document.getElementById('feedback-error'),
        pointsEarned: document.getElementById('points-earned'),
        correctAnswer: document.getElementById('correct-answer'),
        gameOverModal: document.getElementById('game-over-modal'),
        finalScore: document.getElementById('final-score')
    };
    
    // Configure game difficulty settings and time constraints
    gameState.difficulty = localStorage.getItem('banana_chosen_difficulty') || 'Medium';
    const timeConstraintMap = {
        'Easy': 60,
        'Medium': 30,
        'Hard': 15
    };
    gameState.timeLeft = timeConstraintMap[gameState.difficulty] || 30;
    
    resetGameState();
    startGame();
}

function resetGameState() {
    if (gameState.timer) clearInterval(gameState.timer);
    gameState.score = 0;
    gameState.streak = 0;
    gameState.bestStreak = 0;
    gameState.puzzlesSolved = 0;
    gameState.puzzlesAttempted = 0;
    gameState.isPlaying = false;
    gameState.isAnswering = false;
}

function startGame() {
    gameState.isPlaying = true;
    gameState.timer = setInterval(decrementGameTimer, 1000);
    fetchNextPuzzle();
}

function decrementGameTimer() {
    if (!gameState.isPlaying) return;
    gameState.timeLeft--;
    
    if (elements.timerDisplay) elements.timerDisplay.textContent = gameState.timeLeft;
    
    if (elements.gameTimer) {
        elements.gameTimer.classList.remove('warning', 'danger');
        if (gameState.timeLeft <= 10) elements.gameTimer.classList.add('danger');
        else if (gameState.timeLeft <= 20) elements.gameTimer.classList.add('warning');
    }
    
    if (gameState.timeLeft <= 0) {
        terminateGame('time');
    }
}

async function fetchNextPuzzle() {
    elements.loadingSpinner.classList.remove('hidden');
    elements.puzzleImage.style.opacity = '0.5';
    elements.answerInput.value = '';
    elements.answerInput.disabled = true;
    if (elements.submitBtn) elements.submitBtn.disabled = true;
    
    try {
        const apiResponse = await fetch(CONFIG.API_ENDPOINT);
        const puzzleData = await apiResponse.json();
        
        if (!gameState.isPlaying) return;

        gameState.currentPuzzle = {
            image: puzzleData.question,
            answer: puzzleData.solution,
            difficulty: gameState.difficulty
        };
        
        elements.puzzleImage.src = gameState.currentPuzzle.image;
        elements.puzzleImage.style.opacity = '1';
        elements.difficultyBadge.textContent = gameState.difficulty;
        elements.difficultyBadge.className = 'puzzle-difficulty ' + gameState.difficulty.toLowerCase();
        
        elements.answerInput.disabled = false;
        elements.answerInput.focus();
    } catch (error) {
        console.error('Puzzle API Error:', error);
    } finally {
        elements.loadingSpinner.classList.add('hidden');
    }
}

function submitAnswer() {
    if (!gameState.isPlaying || gameState.isAnswering) return;
    const playerProvidedAnswer = parseInt(elements.answerInput.value);
    
    if (isNaN(playerProvidedAnswer)) return;
    
    gameState.isAnswering = true;
    gameState.puzzlesAttempted++;
    
    if (playerProvidedAnswer === gameState.currentPuzzle.answer) {
        gameState.score += CONFIG.POINTS_PER_CORRECT + (gameState.streak * CONFIG.STREAK_BONUS);
        gameState.streak++;
        gameState.puzzlesSolved++;
        if (gameState.streak > gameState.bestStreak) gameState.bestStreak = gameState.streak;
        
        elements.feedbackSuccess.classList.add('show');
    } else {
        gameState.streak = 0;
        elements.feedbackError.classList.add('show');
        elements.correctAnswer.textContent = gameState.currentPuzzle.answer;
    }
    
    updateScoreDisplay();
    
    setTimeout(() => {
        elements.feedbackSuccess.classList.remove('show');
        elements.feedbackError.classList.remove('show');
        gameState.isAnswering = false;
        if(gameState.isPlaying) fetchNextPuzzle();
    }, 1500);
}

function skipPuzzle() {
    if (!gameState.isPlaying) return;
    gameState.streak = 0;
    gameState.score -= CONFIG.SKIP_PENALTY;
    updateScoreDisplay();
    fetchNextPuzzle();
}

function terminateGame(exitReason) {
    if (!gameState.isPlaying) return;
    clearInterval(gameState.timer);
    gameState.isPlaying = false;

    // Disable all game interaction controls
    if (elements.answerInput) elements.answerInput.disabled = true;
    if (elements.submitBtn) elements.submitBtn.disabled = true;
    if (elements.skipBtn) elements.skipBtn.disabled = true;
    const endBtn = document.getElementById('end-btn');
    if (endBtn) endBtn.disabled = true;

    // Populate game statistics in results modal
    if (elements.finalScore) elements.finalScore.textContent = gameState.score;
    const puzzlesEl = document.getElementById('final-puzzles');
    const streakEl = document.getElementById('final-streak');
    const accuracyEl = document.getElementById('final-accuracy');
    if (puzzlesEl) puzzlesEl.textContent = gameState.puzzlesSolved;
    if (streakEl) streakEl.textContent = gameState.bestStreak;
    if (accuracyEl) {
        const computedAccuracy = gameState.puzzlesAttempted > 0 ?
            Math.round((gameState.puzzlesSolved / gameState.puzzlesAttempted) * 100) : 0;
        accuracyEl.textContent = computedAccuracy + "%";
    }

    // Show contextual end game message
    const msgEl = document.getElementById('game-over-message');
    if (msgEl) {
        if (exitReason === 'manual') msgEl.textContent = "Game ended early!";
        else if (exitReason === 'time') msgEl.textContent = "Time's up!";
        else msgEl.textContent = "Game over!";
    }

    elements.gameOverModal.classList.add('active');

    let currentHighScore = retrieveGameMetric(CONFIG.STORAGE_KEYS.HIGH_SCORE) || 0;
    if (gameState.score > currentHighScore) {
        storeGameMetric(CONFIG.STORAGE_KEYS.HIGH_SCORE, gameState.score);
        if (elements.newHighScoreBadge) elements.newHighScoreBadge.style.display = 'block';
    } else {
        if (elements.newHighScoreBadge) elements.newHighScoreBadge.style.display = 'none';
    }
    
    persistPlayerScore();
}

function updateScoreDisplay() {
    if (elements.currentScore) elements.currentScore.textContent = gameState.score;
    if (elements.currentStreak) elements.currentStreak.textContent = gameState.streak;
    if (elements.bestStreak) elements.bestStreak.textContent = gameState.bestStreak;
}

function retrieveGameMetric(metricKey) { 
    return JSON.parse(localStorage.getItem(metricKey)) || null; 
}

function storeGameMetric(metricKey, metricValue) { 
    localStorage.setItem(metricKey, JSON.stringify(metricValue)); 
}

function persistPlayerScore() {
    let activePlayerName = extractSessionFromCookies("banana_active_player") || "Player";
    let leaderboardEntries = JSON.parse(localStorage.getItem("banana_leaderboard")) || [];
    leaderboardEntries.push({ name: activePlayerName, score: gameState.score });
    leaderboardEntries.sort((playerA, playerB) => playerB.score - playerA.score);
    localStorage.setItem("banana_leaderboard", JSON.stringify(leaderboardEntries));
}

// Populates leaderboard table (called by leaderboard.html)
function loadLeaderboard() {
    const table = document.getElementById("leaderboard-body");
    if (!table) return;
    let leaderboardEntries = JSON.parse(localStorage.getItem("banana_leaderboard")) || [];
    leaderboardEntries.sort((playerA, playerB) => playerB.score - playerA.score);
    table.innerHTML = "";
    leaderboardEntries.forEach((entry, rank) => {
        const row = document.createElement("tr");
        row.innerHTML = `
                    <td>${rank + 1}</td>
                    <td>${entry.name}</td>
                    <td>${entry.score}</td>
                `;
        table.appendChild(row);
    });
}

function clearLeaderboard() {
    if (confirm("Are you sure you want to clear the leaderboard? This cannot be undone.")) {
        localStorage.removeItem("banana_leaderboard");
        loadLeaderboard();
    }
}

function setupEventListeners() {
    const submitBtnEl = document.getElementById("submit-btn");
    const skipBtnEl = document.getElementById("skip-btn");
    const answerInputEl = document.getElementById("answer-input");

    if (submitBtnEl) {
        submitBtnEl.addEventListener("click", submitAnswer);
        // Button starts disabled until user provides input
        submitBtnEl.disabled = true;
    }
    if (skipBtnEl) skipBtnEl.addEventListener("click", skipPuzzle);
    if (answerInputEl) {
        answerInputEl.addEventListener("keypress", (e) => {
            if(e.key === "Enter") submitAnswer();
        });
        answerInputEl.addEventListener("input", () => {
            if (submitBtnEl) {
                submitBtnEl.disabled = answerInputEl.value.trim() === '';
            }
        });
    }
}