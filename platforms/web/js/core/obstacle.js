import { GAME_CONFIG } from './utils/config.js';

export class WebObstacle {
    constructor(track, angle = 0) {
        // 基础Obstacle类的属性
        this.track = track;
        this.angle = angle;
        this.x = 0;
        this.y = 0;
        this.radius = 0; // 由子类设置
        this.speed = 0;  // 由子类设置
        this.color = ''; // 由子类设置
        this.direction = 1; // 1顺时针，-1逆时针

        // WebObstacle特有属性
        this._baseRadius = GAME_CONFIG.OBSTACLE_RADIUS;
        this.speed = this.calculateSpeed();
        this.color = this.getObstacleColor();

        // 脉动效果相关参数
        this.pulseEffectEnabled = false;
        this.pulseSpeed = 1.0;
        this.pulseTimer = Math.random() * Math.PI * 2; // 随机初始相位

        // 应用主题参数
        this.applyThemeProperties();

        // 更新初始位置（基础Obstacle类的逻辑）
        this.updatePosition();
    }

    // 从游戏主题中获取障碍物的属性
    applyThemeProperties() {
        const themeManager = window.game && window.game.themeManager;
        if (themeManager && themeManager.currentTheme && themeManager.currentTheme.obstacle) {
            const obstacle = themeManager.currentTheme.obstacle;
            if (typeof obstacle === 'object') {
                if (obstacle.baseColor) {
                    this.color = obstacle.baseColor;
                }

                // 检查视觉舒适模式是否启用
                const comfortModeEnabled = GAME_CONFIG.VISUAL_COMFORT && GAME_CONFIG.VISUAL_COMFORT.ENABLED;

                if (obstacle.pulseEffect !== undefined) {
                    // 在视觉舒适模式下禁用脉动效果，否则使用主题设置
                    this.pulseEffectEnabled = comfortModeEnabled ? false : obstacle.pulseEffect;
                }

                if (obstacle.pulseSpeed !== undefined) {
                    // 在视觉舒适模式下降低脉动速度，否则使用主题设置
                    const speedReduction = comfortModeEnabled ? 0.6 : 1.0;
                    this.pulseSpeed = obstacle.pulseSpeed * speedReduction;
                }
            }
        }
    }

    // 获取障碍物颜色，支持从主题获取
    getObstacleColor() {
        const themeManager = window.game && window.game.themeManager;
        if (themeManager && themeManager.currentTheme && themeManager.currentTheme.obstacle) {
            const obstacle = themeManager.currentTheme.obstacle;
            if (typeof obstacle === 'object' && obstacle.baseColor) {
                return obstacle.baseColor;
            } else if (typeof obstacle === 'string') {
                return obstacle;
            }
        }
        return GAME_CONFIG.OBSTACLE_COLOR;
    }

    // 计算当前轨道对应的障碍星球速度
    calculateSpeed() {
        const {
            BASE_SPEED,
            MAX_SPEED,
            SPEED_INCREMENT,
            ZONE_LENGTH,
            ZONE_START,
            ZONE_GAP
        } = GAME_CONFIG.OBSTACLE_SPEED_CONFIG;

        // 计算当前轨道的圈数
        // 圈数 = 轨道的总轨道数 - 当前轨道的索引
        // Track类中已经有totalTracks属性
        const circle = this.track.totalTracks - this.track.index;

        // 如果在安全区域内，不应该有障碍球，但以防万一返回基础速度
        if (circle <= ZONE_START) {
            return BASE_SPEED;
        }

        // 计算当前所在的区间
        // 考虑到区间长度和间隔，每个完整周期的长度是 ZONE_LENGTH + ZONE_GAP
        const adjustedCircle = circle - ZONE_START;
        const cyclePeriod = ZONE_LENGTH + ZONE_GAP;
        const currentZone = Math.floor(adjustedCircle / cyclePeriod);
        const positionInCycle = adjustedCircle % cyclePeriod;

        // 如果在区间间隔中，使用当前区间的速度
        if (positionInCycle >= ZONE_LENGTH) {
            return Math.min(BASE_SPEED + (currentZone * SPEED_INCREMENT), MAX_SPEED);
        }

        // 计算当前区间的速度
        // 第一个区间（4-13圈）使用基础速度，后续区间递增
        const currentSpeed = BASE_SPEED + (currentZone * SPEED_INCREMENT);

        // 确保不超过最大速度
        return Math.min(currentSpeed, MAX_SPEED);
    }

    // 计算当前轨道对应的障碍星球半径
    calculateRadius() {
        const growthRate = 1.2; // 与轨道宽度增长率保持一致
        const widthRatio = Math.pow(growthRate, this.track.index);
        const minRadius = this._baseRadius * 0.3;
        const maxRadius = this._baseRadius * 3;

        // 获取基础半径
        let radius = Math.min(minRadius * widthRatio, maxRadius);

        // 如果启用了脉动效果，添加脉动变化
        if (this.pulseEffectEnabled) {
            // 更新脉动计时器
            this.pulseTimer += 0.05 * this.pulseSpeed;
            if (this.pulseTimer > Math.PI * 2) {
                this.pulseTimer -= Math.PI * 2;
            }

            // 检查视觉舒适模式
            const comfortModeEnabled = GAME_CONFIG.VISUAL_COMFORT && GAME_CONFIG.VISUAL_COMFORT.ENABLED;

            // 添加脉动变化，根据舒适模式调整幅度
            const pulseFactor = comfortModeEnabled ? 0.04 : 0.08; // 在舒适模式下进一步减小
            const pulseValue = Math.sin(this.pulseTimer) * pulseFactor * 0.8 + 1.0;
            radius *= pulseValue;
        }

        return radius;
    }

    // 重写获取和设置半径的方法
    get radius() {
        return this.calculateRadius();
    }

    set radius(value) {
        this._baseRadius = value;
    }

    // 更新方法，用于更新脉动效果
    update(deltaTime) {
        // 先调用基础的update逻辑，确保角度更新和位置计算
        this.updateBasic(deltaTime);

        // 如果启用了脉动效果，更新脉动计时器
        if (this.pulseEffectEnabled) {
            // 更新脉动计时器，使用deltaTime确保动画速度一致
            const pulseIncrement = 0.002 * this.pulseSpeed * deltaTime;
            this.pulseTimer += pulseIncrement;
            if (this.pulseTimer > Math.PI * 2) {
                this.pulseTimer -= Math.PI * 2;
            }
        }
    }

    render(ctx) {
        ctx.save();

        // 解析颜色以获取HSL值
        const colorValues = this.extractColorValues(this.color);

        // 检查视觉舒适模式是否启用
        const comfortModeEnabled = GAME_CONFIG.VISUAL_COMFORT && GAME_CONFIG.VISUAL_COMFORT.ENABLED;
        const highContrastMode = GAME_CONFIG.VISUAL_COMFORT && GAME_CONFIG.VISUAL_COMFORT.HIGH_CONTRAST;

        // 渲染障碍星球主体
        // 1. 外边框 - 在高对比度模式下加粗
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = highContrastMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = highContrastMode ? 2.5 : 1.5;
        ctx.stroke();

        // 2. 主体填充
        // 如果从主题获取到了颜色值，使用HSL渲染以支持更多效果
        if (colorValues) {
            const { hue, saturation, lightness } = colorValues;

            // 如果启用了脉动效果，调整饱和度和亮度
            let adjustedSaturation = saturation;
            let adjustedLightness = lightness;

            if (this.pulseEffectEnabled) {
                // 脉动时轻微调整饱和度和亮度，在舒适模式下进一步减小幅度
                const saturationPulse = Math.sin(this.pulseTimer * 1.3) * (comfortModeEnabled ? 2 : 5);
                const lightnessPulse = Math.sin(this.pulseTimer) * (comfortModeEnabled ? 4 : 8);

                adjustedSaturation = Math.min(100, Math.max(0, saturation + saturationPulse));
                adjustedLightness = Math.min(100, Math.max(0, lightness + lightnessPulse));

                // 高对比度模式下不添加光晕，舒适模式下减弱光晕
                if (!highContrastMode) {
                    const shadowOpacity = comfortModeEnabled ? 0.3 : 0.5;
                    const shadowBlur = comfortModeEnabled ? 3 : 4;
                    ctx.shadowColor = `hsla(${hue}, ${adjustedSaturation}%, ${adjustedLightness}%, ${shadowOpacity})`;
                    ctx.shadowBlur = shadowBlur;
                }
            }

            // 高对比度模式下增加颜色对比度
            if (highContrastMode) {
                adjustedSaturation = Math.min(100, saturation + 20);
                adjustedLightness = Math.min(85, Math.max(50, lightness));
            }

            ctx.fillStyle = `hsla(${hue}, ${adjustedSaturation}%, ${adjustedLightness}%, 0.9)`;
        } else {
            // 回退到原始颜色
            ctx.fillStyle = this.color;
        }
        ctx.fill();

        // 3. 内部高光 - 在高对比度模式下可选禁用
        if (!highContrastMode || !comfortModeEnabled) {
            // 根据脉动状态调整高光，减小变化幅度
            const highlightRadius = this.pulseEffectEnabled ?
                this.radius * (0.65 + Math.sin(this.pulseTimer * 1.5) * (comfortModeEnabled ? 0.03 : 0.05)) :
                this.radius * 0.7;

            const highlightOpacity = this.pulseEffectEnabled ?
                0.3 + Math.sin(this.pulseTimer * 2) * (comfortModeEnabled ? 0.03 : 0.05) :
                0.3;

            ctx.beginPath();
            ctx.arc(
                this.x - this.radius * 0.1,
                this.y - this.radius * 0.1,
                highlightRadius,
                0, Math.PI * 2
            );
            ctx.fillStyle = `rgba(255, 255, 255, ${highlightOpacity})`;
            ctx.fill();
        }

        ctx.restore();
    }

    // 提取颜色值（支持hex, rgb, rgba, hsl, hsla格式）
    extractColorValues(color) {
        // 处理Hex格式 (#RGB 或 #RRGGBB)
        if (color.startsWith('#')) {
            return this.extractFromHex(color);
        }
        // 处理RGB/RGBA格式
        else if (color.startsWith('rgb')) {
            return this.extractFromRgb(color);
        }
        // 处理HSL/HSLA格式
        else if (color.startsWith('hsl')) {
            return this.extractFromHsl(color);
        }

        return null;
    }

    // 从十六进制颜色中提取HSL值
    extractFromHex(hex) {
        // 移除#号并处理简写形式
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }

        // 转换为RGB
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;

        // 转换为HSL
        return this.rgbToHsl(r, g, b);
    }

    // 从RGB/RGBA颜色中提取HSL值
    extractFromRgb(rgb) {
        // 提取RGB值
        const matches = rgb.match(/\d+/g);
        if (!matches || matches.length < 3) return null;

        const r = parseInt(matches[0]) / 255;
        const g = parseInt(matches[1]) / 255;
        const b = parseInt(matches[2]) / 255;

        // 转换为HSL
        return this.rgbToHsl(r, g, b);
    }

    // 从HSL/HSLA颜色中提取HSL值
    extractFromHsl(hsl) {
        // 提取HSL值
        const matches = hsl.match(/\d+/g);
        if (!matches || matches.length < 3) return null;

        return {
            hue: parseInt(matches[0]),
            saturation: parseInt(matches[1]),
            lightness: parseInt(matches[2])
        };
    }

    // RGB转HSL
    rgbToHsl(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // 灰色
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }

            h *= 60;
        }

        return {
            hue: Math.round(h),
            saturation: Math.round(s * 100),
            lightness: Math.round(l * 100)
        };
    }

    // ===== 基础Obstacle类的方法（原来通过继承获得，现在直接实现） =====

    /**
     * 更新位置（基础Obstacle类方法）
     */
    updatePosition() {
        const pos = this.track.getPointOnTrack(this.angle);
        this.x = pos.x;
        this.y = pos.y;
    }

    /**
     * 基础更新方法（基础Obstacle类方法）
     * 注意：WebObstacle类已经重写了update方法，这里保留基础实现作为参考
     */
    updateBasic(deltaTime) {
        // 更新角度
        const angleIncrement = this.direction * this.speed * (deltaTime / 1000);
        this.angle += angleIncrement;
        if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
        if (this.angle < 0) this.angle += Math.PI * 2;

        // 更新位置
        this.updatePosition();
    }
} 