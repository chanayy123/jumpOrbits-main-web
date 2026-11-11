import { WebTrackSystem } from './track-system.js';
import { WebPlayer } from './player.js';
import { ScoreUI } from './ui/score.js';
import { PauseButton } from './ui/pause-button.js';
import { GAME_CONFIG } from './utils/config.js';
import { WebAudio } from './audio.js';
import { AudioManager } from './audioManager.js';
import { SettingsUI } from './ui/settings-ui.js';
import { ThemeManager } from './utils/theme-manager.js';
import { PerformancePanel } from './ui/performance-panel.js';
import { MeteorSystem } from './meteor-system.js';
import { StarSystem } from './star-system.js';
import { ThemeEffectSystem } from './theme-effect-system.js';
import { ForestEffectSystem } from './forest-effects/forest-effect-system.js';
import { StarSkyEffectSystem } from './starsky-effects/starsky-effect-system.js';
import { LightEffectSystem } from './light-effects/light-effect-system.js';
import { CyberpunkEffectSystem } from './cyberpunk-effects/cyberpunk-effect-system.js';
import { SunriseEffectSystem } from './sunrise-effects/sunrise-effect-system.js';
import { GameInterface } from './ui/game-interface.js';
import { getCurrentPlatformConfig } from '../config/PlatformConfig.js';
import logger from './utils/logger.js';
import { isAudioV2Enabled } from './audio-v2/flag.js';

export class WebGame {
    constructor(canvas) {
        // 基础Game类的属性
        this.lastTime = 0;
        if (!canvas) {
            throw new Error('canvas参数是必需的');
        }
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');

        // 初始化主题管理器
        this.themeManager = new ThemeManager().init();

        // 使用主题管理器生成背景颜色，而不是随机选择
        this.backgroundColor = this.themeManager.getRandomBackgroundColor();

        // 初始化当前渐变配置
        this.currentGradient = null;

        // 添加颜色索引计数器，用于特殊轨道背景色切换
        this.colorIndex = 0;

        // 初始化音频系统
        this.audio = new WebAudio();

        // 初始化音频管理器，但延迟完整初始化
        this.audioManager = new AudioManager();

        // 初始化主题特效系统
        this.themeEffectSystem = new ThemeEffectSystem(this.canvas, this.themeManager);

        // 注册各主题特效系统
        this.registerThemeEffects();

        // 初始化性能面板
        this.performancePanel = new PerformancePanel(this);

        // 初始化重新开始按钮
        this.restartButton = {
            isHovered: false,
            isPressed: false,
            config: {
                SCALE_MIN: 0.95,
                HOVER_ALPHA: 0.1
            }
        };

        // 状态变量初始化
        this.lastFrameTime = 0;
        this.isRunning = false;
        this.isGameStarted = false;
        this.isGameOver = false;
        this.score = 0;
        this.highScore = this.loadHighScore();

        // 初始化重置保护时间
        this.resetProtectionTime = 0;

        // 添加标志，用于跟踪玩家是否玩过游戏
        this.hasPlayedBefore = false;

        // 暂停恢复标志
        this.resumeFromPause = false;

        // 调用初始化方法来执行设置
        this.init();

        // 初始化游戏界面组件（新增）
        this.gameInterface = new GameInterface(this);

        // 初始化设置UI等组件
        this.initializeComponents();

        // 音效系统 v2（研究原型）：仅 ?audio=v2 时动态加载，默认行为不变
        if (isAudioV2Enabled()) {
            import('./audio-v2/integrate.js')
                .then((m) => m.installAudioV2(this))
                .catch((err) => logger.error('[audio-v2] 加载失败，继续使用原音频系统:', err));
        }

        // 在创建UI后异步初始化音频管理器
        // 延迟初始化可以避免在页面加载阶段出现音频管理器报错
        setTimeout(() => {
            this.initializeAudioManager();
        }, 100);

        // 添加页面关闭事件监听
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // 监听openSettings事件，打开设置面板
        document.addEventListener('openSettings', () => {
            if (this.settingsUI) {
                this.settingsUI.toggle();
            }
        });
    }

    /**
     * 注册各主题的特效系统
     */
    registerThemeEffects() {
        // 星空主题特效
        const starskyEffects = new StarSkyEffectSystem();
        this.themeEffectSystem.registerEffectSystem('starsky', starskyEffects);

        // 森林主题特效
        const forestEffects = new ForestEffectSystem();
        this.themeEffectSystem.registerEffectSystem('forest', forestEffects);

        // 轻盈主题特效
        const lightEffects = new LightEffectSystem();
        this.themeEffectSystem.registerEffectSystem('light', lightEffects);

        // 赛博朋克主题特效
        const cyberpunkEffects = new CyberpunkEffectSystem();
        this.themeEffectSystem.registerEffectSystem('cyberpunk', cyberpunkEffects);

        // 日出主题特效
        const sunriseEffects = new SunriseEffectSystem();
        this.themeEffectSystem.registerEffectSystem('sunrise', sunriseEffects);

        logger.debug('已注册主题特效系统');
    }

    /**
     * 获取当前主题ID
     * @returns {string|null} 当前主题ID
     */
    getCurrentThemeId() {
        const currentTheme = this.themeManager.getCurrentTheme();

        if (currentTheme) {
            const themes = this.themeManager.getThemes();
            for (const [id, theme] of Object.entries(themes)) {
                if (theme === currentTheme) {
                    return id;
                }
            }
        }

        return null;
    }

    /**
     * 初始化游戏组件
     */
    initializeComponents() {
        // 创建音频管理器UI
        // 创建统一的设置UI（传递AudioManager和ThemeManager等相关实例）
        this.settingsUI = new SettingsUI(this.audio, this.audioManager, this.themeManager, this);

        // 设置游戏暂停按钮 (位于右上角) - 设置功能已移至主菜单或通过暂停菜单访问
        // this.setupSettingsButton();
    }

    /**
     * 异步初始化音频管理器
     */
    async initializeAudioManager() {
        try {
            logger.debug('开始异步初始化音频管理器...');
            await this.audioManager.init(this.audio);
            logger.debug('音频管理器初始化完成');
        } catch (error) {
            logger.error('音频管理器初始化失败:', error);
        }
    }

    // 移除了 setupAudioManagerButton 与 setupPerformanceButton，其功能已合并入统合版设置面板


    loadHighScore() {
        const saved = localStorage.getItem('highScore');
        return saved ? parseInt(saved) : 0;
    }

    saveHighScore() {
        localStorage.setItem('highScore', this.highScore.toString());
    }

    bindStartButtonEvents() {
        // 鼠标按下事件
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.isGameOver) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // 检查是否点击了"再玩一次"按钮
                const buttonWidth = 200;
                const buttonHeight = 60;
                const buttonX = this.canvas.width / 2 - buttonWidth / 2;
                const buttonY = this.canvas.height / 2 + 100;

                if (x >= buttonX && x <= buttonX + buttonWidth &&
                    y >= buttonY && y <= buttonY + buttonHeight) {
                    this.restartButton.isPressed = true;

                    // 检查音频管理器是否已初始化
                    if (this.audioManager && this.audioManager.initialized) {
                        // 播放按钮点击音效
                        this.audioManager.playSound('buttonClick');
                    }

                    // 强制重新渲染一次以显示按压效果
                    this.render();
                }
                e.stopPropagation();
            }
        });

        // 鼠标松开事件
        this.canvas.addEventListener('mouseup', (e) => {
            if (this.isGameOver && this.restartButton.isPressed) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const buttonWidth = 200;
                const buttonHeight = 60;
                const buttonX = this.canvas.width / 2 - buttonWidth / 2;
                const buttonY = this.canvas.height / 2 + 100;

                // 重置按钮状态并渲染一次，无论是否在按钮区域内
                this.restartButton.isPressed = false;
                this.render();

                // 只有在按钮区域内松开才触发重置
                if (x >= buttonX && x <= buttonX + buttonWidth &&
                    y >= buttonY && y <= buttonY + buttonHeight) {
                    this.resetGame();
                }
                e.stopPropagation();
            }
        });

        // 鼠标移出画布时重置按钮状态
        this.canvas.addEventListener('mouseleave', () => {
            if (this.restartButton.isHovered || this.restartButton.isPressed) {
                this.restartButton.isHovered = false;
                this.restartButton.isPressed = false;
                this.render(); // 更新渲染
            }
        });

        // 点击事件处理游戏开始逻辑
        this.canvas.addEventListener('click', (e) => {
            // 如果游戏结束，不处理点击
            if (this.isGameOver) {
                e.stopPropagation();
                return;
            }

            // 如果在重置保护时间内，不处理点击
            if (this.resetProtectionTime && Date.now() - this.resetProtectionTime < 500) {
                e.stopPropagation();
                return;
            }

            // 如果UI组件正在显示，不处理游戏点击
            if (this.settingsUI && this.settingsUI.isVisible) {
                e.stopPropagation();
                return;
            }

            if (!this.isGameStarted) {
                this.isGameStarted = true;
                this.isGameOver = false;
                this.isRunning = true;

                // 播放背景音乐
                if (this.audio) {
                    this.audio.playBackgroundMusic();
                }

                // 启动游戏循环
                this.requestFrame();

                // 游戏开始时直接触发第一次跳跃
                if (this.player && this.player.jump()) {
                    this.trackSystem.onPlayerStartJump();
                    this.onPlayerJump();
                }
                return;
            }
        }, true);

        // 鼠标移动事件处理
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isGameOver) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const buttonWidth = 200;
                const buttonHeight = 60;
                const buttonX = this.canvas.width / 2 - buttonWidth / 2;
                const buttonY = this.canvas.height / 2 + 100;

                const wasHovered = this.restartButton.isHovered;
                this.restartButton.isHovered = (
                    x >= buttonX && x <= buttonX + buttonWidth &&
                    y >= buttonY && y <= buttonY + buttonHeight
                );

                // 如果悬停状态改变，重新渲染
                if (wasHovered !== this.restartButton.isHovered) {
                    this.render();
                }
            }
        });
    }

    startGame() {
        if (this.isGameStarted) return;

        // 如果之前的游戏没有被重置，先重置状态
        this.resetState();

        this.isGameStarted = true;
        this.isGameOver = false;
        this.isRunning = true;

        // 播放背景音乐
        if (this.audio) {
            this.audio.playBackgroundMusic();
        }

        // 启动游戏循环
        this.requestFrame();

        // 游戏运行时显示设置按钮
        if (this.settingsButton) {
            this.settingsButton.style.display = 'block';
        }
    }

    /**
     * 重置游戏内部状态（不包含启动循环）
     */
    resetState() {
        // 重置游戏状态
        this.isGameOver = false;
        this.score = 0;

        // 重置颜色索引
        this.colorIndex = 0;

        // 重置当前背景色
        this.backgroundColor = this.themeManager.getRandomBackgroundColor();

        // 重置当前渐变配置
        this.currentGradient = null;

        // 设置重置游戏后的点击保护，防止立即触发游戏点击
        this.resetProtectionTime = Date.now();

        // 直接重置得分显示为0
        if (this.scoreUI) {
            this.scoreUI.resetScore();
        }

        // 重置轨道系统和玩家
        if (this.trackSystem) {
            this.trackSystem.reset();
        }
        if (this.player) {
            this.player.reset();
            // 确保玩家位置正确设置
            if (typeof this.player.updatePosition === 'function') {
                this.player.updatePosition();
            }
        }

        // 重置主题
        this.resetTheme();

        // 重置音频管理器
        if (this.audioManager && this.audioManager.initialized && typeof this.audioManager.reset === 'function') {
            try {
                this.audioManager.reset();
            } catch (error) {
                logger.error('重置音频管理器失败:', error);
            }
        }

        // 重置最后一帧时间
        this.lastFrameTime = 0;

        logger.debug(`游戏状态已重置：颜色索引: ${this.colorIndex}, 背景颜色: ${this.backgroundColor}`);
    }

    resetGame() {
        // 先重置游戏状态
        this.resetState();

        // 设置为已开始
        this.isGameStarted = true;
        this.isRunning = true;

        // 重新启动游戏循环
        this.start();
    }

    gameOver() {
        this.isRunning = false;
        this.isGameOver = true;

        // 保存最高分
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }

        // 播放游戏结束音效
        if (this.audioManager) {
            // this.audioManager.playSound('gameOver');
            // 确保使用正确的音效ID
            this.audioManager.playSound('fail');
            // 暂停背景音乐
            this.audio.pauseBackgroundMusic();
        }

        // 触发游戏结束事件，传递游戏数据给界面
        const gameOverEvent = new CustomEvent('gameOver', {
            detail: {
                score: this.score,
                highScore: this.highScore,
                deepestTrack: this.trackSystem ? this.trackSystem.getDeepestTrack() : 0,
                isNewHighScore: this.score >= this.highScore
            }
        });
        document.dispatchEvent(gameOverEvent);

        // 隐藏设置按钮
        if (this.settingsButton) {
            this.settingsButton.style.display = 'none';
        }

        // 设置一个简短的延迟后开始游戏结束流程
        setTimeout(() => {
            this.continueRenderingForGameOver();
        }, 100);
    }

    // 在游戏结束状态下维持渲染循环
    continueRenderingForGameOver() {
        if (this.isGameOver) {
            this.render();
            requestAnimationFrame(() => this.continueRenderingForGameOver());
        }
    }

    setupUI() {
        this.scoreUI = new ScoreUI(this);
        this.pauseButton = new PauseButton(this);
        this.pauseButton.onToggle = (isPaused) => this.togglePause();
    }

    setupCanvas() {
        const resize = () => {
            // 获取窗口尺寸
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            // 无论手机还是电脑都采用响应式铺满全屏幕
            this.canvas.width = windowWidth;
            this.canvas.height = windowHeight;

            // 画布尺寸改变时重新设置轨道系统和UI组件位置
            if (this.trackSystem) {
                this.trackSystem.updateCenter(this.canvas.width / 2, this.canvas.height / 2);
            }
            if (this.pauseButton) {
                this.pauseButton.x = this.canvas.width - this.pauseButton.buttonRadius - 20;
                this.pauseButton.y = this.pauseButton.buttonRadius + 20;
            }
            // 画布尺寸改变时通知主题特效系统
            if (this.themeEffectSystem) {
                this.themeEffectSystem.handleCanvasResize(this.canvas.width, this.canvas.height);
            }
        };
        resize();
        window.addEventListener('resize', resize);
    }

    setupGame() {
        // 确保在全局范围可以访问游戏实例
        window.game = this;

        // 初始化轨道系统
        this.trackSystem = new WebTrackSystem(this.canvas);
        this.trackSystem.setGame(this);
        this.trackSystem.setup();

        // 设置主题管理器到轨道系统
        this.themeManager.setTrackSystem(this.trackSystem);
        this.trackSystem.setThemeManager(this.themeManager);

        // 初始化轨道颜色
        this.initializeTrackColors();

        // 初始化玩家
        this.player = new WebPlayer(this.trackSystem);

        // 轨道系统初始化完成后，更新玩家位置
        if (this.player && typeof this.player.updatePosition === 'function') {
            const success = this.player.updatePosition();
            if (!success) {
                logger.error('无法正确设置玩家初始位置，游戏可能无法正常运行');
            }
        }

        // 添加主题变更监听器
        this.themeManager.addThemeChangedListener((theme) => {
            // 主题变更时更新渐变背景和轨道颜色
            this.currentGradient = this.themeManager.getBackgroundGradientByDepth(this.colorIndex);
            this.initializeTrackColors();

            // 打印日志以便调试
            logger.debug(`主题变更：使用当前颜色索引 ${this.colorIndex} 更新渐变背景`);
            if (this.currentGradient && this.currentGradient.colors) {
                logger.debug(`新的渐变颜色: ${JSON.stringify(this.currentGradient.colors)}`);
            }
        });

        // 设置分数UI
        this.score = 0;
        this.scoreUI = new ScoreUI(this);

        // 设置暂停按钮
        this.pauseButton = new PauseButton(this);

        // 初始化难度
        this.difficulty = 1;
    }

    initializeTrackColors() {
        // 使用主题管理器更新轨道颜色
        this.trackSystem.updateTrackColors();
    }

    update(deltaTime) {
        // 情况1：游戏主循环未运行（例如暂停、游戏结束，或完全未启动）
        // isRunning 是 gameLoop 是否持续请求下一帧的标志。
        // 如果 isRunning 为 false，gameLoop 本身就不会再被 requestAnimationFrame 调用，update 也不会执行。
        // 因此，这里的 !this.isRunning 检查主要是针对 togglePause 将 isRunning 设为 false 的情况。
        if (!this.isRunning) {
            // 虽然 gameLoop 可能因为 !isRunning 而停止，但如果某些外部调用意外触发了 update，
            // 确保 lastFrameTime 更新，避免恢复时 deltaTime 计算错误。
            this.lastFrameTime = performance.now();
            return;
        }

        // 情况2：游戏主循环正在运行 (this.isRunning is true)
        // 在此状态下，玩家和轨道系统应该总是更新它们的状态（例如位置、动画）
        this.player.update(deltaTime);
        this.trackSystem.update(deltaTime);

        // 只有当游戏回合正式开始后，才处理碰撞检测和分数更新等逻辑
        if (this.isGameStarted) {
            this.checkCollision();
            this.scoreUI.updateScore(this.score);
        }
        // 注意：当 !this.isGameStarted && !this.hasPlayedBefore && this.isRunning 时，
        // player 和 trackSystem 会更新（移动），但不会有碰撞和计分。
        // 初始提示文字会在 render 方法中根据 !this.isGameStarted && !this.hasPlayedBefore 显示。

        // 收集对象统计数据并更新性能面板
        let currentFps = 0;
        if (this.performancePanel && this.performancePanel.visible) {
            // 收集轨道系统数据
            let obstacleCount = 0;
            let particleCount = 0;

            if (this.trackSystem && this.trackSystem.tracks) {
                this.trackSystem.tracks.forEach(track => {
                    if (track.obstacles) {
                        obstacleCount += track.obstacles.length;
                    }
                    if (track.particleSystem) {
                        particleCount += track.particleSystem.activeCount || 0;
                    }
                });
            }

            // 更新性能面板的对象统计
            const objectStats = {
                trackCount: this.trackSystem ? this.trackSystem.tracks.length : 0,
                obstacleCount: obstacleCount,
                particleCount: particleCount
            };

            // 传递统计数据给性能面板
            this.performancePanel.updateObjectStats(objectStats);

            // 获取当前帧率
            currentFps = this.performancePanel.fps;
        }

        // 更新主题特效系统
        if (this.themeEffectSystem) {
            this.themeEffectSystem.update(Date.now(), currentFps);
        }
    }

    render() {
        if (!this.ctx) return;

        // 清除画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 渲染背景
        this.renderBackground();

        // 渲染主题特效系统 - 背景层
        if (this.themeEffectSystem) {
            this.themeEffectSystem.render(this.ctx);
        }

        // 渲染游戏元素
        this.trackSystem.render(this.ctx);
        this.player.render(this.ctx);

        // 根据游戏状态渲染UI
        if (this.isGameStarted) {
            // 只有在游戏开始后才渲染分数UI和暂停按钮
            this.scoreUI.render();
            this.pauseButton.render();
        }

        // 移除Canvas渲染的游戏结束面板，只保留DOM实现的面板
    }

    /**
     * 渲染游戏背景
     * 支持纯色和渐变背景
     */
    renderBackground() {
        // 优先使用当前渐变配置（如果有）
        const gradient = this.currentGradient || this.themeManager.getBackgroundGradient();

        if (gradient) {
            // 使用渐变背景
            let bgGradient;

            if (gradient.type === 'radial') {
                // 创建径向渐变
                bgGradient = this.ctx.createRadialGradient(
                    this.canvas.width / 2, this.canvas.height / 2, 0,
                    this.canvas.width / 2, this.canvas.height / 2,
                    Math.max(this.canvas.width, this.canvas.height) / 1.5
                );
            } else { // linear
                // 创建线性渐变
                const angle = Date.now() * 0.00001 % (Math.PI * 2); // 缓慢旋转的角度
                const x1 = this.canvas.width / 2 + Math.cos(angle) * this.canvas.width / 2;
                const y1 = this.canvas.height / 2 + Math.sin(angle) * this.canvas.height / 2;
                const x2 = this.canvas.width / 2 + Math.cos(angle + Math.PI) * this.canvas.width / 2;
                const y2 = this.canvas.height / 2 + Math.sin(angle + Math.PI) * this.canvas.height / 2;

                bgGradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
            }

            // 添加渐变色停止点
            const colorCount = gradient.colors.length;
            for (let i = 0; i < colorCount; i++) {
                const stopPosition = gradient.colorStops ?
                    gradient.colorStops[i] :
                    i / (colorCount - 1);

                // 直接使用渐变色，不再与背景色混合
                bgGradient.addColorStop(stopPosition, gradient.colors[i]);
            }

            this.ctx.fillStyle = bgGradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            // 使用普通背景色
            this.ctx.fillStyle = this.backgroundColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * 混合两个颜色
     * @param {string} color1 - 第一个颜色（CSS颜色格式）
     * @param {string} color2 - 第二个颜色（CSS颜色格式）
     * @param {number} weight - 第一个颜色的权重（0-1）
     * @returns {string} 混合后的颜色（CSS RGB格式）
     */
    blendColors(color1, color2, weight) {
        // 解析颜色1
        const c1 = this.parseColor(color1);
        // 解析颜色2
        const c2 = this.parseColor(color2);

        // 混合RGB值
        const r = Math.round(c1.r * weight + c2.r * (1 - weight));
        const g = Math.round(c1.g * weight + c2.g * (1 - weight));
        const b = Math.round(c1.b * weight + c2.b * (1 - weight));

        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * 解析CSS颜色字符串为RGB对象
     * @param {string} color - CSS颜色字符串
     * @returns {Object} 包含r、g、b值的对象
     */
    parseColor(color) {
        if (color.startsWith('#')) {
            // 处理十六进制颜色
            const hex = color.replace('#', '');
            return {
                r: parseInt(hex.substr(0, 2), 16),
                g: parseInt(hex.substr(2, 2), 16),
                b: parseInt(hex.substr(4, 2), 16)
            };
        } else if (color.startsWith('rgb')) {
            // 处理rgb/rgba颜色
            const matches = color.match(/\d+/g);
            if (matches && matches.length >= 3) {
                return {
                    r: parseInt(matches[0]),
                    g: parseInt(matches[1]),
                    b: parseInt(matches[2])
                };
            }
        }
        // 默认返回黑色
        return { r: 0, g: 0, b: 0 };
    }

    /**
     * Web平台上使用requestAnimationFrame实现
     */
    requestFrame() {
        if (this.isRunning) {
            this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
        }
    }

    // 修改gameLoop方法，不再自动调用requestAnimationFrame
    gameLoop(currentTime) {
        // 如果游戏暂停过，恢复时重置lastFrameTime为当前时间
        // 这样可以避免暂停后恢复时deltaTime过大
        if (this.resumeFromPause) {
            this.lastFrameTime = currentTime;
            this.resumeFromPause = false;
        }

        if (this.lastFrameTime === 0) {
            this.lastFrameTime = currentTime;
        }

        // 计算deltaTime，并限制最大值，防止位置跳变
        let deltaTime = currentTime - this.lastFrameTime;
        // 限制最大deltaTime为16.7ms (约60fps)，避免帧率过低时物体移动过快
        deltaTime = Math.min(deltaTime, 16.7);

        // 更新性能面板
        if (this.performancePanel) {
            this.performancePanel.update(currentTime);
        }

        // 计时更新过程
        if (this.performancePanel) {
            this.performancePanel.startTiming('update');
        }
        this.update(deltaTime);
        if (this.performancePanel) {
            this.performancePanel.endTiming('update');
        }

        // 计时渲染过程
        if (this.performancePanel) {
            this.performancePanel.startTiming('render');
        }
        this.render();
        if (this.performancePanel) {
            this.performancePanel.endTiming('render');
        }

        this.lastFrameTime = currentTime;

        // 只有在游戏运行时才请求下一帧
        if (this.isRunning) {
            this.requestFrame();
        }
    }

    // 修改start方法，使用requestFrame
    start() {
        this.isRunning = true;
        this.requestFrame();
    }

    // 使用主题管理器获取随机背景色
    getRandomBackgroundColor() {
        // 直接从主题管理器获取随机背景色
        return this.themeManager.getRandomBackgroundColor();
    }

    onPlayerJump() {
        // 当玩家成功跳跃时触发

        // 播放跳跃音效（使用AudioManager处理，它会根据当前活跃系统选择合适的播放方式）
        this.audioManager.playSound('jump');

        // 使用音频管理器处理点击（高级系统将通过这里播放自己的音效）
        this.audioManager.handlePlayerClick();

        // 获取当前轨道
        const currentTrack = this.trackSystem.tracks[this.player.currentTrackIndex];
        // 获取当前轨道从外向内数是第几圈
        const currentTrackFromOutside = this.trackSystem.totalTracks - this.player.currentTrackIndex;

        // 检查是否跳到了特殊轨道
        if (currentTrack && currentTrack.isSpecial) {
            // 特殊轨道不给基础得分，只计算清除障碍物的得分
            // 清除外层障碍物并获得额外得分
            const clearedObstacles = this.trackSystem.handleSpecialTrackEffect(this.player.currentTrackIndex);

            if (clearedObstacles > 0) {
                // 每个清除的障碍物额外得2分
                this.score += clearedObstacles * 2;
                // 播放清除音效（使用AudioManager处理）
                this.audioManager.playSound('clear');
            } else {
                // 播放特殊轨道音效（使用AudioManager处理）
                this.audioManager.playSound('specialTrack');
            }

            logger.debug(`跳入特殊轨道：不获得基础得分，清除了${clearedObstacles}个障碍物，获得${clearedObstacles * 2}分`);

            // 增加颜色索引，只有在跳过特殊轨道时才更新背景颜色
            this.colorIndex = (this.colorIndex + 1) % GAME_CONFIG.THEME_COLORS.GRADIENT_STEPS;

            // 更新渐变配置 - 使用基于索引的渐变配置生成方法
            this.currentGradient = this.themeManager.getBackgroundGradientByDepth(this.colorIndex);

            logger.debug(`特殊轨道：更新背景颜色，当前颜色索引: ${this.colorIndex}`);
            if (this.currentGradient && this.currentGradient.colors) {
                logger.debug(`渐变颜色: ${JSON.stringify(this.currentGradient.colors)}`);
            }
        } else {
            // 普通轨道：只有不在安全区域（前3圈）时才得分
            if (currentTrackFromOutside > 3) {
                // 基础得分
                this.score += 1;
                logger.debug(`跳入普通轨道：获得1分基础得分`);
            }
        }

        // 更新分数显示
        this.scoreUI.updateScore(this.score);
    }

    // 添加分数的方法，用于特殊轨道效果和其他来源的分数
    addScore(points) {
        if (typeof points === 'number' && points > 0) {
            this.score += points * 2; // 每个清除的障碍物给2分
            this.scoreUI.updateScore(this.score);

            // 播放得分音效（使用AudioManager处理）
            if (this.audio) {
                this.audioManager.playSound('score');
            }
        }
    }

    checkCollision() {
        if (!this.isGameStarted || !this.isRunning || this.isGameOver) {
            return false;
        }

        // 在开发模式下，如果启用了无敌模式，则跳过碰撞检测
        if (GAME_CONFIG.DEV.INVINCIBLE_MODE) {
            return false;
        }

        // 获取当前轨道和玩家
        const currentTrack = this.trackSystem.tracks[this.player.currentTrackIndex];
        if (!currentTrack) return false;

        let isColliding = false;
        let collidedObstacle = null;

        // 检查与当前轨道上所有障碍物的碰撞
        for (const obstacle of currentTrack.obstacles) {
            const dx = this.player.x - obstacle.x;
            const dy = this.player.y - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.player.radius + obstacle.radius) {
                isColliding = true;
                collidedObstacle = obstacle;
                break;
            }
        }

        // 发生碰撞，游戏结束
        if (isColliding) {
            // 播放碰撞音效（使用AudioManager处理）
            this.audioManager.playSound('collision');

            // 播放撞击粒子效果
            if (collidedObstacle) {
                const { x, y } = collidedObstacle;
                this.trackSystem.tracks[this.player.currentTrackIndex]
                    .particleSystem.createExplosion(x, y, '#FFDD99');
            }

            this.gameOver();
            return true;
        }

        return false;
    }

    togglePause() {
        if (this.isGameOver) return; // 游戏结束时不能暂停

        this.isRunning = !this.isRunning;

        if (this.isRunning) {
            // 恢复游戏
            this.resumeGame();
        } else {
            // 暂停游戏
            if (this.audio) {
                // 暂停背景音乐
                this.audio.pauseBackgroundMusic();
            }
            if (this.audioManager) {
                // 播放暂停音效
                this.audioManager.playSound('pause');
            }

            // 触发暂停事件，传递游戏数据给界面
            const pauseEvent = new CustomEvent('gamePaused', {
                detail: {
                    score: this.score,
                    highScore: this.highScore
                }
            });
            document.dispatchEvent(pauseEvent);

            // 在暂停状态下继续渲染，以支持主题切换
            this.continuePauseRendering();
        }
    }

    // 在暂停状态下维持渲染循环
    continuePauseRendering() {
        if (!this.isRunning && !this.isGameOver) {
            // 更新主题特效系统
            if (this.themeEffectSystem) {
                this.themeEffectSystem.update(Date.now(), 60); // 使用固定帧率
            }

            // 更新轨道系统位置
            if (this.trackSystem) {
                this.trackSystem.updateCenter(this.canvas.width / 2, this.canvas.height / 2);
            }

            this.render();
            requestAnimationFrame(() => this.continuePauseRendering());
        }
    }

    // 设置游戏设置按钮
    setupSettingsButton() {
        // 创建按钮
        const button = document.createElement('button');
        button.id = 'settings-button';
        button.className = 'neo-button small secondary';
        button.textContent = '设置';
        button.style.position = 'absolute';
        button.style.top = '20px';
        button.style.right = '20px';
        button.style.zIndex = '1100';
        button.style.display = 'none'; // 初始隐藏，仅在游戏开始后显示

        this.settingsButton = button;

        // 添加到文档
        document.body.appendChild(button);

        // 添加mousedown事件监听，在按下时播放音效
        button.addEventListener('mousedown', (e) => {
            // 阻止事件冒泡，防止点击穿透到游戏画布
            e.stopPropagation();
            e.preventDefault();

            // 播放按钮点击音效
            this.audioManager.playSound('buttonClick');
        });

        // click事件用于触发功能，不再播放音效
        button.addEventListener('click', (e) => {
            // 阻止事件冒泡，防止点击穿透到游戏画布
            e.stopPropagation();
            e.preventDefault();

            this.settingsUI.toggle();
        });
    }

    // 重置游戏主题相关状态
    resetTheme() {
        // 获取新的随机背景色
        this.backgroundColor = this.themeManager.getRandomBackgroundColor();
        // 重置颜色索引
        this.colorIndex = 0;
        // 重新初始化轨道颜色
        this.initializeTrackColors();

        // 打印重置主题后的背景颜色
        logger.debug(`主题重置：颜色索引: ${this.colorIndex}, 背景颜色: ${this.backgroundColor}`);
    }

    /**
     * 初始化游戏
     */
    init() {
        logger.debug('WebGame: 初始化游戏');

        // 确保全局访问
        window.GAME_CONFIG = GAME_CONFIG;

        // 设置全局游戏引用，方便其他组件访问
        window.game = this;

        // 加载设置，如果有的话
        this.loadSettings();

        // 注意：主题管理器、音频、UI组件等都已在构造函数中初始化，无需再次初始化

        // 设置舞台尺寸和游戏对象（这些方法已经实现）
        this.setupCanvas();
        this.setupGame();
        this.setupUI();

        return true;
    }

    /**
     * 从本地存储中加载设置
     */
    loadSettings() {
        try {
            // 尝试加载音频设置
            const audioSettingsStr = localStorage.getItem('jumpOrbits_audioSettings');
            if (audioSettingsStr) {
                const audioSettings = JSON.parse(audioSettingsStr);

                // 如果存在视觉舒适模式设置，应用到GAME_CONFIG
                if (audioSettings.visualComfort !== undefined) {
                    GAME_CONFIG.VISUAL_COMFORT.ENABLED = audioSettings.visualComfort;
                }

                // 如果存在高对比度模式设置，应用到GAME_CONFIG
                if (audioSettings.highContrast !== undefined) {
                    GAME_CONFIG.VISUAL_COMFORT.HIGH_CONTRAST = audioSettings.highContrast;
                }

                logger.debug('WebGame: 已从本地存储加载视觉舒适性设置', {
                    visualComfort: GAME_CONFIG.VISUAL_COMFORT.ENABLED,
                    highContrast: GAME_CONFIG.VISUAL_COMFORT.HIGH_CONTRAST
                });
            }
        } catch (e) {
            logger.warn('WebGame: 加载设置失败', e);
        }
    }

    /**
     * 重启游戏
     */
    restartGame() {
        // 先重置游戏状态
        this.resetGame();

        // 确保游戏状态正确设置
        this.isRunning = true;  // 设置游戏为运行状态
        this.resumeFromPause = true;  // 避免deltaTime过大
        this.lastFrameTime = performance.now();

        // 恢复背景音乐
        if (this.audio) {
            this.audio.resumeBackgroundMusic();
        }

        // 播放按钮音效
        if (this.audioManager) {
            this.audioManager.playSound('buttonClick');
        }

        // 重新启动游戏循环
        this.requestFrame();
    }

    /**
     * 返回主菜单
     */
    returnToMainMenu() {
        // 停止运行
        this.isRunning = false;
        this.isGameStarted = false;
        this.isGameOver = false;

        // 重置状态，确保球回到外圈且移除障碍物
        this.resetState();

        // 隐藏设置按钮
        if (this.settingsButton) {
            this.settingsButton.style.display = 'none';
        }

        // 播放按钮点击音效
        if (this.audioManager) {
            this.audioManager.playSound('buttonClick');
        }

        // 暂停背景音乐
        if (this.audio) {
            this.audio.pauseBackgroundMusic();
        }

        // 取消可能的动画帧
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // 显示主菜单
        if (this.gameInterface) {
            this.gameInterface.showMainMenu();
        }
    }

    /**
     * 恢复游戏（从暂停）
     */
    resumeGame() {
        if (this.isGameOver) return;

        this.isRunning = true;
        this.resumeFromPause = true;  // 标记从暂停恢复，避免deltaTime过大
        this.lastFrameTime = performance.now();

        // 恢复背景音乐
        if (this.audio) {
            this.audio.resumeBackgroundMusic();
        }

        // 播放恢复音效
        if (this.audioManager) {
            this.audioManager.playSound('buttonClick');
        }

        // 触发游戏恢复事件
        const resumeEvent = new CustomEvent('gameResumed');
        document.dispatchEvent(resumeEvent);

        // 重新启动游戏循环
        this.requestFrame();
    }

    /**
     * 清理游戏资源
     */
    cleanup() {
        // 停止游戏循环
        this.stop();

        // 清理音频资源
        if (this.audioManager) {
            this.audioManager.stopAll();
        }

        // 清理UI组件
        if (this.gameInterface) {
            this.gameInterface.destroy();
        }
        if (this.scoreUI) {
            this.scoreUI.destroy();
        }
        if (this.pauseButton) {
            this.pauseButton.destroy();
        }

        // 移除所有事件监听器
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleResize);

        // 清理canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 记录游戏结束
        logger.info('游戏资源已清理完毕');
    }

    // ===== 基础Game类的方法（原来通过继承获得，现在直接实现） =====

    /**
     * 清空画布（基础Game类的抽象方法，WebGame中已有实现）
     * 注意：WebGame类已经有了clear方法的实现，这里保留基础定义作为参考
     */
    clear() {
        // WebGame类在render方法中实现了清空画布的逻辑
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * 基础游戏循环（基础Game类方法）
     * 注意：WebGame类已经重写了gameLoop方法，这里保留基础实现作为参考
     */
    gameLoopBasic(timestamp = 0) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // 清空画布
        this.clear();

        // 更新和渲染游戏
        this.update(deltaTime);
        this.render();

        this.requestFrame();
    }
} 