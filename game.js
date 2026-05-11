const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game States
const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
    LEVEL_UP: 'levelup'
};

// Difficulty Levels with extreme scaling
const DIFFICULTY_LEVELS = {
    EASY: { name: 'Easy', aiSpeed: 3, ballSpeedMult: 0.8, ballAccel: 1.01, maxSpeed: 8, reaction: 80 },
    NORMAL: { name: 'Normal', aiSpeed: 5, ballSpeedMult: 1.0, ballAccel: 1.02, maxSpeed: 12, reaction: 60 },
    HARD: { name: 'Hard', aiSpeed: 6.5, ballSpeedMult: 1.1, ballAccel: 1.03, maxSpeed: 16, reaction: 40 },
    INSANE: { name: 'INSANE', aiSpeed: 8, ballSpeedMult: 1.25, ballAccel: 1.04, maxSpeed: 20, reaction: 25 },
    NIGHTMARE: { name: '⚡ NIGHTMARE', aiSpeed: 10, ballSpeedMult: 1.5, ballAccel: 1.06, maxSpeed: 25, reaction: 15 },
    HELL: { name: '🔥 HELL MODE', aiSpeed: 12, ballSpeedMult: 1.75, ballAccel: 1.08, maxSpeed: 30, reaction: 8 }
};

let currentDifficulty = DIFFICULTY_LEVELS.NORMAL;
let gameState = GAME_STATE.MENU;
let isPaused = false;
let soundEnabled = true;
let gameScore = 0;
let roundCount = 0;
let streak = 0;

// Game Objects
const paddleWidth = 10;
const paddleHeight = 80;
const ballSize = 8;

const player = {
    x: 10,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    speed: 6,
    score: 0,
    consecutiveHits: 0
};

const computer = {
    x: canvas.width - paddleWidth - 10,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    speed: 5,
    score: 0,
    reactionCounter: 0,
    targetY: canvas.height / 2
};

const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    dx: 5,
    dy: 5,
    radius: ballSize,
    speed: 5,
    trail: [],
    spins: 0
};

// Particles for effects
let particles = [];
let powerUps = [];

// Keyboard input
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // Control keys
    if (e.key === 'p' || e.key === 'P') {
        if (gameState === GAME_STATE.PLAYING) {
            gameState = GAME_STATE.PAUSED;
            isPaused = true;
        } else if (gameState === GAME_STATE.PAUSED) {
            gameState = GAME_STATE.PLAYING;
            isPaused = false;
        }
    }
    
    if (e.key === 'm' || e.key === 'M') {
        soundEnabled = !soundEnabled;
    }
    
    // Difficulty selection
    if (gameState === GAME_STATE.MENU) {
        switch(e.key) {
            case '1': setDifficulty(DIFFICULTY_LEVELS.EASY); break;
            case '2': setDifficulty(DIFFICULTY_LEVELS.NORMAL); break;
            case '3': setDifficulty(DIFFICULTY_LEVELS.HARD); break;
            case '4': setDifficulty(DIFFICULTY_LEVELS.INSANE); break;
            case '5': setDifficulty(DIFFICULTY_LEVELS.NIGHTMARE); break;
            case '6': setDifficulty(DIFFICULTY_LEVELS.HELL); break;
            case 'Enter': startGame(); break;
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Mouse control
canvas.addEventListener('mousemove', (e) => {
    if (gameState !== GAME_STATE.PLAYING) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    
    if (mouseY < player.y) {
        player.dy = -player.speed;
    } else if (mouseY > player.y + player.height) {
        player.dy = player.speed;
    } else {
        player.dy *= 0.8;
    }
});

// Audio synthesis (Web Audio API)
function playSound(frequency, duration, volume = 0.1) {
    if (!soundEnabled) return;
    
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.log('Audio not available');
    }
}

function setDifficulty(level) {
    currentDifficulty = level;
    playSound(400, 0.1);
}

function startGame() {
    gameState = GAME_STATE.PLAYING;
    player.score = 0;
    computer.score = 0;
    gameScore = 0;
    roundCount = 0;
    streak = 0;
    resetBall();
    playSound(800, 0.2);
}

function gameOver() {
    gameState = GAME_STATE.GAME_OVER;
    playSound(200, 0.3);
}

// Update player position from keyboard
function updatePlayerInput() {
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        player.dy = -player.speed;
    } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        player.dy = player.speed;
    } else if (!canvas.matches(':hover')) {
        player.dy *= 0.95;
    }
}

// Create particle effect
function createParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            life: 30,
            color: color
        });
    }
}

// Update game logic
function update() {
    if (gameState !== GAME_STATE.PLAYING) return;
    
    updatePlayerInput();

    // Move paddles
    player.y += player.dy;
    computer.y += computer.dy;

    // Keep paddles in bounds
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
    if (computer.y < 0) computer.y = 0;
    if (computer.y + computer.height > canvas.height) computer.y = canvas.height - computer.height;

    // Move ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Trail effect
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 15) ball.trail.shift();

    // Ball collision with top and bottom walls
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.dy = -ball.dy;
        ball.y = ball.y - ball.radius < 0 ? ball.radius : canvas.height - ball.radius;
        playSound(600, 0.05);
        createParticles(ball.x, ball.y, '#00ffff', 5);
    }

    // Ball collision with player paddle
    if (
        ball.x - ball.radius < player.x + player.width &&
        ball.y > player.y &&
        ball.y < player.y + player.height &&
        ball.dx < 0
    ) {
        ball.dx = -ball.dx;
        ball.x = player.x + player.width + ball.radius;
        
        const hitPos = (ball.y - (player.y + player.height / 2)) / (player.height / 2);
        ball.dy += hitPos * 4;
        
        player.consecutiveHits++;
        streak++;
        gameScore += 10 * Math.min(streak, 10);
        
        ball.speed = Math.min(ball.speed * currentDifficulty.ballAccel, currentDifficulty.maxSpeed);
        ball.dx = Math.abs(ball.dx) * (ball.speed / 5);
        ball.spins = Math.abs(hitPos);
        
        playSound(400 + hitPos * 200, 0.1);
        createParticles(ball.x, ball.y, '#00ff88', 6);
    }

    // Ball collision with computer paddle
    if (
        ball.x + ball.radius > computer.x &&
        ball.y > computer.y &&
        ball.y < computer.y + computer.height &&
        ball.dx > 0
    ) {
        ball.dx = -ball.dx;
        ball.x = computer.x - ball.radius;
        
        const hitPos = (ball.y - (computer.y + computer.height / 2)) / (computer.height / 2);
        ball.dy += hitPos * 4;
        
        ball.speed = Math.min(ball.speed * currentDifficulty.ballAccel, currentDifficulty.maxSpeed);
        ball.dx = -Math.abs(ball.dx) * (ball.speed / 5);
        ball.spins = Math.abs(hitPos);
        
        playSound(600 + hitPos * 200, 0.1);
        createParticles(ball.x, ball.y, '#ff00ff', 6);
    }

    // Ball out of bounds - scoring
    if (ball.x - ball.radius < 0) {
        computer.score++;
        streak = 0;
        playSound(200, 0.2);
        createParticles(ball.x, ball.y, '#ff0000', 10);
        resetBall();
        
        if (computer.score >= 21) {
            gameOver();
        }
    }
    
    if (ball.x + ball.radius > canvas.width) {
        player.score++;
        playSound(800, 0.2);
        createParticles(ball.x, ball.y, '#00ff88', 10);
        gameScore += 50;
        
        if (player.score >= 21) {
            gameState = GAME_STATE.LEVEL_UP;
            playSound(1000, 0.3);
        }
        
        resetBall();
    }

    // Update AI with advanced behavior
    computerAI();

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].life--;
        particles[i].vy += 0.2; // gravity
        
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Update UI
    document.getElementById('playerScore').textContent = player.score;
    document.getElementById('computerScore').textContent = computer.score;
    document.getElementById('gameScore').textContent = gameScore;
    document.getElementById('streak').textContent = streak;
    document.getElementById('difficulty').textContent = currentDifficulty.name;
}

function computerAI() {
    // Advanced AI with reaction time and prediction
    computer.reactionCounter++;
    
    if (computer.reactionCounter >= currentDifficulty.reaction) {
        // Predict ball position
        let predictedY = ball.y;
        
        if (ball.dx > 0) {
            const distanceToPaddle = computer.x - ball.x;
            const timeToImpact = distanceToPaddle / Math.abs(ball.dx);
            predictedY = ball.y + ball.dy * timeToImpact;
            
            // Add some randomness on lower difficulties
            if (currentDifficulty.reaction > 30) {
                predictedY += (Math.random() - 0.5) * 40;
            }
        }
        
        computer.targetY = Math.max(0, Math.min(canvas.height - computer.height, predictedY - computer.height / 2));
        computer.reactionCounter = 0;
    }
    
    // Smooth movement to target
    const diff = computer.targetY - computer.y;
    if (Math.abs(diff) > 5) {
        computer.dy = Math.sign(diff) * currentDifficulty.aiSpeed;
    } else {
        computer.dy = diff * 0.3;
    }
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * 5 * currentDifficulty.ballSpeedMult;
    ball.dy = (Math.random() - 0.5) * 4 * currentDifficulty.ballSpeedMult;
    ball.speed = 5 * currentDifficulty.ballSpeedMult;
    ball.trail = [];
    player.consecutiveHits = 0;
}

// Draw functions
function drawPaddle(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
    
    // Add glow effect
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function drawBall(x, y, radius) {
    // Trail effect
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < ball.trail.length; i++) {
        ctx.fillStyle = `rgba(0, 255, 136, ${0.3 * (i / ball.trail.length)})`;
        ctx.beginPath();
        ctx.arc(ball.trail[i].x, ball.trail[i].y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Ball body
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow effect with shadow
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    
    // Spin indicator
    if (ball.spins > 0.3) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

function drawCenterLine() {
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawParticles() {
    for (let particle of particles) {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life / 30;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawMenu() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#2a2a4e');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 20;
    ctx.fillText('PONG EXTREME', canvas.width / 2, 80);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffff';
    ctx.font = '20px Arial';
    ctx.fillText('Select Difficulty Level:', canvas.width / 2, 140);

    const difficulties = [
        { key: '1', level: DIFFICULTY_LEVELS.EASY },
        { key: '2', level: DIFFICULTY_LEVELS.NORMAL },
        { key: '3', level: DIFFICULTY_LEVELS.HARD },
        { key: '4', level: DIFFICULTY_LEVELS.INSANE },
        { key: '5', level: DIFFICULTY_LEVELS.NIGHTMARE },
        { key: '6', level: DIFFICULTY_LEVELS.HELL }
    ];

    let y = 180;
    difficulties.forEach(d => {
        const highlight = d.level === currentDifficulty;
        ctx.fillStyle = highlight ? '#ffff00' : '#00ff88';
        ctx.font = highlight ? 'bold 18px Arial' : '16px Arial';
        ctx.fillText(`[${d.key}] ${d.level.name}`, canvas.width / 2, y);
        y += 35;
    });

    ctx.fillStyle = '#ff00ff';
    ctx.font = '18px Arial';
    ctx.fillText('Press ENTER to Start', canvas.width / 2, y + 30);
}

function drawPauseMenu() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 20;
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#00ffff';
    ctx.font = '16px Arial';
    ctx.fillText('Press P to Resume', canvas.width / 2, canvas.height / 2 + 50);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 30;
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#00ffff';
    ctx.font = '20px Arial';
    ctx.fillText(`Final Score: ${gameScore}`, canvas.width / 2, canvas.height / 2 + 20);
    
    ctx.fillStyle = '#ffff00';
    ctx.font = '16px Arial';
    ctx.fillText('Press any key to return to menu', canvas.width / 2, canvas.height / 2 + 60);
}

function drawLevelUp() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 30;
    ctx.fillText('🎮 YOU WIN! 🎮', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#ffff00';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${gameScore}`, canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText(`Highest Streak: ${streak}`, canvas.width / 2, canvas.height / 2 + 80);
    
    ctx.fillStyle = '#00ffff';
    ctx.font = '16px Arial';
    ctx.fillText('Press any key to return to menu', canvas.width / 2, canvas.height / 2 + 120);
}

function draw() {
    // Clear canvas with gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#2a2a4e');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === GAME_STATE.MENU) {
        drawMenu();
    } else if (gameState === GAME_STATE.PLAYING) {
        // Draw center line
        drawCenterLine();

        // Draw paddles
        drawPaddle(player.x, player.y, player.width, player.height, '#00ffff');
        drawPaddle(computer.x, computer.y, computer.width, computer.height, '#ff00ff');

        // Draw ball
        drawBall(ball.x, ball.y, ball.radius);
        
        // Draw particles
        drawParticles();

        // Draw border
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        // Draw UI
        drawGameUI();
    } else if (gameState === GAME_STATE.PAUSED) {
        // Draw frozen game
        drawCenterLine();
        drawPaddle(player.x, player.y, player.width, player.height, '#00ffff');
        drawPaddle(computer.x, computer.y, computer.width, computer.height, '#ff00ff');
        drawBall(ball.x, ball.y, ball.radius);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        drawGameUI();
        drawPauseMenu();
    } else if (gameState === GAME_STATE.GAME_OVER) {
        drawGameOver();
        
        // Reset on any key
        window.addEventListener('keydown', function resetHandler(e) {
            if (e.key !== 'p' && e.key !== 'm') {
                gameState = GAME_STATE.MENU;
                window.removeEventListener('keydown', resetHandler);
            }
        }, { once: true });
    } else if (gameState === GAME_STATE.LEVEL_UP) {
        drawLevelUp();
        
        // Reset on any key
        window.addEventListener('keydown', function resetHandler(e) {
            if (e.key !== 'p' && e.key !== 'm') {
                gameState = GAME_STATE.MENU;
                window.removeEventListener('keydown', resetHandler);
            }
        }, { once: true });
    }
}

function drawGameUI() {
    ctx.fillStyle = '#00ffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Difficulty: ${currentDifficulty.name}`, 10, canvas.height - 10);
    ctx.fillText(`Speed: ${ball.speed.toFixed(1)} | Streak: ${streak}`, 10, canvas.height - 25);
    
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${gameScore}`, canvas.width - 10, canvas.height - 10);
    ctx.fillText(`P: Pause | M: Sound ${soundEnabled ? '✓' : '✗'}`, canvas.width - 10, canvas.height - 25);
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start menu
gameState = GAME_STATE.MENU;
gameLoop();
