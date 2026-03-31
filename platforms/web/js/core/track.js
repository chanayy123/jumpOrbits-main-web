import { GAME_CONFIG } from './utils/config.js';
import { ParticleSystem } from './particle-system.js';

export class WebTrack {
    constructor(canvas, options) {
        // 支持两种构造方式:
        // 1. 新方式: (canvas, {centerX, centerY, radius, index, totalTracks, lineWidth, isSpecial})
        // 2. 旧方式: (x, y, index, totalTracks)

        let x, y, index, totalTracks;
        let radius, lineWidth, isSpecial;

        if (typeof options === 'object') {
            // 新的构造方式
            x = options.centerX;
            y = options.centerY;
            index = options.index;
            totalTracks = options.totalTracks || 5;
            radius = options.radius || 0;
            lineWidth = options.lineWidth || GAME_CONFIG.TRACK_BASE_WIDTH;
            isSpecial = options.isSpecial || false;
        } else {
            // 旧的构造方式，参数依次为x, y, index, totalTracks
            x = canvas; // 第一个参数其实是x
            y = options; // 第二个参数其实是y
            index = arguments[2];
            totalTracks = arguments[3] || 5;
            radius = 0;
            lineWidth = GAME_CONFIG.TRACK_BASE_WIDTH;
            isSpecial = false;
        }

        // 基础Track类的属性
        this.x = x;              // 轨道中心x坐标
        this.y = y;              // 轨道中心y坐标
        this.index = index;      // 轨道层级（从内到外，0开始）
        this.totalTracks = totalTracks;  // 总轨道数
        this.rotation = 0;       // 轨道旋转角度
        this.obstacles = [];     // 轨道上的障碍星球

        // 动画相关属性
        this.isAnimating = false;
        this.animationProgress = 0;
        this.animationDuration = 0; // 由子类设置
        this.animationStartTime = 0;
        this.startRadius = 0;
        this.targetRadius = 0;

        // WebTrack特有属性

        // 设置特有属性
        this.radius = radius;
        this.lineWidth = lineWidth;
        this.isSpecial = isSpecial;

        if (typeof options === 'object') {
            this.canvas = canvas;
        }

        this.animationDuration = GAME_CONFIG.JUMP_DURATION;
        // 初始化时不设置颜色，等待外部设置
        this.color = null;
        this.particleSystem = new ParticleSystem();
        this.clearedBySpecialTrack = false; // 标记是否被特殊轨道清除过

        // 调用基础Track类的setup方法
        this.setup();
    }

    getTrackSpacing() {
        return GAME_CONFIG.TRACK_SPACING;
    }

    // 生成轨道颜色 - 现在调用的地方会传入主题管理器，不再需要从背景色生成
    generateColor(themeManager, circle) {
        // 如果传入了主题管理器，使用主题管理器获取颜色
        if (themeManager) {
            if (this.isSpecial) {
                // 特殊轨道颜色
                return themeManager.currentTheme.specialTrackColor;
            }

            // 普通轨道颜色 - 使用圈数计算颜色
            return themeManager.getTrackColorForLayer(circle);
        }

        // 如果没有传入主题管理器，使用旧方法（为了兼容性保留）
        if (this.isSpecial) {
            // 特殊轨道使用金色
            return {
                hue: 45, // 金色的色相
                saturation: 80,
                lightness: 65
            };
        }

        // 普通轨道的颜色生成逻辑 - 保留旧逻辑，但不再使用
        const { MIN_LIGHTNESS, MAX_LIGHTNESS, SATURATION } = GAME_CONFIG.TRACK_COLOR_CONFIG;
        const hue = Math.random() * 360; // 随机色相
        const lightness = MIN_LIGHTNESS + (MAX_LIGHTNESS - MIN_LIGHTNESS) * (this.index / this.totalTracks);

        return {
            hue,
            saturation: SATURATION,
            lightness
        };
    }

    // 从十六进制颜色中提取色相 - 保留但不再使用
    extractHue(hexColor) {
        // 移除#号
        const hex = hexColor.replace('#', '');
        // 转换为RGB
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let hue = 0;

        if (max === min) {
            hue = 0;
        } else {
            const d = max - min;
            switch (max) {
                case r:
                    hue = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    hue = (b - r) / d + 2;
                    break;
                case b:
                    hue = (r - g) / d + 4;
                    break;
            }
            hue *= 60;
        }

        return hue;
    }

    updateColor(color) {
        this.color = color;
    }

    render(ctx) {
        if (!this.color) return;

        ctx.save();

        // 设置轨道样式
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        // 轨道线条宽度：从外到内计算，而不是直接使用构造函数的lineWidth
        const growthRate = 1.2; // 每层增长20%
        const widthRatio = Math.pow(growthRate, this.index);
        const minWidth = GAME_CONFIG.TRACK_BASE_WIDTH * 0.3;
        const maxWidth = GAME_CONFIG.TRACK_BASE_WIDTH * 3;
        const baseLineWidth = Math.min(minWidth * widthRatio, maxWidth);

        // 获取当前主题中的平台样式参数
        const themeManager = window.game && window.game.themeManager;
        let platformStyle = 'normal';
        let widthMultiplier = 1.0;
        let glowIntensity = 0.0;

        if (themeManager && themeManager.currentTheme && themeManager.currentTheme.platform) {
            const platform = themeManager.currentTheme.platform;
            if (typeof platform === 'object') {
                platformStyle = platform.style || 'normal';
                widthMultiplier = platform.width || 1.0;
                glowIntensity = platform.glowIntensity || 0.0;
            }
        }

        // 应用宽度乘数
        const lineWidth = baseLineWidth * widthMultiplier;
        ctx.lineWidth = lineWidth;

        // 设置颜色
        const hsl = `hsla(${this.color.hue}, 
                          ${this.color.saturation}%, 
                          ${this.color.lightness}%, 
                          0.8)`;

        // 特殊轨道或有光晕效果的轨道添加发光效果
        if (this.isSpecial || (platformStyle === 'neon' && glowIntensity > 0)) {
            const glowColor = this.isSpecial
                ? `hsla(${this.color.hue}, ${this.color.saturation}%, ${this.color.lightness}%, 0.8)`
                : `hsla(${this.color.hue}, ${this.color.saturation}%, ${this.color.lightness}%, ${glowIntensity})`;

            ctx.shadowColor = glowColor;
            ctx.shadowBlur = this.isSpecial ? 15 : 10 * glowIntensity;
        }

        // 根据不同样式绘制轨道
        switch (platformStyle) {
            case 'neon':
                // 霓虹效果：添加内外双层光晕
                ctx.strokeStyle = hsl;
                ctx.stroke();

                // 添加内层发光效果
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.lineWidth = lineWidth * 0.5;
                ctx.strokeStyle = `hsla(${this.color.hue}, 
                                      ${this.color.saturation + 10}%, 
                                      ${this.color.lightness + 20}%, 
                                      0.6)`;
                ctx.stroke();
                break;

            case 'dotted':
                // 虚线效果
                ctx.setLineDash([lineWidth * 2, lineWidth * 3]);
                ctx.strokeStyle = hsl;
                ctx.stroke();
                break;

            case 'wavy':
                // 波浪效果 - 使用多个小圆弧模拟波浪
                ctx.strokeStyle = hsl;
                const segments = 60; // 分段数量
                const waveAmplitude = lineWidth * 0.8; // 波浪振幅
                const waveFrequency = 15; // 波浪频率

                // 创建新路径用于波浪线
                ctx.beginPath();

                for (let i = 0; i <= segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    const phase = Date.now() * 0.001 + (this.index * Math.PI / 4); // 添加动画效果
                    const waveOffset = Math.sin(angle * waveFrequency + phase) * waveAmplitude;
                    const r = this.radius + waveOffset;

                    const x = this.x + Math.cos(angle) * r;
                    const y = this.y + Math.sin(angle) * r;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                ctx.closePath();
                ctx.stroke();
                break;

            case 'gradient':
                // 渐变效果
                const gradientWidth = lineWidth * 3;
                const innerRadius = this.radius - gradientWidth / 2;
                const outerRadius = this.radius + gradientWidth / 2;

                const gradient = ctx.createRadialGradient(
                    this.x, this.y, innerRadius,
                    this.x, this.y, outerRadius
                );

                gradient.addColorStop(0, `hsla(${this.color.hue}, 
                                            ${this.color.saturation}%, 
                                            ${this.color.lightness + 20}%, 
                                            0.1)`);
                gradient.addColorStop(0.5, `hsla(${this.color.hue}, 
                                            ${this.color.saturation}%, 
                                            ${this.color.lightness}%, 
                                            0.8)`);
                gradient.addColorStop(1, `hsla(${this.color.hue}, 
                                            ${this.color.saturation}%, 
                                            ${this.color.lightness - 20}%, 
                                            0.1)`);

                ctx.strokeStyle = gradient;
                ctx.lineWidth = gradientWidth;
                ctx.stroke();
                break;

            case 'normal':
            default:
                // 普通轨道
                ctx.strokeStyle = hsl;
                ctx.stroke();
                break;
        }

        // 渲染障碍星球
        this.obstacles.forEach(obstacle => obstacle.render(ctx));

        // 渲染粒子效果
        this.particleSystem.update();
        this.particleSystem.render(ctx);

        ctx.restore();
    }

    clearObstacles() {
        const count = this.obstacles.length;
        // 为每个障碍物创建爆炸效果
        this.obstacles.forEach(obstacle => {
            const angle = obstacle.angle;
            const x = this.x + Math.cos(angle) * this.radius;
            const y = this.y + Math.sin(angle) * this.radius;
            this.particleSystem.createExplosion(x, y, obstacle.color || '#ffffff');
        });
        this.obstacles = [];
        return count;
    }

    // ===== 基础Track类的方法（原来通过继承获得，现在直接实现） =====

    /**
     * 设置轨道（基础Track类方法）
     */
    setup() {
        // 当前轨道半径 = 轨道间距 * (当前层级 + 1)
        // index从0开始，所以要+1，这样最内层(index=0)的半径就等于trackSpacing
        this.radius = this.getTrackSpacing() * (this.index + 1);
    }

    /**
     * 开始动画（基础Track类方法）
     */
    startAnimation(newIndex, newTotal) {
        this.isAnimating = true;
        this.animationStartTime = Date.now();
        this.startRadius = this.radius;

        // 计算目标半径
        this.targetRadius = this.getTrackSpacing() * (newIndex + 1);
    }

    /**
     * 基础更新方法（基础Track类方法）
     * 注意：WebTrack类可能需要重写update方法，这里保留基础实现作为参考
     */
    updateBasic(deltaTime) {
        if (this.isAnimating) {
            const currentTime = Date.now();
            const elapsed = currentTime - this.animationStartTime;
            this.animationProgress = Math.min(elapsed / this.animationDuration, 1);

            // 使用缓动函数计算当前半径
            this.radius = this.startRadius + (this.targetRadius - this.startRadius) * this.easeOutQuad(this.animationProgress);

            if (this.animationProgress >= 1) {
                this.isAnimating = false;
                this.animationProgress = 0;
            }
        }

        // 更新障碍星球
        this.obstacles.forEach(obstacle => obstacle.update(deltaTime));
    }

    /**
     * 二次方缓出函数（基础Track类方法）
     */
    easeOutQuad(t) {
        return t * (2 - t);
    }

    /**
     * 获取轨道上的点的坐标（基础Track类方法）
     */
    getPointOnTrack(angle) {
        return {
            x: this.x + Math.cos(angle) * this.radius,
            y: this.y + Math.sin(angle) * this.radius
        };
    }

    /**
     * 添加障碍星球（基础Track类方法）
     */
    addObstacle(obstacle) {
        this.obstacles.push(obstacle);
    }

    /**
     * 移除障碍星球（基础Track类方法）
     */
    removeObstacle(obstacle) {
        const index = this.obstacles.indexOf(obstacle);
        if (index !== -1) {
            this.obstacles.splice(index, 1);
        }
    }

    /**
     * 主要的更新方法，被轨道系统调用
     */
    update(deltaTime) {
        // 调用基础更新方法
        this.updateBasic(deltaTime);
    }
} 