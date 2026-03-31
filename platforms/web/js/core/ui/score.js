export class ScoreUI {
    constructor(game, canvas) {
        // 支持两种构造方式:
        // 1. (game) - 直接从game获取canvas
        // 2. (canvas, game) - 兼容旧版传入方式

        if (!canvas && game && game.canvas) {
            // 如果只传入了一个参数且是game对象，从game获取canvas
            this.game = game;
            this.canvas = game.canvas;
        } else {
            // 兼容旧的传入方式 (canvas, game)
            this.canvas = game; // 第一个参数是canvas
            this.game = canvas; // 第二个参数是game
        }

        this.ctx = this.canvas.getContext('2d');
        this.currentScore = 0;
        this.highScore = this.loadHighScore();
        this.scoreAnimationStart = 0;
        this.scoreAnimationDuration = 500; // 500ms动画
        this.lastScore = 0;

        // 创建DOM元素
        this.createDOMElements();
    }

    createDOMElements() {
        // 清除可能已存在的DOM元素
        const existingScoreContainer = document.querySelector('.score-container');
        if (existingScoreContainer) {
            existingScoreContainer.remove();
        }

        const existingHighScore = document.querySelector('.high-score');
        if (existingHighScore) {
            existingHighScore.remove();
        }

        // 创建分数容器
        this.scoreContainer = document.createElement('div');
        this.scoreContainer.className = 'score-container';
        document.getElementById('gameContainer').appendChild(this.scoreContainer);

        // 创建当前分数显示
        this.scoreElement = document.createElement('div');
        this.scoreElement.className = 'current-score';
        this.scoreElement.textContent = this.currentScore;
        this.scoreContainer.appendChild(this.scoreElement);

        // 创建分数标签
        const scoreLabel = document.createElement('div');
        scoreLabel.className = 'score-label';
        scoreLabel.textContent = '得分';
        this.scoreContainer.appendChild(scoreLabel);

        // 创建最高分显示
        this.highScoreElement = document.createElement('div');
        this.highScoreElement.className = 'high-score';
        this.highScoreElement.textContent = `最高分: ${this.highScore}`;
        document.getElementById('gameContainer').appendChild(this.highScoreElement);
    }

    loadHighScore() {
        const saved = localStorage.getItem('highScore');
        return saved ? parseInt(saved) : 0;
    }

    saveHighScore() {
        localStorage.setItem('highScore', this.highScore.toString());
    }

    updateScore(newScore) {
        if (newScore !== this.currentScore) {
            this.lastScore = this.currentScore;
            this.currentScore = newScore;
            this.scoreAnimationStart = Date.now();

            if (this.currentScore > this.highScore) {
                this.highScore = this.currentScore;
                this.saveHighScore();
                this.highScoreElement.textContent = `最高分: ${this.highScore}`;
            }

            // 添加分数变化动画
            this.scoreElement.classList.add('score-changed');
            setTimeout(() => {
                this.scoreElement.classList.remove('score-changed');
            }, 500);

            // 更新DOM显示
            this.render();
        }
    }

    // 直接重置分数，不使用动画
    resetScore() {
        this.currentScore = 0;
        this.lastScore = 0;
        this.scoreAnimationStart = 0;
        if (this.scoreElement) {
            this.scoreElement.textContent = '0';
        }
    }

    render() {
        // 游戏结束时不渲染分数UI
        if (this.game && this.game.isGameOver) {
            if (this.scoreContainer) this.scoreContainer.style.display = 'none';
            if (this.highScoreElement) this.highScoreElement.style.display = 'none';
            return;
        }

        // 确保DOM元素存在
        if (!this.scoreElement || !this.highScoreElement) {
            this.createDOMElements();
        } else {
            this.scoreContainer.style.display = 'block';
            this.highScoreElement.style.display = 'block';
        }

        // 计算动画进度
        const currentTime = Date.now();
        const animationProgress = Math.min(1, (currentTime - this.scoreAnimationStart) / this.scoreAnimationDuration);
        const displayScore = this.scoreAnimationStart === 0 ?
            this.currentScore : // 如果没有动画，直接显示当前分数
            Math.floor(this.lastScore + (this.currentScore - this.lastScore) * this.easeOutQuad(animationProgress));

        // 更新分数显示
        this.scoreElement.textContent = displayScore.toString();
    }

    // 销毁DOM元素（在游戏重启或结束时调用）
    destroy() {
        if (this.scoreContainer) {
            this.scoreContainer.remove();
        }
        if (this.highScoreElement) {
            this.highScoreElement.remove();
        }
    }

    easeOutQuad(t) {
        return t * (2 - t);
    }
} 