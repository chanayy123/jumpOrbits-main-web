export class PauseButton {
    constructor(game, canvas) {
        // 确保正确获取game对象
        if (game && game.canvas) {
            // 第一个参数是game对象
            this.game = game;
            this.canvas = game.canvas;
        } else if (canvas && canvas.canvas) {
            // 第二个参数是game对象
            this.game = canvas;
            this.canvas = canvas.canvas;
        } else {
            console.warn('PauseButton: 无法正确初始化game对象');
            return;
        }

        // 验证game对象的完整性
        if (!this.game.audioManager) {
            console.warn('PauseButton: game对象缺少audioManager');
        }

        this.isPaused = false;

        // 等待DOM加载完成后再创建元素
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.createDOMElement();
                this.bindEvents();
            });
        } else {
            this.createDOMElement();
            this.bindEvents();
        }
    }

    createDOMElement() {
        // 清除可能已存在的DOM元素
        const existingButton = document.querySelector('.control-buttons');
        if (existingButton) {
            existingButton.remove();
        }

        // 创建控制按钮容器
        this.controlButtons = document.createElement('div');
        this.controlButtons.className = 'control-buttons';
        document.getElementById('gameContainer').appendChild(this.controlButtons);

        // 创建暂停按钮
        this.pauseButton = document.createElement('button');
        this.pauseButton.className = 'neo-button icon';
        this.pauseButton.setAttribute('aria-label', '暂停游戏');
        this.pauseButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="4" y="3" width="3" height="10" fill="currentColor"/><rect x="9" y="3" width="3" height="10" fill="currentColor"/></svg>';
        this.controlButtons.appendChild(this.pauseButton);
    }

    bindEvents() {
        // 添加点击事件监听器
        this.pauseButton.addEventListener('mousedown', (e) => {
            // 阻止事件传播到游戏画布
            e.stopPropagation();
            e.preventDefault();

            // 播放按钮点击音效
            if (this.game && this.game.audioManager) {
                this.game.audioManager.playSound('buttonClick');
            }
        });

        this.pauseButton.addEventListener('click', (e) => {
            // 阻止事件传播到游戏画布
            e.stopPropagation();
            e.preventDefault();

            // 切换暂停状态
            this.isPaused = !this.isPaused;

            // 更新按钮图标
            this.updateButtonIcon();

            // 调用回调函数
            if (this.onToggle) {
                this.onToggle(this.isPaused);
            }
        });
    }

    togglePause() {
        // 切换暂停状态
        this.isPaused = !this.isPaused;

        // 调用游戏的暂停切换方法
        if (this.onToggle) {
            this.onToggle(this.isPaused);
        }

        // 确保isPaused状态与游戏的isRunning状态同步
        // isRunning为false表示游戏暂停，所以isPaused应该是!isRunning
        this.isPaused = !this.game.isRunning;

        // 更新按钮图标
        this.updateButtonIcon();
    }

    updateButtonIcon() {
        if (this.isPaused) {
            // 显示播放图标
            this.pauseButton.innerHTML = '<span style="position:relative; display:flex; pointer-events:none;"><svg width="24" height="24" viewBox="0 0 16 16"><path d="M5 3l8 5-8 5V3z" fill="currentColor"/></svg></span>';
            this.pauseButton.setAttribute('aria-label', '继续游戏');
        } else {
            // 显示暂停图标
            this.pauseButton.innerHTML = '<span style="position:relative; display:flex; pointer-events:none;"><svg width="24" height="24" viewBox="0 0 16 16"><rect x="4" y="3" width="3" height="10" fill="currentColor"/><rect x="9" y="3" width="3" height="10" fill="currentColor"/></svg></span>';
            this.pauseButton.setAttribute('aria-label', '暂停游戏');
        }
    }

    render() {
        // 游戏结束时隐藏控制按钮
        if (this.game && this.game.isGameOver) {
            if (this.controlButtons) {
                this.controlButtons.style.display = 'none';
            }
            return;
        }

        // 确保DOM元素存在
        if (!this.pauseButton) {
            this.createDOMElement();
        } else {
            this.controlButtons.style.display = 'flex';
        }

        // 确保isPaused状态与游戏的isRunning状态同步
        this.isPaused = !this.game.isRunning;
        this.updateButtonIcon();
    }

    // 销毁DOM元素（在游戏重启或结束时调用）
    destroy() {
        if (this.controlButtons) {
            this.controlButtons.remove();
        }
    }
} 