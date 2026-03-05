/* ============================================
   BANANA MATH CHALLENGE - GAME LOGIC
   ============================================ */

/* ============================================
   CONFIGURATION
   ============================================ */
const CONFIG = {
    // Banana API Configuration
    API_BASE: 'https://marcconrad.com/uob/banana/api',
    API_ENDPOINT: 'https://marcconrad.com/uob/banana/',
    
    // Game Settings
    GAME_DURATION: 30, // seconds
    POINTS_PER_CORRECT: 10,
    STREAK_BONUS: 5,
    SKIP_PENALTY: 2,
    
    // Storage Keys
    STORAGE_KEYS: {
        HIGH_SCORE: 'banana_high_score',
        TOTAL_GAMES: 'banana_total_games',
        TOTAL_CORRECT: 'banana_total_correct',
        LEADERBOARD: 'banana_leaderboard'
    }
};

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
    timeLeft: CONFIG.GAME_DURATION,
    isPlaying: false,
    isAnswering: false
};

/* ============================================
   DOM ELEMENTS
   ============================================ */
let elements = {
    // Menu
    menuHighScore: null,
    gamesPlayed: null,
    totalCorrect: null,
    
    // Game
    gameTimer: null,
    timerDisplay: null,
    currentScore: null,
    currentStreak: null,
    bestStreak: null,
    puzzleCount: null,
    difficultyBadge: null,
    puzzleImage: null,
    loadingSpinner: null,
    answerInput: null,
    submitBtn: null,
    skipBtn: null,
    feedbackContainer: null,
    feedbackSuccess: null,
    feedbackError: null,
    pointsEarned: null,
    correctAnswer: null,
    gameOverModal: null,
    finalScore: null,
    finalPuzzles: null,
    finalStreak: null,
    finalAccuracy: null,
    newHighScoreBadge: null,
    
    // How To
    howtoContainer: null,
    
    // Scores
    leaderboard: null
};

/* ============================================
   INITIALIZATION
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize based on current page
    if (document.querySelector('.menu-container')) {
        initMenu();
    } else if (document.querySelector('.game-container')) {
        initGame();
    } else if (document.querySelector('.howto-container')) {
        initHowTo();
    } else if (document.querySelector('.scores-page')) {
        initScores();
    }
    
    // Setup event listeners
    setupEventListeners();
});

/* ============================================
   MENU PAGE INITIALIZATION
   ============================================ */
function initMenu() {
    elements.menuHighScore = document.getElementById('menu-high-score');
    elements.gamesPlayed = document.getElementById('games-played');
    elements.totalCorrect = document.getElementById('total-correct');
    
    loadMenuStats();
}

function loadMenuStats() {
    const highScore = getStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE) || 0;
    const totalGames = getStorage(CONFIG.STORAGE_KEYS.TOTAL_GAMES) || 0;
    const totalCorrect = getStorage(CONFIG.STORAGE_KEYS.TOTAL_CORRECT) || 0;
    
    if (elements.menuHighScore) elements.menuHighScore.textContent = highScore;
    if (elements.gamesPlayed) elements.gamesPlayed.textContent = totalGames;
    if (elements.totalCorrect) elements.totalCorrect.textContent = totalCorrect;
}

/* ============================================
   GAME PAGE INITIALIZATION
   ============================================ */
function initGame() {
    // Get DOM elements
    elements.gameTimer = document.getElementById('game-timer');
    elements.timerDisplay = document.getElementById('timer-display');
    elements.currentScore = document.getElementById('current-score');
    elements.currentStreak = document.getElementById('current-streak');
    elements.bestStreak = document.getElementById('best-streak');
    elements.puzzleCount = document.getElementById('puzzle-count');
    elements.difficultyBadge = document.getElementById('difficulty-badge');
    elements.puzzleImage = document.getElementById('puzzle-image');
    elements.loadingSpinner = document.getElementById('loading-spinner');
    elements.answerInput = document.getElementById('answer-input');
    elements.submitBtn = document.getElementById('submit-btn');
    elements.skipBtn = document.getElementById('skip-btn');
    elements.feedbackContainer = document.getElementById('feedback-container');
    elements.feedbackSuccess = document.getElementById('feedback-success');
    elements.feedbackError = document.getElementById('feedback-error');
    elements.pointsEarned = document.getElementById('points-earned');
    elements.correctAnswer = document.getElementById('correct-answer');
    elements.gameOverModal = document.getElementById('game-over-modal');
    elements.finalScore = document.getElementById('final-score');
    elements.finalPuzzles = document.getElementById('final-puzzles');
    elements.finalStreak = document.getElementById('final-streak');
    elements.finalAccuracy = document.getElementById('final-accuracy');
    elements.newHighScoreBadge = document.getElementById('new-high-score-badge');
    
    // Reset game state
    resetGameState();
    
    // Load best streak from storage
    const savedBestStreak = getStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE) || 0;
    if (elements.bestStreak) elements.bestStreak.textContent = savedBestStreak;
    
    // Start game
    startGame();
}

function resetGameState() {
    gameState = {
        score: 0,
        streak: 0,
        bestStreak: 0,
        puzzlesSolved: 0,
        puzzlesAttempted: 0,
        currentPuzzle: null,
        timer: null,
        timeLeft: CONFIG.GAME_DURATION,
        isPlaying: false,
        isAnswering: false
    };
    
    updateScoreDisplay();
    hideFeedback();
    elements.newHighScoreBadge.style.display = 'none';
}

function startGame() {
    gameState.isPlaying = true;
    gameState.timeLeft = CONFIG.GAME_DURATION;
    
    // Start timer
    gameState.timer = setInterval(updateTimer, 1000);
    
    // Load first puzzle
    loadPuzzle();
    
    // Enable input
    elements.answerInput.disabled = false;
    elements.submitBtn.disabled = false;
    elements.skipBtn.disabled = false;
    elements.answerInput.focus();
}

function updateTimer() {
    gameState.timeLeft--;
    
    if (elements.timerDisplay) {
        elements.timerDisplay.textContent = gameState.timeLeft;
    }
    
    // Update timer styling based on time remaining
    if (elements.gameTimer) {
        elements.gameTimer.classList.remove('warning', 'danger');
        if (gameState.timeLeft <= 10) {
            elements.gameTimer.classList.add('danger');
        } else if (gameState.timeLeft <= 20) {
            elements.gameTimer.classList.add('warning');
        }
    }
    
    // Game over
    if (gameState.timeLeft <= 0) {
        endGame();
    }
}

/* ============================================
   PUZZLE LOGIC
   ============================================ */
async function loadPuzzle() {
    // Show loading
    elements.loadingSpinner.classList.remove('hidden');
    elements.puzzleImage.style.opacity = '0.5';
    elements.answerInput.value = '';
    elements.answerInput.disabled = true;
    elements.submitBtn.disabled = true;
    hideFeedback();
    
    try {
        // Fetch puzzle from Banana API
        const puzzle = await fetchPuzzle();
        gameState.currentPuzzle = puzzle;
        
        // Update puzzle display
        if (elements.puzzleImage) {
            elements.puzzleImage.src = puzzle.image;
            elements.puzzleImage.style.opacity = '1';
        }
        
        if (elements.puzzleCount) {
            elements.puzzleCount.textContent = gameState.puzzlesSolved + 1;
        }
        
        if (elements.difficultyBadge) {
            elements.difficultyBadge.textContent = puzzle.difficulty;
            elements.difficultyBadge.className = 'puzzle-difficulty ' + puzzle.difficulty.toLowerCase();
        }
        
        // Enable input
        elements.answerInput.disabled = false;
        elements.submitBtn.disabled = false;
        elements.answerInput.focus();
        
    } catch (error) {
        console.error('Error loading puzzle:', error);
        showError('Failed to load puzzle. Please try again.');
    } finally {
        elements.loadingSpinner.classList.add('hidden');
    }
}

async function fetchPuzzle() {
    try {
        // Try direct API call first
        const response = await fetch(CONFIG.API_ENDPOINT);
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        
        // Return puzzle data
        return {
            image: data.image || 'https://via.placeholder.com/400x200?text=Banana+Puzzle',
            answer: data.answer || 0,
            difficulty: data.difficulty || 'Easy',
            question: data.question || 'Solve this!'
        };
        
    } catch (error) {
        // Fallback to demo puzzle
        console.warn('Using demo puzzle:', error);
        return {
            image: 'https://via.placeholder.com/400x200?text=Banana+Math',
            answer: Math.floor(Math.random() * 10) + 1,
            difficulty: getRandomDifficulty(),
            question: 'Demo Puzzle'
        };
    }
}

function getRandomDifficulty() {
    const difficulties = ['Easy', 'Medium', 'Hard'];
    return difficulties[Math.floor(Math.random() * difficulties.length)];
}

/* ============================================
   ANSWER LOGIC
   ============================================ */
function submitAnswer() {
    if (!gameState.isPlaying || gameState.isAnswering) return;
    
    const userAnswer = parseInt(elements.answerInput.value);
    
    if (isNaN(userAnswer)) {
        showError('Please enter a valid number');
        return;
    }
    
    gameState.isAnswering = true;
    elements.answerInput.disabled = true;
    elements.submitBtn.disabled = true;
    elements.skipBtn.disabled = true;
    
    gameState.puzzlesAttempted++;
    
    // Check answer
    if (userAnswer === gameState.currentPuzzle.answer) {
        handleCorrectAnswer(userAnswer);
    } else {
        handleWrongAnswer(userAnswer);
    }
}

function handleCorrectAnswer(userAnswer) {
    // Calculate points
    const points = CONFIG.POINTS_PER_CORRECT + (gameState.streak * CONFIG.STREAK_BONUS);
    gameState.score += points;
    gameState.streak++;
    gameState.puzzlesSolved++;
    
    // Update best streak
    if (gameState.streak > gameState.bestStreak) {
        gameState.bestStreak = gameState.streak;
    }
    
    // Update display
    updateScoreDisplay();
    showSuccessFeedback(points);
    playSound('correct');
    
    // Animate image
    if (elements.puzzleImage) {
        elements.puzzleImage.classList.add('correct');
        setTimeout(() => elements.puzzleImage.classList.remove('correct'), 500);
    }
    
    // Save stats
    saveStats();
    
    // Load next puzzle after delay
    setTimeout(() => {
        gameState.isAnswering = false;
        loadPuzzle();
    }, 1500);
}

function handleWrongAnswer(userAnswer) {
    gameState.streak = 0;
    gameState.puzzlesAttempted++;
    
    // Update display
    updateScoreDisplay();
    showErrorFeedback(gameState.currentPuzzle.answer);
    playSound('wrong');
    
    // Animate image
    if (elements.puzzleImage) {
        elements.puzzleImage.classList.add('shake');
        setTimeout(() => elements.puzzleImage.classList.remove('shake'), 500);
    }
    
    // Load next puzzle after delay
    setTimeout(() => {
        gameState.isAnswering = false;
        loadPuzzle();
    }, 2000);
}

function skipPuzzle() {
    if (!gameState.isPlaying || gameState.isAnswering) return;
    
    gameState.streak = 0;
    gameState.score -= CONFIG.SKIP_PENALTY;
    gameState.puzzlesAttempted++;
    
    updateScoreDisplay();
    showSkipFeedback();
    
    setTimeout(() => {
        gameState.isAnswering = false;
        loadPuzzle();
    }, 1000);
}

/* ============================================
   GAME OVER
   ============================================ */
function endGame() {
    clearInterval(gameState.timer);
    gameState.isPlaying = false;
    
    // Calculate accuracy
    const accuracy = gameState.puzzlesAttempted > 0 
        ? Math.round((gameState.puzzlesSolved / gameState.puzzlesAttempted) * 100) 
        : 0;
    
    // Update final stats
    if (elements.finalScore) elements.finalScore.textContent = gameState.score;
    if (elements.finalPuzzles) elements.finalPuzzles.textContent = gameState.puzzlesSolved;
    if (elements.finalStreak) elements.finalStreak.textContent = gameState.bestStreak;
    if (elements.finalAccuracy) elements.finalAccuracy.textContent = accuracy + '%';
    
    // Check for new high score
    const currentHighScore = getStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE) || 0;
    if (gameState.score > currentHighScore) {
        setStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE, gameState.score);
        if (elements.newHighScoreBadge) {
            elements.newHighScoreBadge.style.display = 'block';
        }
    }
    
    // Save stats
    saveStats();
    
    // Show game over modal
    if (elements.gameOverModal) {
        elements.gameOverModal.classList.add('active');
    }
}

/* ============================================
   SCORE DISPLAY
   ============================================ */
function updateScoreDisplay() {
    if (elements.currentScore) elements.currentScore.textContent = gameState.score;
    if (elements.currentStreak) elements.currentStreak.textContent = gameState.streak;
    if (elements.bestStreak) elements.bestStreak.textContent = gameState.bestStreak;
}

/* ============================================
   FEEDBACK DISPLAY
   ============================================ */
function showSuccessFeedback(points) {
    hideFeedback();
    
    if (elements.feedbackSuccess) {
        elements.feedbackSuccess.classList.add('show');
        if (elements.pointsEarned) elements.pointsEarned.textContent = points;
    }
}

function showErrorFeedback(correctAnswer) {
    hideFeedback();
    
    if (elements.feedbackError) {
        elements.feedbackError.classList.add('show');
        if (elements.correctAnswer) elements.correctAnswer.textContent = correctAnswer;
    }
}

function showSkipFeedback() {
    hideFeedback();
    // Could add skip feedback here
}

function showError(message) {
    hideFeedback();
    // Could add error feedback here
    console.error(message);
}

function hideFeedback() {
    if (elements.feedbackSuccess) elements.feedbackSuccess.classList.remove('show');
    if (elements.feedbackError) elements.feedbackError.classList.remove('show');
}

/* ============================================
   STORAGE UTILITIES
   ============================================ */
function getStorage(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || null;
    } catch (e) {
        console.error('Error reading storage:', e);
        return null;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Error writing storage:', e);
    }
}

function saveStats() {
    // Update total games
    const totalGames = getStorage(CONFIG.STORAGE_KEYS.TOTAL_GAMES) || 0;
    setStorage(CONFIG.STORAGE_KEYS.TOTAL_GAMES, totalGames + 1);
    
    // Update total correct
    const totalCorrect = getStorage(CONFIG.STORAGE_KEYS.TOTAL_CORRECT) || 0;
    setStorage(CONFIG.STORAGE_KEYS.TOTAL_CORRECT, totalCorrect + gameState.puzzlesSolved);
}

/* ============================================
   SOUND EFFECTS
   ============================================ */
function playSound(type) {
    // Simple beep using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === 'correct') {
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
    } else if (type === 'wrong') {
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.1);
    }
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

/* ============================================
   EVENT LISTENERS
   ============================================ */
function setupEventListeners() {
    // Submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitAnswer);
    }
    
    // Skip button
    const skipBtn = document.getElementById();

    }