/* ============================================
   CONFIGURATION & COOKIES
   ============================================ */
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

// Cookie Management
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Strict";
}

// transparent session helpers with fallback when cookies are disabled
function setSession(username) {
    if (navigator.cookieEnabled) {
        setCookie("banana_session", username, 1);
    } else {
        localStorage.setItem("banana_session", username);
    }
}

function getSession() {
    if (navigator.cookieEnabled) {
        return getCookie("banana_session");
    }
    return localStorage.getItem("banana_session");
}

function clearSession() {
    if (navigator.cookieEnabled) eraseCookie("banana_session");
    localStorage.removeItem("banana_session");
}

function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/;';
}

/* ============================================
   GAME STATE
   ============================================ */
let gameState = {
    score: 0,
    streak: 0,
    bestStreak: 0,
    puzzlesSolved: 0,
    puzzlesAttempted: 0,
    currentPuzzle: null,
    timer: null,
    timeLeft: 30, // Default, will be overwritten by difficulty
    difficulty: 'Medium',
    isPlaying: false,
    isAnswering: false
};

let elements = {};

/* ============================================
   INITIALIZATION
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('login-screen')) {
        initAuth();
    } else if (document.querySelector('.game-container')) {
        initGame();
    }
    setupEventListeners();
});

/* ============================================
   AUTH & MENU LOGIC
   ============================================ */
function initAuth() {
    const currentUser = getSession();
    if (currentUser) {
        showMainMenu(currentUser);
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-menu').style.display = 'none';
    }
}

function handleSignIn() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username) {
        alert("Please enter a username!");
        return;
    }
    if (!password) {
        alert("Please enter a password!");
        return;
    }

    // simple in-browser credential store using localStorage
    let users = JSON.parse(localStorage.getItem('banana_users')) || {};

    if (!users[username] || users[username] !== password) {
        alert('Incorrect username or password.');
        return;
    }

    // set session through helper
    setSession(username);
    // username stored in session or banana_player if needed
    showMainMenu(username);
}

function handleRegister() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username) {
        alert("Please enter a username!");
        return;
    }
    if (!password) {
        alert("Please enter a password!");
        return;
    }

    let users = JSON.parse(localStorage.getItem('banana_users')) || {};
    if (users[username]) {
        alert('Username already exists. Please sign in instead.');
        return;
    }

    // register new user
    users[username] = password;
    localStorage.setItem('banana_users', JSON.stringify(users));

    // automatically sign them in after registration
    setSession(username);
    showMainMenu(username);
}

function handleLogout() {
    clearSession();
    window.location.reload();
}

function showMainMenu(username) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    document.getElementById('display-username').textContent = username;
    
    elements.menuHighScore = document.getElementById('menu-high-score');
    if (elements.menuHighScore) {
        elements.menuHighScore.textContent = getStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE) || 0;
    }
}

function startCustomGame() {
    const selectedDifficulty = document.getElementById('difficulty-select').value;
    localStorage.setItem('banana_chosen_difficulty', selectedDifficulty);
    window.location.href = 'game.html';
}

/* ============================================
   GAME LOGIC
   ============================================ */
function initGame() {
    // Kick out users who aren't logged in
    if (!getCookie("banana_session")) {
        window.location.href = 'index.html';
        return;
    }

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
    
    // Set up difficulty and timer
    gameState.difficulty = localStorage.getItem('banana_chosen_difficulty') || 'Medium';
    let duration = 30;
    if (gameState.difficulty === 'Easy') duration = 60;
    if (gameState.difficulty === 'Hard') duration = 15;
    
    gameState.timeLeft = duration;
    
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
    gameState.timer = setInterval(updateTimer, 1000);
    loadPuzzle();
}

function updateTimer() {
    if (!gameState.isPlaying) return;
    gameState.timeLeft--;
    
    if (elements.timerDisplay) elements.timerDisplay.textContent = gameState.timeLeft;
    
    if (elements.gameTimer) {
        elements.gameTimer.classList.remove('warning', 'danger');
        if (gameState.timeLeft <= 10) elements.gameTimer.classList.add('danger');
        else if (gameState.timeLeft <= 20) elements.gameTimer.classList.add('warning');
    }
    
    if (gameState.timeLeft <= 0) {
        endGame('time');
    }
}

async function loadPuzzle() {
    elements.loadingSpinner.classList.remove('hidden');
    elements.puzzleImage.style.opacity = '0.5';
    elements.answerInput.value = '';
    elements.answerInput.disabled = true;
    if (elements.submitBtn) elements.submitBtn.disabled = true;
    
    try {
        const response = await fetch(CONFIG.API_ENDPOINT);
        const data = await response.json();
        
        if (!gameState.isPlaying) return;

        gameState.currentPuzzle = {
            image: data.question,
            answer: data.solution,
            difficulty: gameState.difficulty
        };
        
        elements.puzzleImage.src = gameState.currentPuzzle.image;
        elements.puzzleImage.style.opacity = '1';
        elements.difficultyBadge.textContent = gameState.difficulty;
        elements.difficultyBadge.className = 'puzzle-difficulty ' + gameState.difficulty.toLowerCase();
        
        elements.answerInput.disabled = false;
        elements.answerInput.focus();
    } catch (error) {
        console.error('API Error:', error);
    } finally {
        elements.loadingSpinner.classList.add('hidden');
    }
}

function submitAnswer() {
    if (!gameState.isPlaying || gameState.isAnswering) return;
    const userAnswer = parseInt(elements.answerInput.value);
    
    if (isNaN(userAnswer)) return;
    
    gameState.isAnswering = true;
    gameState.puzzlesAttempted++;
    
    if (userAnswer === gameState.currentPuzzle.answer) {
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
        if(gameState.isPlaying) loadPuzzle();
    }, 1500);
}

function skipPuzzle() {
    if (!gameState.isPlaying) return;
    gameState.streak = 0;
    gameState.score -= CONFIG.SKIP_PENALTY;
    updateScoreDisplay();
    loadPuzzle();
}

function endGame(reason) {
    if (!gameState.isPlaying) return;
    clearInterval(gameState.timer);
    gameState.isPlaying = false;

    // disable controls
    if (elements.answerInput) elements.answerInput.disabled = true;
    if (elements.submitBtn) elements.submitBtn.disabled = true;
    if (elements.skipBtn) elements.skipBtn.disabled = true;
    const endBtn = document.getElementById('end-btn');
    if (endBtn) endBtn.disabled = true;

    // fill modal stats
    if (elements.finalScore) elements.finalScore.textContent = gameState.score;
    const puzzlesEl = document.getElementById('final-puzzles');
    const streakEl = document.getElementById('final-streak');
    const accuracyEl = document.getElementById('final-accuracy');
    if (puzzlesEl) puzzlesEl.textContent = gameState.puzzlesSolved;
    if (streakEl) streakEl.textContent = gameState.bestStreak;
    if (accuracyEl) {
        const percent = gameState.puzzlesAttempted > 0 ?
            Math.round((gameState.puzzlesSolved / gameState.puzzlesAttempted) * 100) : 0;
        accuracyEl.textContent = percent + "%";
    }

    // show optional message
    const msgEl = document.getElementById('game-over-message');
    if (msgEl) {
        if (reason === 'manual') msgEl.textContent = "Game ended early!";
        else if (reason === 'time') msgEl.textContent = "Time's up!";
        else msgEl.textContent = "Game over!";
    }

    elements.gameOverModal.classList.add('active');

    let currentHighScore = getStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE) || 0;
    if (gameState.score > currentHighScore) {
        setStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE, gameState.score);
        if (elements.newHighScoreBadge) elements.newHighScoreBadge.style.display = 'block';
    } else {
        if (elements.newHighScoreBadge) elements.newHighScoreBadge.style.display = 'none';
    }
    
    saveLeaderboardScore();
}

function updateScoreDisplay() {
    if (elements.currentScore) elements.currentScore.textContent = gameState.score;
    if (elements.currentStreak) elements.currentStreak.textContent = gameState.streak;
    if (elements.bestStreak) elements.bestStreak.textContent = gameState.bestStreak;
}

function getStorage(key) { return JSON.parse(localStorage.getItem(key)) || null; }
function setStorage(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function saveLeaderboardScore() {
    let name = getCookie("banana_session") || "Player";
    let scores = JSON.parse(localStorage.getItem("banana_leaderboard")) || [];
    scores.push({ name: name, score: gameState.score });
    scores.sort((a,b) => b.score - a.score);
    localStorage.setItem("banana_leaderboard", JSON.stringify(scores));
}

// used by leaderboard.html to populate table
function loadLeaderboard() {
    const table = document.getElementById("leaderboard-body");
    if (!table) return;
    let scores = JSON.parse(localStorage.getItem("banana_leaderboard")) || [];
    scores.sort((a,b) => b.score - a.score);
    table.innerHTML = "";
    scores.forEach((player,index)=>{
        const row=document.createElement("tr");
        row.innerHTML=`
                    <td>${index+1}</td>
                    <td>${player.name}</td>
                    <td>${player.score}</td>
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
        // disable initially, will be enabled when input has something
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