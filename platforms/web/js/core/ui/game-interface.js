/**
 * 游戏界面组件
 * 处理游戏的主界面、暂停界面和游戏结束界面
 */
export class GameInterface {
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('gameContainer');

        // 初始化界面元素
        this.createMainMenu();
        this.createPauseMenu();
        this.createGameOverScreen();

        // 绑定事件处理
        this.bindEvents();

        // 默认显示主界面
        this.showMainMenu();
    }

    /**
     * 创建主菜单界面
     */
    createMainMenu() {
        this.mainMenu = document.createElement('div');
        this.mainMenu.className = 'game-interface main-menu';
        this.mainMenu.style.display = 'none';

        // 游戏标题
        const logo = document.createElement('div');
        logo.className = 'game-logo';

        const title = document.createElement('h1');
        title.className = 'game-title';
        title.textContent = '指尖跳跳';
        logo.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.className = 'game-subtitle';
        subtitle.textContent = '无限轨道的挑战';
        logo.appendChild(subtitle);

        this.mainMenu.appendChild(logo);

        // 按钮容器
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'main-menu-buttons';

        // 开始游戏按钮
        const startButton = document.createElement('button');
        startButton.className = 'neo-button large primary';
        startButton.textContent = '开始游戏';
        startButton.addEventListener('click', () => {
            if (this.game.audioManager) {
                this.game.audioManager.playSound('buttonClick');
            }
            this.hideMainMenu();
            this.game.startGame();
        });
        buttonsContainer.appendChild(startButton);

        // 设置按钮
        const settingsButton = document.createElement('button');
        settingsButton.className = 'neo-button secondary';
        settingsButton.textContent = '设置';
        settingsButton.addEventListener('click', () => {
            if (this.game.audioManager) {
                this.game.audioManager.playSound('buttonClick');
            }
            // 触发设置面板打开
            const event = new CustomEvent('openSettings');
            document.dispatchEvent(event);
        });
        buttonsContainer.appendChild(settingsButton);

        // 排行榜按钮 (可选功能)
        const leaderboardButton = document.createElement('button');
        leaderboardButton.className = 'neo-button secondary';
        leaderboardButton.textContent = '排行榜';
        leaderboardButton.style.display = 'none';
        leaderboardButton.addEventListener('click', () => {
            if (this.game.audioManager) {
                this.game.audioManager.playSound('buttonClick');
            }
            // 触发排行榜面板打开
            const event = new CustomEvent('openLeaderboard');
            document.dispatchEvent(event);
        });
        buttonsContainer.appendChild(leaderboardButton);

        this.mainMenu.appendChild(buttonsContainer);

        // 添加游戏健康忠告
        const healthNotice = document.createElement('div');
        healthNotice.className = 'health-notice';
        healthNotice.textContent = '抵制不良游戏，拒绝盗版游戏。\n注意自我保护，谨防受骗上当。\n适度游戏益脑，沉迷游戏伤身。\n合理安排时间，享受健康生活。';
        this.mainMenu.appendChild(healthNotice);

        this.container.appendChild(this.mainMenu);
    }

    /**
     * 创建暂停菜单界面
     */
    createPauseMenu() {
        this.pauseMenu = document.createElement('div');
        this.pauseMenu.className = 'game-interface pause-menu';
        this.pauseMenu.style.display = 'none';

        // 暂停标题
        const pauseTitle = document.createElement('h2');
        pauseTitle.className = 'pause-title';
        pauseTitle.textContent = '游戏已暂停';
        this.pauseMenu.appendChild(pauseTitle);

        // 游戏统计
        const pauseStats = document.createElement('div');
        pauseStats.className = 'pause-stats';

        // 当前分数
        const scoreItem = document.createElement('div');
        scoreItem.className = 'pause-stats-item';

        const scoreLabel = document.createElement('div');
        scoreLabel.className = 'pause-stats-label';
        scoreLabel.textContent = '当前分数';
        scoreItem.appendChild(scoreLabel);

        this.pauseScoreValue = document.createElement('div');
        this.pauseScoreValue.className = 'pause-stats-value';
        this.pauseScoreValue.textContent = '0';
        scoreItem.appendChild(this.pauseScoreValue);

        pauseStats.appendChild(scoreItem);

        // 最高分数
        const highScoreItem = document.createElement('div');
        highScoreItem.className = 'pause-stats-item';

        const highScoreLabel = document.createElement('div');
        highScoreLabel.className = 'pause-stats-label';
        highScoreLabel.textContent = '最高分数';
        highScoreItem.appendChild(highScoreLabel);

        this.pauseHighScoreValue = document.createElement('div');
        this.pauseHighScoreValue.className = 'pause-stats-value';
        this.pauseHighScoreValue.textContent = '0';
        highScoreItem.appendChild(this.pauseHighScoreValue);

        pauseStats.appendChild(highScoreItem);
        this.pauseMenu.appendChild(pauseStats);

        // 按钮容器
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'pause-buttons';

        // 继续游戏按钮
        const resumeButton = document.createElement('button');
        resumeButton.className = 'neo-button primary';
        resumeButton.textContent = '继续游戏';
        resumeButton.addEventListener('click', () => {
            if (this.game.audioManager) {
                this.game.audioManager.playSound('buttonClick');
            }
            this.hidePauseMenu();
            this.game.resumeGame();
        });
        buttonsContainer.appendChild(resumeButton);

        // 重新开始按钮
        const restartButton = document.createElement('button');
        restartButton.className = 'neo-button secondary';
        restartButton.textContent = '重新开始';
        restartButton.addEventListener('click', () => {
            if (this.game.audioManager) {
                this.game.audioManager.playSound('buttonClick');
            }
            this.hidePauseMenu();
            this.game.restartGame();
        });
        buttonsContainer.appendChild(restartButton);

        // 回到主菜单按钮
        const mainMenuButton = document.createElement('button');
        mainMenuButton.className = 'neo-button secondary';
        mainMenuButton.textContent = '主菜单';
        mainMenuButton.addEventListener('click', () => {
            if (this.game.audioManager) {
                this.game.audioManager.playSound('buttonClick');
            }
            this.hidePauseMenu();
            this.game.returnToMainMenu();
        });
        buttonsContainer.appendChild(mainMenuButton);

        this.pauseMenu.appendChild(buttonsContainer);
        this.container.appendChild(this.pauseMenu);
    }

    /**
     * 创建游戏结束界面
     */
    createGameOverScreen() {
        this.gameOverScreen = document.createElement('div');
        this.gameOverScreen.className = 'game-interface game-over';
        this.gameOverScreen.style.display = 'none';

        // 游戏结束标题
        const header = document.createElement('div');
        header.className = 'game-over-header';

        const gameOverTitle = document.createElement('h2');
        gameOverTitle.className = 'game-over-title';
        gameOverTitle.textContent = '游戏结束';
        header.appendChild(gameOverTitle);
        this.gameOverScreen.appendChild(header);

        // 最终得分
        const finalScoreContainer = document.createElement('div');
        finalScoreContainer.className = 'final-score-container';

        const finalScoreLabel = document.createElement('div');
        finalScoreLabel.className = 'final-score-label';
        finalScoreLabel.textContent = '最终得分';
        finalScoreContainer.appendChild(finalScoreLabel);

        this.finalScoreElement = document.createElement('div');
        this.finalScoreElement.className = 'final-score';
        this.finalScoreElement.textContent = '0';
        finalScoreContainer.appendChild(this.finalScoreElement);

        // 新高分提示 (仅在达到新高分时显示)
        this.newHighScoreElement = document.createElement('div');
        this.newHighScoreElement.className = 'new-high-score';
        this.newHighScoreElement.textContent = '新纪录！';
        this.newHighScoreElement.style.display = 'none';
        finalScoreContainer.appendChild(this.newHighScoreElement);

        this.gameOverScreen.appendChild(finalScoreContainer);

        // 游戏统计
        const gameStats = document.createElement('div');
        gameStats.className = 'game-stats';

        // 最高分数
        const highScoreItem = document.createElement('div');
        highScoreItem.className = 'game-stat-item';

        const highScoreLabel = document.createElement('div');
        highScoreLabel.className = 'game-stat-label';
        highScoreLabel.textContent = '历史最高分';
        highScoreItem.appendChild(highScoreLabel);

        this.highScoreElement = document.createElement('div');
        this.highScoreElement.className = 'game-stat-value';
        this.highScoreElement.textContent = '0';
        highScoreItem.appendChild(this.highScoreElement);

        gameStats.appendChild(highScoreItem);

        // 达到的最深轨道
        const deepestTrackItem = document.createElement('div');
        deepestTrackItem.className = 'game-stat-item';

        const deepestTrackLabel = document.createElement('div');
        deepestTrackLabel.className = 'game-stat-label';
        deepestTrackLabel.textContent = '最深轨道';
        deepestTrackItem.appendChild(deepestTrackLabel);

        this.deepestTrackElement = document.createElement('div');
        this.deepestTrackElement.className = 'game-stat-value';
        this.deepestTrackElement.textContent = '0';
        deepestTrackItem.appendChild(this.deepestTrackElement);

        gameStats.appendChild(deepestTrackItem);
        this.gameOverScreen.appendChild(gameStats);

        // 按钮容器
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'game-over-buttons';

        // 再来一次按钮
        const restartButton = document.createElement('button');
        restartButton.className = 'neo-button large primary';
        restartButton.textContent = '再来一次';
        restartButton.addEventListener('click', () => {
            this.hideGameOverScreen();
            this.game.restartGame();
        });
        buttonsContainer.appendChild(restartButton);

        // 分享成绩按钮 (可选功能)
        const shareButton = document.createElement('button');
        shareButton.className = 'neo-button secondary';
        shareButton.textContent = '分享成绩';
        shareButton.style.display = 'none';
        shareButton.addEventListener('click', () => {
            if (this.game.audioManager) {
                this.game.audioManager.playSound('buttonClick');
            }
            // 实现分享功能
            this.shareScore();
        });
        buttonsContainer.appendChild(shareButton);

        // 回到主菜单按钮
        const mainMenuButton = document.createElement('button');
        mainMenuButton.className = 'neo-button secondary';
        mainMenuButton.textContent = '主菜单';
        mainMenuButton.addEventListener('click', () => {
            this.hideGameOverScreen();
            this.game.returnToMainMenu();
        });
        buttonsContainer.appendChild(mainMenuButton);

        this.gameOverScreen.appendChild(buttonsContainer);
        this.container.appendChild(this.gameOverScreen);
    }

    /**
     * 绑定事件处理
     */
    bindEvents() {
        // 监听游戏暂停事件
        document.addEventListener('gamePaused', (e) => {
            this.updatePauseMenu(e.detail);
            this.showPauseMenu();
        });

        // 监听游戏结束事件
        document.addEventListener('gameOver', (e) => {
            this.updateGameOverScreen(e.detail);
            this.showGameOverScreen();
        });
    }

    /**
     * 更新暂停菜单中的游戏数据
     * @param {Object} data - 游戏数据
     */
    updatePauseMenu(data = {}) {
        if (this.pauseScoreValue && data.score !== undefined) {
            this.pauseScoreValue.textContent = data.score;
        }

        if (this.pauseHighScoreValue && data.highScore !== undefined) {
            this.pauseHighScoreValue.textContent = data.highScore;
        }
    }

    /**
     * 更新游戏结束界面中的游戏数据
     * @param {Object} data - 游戏数据
     */
    updateGameOverScreen(data = {}) {
        if (this.finalScoreElement && data.score !== undefined) {
            this.finalScoreElement.textContent = data.score;
        }

        if (this.highScoreElement && data.highScore !== undefined) {
            this.highScoreElement.textContent = data.highScore;
        }

        if (this.deepestTrackElement && data.deepestTrack !== undefined) {
            this.deepestTrackElement.textContent = data.deepestTrack;
        }

        // 显示或隐藏新高分提示
        if (this.newHighScoreElement) {
            if (data.isNewHighScore) {
                this.newHighScoreElement.style.display = 'inline-block';
            } else {
                this.newHighScoreElement.style.display = 'none';
            }
        }
    }

    /**
     * 显示主菜单界面
     */
    showMainMenu() {
        if (this.mainMenu) {
            this.mainMenu.style.display = 'flex';
        }
    }

    /**
     * 隐藏主菜单界面
     */
    hideMainMenu() {
        if (this.mainMenu) {
            this.mainMenu.style.display = 'none';
        }
    }

    /**
     * 显示暂停菜单
     */
    showPauseMenu() {
        if (this.pauseMenu) {
            this.pauseMenu.style.display = 'flex';
        }
    }

    /**
     * 隐藏暂停菜单
     */
    hidePauseMenu() {
        if (this.pauseMenu) {
            this.pauseMenu.style.display = 'none';
        }
    }

    /**
     * 显示游戏结束界面
     */
    showGameOverScreen() {
        if (this.gameOverScreen) {
            this.gameOverScreen.style.display = 'flex';

            // 添加淡入动画
            this.gameOverScreen.classList.add('fade-in');
        }
    }

    /**
     * 隐藏游戏结束界面
     */
    hideGameOverScreen() {
        if (this.gameOverScreen) {
            this.gameOverScreen.style.display = 'none';
            this.gameOverScreen.classList.remove('fade-in');
        }
    }

    /**
     * 分享游戏成绩（可选功能）
     */
    shareScore() {
        // 如果浏览器支持网络分享API
        if (navigator.share) {
            navigator.share({
                title: '指尖跳跳 - 我的成绩',
                text: `我在指尖跳跳中获得了${this.finalScoreElement.textContent}分，到达了第${this.deepestTrackElement.textContent}层轨道！来挑战我吧！`,
                url: window.location.href
            }).catch((error) => console.log('分享失败', error));
        } else {
            // 不支持分享API，可以提供其他分享方式
            alert('分享功能暂不可用，请手动截图分享成绩。');
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        if (this.mainMenu) {
            this.mainMenu.remove();
        }

        if (this.pauseMenu) {
            this.pauseMenu.remove();
        }

        if (this.gameOverScreen) {
            this.gameOverScreen.remove();
        }
    }
} 