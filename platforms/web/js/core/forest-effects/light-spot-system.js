/**
 * 森林主题 - 光斑系统
 * 模拟阳光透过树叶在地面形成的光斑效果
 */
import logger from '../utils/logger.js';

/**
 * 光斑类
 * @private
 */
class LightSpot {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.radius = 0;
        this.active = false;

        // 光斑效果属性
        this.alpha = 0;
        this.maxAlpha = 0;
        this.color = '';
        this.blurFactor = 0;

        // 光斑动画属性
        this.sway = {
            amplitude: 0,    // 摇摆幅度
            speed: 0,        // 摇摆速度
            offset: 0        // 初始偏移量
        };

        // 光强变化
        this.pulse = {
            speed: 0,        // 脉动速度
            min: 0,          // 最小透明度系数
            max: 0           // 最大透明度系数
        };
    }

    /**
     * 重置光斑属性
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15 + Math.random() * 45; // 光斑大小介于15-60之间
        this.active = true;

        // 设置光斑效果
        this.maxAlpha = 0.1 + Math.random() * 0.4; // 最大透明度介于0.1-0.5之间
        this.alpha = this.maxAlpha * (0.3 + Math.random() * 0.7);

        // 光斑颜色 - 从暖黄到白色的随机色调
        const warmth = Math.random();
        const r = 255;
        const g = 220 + Math.floor(warmth * 35); // 220-255
        const b = 180 + Math.floor(warmth * 75); // 180-255
        this.color = `rgb(${r}, ${g}, ${b})`;

        // 模糊因子 - 控制光斑边缘柔和程度
        this.blurFactor = 2 + Math.random() * 6;

        // 设置摇摆属性 - 模拟树叶随风摆动导致光斑移动
        this.sway = {
            amplitude: 2 + Math.random() * 5,     // 摇摆幅度2-7像素
            speed: 0.2 + Math.random() * 0.8,     // 摇摆速度
            offset: Math.random() * Math.PI * 2   // 随机初始相位
        };

        // 设置光强脉动属性 - 模拟光照强度变化
        this.pulse = {
            speed: 0.1 + Math.random() * 0.4,     // 脉动速度
            min: 0.4 + Math.random() * 0.3,       // 最小透明度系数0.4-0.7
            max: 0.7 + Math.random() * 0.3        // 最大透明度系数0.7-1.0
        };
    }

    /**
     * 更新光斑状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 计算光斑摇摆位移
        const swayX = Math.sin(currentTime * 0.001 * this.sway.speed + this.sway.offset) * this.sway.amplitude;
        const swayY = Math.cos(currentTime * 0.001 * this.sway.speed + this.sway.offset + Math.PI / 3) * this.sway.amplitude * 0.5;

        // 计算光强脉动
        const pulseAlpha = this.pulse.min + (this.pulse.max - this.pulse.min) *
            (0.5 + 0.5 * Math.sin(currentTime * 0.001 * this.pulse.speed + this.sway.offset));

        // 应用效果
        this.alpha = this.maxAlpha * pulseAlpha;
    }

    /**
     * 绘制光斑
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.active || this.alpha <= 0.01) return;

        ctx.save();

        // 计算摇摆位移
        const swayX = Math.sin(currentTime * 0.001 * this.sway.speed + this.sway.offset) * this.sway.amplitude;
        const swayY = Math.cos(currentTime * 0.001 * this.sway.speed + this.sway.offset + Math.PI / 3) * this.sway.amplitude * 0.5;

        // 创建光斑渐变
        const gradient = ctx.createRadialGradient(
            this.x + swayX, this.y + swayY, 0,
            this.x + swayX, this.y + swayY, this.radius
        );

        // 中心到边缘的渐变
        gradient.addColorStop(0, `rgba(255, 255, 235, ${this.alpha})`);
        gradient.addColorStop(0.3, `rgba(${this.color.match(/\d+/g)[0]}, ${this.color.match(/\d+/g)[1]}, ${this.color.match(/\d+/g)[2]}, ${this.alpha * 0.7})`);
        gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');

        // 设置模糊效果
        ctx.filter = `blur(${this.blurFactor}px)`;

        // 绘制光斑
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x + swayX, this.y + swayY, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // 重置滤镜
        ctx.filter = 'none';

        ctx.restore();
    }
}

/**
 * 光斑系统类
 * 管理森林中的光斑效果
 */
export class LightSpotSystem {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        // 活动状态
        this.isEnabled = false;

        // 画布尺寸
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        // 光斑配置
        this.maxSpots = options.maxSpots || 12;     // 默认光斑数量
        this.lightsEnabled = options.lightsEnabled !== undefined ? options.lightsEnabled : true;
        this.lightSpots = [];

        // 初始化光斑对象池
        this.initLightSpots();

        logger.debug('LightSpotSystem: 初始化完成, 最大光斑数:', this.maxSpots);
    }

    /**
     * 初始化光斑对象池
     */
    initLightSpots() {
        this.lightSpots = [];
        for (let i = 0; i < this.maxSpots; i++) {
            this.lightSpots.push(new LightSpot());
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

        // 立即创建光斑
        this.createLightSpots();

        logger.debug('LightSpotSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;

        // 清空所有活动的光斑
        this.lightSpots.forEach(spot => {
            spot.active = false;
        });

        logger.debug('LightSpotSystem: 已禁用');
    }

    /**
     * 调整画布尺寸
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     */
    resize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;

        // 重新创建光斑，适应新尺寸
        if (this.isEnabled) {
            this.createLightSpots();
        }
    }

    /**
     * 创建光斑
     */
    createLightSpots() {
        // 首先清除所有现有光斑
        this.lightSpots.forEach(spot => {
            spot.active = false;
        });

        // 确定要创建的光斑数量
        const spotCount = this.lightsEnabled ? this.maxSpots : 0;

        // 创建新光斑
        for (let i = 0; i < spotCount; i++) {
            if (i < this.lightSpots.length) {
                // 随机位置 - 分布在画布区域内
                const x = Math.random() * this.canvasWidth;
                const y = Math.random() * this.canvasHeight;

                this.lightSpots[i].reset(x, y);
            }
        }
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 更新所有活动光斑
        this.lightSpots.forEach(spot => {
            if (spot.active) {
                spot.update(currentTime);
            }
        });
    }

    /**
     * 渲染光斑
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.isEnabled) return;

        // 先存储上下文状态，因为我们要使用滤镜
        ctx.save();

        // 设置混合模式 - 使光斑与背景融合
        ctx.globalCompositeOperation = 'lighter';

        // 绘制所有活动光斑
        this.lightSpots.forEach(spot => {
            if (spot.active) {
                spot.render(ctx, currentTime);
            }
        });

        // 恢复上下文状态
        ctx.restore();
    }
} 