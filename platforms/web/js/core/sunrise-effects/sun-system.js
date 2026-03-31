/**
 * 日出主题 - 太阳系统
 * 生成太阳升起和光线照射效果
 */
import logger from '../utils/logger.js';

// 光线相关常量
const SUN_RAY_MIN_ALPHA = 0.005; // 下方光线最小透明度
const SUN_RAY_MAX_ALPHA = 0.03;  // 上方光线最大透明度
const SUN_RAY_GAME_AREA_ALPHA_FACTOR = 0.3; // 游戏区域光线透明度因子

// 太阳位置相关常量
const SUN_INITIAL_X_RATIO = 0.15;  // 太阳初始X位置比例
const SUN_INITIAL_Y_RATIO = 0.9;   // 太阳初始Y位置比例，从0.85改为0.9
const SUN_MAX_RISE_HEIGHT_RATIO = 0.75;  // 太阳最大上升高度比例，从0.5改为0.7

/**
 * 太阳光晕类
 * @private
 */
class SunGlow {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.radius = 0;
        this.active = false;

        // 光晕特性
        this.color = '';
        this.alpha = 1;
        this.pulseSpeed = 0;
        this.pulseRange = 0;
        this.rotation = 0;
        this.rotationSpeed = 0;
    }

    /**
     * 重置光晕属性
     * @param {number} x - 中心X坐标
     * @param {number} y - 中心Y坐标
     * @param {number} radius - 半径
     * @param {string} color - 颜色
     * @param {number} alpha - 透明度
     */
    reset(x, y, radius, color, alpha) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.alpha = alpha || 0.3;
        this.active = true;

        // 设置动画属性
        this.pulseSpeed = 0.0003 + Math.random() * 0.0005; // 脉动速度
        this.pulseRange = 0.1 + Math.random() * 0.2; // 脉动范围
        this.rotation = Math.random() * Math.PI * 2; // 随机初始旋转
        this.rotationSpeed = (Math.random() * 0.0001) * (Math.random() < 0.5 ? -1 : 1); // 旋转速度
    }

    /**
     * 更新光晕状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 脉动效果 - 随时间变化大小
        this.currentScale = 1 + this.pulseRange * Math.sin(currentTime * this.pulseSpeed);

        // 旋转效果
        this.rotation += this.rotationSpeed;
    }

    /**
     * 绘制光晕
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active) return;

        ctx.save();

        // 设置透明度和混合模式以增强发光效果
        ctx.globalAlpha = this.alpha;
        ctx.globalCompositeOperation = 'lighter';

        // 计算当前大小
        const currentRadius = this.radius * this.currentScale;

        // 创建径向渐变
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, currentRadius
        );

        // 渐变创建 - 中心白色，然后是传入的颜色，最后是透明
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.5, this.color);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;

        // 绘制光晕圆形
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

/**
 * 太阳光线类（使用径向渐变替代线条）
 * @private
 */
class SunRay {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.active = false;
        this.startAngle = 0;
        this.endAngle = 0;
        this.innerRadius = 0;
        this.outerRadius = 0;

        // 光线特性
        this.startColor = '';
        this.endColor = '';
        this.alpha = 1;
        this.direction = 0; // 光线方向（用于控制透明度）

        // 动画属性
        this.pulseSpeed = 0;
        this.pulseRange = 0;
        this.rotateSpeed = 0;
    }

    /**
     * 重置光线属性
     * @param {number} x - 中心X坐标
     * @param {number} y - 中心Y坐标
     * @param {number} startAngle - 起始角度
     * @param {number} endAngle - 结束角度
     * @param {number} innerRadius - 内半径
     * @param {number} direction - 光线方向 (0-上方, 1-右侧, 2-下方, 3-左侧)
     */
    reset(x, y, startAngle, endAngle, innerRadius, direction) {
        this.x = x;
        this.y = y;
        this.startAngle = startAngle;
        this.endAngle = endAngle;
        this.innerRadius = innerRadius;
        this.direction = direction;
        this.active = true;

        // 设置光线基本属性
        this.outerRadius = 1500; // 外半径足够大以覆盖屏幕

        // 根据方向设置透明度 (上方最亮，下方最暗)
        // 游戏区域（右侧）透明度较低，不干扰游戏元素
        if (direction === 0) { // 上方
            this.alpha = SUN_RAY_MAX_ALPHA * (0.8 + Math.random() * 0.2);
        } else if (direction === 1) { // 右侧（游戏区域）
            this.alpha = SUN_RAY_MIN_ALPHA +
                (SUN_RAY_MAX_ALPHA - SUN_RAY_MIN_ALPHA) *
                SUN_RAY_GAME_AREA_ALPHA_FACTOR *
                Math.random();
        } else if (direction === 2) { // 下方
            this.alpha = SUN_RAY_MIN_ALPHA * (0.8 + Math.random() * 0.2);
        } else { // 左侧
            this.alpha = SUN_RAY_MIN_ALPHA +
                (SUN_RAY_MAX_ALPHA - SUN_RAY_MIN_ALPHA) *
                0.5 * Math.random();
        }

        // 设置光线颜色 - 偏黄色到橙色
        const hue = 35 + Math.random() * 25; // 色相范围在35-60之间（黄色到橙色）
        const saturation = 90 + Math.random() * 10; // 饱和度在90-100%之间
        const lightness = 70 + Math.random() * 10; // 亮度在70-80%之间

        this.startColor = `hsla(${hue}, ${saturation}%, ${Math.min(100, lightness + 15)}%, ${this.alpha * 1.5})`;
        this.endColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`;

        // 设置动画属性
        this.pulseSpeed = 0.0003 + Math.random() * 0.0005; // 脉动速度
        this.pulseRange = 0.2 + Math.random() * 0.4; // 脉动范围
        this.rotateSpeed = (Math.random() * 0.00002) * (Math.random() < 0.5 ? -1 : 1); // 旋转速度很慢
    }

    /**
     * 更新光线状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 脉动效果 - 随时间变化透明度
        const pulseFactor = 1 + this.pulseRange * Math.sin(currentTime * this.pulseSpeed);
        this.currentAlpha = this.alpha * pulseFactor;

        // 光线可以非常缓慢地旋转，增加动态感
        this.startAngle += this.rotateSpeed;
        this.endAngle += this.rotateSpeed;
    }

    /**
     * 绘制光线
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active) return;

        ctx.save();

        // 设置混合模式增强发光效果
        ctx.globalCompositeOperation = 'lighter';

        // 创建径向渐变
        const gradient = ctx.createRadialGradient(
            this.x, this.y, this.innerRadius,
            this.x, this.y, this.outerRadius
        );

        // 渐变颜色设置
        gradient.addColorStop(0, this.startColor);
        gradient.addColorStop(1, this.endColor);

        ctx.fillStyle = gradient;

        // 绘制扇形光线
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, this.outerRadius, this.startAngle, this.endAngle);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

/**
 * 柔和天光效果
 * @private
 */
class SkyGlow {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.active = false;
        this.colors = [];
        this.alpha = 0.4;
    }

    /**
     * 重置天光属性
     * @param {number} x - 中心X坐标
     * @param {number} y - 中心Y坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    reset(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;

        // 设置颜色渐变 - 从太阳位置的黄橙色到远处的淡蓝色
        this.colors = [
            'rgba(255, 200, 100, 0.15)', // 靠近太阳的黄橙色
            'rgba(255, 150, 80, 0.1)',  // 中间过渡色
            'rgba(200, 220, 255, 0.05)' // 远处淡蓝色
        ];
    }

    /**
     * 更新天光状态
     */
    update() {
        // 天光是静态的，不需要更新
    }

    /**
     * 绘制天光
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active) return;

        ctx.save();

        // 使用叠加模式增强发光效果
        ctx.globalCompositeOperation = 'lighter';

        // 创建径向渐变
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.width * 1.2
        );

        // 添加渐变颜色
        this.colors.forEach((color, index) => {
            gradient.addColorStop(index / (this.colors.length - 1), color);
        });

        ctx.fillStyle = gradient;

        // 绘制覆盖整个天空的矩形
        ctx.fillRect(0, 0, this.width * 2, this.height);

        ctx.restore();
    }
}

/**
 * 太阳系统类
 * 管理太阳、光晕和光线效果
 */
export class SunSystem {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        // 系统状态
        this.isEnabled = false;

        // 画布尺寸
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        // 光晕配置
        this.maxGlows = options.maxGlows || 4;
        this.glows = [];

        // 光线扇形配置
        this.maxRays = options.maxBeams || 8; // 减少光线数量，改善视觉效果
        this.rays = [];

        // 天光效果
        this.skyGlow = new SkyGlow();

        // 太阳基本属性
        this.sunPosition = { x: 0, y: 0 };
        this.sunRadius = 40;  // 太阳基础半径
        this.animationProgress = 0;  // 动画进度（0-1）
        this.animationSpeed = 0.0001;  // 动画速度

        // 初始化光晕和光线对象池
        this.initGlows();
        this.initRays();

        logger.debug('SunSystem: 初始化完成');
    }

    /**
     * 初始化光晕对象池
     */
    initGlows() {
        this.glows = [];
        for (let i = 0; i < this.maxGlows; i++) {
            this.glows.push(new SunGlow());
        }
    }

    /**
     * 初始化光线对象池
     */
    initRays() {
        this.rays = [];
        for (let i = 0; i < this.maxRays; i++) {
            this.rays.push(new SunRay());
        }
    }

    /**
     * 启用系统
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    enable(width, height) {
        this.isEnabled = true;
        this.canvasWidth = width;
        this.canvasHeight = height;

        // 设置太阳位置，在左侧靠下的位置，以表现日出
        this.resetSunPosition();

        // 设置动画起始状态
        this.animationProgress = 0;

        // 初始化光晕和光线
        this.setupGlows();
        this.setupRays();

        // 设置天光效果
        this.skyGlow.reset(this.sunPosition.x, this.sunPosition.y, this.canvasWidth, this.canvasHeight);

        logger.debug('SunSystem: 已启用');
    }

    /**
     * 重置太阳位置
     */
    resetSunPosition() {
        this.sunPosition = {
            x: this.canvasWidth * SUN_INITIAL_X_RATIO,
            y: this.canvasHeight * SUN_INITIAL_Y_RATIO
        };
    }

    /**
     * 设置太阳光晕
     */
    setupGlows() {
        // 清空当前活动的光晕
        this.glows.forEach(glow => glow.active = false);

        // 创建不同大小和颜色的光晕层
        const glowColors = [
            'rgba(255, 220, 100, 0.3)',  // 内层黄色光晕
            'rgba(255, 180, 80, 0.25)',  // 中层橙色光晕
            'rgba(255, 150, 50, 0.2)',   // 外层橙红色光晕
            'rgba(255, 120, 50, 0.15)'   // 最外层红色光晕
        ];

        // 光晕半径比例
        const radiusFactors = [1.5, 2.5, 3.5, 5];

        // 创建光晕，数量取决于最大光晕数和颜色数组长度的较小值
        const glowCount = Math.min(this.maxGlows, glowColors.length);

        for (let i = 0; i < glowCount; i++) {
            const glow = this.glows[i];
            if (glow) {
                glow.reset(
                    this.sunPosition.x,
                    this.sunPosition.y,
                    this.sunRadius * radiusFactors[i],
                    glowColors[i]
                );
            }
        }
    }

    /**
     * 设置太阳光线
     */
    setupRays() {
        // 清空当前活动的光线
        this.rays.forEach(ray => ray.active = false);

        // 将光线分为四个方向区域，每个区域分配一定数量的光线
        const raysPerDirection = Math.floor(this.maxRays / 4);
        const remainingRays = this.maxRays % 4;

        const angles = [
            { start: -Math.PI * 0.25, end: Math.PI * 0.25, count: raysPerDirection + (remainingRays > 0 ? 1 : 0), direction: 0 }, // 上方
            { start: Math.PI * 0.25, end: Math.PI * 0.75, count: raysPerDirection + (remainingRays > 1 ? 1 : 0), direction: 1 },  // 右侧
            { start: Math.PI * 0.75, end: Math.PI * 1.25, count: raysPerDirection + (remainingRays > 2 ? 1 : 0), direction: 2 },  // 下方
            { start: Math.PI * 1.25, end: Math.PI * 1.75, count: raysPerDirection, direction: 3 }  // 左侧
        ];

        let rayIndex = 0;

        // 为每个方向设置光线
        for (const area of angles) {
            if (area.count <= 0) continue;

            const angleStep = (area.end - area.start) / (area.count + 1);

            for (let i = 0; i < area.count; i++) {
                if (rayIndex >= this.maxRays) break;

                const ray = this.rays[rayIndex];
                if (!ray) continue;

                // 计算光线角度
                const baseAngle = area.start + angleStep * (i + 1);
                // 角度范围随机，但不会太宽
                const angleWidth = angleStep * (0.4 + Math.random() * 0.4);

                ray.reset(
                    this.sunPosition.x,
                    this.sunPosition.y,
                    baseAngle - angleWidth / 2,
                    baseAngle + angleWidth / 2,
                    this.sunRadius * 1.2,
                    area.direction
                );

                rayIndex++;
            }
        }
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;

        // 清除所有活动的光晕和光线
        this.glows.forEach(glow => glow.active = false);
        this.rays.forEach(ray => ray.active = false);
        this.skyGlow.active = false;

        logger.debug('SunSystem: 已禁用');
    }

    /**
     * 调整画布尺寸
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     */
    resize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;

        // 重新计算太阳位置
        this.resetSunPosition();

        // 更新所有光晕的位置
        this.glows.forEach(glow => {
            if (glow.active) {
                glow.x = this.sunPosition.x;
                glow.y = this.sunPosition.y;
            }
        });

        // 更新所有光线的位置
        this.rays.forEach(ray => {
            if (ray.active) {
                ray.x = this.sunPosition.x;
                ray.y = this.sunPosition.y;
            }
        });

        // 更新天光效果
        if (this.skyGlow.active) {
            this.skyGlow.x = this.sunPosition.x;
            this.skyGlow.y = this.sunPosition.y;
            this.skyGlow.width = width;
            this.skyGlow.height = height;
        }
    }

    /**
     * 更新光晕池大小
     * @param {number} newSize - 新的池大小
     */
    updateGlowsPool(newSize) {
        if (newSize === this.maxGlows) return;

        // 如果新大小更小，禁用多余的光晕
        if (newSize < this.maxGlows) {
            for (let i = newSize; i < this.maxGlows; i++) {
                if (i < this.glows.length) {
                    this.glows[i].active = false;
                }
            }
        }
        // 如果新大小更大，添加新的光晕
        else if (newSize > this.maxGlows) {
            const addCount = newSize - this.maxGlows;
            for (let i = 0; i < addCount; i++) {
                this.glows.push(new SunGlow());
            }
            // 设置新添加的光晕
            this.setupGlows();
        }

        this.maxGlows = newSize;
    }

    /**
     * 更新光线池大小
     * @param {number} newSize - 新的池大小
     */
    updateBeamsPool(newSize) {
        if (newSize === this.maxRays) return;

        // 如果新大小更小，禁用多余的光线
        if (newSize < this.maxRays) {
            for (let i = newSize; i < this.maxRays; i++) {
                if (i < this.rays.length) {
                    this.rays[i].active = false;
                }
            }
        }
        // 如果新大小更大，添加新的光线
        else if (newSize > this.maxRays) {
            const addCount = newSize - this.maxRays;
            for (let i = 0; i < addCount; i++) {
                this.rays.push(new SunRay());
            }
            // 设置新添加的光线
            this.setupRays();
        }

        this.maxRays = newSize;
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 更新太阳升起动画
        this.animationProgress = Math.min(1, this.animationProgress + this.animationSpeed * (currentTime - (this.lastUpdateTime || currentTime)));
        this.lastUpdateTime = currentTime;

        // 计算当前太阳高度，根据动画进度从初始位置上升
        // 使用正弦缓动使动画看起来更自然
        const easedProgress = Math.sin(this.animationProgress * Math.PI / 2);
        const maxRiseHeight = this.canvasHeight * SUN_MAX_RISE_HEIGHT_RATIO;
        this.sunPosition.y = this.canvasHeight * SUN_INITIAL_Y_RATIO - easedProgress * maxRiseHeight;

        // 更新所有光晕的位置和状态
        this.glows.forEach(glow => {
            if (glow.active) {
                glow.x = this.sunPosition.x;
                glow.y = this.sunPosition.y;
                glow.update(currentTime);
            }
        });

        // 更新所有光线的位置和状态
        this.rays.forEach(ray => {
            if (ray.active) {
                ray.x = this.sunPosition.x;
                ray.y = this.sunPosition.y;
                ray.update(currentTime);
            }
        });

        // 更新天光效果
        if (this.skyGlow.active) {
            this.skyGlow.x = this.sunPosition.x;
            this.skyGlow.y = this.sunPosition.y;
            this.skyGlow.update();
        }
    }

    /**
     * 渲染太阳系统
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.isEnabled) return;

        ctx.save();

        // 首先渲染整体天光效果（最底层）
        if (this.skyGlow.active) {
            this.skyGlow.render(ctx);
        }

        // 然后渲染扇形光线（底层）
        this.rays.forEach(ray => {
            if (ray.active) {
                ray.render(ctx);
            }
        });

        // 渲染光晕（中层）
        this.glows.forEach(glow => {
            if (glow.active) {
                glow.render(ctx);
            }
        });

        // 渲染太阳本体（在顶层）
        ctx.globalCompositeOperation = 'lighter';

        // 创建太阳径向渐变
        const sunGradient = ctx.createRadialGradient(
            this.sunPosition.x, this.sunPosition.y, 0,
            this.sunPosition.x, this.sunPosition.y, this.sunRadius
        );

        // 太阳中心为白色，向外过渡为黄色再到橙色
        sunGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        sunGradient.addColorStop(0.3, 'rgba(255, 255, 180, 1)');
        sunGradient.addColorStop(0.7, 'rgba(255, 200, 50, 0.9)');
        sunGradient.addColorStop(1, 'rgba(255, 140, 0, 0.5)');

        ctx.fillStyle = sunGradient;

        // 绘制太阳主体
        ctx.beginPath();
        ctx.arc(this.sunPosition.x, this.sunPosition.y, this.sunRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
} 