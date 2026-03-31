import logger from './utils/logger.js';
import { GAME_CONFIG } from './utils/config.js';
import { ColorUtils } from './utils/color-utils.js';

export class WebPlayer {
    constructor(trackSystem) {
        // 基础Player类的属性
        this.trackSystem = trackSystem;
        // 确保trackSystem和totalTracks正确初始化后才设置currentTrackIndex
        if (this.trackSystem && this.trackSystem.totalTracks && this.trackSystem.totalTracks > 0) {
            this.currentTrackIndex = this.trackSystem.totalTracks - 1; // 从最外层开始
        } else {
            // 设置一个默认值，后续会在updatePosition时更新
            this.currentTrackIndex = 0;
            logger.warn('轨道系统未完全初始化，将在updatePosition时更新玩家轨道索引');
        }
        this.angle = -Math.PI / 2; // 从顶部开始
        this.radius = 0; // 由子类设置
        this.speed = 0; // 由子类设置
        this.color = ''; // 由子类设置
        this.isJumping = false;
        this.jumpProgress = 0;
        this.jumpDuration = 0; // 由子类设置
        this.jumpStartTime = 0;
        this.jumpStartPos = { x: 0, y: 0 };
        this.jumpTargetPos = { x: 0, y: 0 };
        this.jumpStartRadius = 0; // 记录跳跃开始时的轨道半径
        this.jumpTargetRadius = 0; // 记录目标轨道的最终半径
        this.jumpTargetIndex = 0; // 记录目标轨道索引
        this.jumpInertiaConfig = null; // 由子类设置
        this.extraInertiaFactor = 1.0; // 新增额外惯性因子

        // 轨道运行方向（1顺时针，-1逆时针）
        this.direction = 1;

        // WebPlayer特有属性

        // 设置基本属性
        this.radius = GAME_CONFIG.PLAYER_RADIUS || 8;  // 添加默认值确保不为0
        this.speed = GAME_CONFIG.PLAYER_SPEED || 2;  // 添加默认值确保不为0
        this.color = GAME_CONFIG.PLAYER_COLOR || '#FFD700';  // 添加默认值确保有颜色
        this.jumpDuration = GAME_CONFIG.JUMP_DURATION || 300;  // 添加默认值确保不为0
        this.jumpInertiaConfig = GAME_CONFIG.JUMP_INERTIA || {
            BASE_ANGLE: Math.PI / 12,  // 默认15度
            MAX_ANGLE: Math.PI / 6,    // 默认30度
            DIFFICULTY_FACTOR: 0.1     // 默认难度系数
        };
        this.gestureConfig = GAME_CONFIG.GESTURE_CONTROL || {
            SWIPE_THRESHOLD: 20,
            MIN_INERTIA_FACTOR: -0.5,
            MAX_INERTIA_FACTOR: 2.0,
            SWIPE_SENSITIVITY: 0.03,
            FEEDBACK_DURATION: 500
        };

        // 触摸相关属性
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.isTouchDown = false;

        // 手势反馈相关属性
        this.lastInertiaFactor = 1.0;
        this.gestureFeedbackTime = 0;
        this.showGestureFeedback = false;

        // 初始位置设置为轨道系统中心，等待updatePosition被调用来更新正确位置
        this.x = this.trackSystem.centerX || 0;
        this.y = this.trackSystem.centerY || 0;

        // 设置主题颜色（如果可用）
        this.setThemeColor();

        // 监听主题变更
        if (window.game && window.game.themeManager) {
            window.game.themeManager.onThemeChange(() => {
                this.setThemeColor();
            });
        }

        // 绑定点击事件
        this.bindEvents();
    }

    // 更新玩家位置，在轨道系统完全初始化后调用
    updatePosition() {
        if (!this.trackSystem) {
            logger.error('轨道系统不存在，无法更新玩家位置');
            return false;
        }

        if (typeof this.trackSystem.getTrack !== 'function') {
            logger.error('轨道系统没有getTrack方法，无法更新玩家位置');
            return false;
        }

        // 检查轨道系统的tracks数组是否已初始化
        if (!this.trackSystem.tracks || this.trackSystem.tracks.length === 0) {
            logger.error('轨道系统没有初始化轨道，无法更新玩家位置');
            return false;
        }

        // 检查当前轨道索引是否有效，如果无效则重置为最外层轨道
        if (this.currentTrackIndex === undefined || this.currentTrackIndex < 0 ||
            this.currentTrackIndex >= this.trackSystem.tracks.length) {
            logger.warn(`轨道索引无效 (${this.currentTrackIndex})，重置为最外层轨道 (${this.trackSystem.tracks.length - 1})`);
            this.currentTrackIndex = this.trackSystem.tracks.length - 1;
        }

        const currentTrack = this.trackSystem.getTrack(this.currentTrackIndex);
        if (!currentTrack) {
            logger.error('找不到玩家当前轨道, 索引:', this.currentTrackIndex, '轨道数组长度:', this.trackSystem.tracks ? this.trackSystem.tracks.length : 0);
            return false;
        }

        if (typeof currentTrack.getPointOnTrack !== 'function') {
            logger.error('轨道对象缺少getPointOnTrack方法');
            return false;
        }

        try {
            const pos = currentTrack.getPointOnTrack(this.angle);
            this.x = pos.x;
            this.y = pos.y;
            return true;
        } catch (error) {
            logger.error('更新玩家位置时发生错误:', error);
            return false;
        }
    }

    bindEvents() {
        // 触摸开始事件
        document.addEventListener('touchstart', (e) => {
            if (this.shouldProcessInput()) {
                // 检查触摸事件的目标是否为UI元素
                const isUIElement = e.target.closest('.settings-ui') ||
                    e.target.closest('.audio-manager-ui') ||
                    e.target.closest('#settings-button') ||
                    e.target.closest('#audio-manager-button') ||
                    e.target.closest('.ui-overlay');

                if (!isUIElement) {
                    this.handleTouchStart(e);
                }
            }
        }, { passive: false });

        // 触摸移动事件
        document.addEventListener('touchmove', (e) => {
            if (this.isTouchDown && this.shouldProcessInput()) {
                e.preventDefault(); // 阻止页面滚动
            }
        }, { passive: false });

        // 触摸结束事件
        document.addEventListener('touchend', (e) => {
            if (this.isTouchDown && this.shouldProcessInput()) {
                this.handleTouchEnd(e);
            }
        });

        // 鼠标按下事件（兼容桌面设备）
        document.addEventListener('mousedown', (e) => {
            if (this.shouldProcessInput()) {
                // 检查点击事件的目标是否为UI元素
                const isUIElement = e.target.closest('.settings-ui') ||
                    e.target.closest('.audio-manager-ui') ||
                    e.target.closest('#settings-button') ||
                    e.target.closest('#audio-manager-button') ||
                    e.target.closest('.ui-overlay');

                if (!isUIElement) {
                    this.handleMouseDown(e);
                }
            }
        });

        // 鼠标移动事件
        document.addEventListener('mousemove', (e) => {
            if (this.isTouchDown && this.shouldProcessInput()) {
                // 仅记录鼠标移动
            }
        });

        // 鼠标释放事件
        document.addEventListener('mouseup', (e) => {
            if (this.isTouchDown && this.shouldProcessInput()) {
                this.handleMouseUp(e);
            }
        });

        // 添加空格键事件监听
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.shouldProcessInput()) {
                this.performJump(1.0); // 使用默认惯性
            }
        });
    }

    // 检查是否应该处理输入
    shouldProcessInput() {
        // 基本游戏状态检查
        if (!this.trackSystem.game ||
            !this.trackSystem.game.isGameStarted ||
            !this.trackSystem.game.isRunning ||
            this.trackSystem.game.isGameOver) {
            return false;
        }

        // 如果UI组件正在显示，不处理游戏输入
        if (this.trackSystem.game.settingsUI && this.trackSystem.game.settingsUI.isVisible) {
            return false;
        }

        if (this.trackSystem.game.audioManagerUI && this.trackSystem.game.audioManagerUI.isVisible) {
            return false;
        }

        return true;
    }

    // 处理触摸开始
    handleTouchStart(e) {
        // 检查是否有UI组件正在显示
        if (this.trackSystem.game) {
            // 检查设置面板
            if (this.trackSystem.game.settingsUI && this.trackSystem.game.settingsUI.isVisible) {
                return; // 如果设置UI可见，不处理触摸事件
            }

            // 检查音频管理器面板
            if (this.trackSystem.game.audioManagerUI && this.trackSystem.game.audioManagerUI.isVisible) {
                return; // 如果音频管理器UI可见，不处理触摸事件
            }

            // 检查是否在重置保护时间内
            if (this.trackSystem.game.resetProtectionTime &&
                Date.now() - this.trackSystem.game.resetProtectionTime < 500) {
                return; // 如果在重置保护时间内，不处理触摸
            }
        }

        // 检查是否在暂停按钮区域内
        const pauseButton = this.trackSystem.game.pauseButton;
        if (pauseButton) {
            const touch = e.touches[0];
            const rect = pauseButton.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const distance = Math.sqrt(
                Math.pow(x - pauseButton.x, 2) +
                Math.pow(y - pauseButton.y, 2)
            );
            if (distance <= pauseButton.buttonRadius) {
                return; // 如果触摸在暂停按钮上，不处理跳跃
            }
        }

        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = Date.now();
        this.isTouchDown = true;
    }

    // 处理触摸结束
    handleTouchEnd(e) {
        if (!this.isTouchDown) return;

        const touch = e.changedTouches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const touchDuration = Date.now() - this.touchStartTime;

        this.isTouchDown = false;

        // 计算滑动距离和方向
        const swipeDistance = Math.sqrt(dx * dx + dy * dy);

        // 如果滑动距离低于阈值，当作普通点击处理
        if (swipeDistance < this.gestureConfig.SWIPE_THRESHOLD) {
            this.performJump(1.0); // 使用默认惯性
            return;
        }

        // 计算滑动角度
        let swipeAngle = Math.atan2(dy, dx);
        // 转换为极坐标系角度（0-2π）
        if (swipeAngle < 0) swipeAngle += 2 * Math.PI;

        // 计算玩家当前方向的角度
        const playerMovementAngle = this.angle + (this.direction > 0 ? Math.PI / 2 : -Math.PI / 2);

        // 计算滑动与玩家移动方向的夹角
        let angleDiff = swipeAngle - playerMovementAngle;
        // 归一化夹角到 -π 到 π
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        // 计算惯性因子
        const cosFactor = Math.cos(angleDiff);

        // 根据滑动强度和方向计算惯性因子
        const swipeStrength = Math.min(swipeDistance / 100, 1); // 归一化强度
        const baseFactor = 1.0 + (cosFactor * swipeStrength * this.gestureConfig.SWIPE_SENSITIVITY * 100);

        // 限制在配置的范围内
        const finalFactor = Math.max(
            this.gestureConfig.MIN_INERTIA_FACTOR,
            Math.min(this.gestureConfig.MAX_INERTIA_FACTOR, baseFactor)
        );

        // 记录手势反馈
        this.lastInertiaFactor = finalFactor;
        this.gestureFeedbackTime = Date.now();
        this.showGestureFeedback = true;

        // 执行跳跃，应用计算出的惯性因子
        this.performJump(finalFactor);
    }

    // 处理鼠标按下（桌面设备）
    handleMouseDown(e) {
        // 检查是否有UI组件正在显示
        if (this.trackSystem.game) {
            // 检查设置面板
            if (this.trackSystem.game.settingsUI && this.trackSystem.game.settingsUI.isVisible) {
                return; // 如果设置UI可见，不处理鼠标事件
            }

            // 检查音频管理器面板
            if (this.trackSystem.game.audioManagerUI && this.trackSystem.game.audioManagerUI.isVisible) {
                return; // 如果音频管理器UI可见，不处理鼠标事件
            }

            // 检查是否在重置保护时间内
            if (this.trackSystem.game.resetProtectionTime &&
                Date.now() - this.trackSystem.game.resetProtectionTime < 500) {
                return; // 如果在重置保护时间内，不处理点击
            }
        }

        // 检查是否在暂停按钮区域内
        const pauseButton = this.trackSystem.game.pauseButton;
        if (pauseButton) {
            const rect = pauseButton.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const distance = Math.sqrt(
                Math.pow(x - pauseButton.x, 2) +
                Math.pow(y - pauseButton.y, 2)
            );
            if (distance <= pauseButton.buttonRadius) {
                return; // 如果点击在暂停按钮上，不处理跳跃
            }
        }

        this.touchStartX = e.clientX;
        this.touchStartY = e.clientY;
        this.touchStartTime = Date.now();
        this.isTouchDown = true;
    }

    // 处理鼠标释放（桌面设备）
    handleMouseUp(e) {
        if (!this.isTouchDown) return;

        const dx = e.clientX - this.touchStartX;
        const dy = e.clientY - this.touchStartY;
        const touchDuration = Date.now() - this.touchStartTime;

        this.isTouchDown = false;

        // 使用与触摸相同的逻辑处理鼠标滑动
        const swipeDistance = Math.sqrt(dx * dx + dy * dy);

        if (swipeDistance < this.gestureConfig.SWIPE_THRESHOLD) {
            this.performJump(1.0); // 使用默认惯性
            return;
        }

        let swipeAngle = Math.atan2(dy, dx);
        if (swipeAngle < 0) swipeAngle += 2 * Math.PI;

        const playerMovementAngle = this.angle + (this.direction > 0 ? Math.PI / 2 : -Math.PI / 2);

        let angleDiff = swipeAngle - playerMovementAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const cosFactor = Math.cos(angleDiff);
        const swipeStrength = Math.min(swipeDistance / 100, 1);
        const baseFactor = 1.0 + (cosFactor * swipeStrength * this.gestureConfig.SWIPE_SENSITIVITY * 100);

        const finalFactor = Math.max(
            this.gestureConfig.MIN_INERTIA_FACTOR,
            Math.min(this.gestureConfig.MAX_INERTIA_FACTOR, baseFactor)
        );

        // 记录手势反馈
        this.lastInertiaFactor = finalFactor;
        this.gestureFeedbackTime = Date.now();
        this.showGestureFeedback = true;

        this.performJump(finalFactor);
    }

    // 执行跳跃并通知相关系统
    performJump(inertiaFactor) {
        if (this.jump(inertiaFactor)) {
            // 根据惯性因子决定播放哪种滑动音效
            if (this.trackSystem.game && this.trackSystem.game.audio) {
                // 计算滑动强度 - 将惯性因子映射到0-1范围
                const intensity = Math.abs(inertiaFactor - 1.0);
                // 判断是顺向还是逆向滑动
                const isForward = inertiaFactor > 1.0;
                // 播放对应的滑动音效
                this.trackSystem.game.audio.playSlideSound(isForward, intensity);
            }

            // 通知轨道系统玩家开始跳跃
            this.trackSystem.onPlayerStartJump();
            // 通知游戏更新分数
            if (this.trackSystem.game) {
                this.trackSystem.game.onPlayerJump();
            }
        }
    }

    getTrackSpacing() {
        return GAME_CONFIG.TRACK_SPACING;
    }

    render(ctx) {
        ctx.save();

        // 获取跳跃缩放比例
        const scale = this.getJumpScale();
        const scaledRadius = this.radius * scale;

        // 渲染玩家主体 - 确保基本图形始终渲染
        // 1. 外边框
        ctx.beginPath();
        ctx.arc(this.x, this.y, scaledRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 2. 主体填充
        ctx.fillStyle = this.color;
        ctx.fill();

        // 3. 内部高光
        ctx.beginPath();
        ctx.arc(this.x, this.y, scaledRadius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();

        // 4. 添加跳跃轨迹效果 - 将所有特效放在try-catch中，确保不会影响基本图形渲染
        try {
            if (this.isJumping && this.jumpProgress > 0.05 && this.jumpProgress < 0.95) {
                // 确保trackSystem.centerX和centerY有效
                if (this.trackSystem && typeof this.trackSystem.centerX === 'number' &&
                    !isNaN(this.trackSystem.centerX) && typeof this.trackSystem.centerY === 'number' &&
                    !isNaN(this.trackSystem.centerY) && typeof this.jumpStartRadius === 'number' &&
                    !isNaN(this.jumpStartRadius) && typeof this.extraInertiaFactor === 'number' &&
                    !isNaN(this.extraInertiaFactor)) {

                    // 绘制跳跃轨迹 - 使用连续的尾迹而不是独立的点
                    ctx.save();

                    // 设置混合模式让轨迹发光
                    ctx.globalCompositeOperation = 'lighter';

                    // 计算轨迹长度 - 只绘制最近的一小段轨迹
                    const trailLength = Math.min(0.3, this.jumpProgress); // 轨迹最长为30%的跳跃距离

                    // 计算轨迹起点位置 - 基于当前位置和进度反推
                    const progressDiff = Math.min(trailLength, this.jumpProgress);
                    const startProgress = Math.max(0, this.jumpProgress - progressDiff);

                    // 计算轨迹起点的轨道半径和角度
                    const startRadius = this.jumpStartRadius + (this.getTrackSpacing() * startProgress);
                    // 使用当前角度计算起点，而不是使用固定角度，保持与移动方向一致
                    const currentAngle = this.angle + (this.direction * this.calculateInertiaAngle(this.extraInertiaFactor) * startProgress);
                    const startX = Math.cos(currentAngle) * startRadius + this.trackSystem.centerX;
                    const startY = Math.sin(currentAngle) * startRadius + this.trackSystem.centerY;

                    // 检查起点坐标是否有效
                    if (!isNaN(startX) && !isNaN(startY) && !isNaN(this.x) && !isNaN(this.y)) {
                        // 使用ColorUtils处理颜色
                        const { r, g, b } = ColorUtils.extractRGB(this.color);

                        // 创建径向渐变 - 从起点到当前位置
                        const gradient = ctx.createLinearGradient(startX, startY, this.x, this.y);
                        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
                        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.5)`);
                        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.2)`);

                        // 绘制平滑的尾迹曲线
                        ctx.beginPath();

                        // 绘制曲线 - 使用二阶贝塞尔曲线，控制点在中间位置
                        ctx.moveTo(startX, startY);

                        // 更精确计算控制点，使曲线更加匹配实际移动路径
                        // 控制点取两点之间的中点，但稍微偏向起点一些
                        const midProgress = startProgress + progressDiff * 0.4;
                        const midRadius = this.jumpStartRadius + (this.getTrackSpacing() * midProgress);
                        const midAngle = this.angle + (this.direction * this.calculateInertiaAngle(this.extraInertiaFactor) * midProgress);
                        const cpX = Math.cos(midAngle) * midRadius + this.trackSystem.centerX;
                        const cpY = Math.sin(midAngle) * midRadius + this.trackSystem.centerY;

                        // 检查控制点坐标是否有效
                        if (!isNaN(cpX) && !isNaN(cpY)) {
                            // 绘制二次贝塞尔曲线
                            ctx.quadraticCurveTo(cpX, cpY, this.x, this.y);

                            // 设置轨迹样式 - 使线条宽度随进度变化，越靠近当前位置越细
                            const baseWidth = this.radius * 1;
                            ctx.lineWidth = baseWidth;
                            ctx.strokeStyle = gradient;
                            ctx.lineCap = 'round';

                            // 应用笔触
                            ctx.stroke();
                        }
                    }

                    // 还原上下文
                    ctx.restore();
                }
            }

            // 5. 渲染手势反馈指示器
            if (this.showGestureFeedback) {
                const currentTime = Date.now();
                const elapsedTime = currentTime - this.gestureFeedbackTime;

                // 检查是否应该继续显示反馈
                if (elapsedTime < this.gestureConfig.FEEDBACK_DURATION) {
                    // 计算不透明度，随时间衰减
                    const opacity = 1 - (elapsedTime / this.gestureConfig.FEEDBACK_DURATION);

                    // 计算指示器颜色 - 蓝色表示更快，红色表示更慢
                    let color, indicatorType;
                    if (this.lastInertiaFactor > 1.0) {
                        // 蓝色 - 加速
                        const intensity = Math.min(255, Math.round(128 + 127 * (this.lastInertiaFactor - 1) / (this.gestureConfig.MAX_INERTIA_FACTOR - 1)));
                        color = `rgba(0, 128, ${intensity}, ${opacity})`;
                        indicatorType = 'forward';
                    } else if (this.lastInertiaFactor < 1.0) {
                        // 红色 - 减速
                        const intensity = Math.min(255, Math.round(128 + 127 * (1 - this.lastInertiaFactor) / (1 - this.gestureConfig.MIN_INERTIA_FACTOR)));
                        color = `rgba(${intensity}, 64, 0, ${opacity})`;
                        indicatorType = 'backward';
                    } else {
                        // 中性 - 正常速度
                        color = `rgba(128, 128, 128, ${opacity})`;
                        indicatorType = 'neutral';
                    }

                    // 绘制基本指示器环
                    const indicatorRadius = scaledRadius * 1.8;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, indicatorRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = opacity;
                    ctx.stroke();

                    // 根据滑动类型添加方向指示
                    if (indicatorType !== 'neutral') {
                        // 获取玩家移动方向
                        const movementAngle = this.angle + (this.direction > 0 ? Math.PI / 2 : -Math.PI / 2);

                        // 箭头参数 - 调整尺寸，使其在径向上更明显
                        const arrowLength = scaledRadius * 1.0; // 稍微缩短长度
                        const arrowWidth = scaledRadius * 0.6;  // 稍微增加宽度

                        // 计算箭头方向 - 正向或反向
                        let arrowAngle;
                        if (indicatorType === 'forward') {
                            // 顺向箭头 - 指向内圈的目标落点位置
                            // 计算当前角度下的目标轨道上的落点
                            // 首先获取当前轨道索引和半径
                            const currentTrackIndex = this.currentTrackIndex;
                            // 目标轨道索引（总是向内一层）
                            const targetTrackIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : 0;
                            // 计算目标轨道半径
                            let targetRadius = 0;
                            if (this.trackSystem.tracks && this.trackSystem.tracks[targetTrackIndex]) {
                                targetRadius = this.trackSystem.tracks[targetTrackIndex].radius;
                            } else {
                                // 如果没有目标轨道信息，使用基于当前位置估算的半径
                                const currentRadius = Math.sqrt(
                                    Math.pow(this.x - this.trackSystem.centerX, 2) +
                                    Math.pow(this.y - this.trackSystem.centerY, 2)
                                );
                                targetRadius = currentRadius - this.getTrackSpacing();
                            }

                            // 计算带有惯性的目标角度
                            const inertiaAngle = this.calculateInertiaAngle(this.lastInertiaFactor) * this.direction;
                            const targetAngle = this.angle + inertiaAngle;

                            // 计算目标位置
                            const targetX = this.trackSystem.centerX + Math.cos(targetAngle) * targetRadius;
                            const targetY = this.trackSystem.centerY + Math.sin(targetAngle) * targetRadius;

                            // 计算从当前位置到目标位置的角度
                            arrowAngle = Math.atan2(targetY - this.y, targetX - this.x);
                        } else {
                            // 逆向箭头 - 指向相反方向（使用原来的切线计算）
                            arrowAngle = movementAngle + Math.PI;
                        }

                        // 计算箭头的三个点 - 调整为径向显示更合适的形状
                        const tipX = this.x + Math.cos(arrowAngle) * (indicatorRadius + arrowLength * 0.6);
                        const tipY = this.y + Math.sin(arrowAngle) * (indicatorRadius + arrowLength * 0.6);

                        const leftX = tipX - Math.cos(arrowAngle - Math.PI / 2) * arrowWidth - Math.cos(arrowAngle) * arrowLength;
                        const leftY = tipY - Math.sin(arrowAngle - Math.PI / 2) * arrowWidth - Math.sin(arrowAngle) * arrowLength;

                        const rightX = tipX - Math.cos(arrowAngle + Math.PI / 2) * arrowWidth - Math.cos(arrowAngle) * arrowLength;
                        const rightY = tipY - Math.sin(arrowAngle + Math.PI / 2) * arrowWidth - Math.sin(arrowAngle) * arrowLength;

                        // 绘制箭头 - 使用原来的单一三角形设计
                        ctx.beginPath();
                        ctx.moveTo(tipX, tipY);
                        ctx.lineTo(leftX, leftY);
                        ctx.lineTo(rightX, rightY);
                        ctx.closePath();

                        ctx.fillStyle = color;
                        ctx.fill();

                        // 添加一个轻微的发光效果
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = color;
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }

                    ctx.globalAlpha = 1.0;
                } else {
                    this.showGestureFeedback = false;
                }
            }
        } catch (e) {
            logger.error('渲染玩家特效时出错:', e);
            // 错误发生时不做任何处理，确保基本图形仍然可见
        }

        ctx.restore();

        // 开发模式：渲染跳跃进度
        if (window.DEBUG_MODE && this.isJumping) {
            ctx.save();
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(`Jump: ${Math.round(this.jumpProgress * 100)}%`, this.x + 20, this.y - 20);
            ctx.restore();
        }
    }

    // 更新玩家颜色
    updateColor(newColor) {
        this.color = newColor;
    }

    // 从主题管理器获取颜色并应用
    setThemeColor() {
        // 检查是否可以访问游戏实例和主题管理器
        if (window.game && window.game.themeManager && window.game.themeManager.currentTheme) {
            const theme = window.game.themeManager.currentTheme;
            if (theme.player) {
                // 如果player是字符串，直接使用
                if (typeof theme.player === 'string') {
                    this.color = theme.player;
                }
                // 如果player是对象且有baseColor属性，使用baseColor
                else if (theme.player.baseColor) {
                    this.color = theme.player.baseColor;
                }
            }
        }
    }

    // 主要的更新方法，被游戏循环调用
    update(deltaTime) {
        // 调用基础更新方法
        this.updateBasic(deltaTime);
        
        // 如果不在跳跃中，更新玩家在轨道上的位置
        if (!this.isJumping) {
            this.updatePosition();
        }
    }

    // ===== 基础Player类的方法（原来通过继承获得，现在直接实现） =====

    /**
     * 计算当前层级的惯性角度（基础Player类方法）
     */
    calculateInertiaAngle(extraInertiaFactor = 1.0) {
        // 注意：基础Player类不应依赖于具体的惯性配置
        // 这些配置应由平台特定的子类提供
        let baseAngle = Math.PI / 12; // 默认15度
        let difficultyFactor = 0.1;   // 默认难度系数

        if (this.jumpInertiaConfig) {
            baseAngle = this.jumpInertiaConfig.BASE_ANGLE || baseAngle;
            difficultyFactor = this.jumpInertiaConfig.DIFFICULTY_FACTOR || difficultyFactor;
        }

        // 确保extraInertiaFactor是有效值
        if (typeof extraInertiaFactor !== 'number' || isNaN(extraInertiaFactor)) {
            extraInertiaFactor = 1.0; // 如果无效则使用默认值
        }

        // 根据当前难度计算基础惯性角度
        const difficulty = this.trackSystem && this.trackSystem.game ? this.trackSystem.game.difficulty || 1 : 1;
        const baseDifficultyAngle = baseAngle + (difficulty * difficultyFactor);

        // 应用额外惯性因子
        return baseDifficultyAngle * extraInertiaFactor;
    }

    /**
     * 基础更新方法（基础Player类方法）
     * 注意：WebPlayer类已经重写了update方法，这里保留基础实现作为参考
     */
    updateBasic(deltaTime) {
        if (this.isJumping) {
            // 更新跳跃动画
            const currentTime = Date.now();
            const jumpElapsed = currentTime - this.jumpStartTime;
            // 恢复线性跳跃，移除缓动效果
            this.jumpProgress = Math.min(jumpElapsed / this.jumpDuration, 1);

            if (this.jumpProgress >= 1) {
                // 跳跃结束
                this.isJumping = false;
                this.jumpProgress = 0;
                // 更新到新轨道上的位置，添加惯性偏移
                this.currentTrackIndex = this.jumpTargetIndex + 1; // +1因为已经新增了一层内圈
                const targetTrack = this.trackSystem.getTrack(this.currentTrackIndex);
                // 应用惯性，根据额外惯性因子调整惯性角度
                const inertiaAngle = this.calculateInertiaAngle(this.extraInertiaFactor);
                this.angle += inertiaAngle * this.direction;
                const pos = targetTrack.getPointOnTrack(this.angle);
                this.x = pos.x;
                this.y = pos.y;
                // 重置额外惯性因子
                this.extraInertiaFactor = 1.0;
                // 触发轨道系统的玩家落地事件
                this.trackSystem.onPlayerLand();
            } else {
                // 计算当前轨道扩展的进度
                const currentRadius = this.jumpStartRadius + (this.getTrackSpacing() * this.jumpProgress);
                const targetRadius = this.jumpTargetRadius + (this.getTrackSpacing() * this.jumpProgress);

                // 计算实时的起点和终点，添加渐进的惯性效果，应用额外惯性因子
                const inertiaAngle = this.direction * this.calculateInertiaAngle(this.extraInertiaFactor || 1.0) * this.jumpProgress; // 随着跳跃进度逐渐增加惯性
                const currentAngle = this.angle + inertiaAngle;

                const startX = Math.cos(currentAngle) * currentRadius + this.trackSystem.centerX;
                const startY = Math.sin(currentAngle) * currentRadius + this.trackSystem.centerY;
                const targetX = Math.cos(currentAngle) * targetRadius + this.trackSystem.centerX;
                const targetY = Math.sin(currentAngle) * targetRadius + this.trackSystem.centerY;

                // 使用线性插值计算当前位置
                const t = this.jumpProgress;
                this.x = startX + (targetX - startX) * t;
                this.y = startY + (targetY - startY) * t;
            }
        } else {
            // 正常轨道运行
            const angleIncrement = this.direction * this.speed * (deltaTime / 1000);
            this.angle += angleIncrement;
            if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
            if (this.angle < 0) this.angle += Math.PI * 2;

            // 更新位置
            const currentTrack = this.trackSystem.getTrack(this.currentTrackIndex);
            const pos = currentTrack.getPointOnTrack(this.angle);
            this.x = pos.x;
            this.y = pos.y;
        }
    }

    /**
     * 玩家跳跃（基础Player类方法）
     * @param {number} extraInertiaFactor 额外惯性因子，控制跳跃后的惯性大小，默认为1.0
     * @returns {boolean} 是否成功跳跃
     */
    jump(extraInertiaFactor = 1.0) {
        // 如果已经在跳跃中，不能再次跳跃
        if (this.isJumping) {
            return false;
        }

        // 如果已经到达最内层，不允许继续跳跃
        if (this.currentTrackIndex <= 0) {
            return false;
        }

        // 设置跳跃状态
        this.isJumping = true;
        this.jumpStartTime = Date.now();
        this.jumpStartTrackIndex = this.currentTrackIndex;

        // 计算跳跃目标轨道索引（总是向内跳一层）
        const nextTrackIndex = this.currentTrackIndex - 1;
        this.jumpTargetIndex = nextTrackIndex;

        // 保存跳跃开始时的角度，用于计算轨迹
        this.jumpStartAngle = this.angle;

        // 保存额外惯性因子
        this.extraInertiaFactor = extraInertiaFactor;

        // 计算起始半径和目标半径
        this.jumpStartRadius = this.trackSystem.tracks[this.currentTrackIndex].radius;
        this.jumpTargetRadius = this.trackSystem.tracks[this.jumpTargetIndex].radius;

        return true;
    }

    /**
     * 跳跃过程中的缩放效果（基础Player类方法）
     */
    getJumpScale() {
        if (!this.isJumping) return 1;

        // 跳跃中途稍微放大，开始和结束时恢复原大小
        const scaleUp = 1.3; // 最大放大倍数
        const progress = this.jumpProgress;

        if (progress < 0.5) {
            // 前半段放大
            return 1 + (scaleUp - 1) * (progress * 2);
        } else {
            // 后半段缩小
            return scaleUp - (scaleUp - 1) * ((progress - 0.5) * 2);
        }
    }

    /**
     * 重置玩家状态到初始状态（基础Player类方法）
     */
    reset() {
        // 重置位置到最外层轨道，确保轨道系统已初始化
        if (this.trackSystem && this.trackSystem.totalTracks && this.trackSystem.totalTracks > 0) {
            this.currentTrackIndex = this.trackSystem.totalTracks - 1;
        } else {
            this.currentTrackIndex = 0;
            logger.warn('重置玩家状态时轨道系统未完全初始化');
        }

        this.angle = -Math.PI / 2; // 从顶部开始

        // 重置跳跃状态
        this.isJumping = false;
        this.jumpProgress = 0;
        this.jumpStartTime = 0;
        this.jumpStartPos = { x: 0, y: 0 };
        this.jumpTargetPos = { x: 0, y: 0 };
        this.jumpStartRadius = 0;
        this.jumpTargetRadius = 0;
        this.jumpTargetIndex = 0;
        this.extraInertiaFactor = 1.0;

        // 位置将通过子类的updatePosition方法更新
    }
} 