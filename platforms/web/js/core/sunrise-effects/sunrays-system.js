/**
 * 日出主题 - 光线系统
 * 生成太阳光线效果
 */
import logger from '../utils/logger.js';

/**
 * 光线类
 * @private
 */
class Sunray {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.length = 0;
        this.width = 0;
        this.angle = 0;
        this.active = false;

        // 光线特性
        this.color = '';
        this.alpha = 1;
        this.glow = 0;

        // 动画属性
        this.pulseSpeed = 0;
        this.pulseRange = 0;
        this.fadeSpeed = 0;
        this.lifespan = 0;
        this.createTime = 0;
    }

    /**
     * 重置光线属性
     * @param {number} x - 起始X坐标
     * @param {number} y - 起始Y坐标
     * @param {number} currentTime - 当前时间戳
     */
    reset(x, y, currentTime) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.createTime = currentTime;

        // 设置光线基本属性
        this.length = 100 + Math.random() * 200; // 光线长度在100-300像素之间
        this.width = 5 + Math.random() * 10; // 光线宽度在5-15像素之间
        this.angle = Math.random() * Math.PI * 0.5 - Math.PI * 0.25; // 角度范围为 -45° 到 45°
        this.alpha = 0.2 + Math.random() * 0.3; // 透明度在0.2-0.5之间

        // 设置光线颜色 - 偏黄色到橙色
        const hue = 40 + Math.random() * 20; // 色相范围在40-60之间（黄色到橙色）
        const saturation = 80 + Math.random() * 20; // 饱和度在80-100%之间
        const lightness = 65 + Math.random() * 15; // 亮度在65-80%之间
        this.color = `hsla(${hue}, ${saturation}%, ${lightness}%, ${this.alpha})`;

        // 设置光线发光效果
        this.glow = 5 + Math.random() * 10; // 发光大小在5-15像素之间

        // 设置动画属性
        this.pulseSpeed = 0.0005 + Math.random() * 0.001; // 脉动速度
        this.pulseRange = 0.2 + Math.random() * 0.3; // 脉动范围
        this.fadeSpeed = 0.00005 + Math.random() * 0.0001; // 淡出速度
        this.lifespan = 10000 + Math.random() * 20000; // 生命周期10-30秒
    }

    /**
     * 更新光线状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 计算存在时间
        const age = currentTime - this.createTime;

        // 检查是否超过生命周期
        if (age > this.lifespan) {
            this.active = false;
            return;
        }

        // 根据年龄计算淡出效果
        if (age > this.lifespan * 0.7) {
            const fadeFactor = 1 - ((age - this.lifespan * 0.7) / (this.lifespan * 0.3));
            this.currentAlpha = this.alpha * fadeFactor;
        } else {
            // 脉动效果 - 随时间变化透明度
            const pulseFactor = 1 - this.pulseRange * Math.sin(currentTime * this.pulseSpeed);
            this.currentAlpha = this.alpha * pulseFactor;
        }
    }

    /**
     * 绘制光线
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active) return;

        ctx.save();

        // 移动到光线起点并应用旋转
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 创建光线渐变
        const gradient = ctx.createLinearGradient(0, 0, this.length, 0);

        // 解析颜色以应用渐变
        const colorMatch = this.color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([.\d]+))?\)/);
        if (colorMatch) {
            const hue = parseInt(colorMatch[1]);
            const saturation = parseInt(colorMatch[2]);
            const lightness = parseInt(colorMatch[3]);
            const alpha = this.currentAlpha;

            // 起点颜色更亮更白
            gradient.addColorStop(0, `hsla(${hue}, ${saturation * 0.5}%, ${Math.min(95, lightness + 15)}%, ${alpha})`);

            // 中间过渡色
            gradient.addColorStop(0.3, `hsla(${hue}, ${saturation * 0.7}%, ${lightness + 5}%, ${alpha * 0.8})`);

            // 终点颜色淡出
            gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
        } else {
            // 如果颜色解析失败，使用默认渐变
            gradient.addColorStop(0, 'rgba(255, 240, 150, ' + this.currentAlpha + ')');
            gradient.addColorStop(0.3, 'rgba(255, 180, 80, ' + (this.currentAlpha * 0.8) + ')');
            gradient.addColorStop(1, 'rgba(255, 180, 80, 0)');
        }

        // 设置光线效果
        ctx.globalAlpha = this.currentAlpha;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.glow;
        ctx.fillStyle = gradient;

        // 绘制光线（使用梯形而非矩形，使光线有扩散效果）
        ctx.beginPath();
        ctx.moveTo(0, -this.width / 2);
        ctx.lineTo(this.length, -this.width);
        ctx.lineTo(this.length, this.width);
        ctx.lineTo(0, this.width / 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

/**
 * 光线系统类
 * 管理所有太阳光线效果
 */
export class SunraysSystem {
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

        // 光线配置
        this.maxRays = options.maxRays || 18;
        this.rays = [];
        this.nextRayTime = 0;
        this.rayInterval = options.rayInterval || 2000; // 每2秒尝试生成一条新光线

        // 初始化光线对象池
        this.initRays();

        logger.debug('SunraysSystem: 初始化完成, 最大光线数:', this.maxRays);
    }

    /**
     * 初始化光线对象池
     */
    initRays() {
        this.rays = [];
        for (let i = 0; i < this.maxRays; i++) {
            this.rays.push(new Sunray());
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
        this.nextRayTime = Date.now();

        // 初始创建一些光线
        const initialCount = Math.min(5, this.maxRays);
        for (let i = 0; i < initialCount; i++) {
            this.createRay(Date.now());
        }

        logger.debug('SunraysSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;

        // 清除所有活动的光线
        this.rays.forEach(ray => {
            ray.active = false;
        });

        logger.debug('SunraysSystem: 已禁用');
    }

    /**
     * 调整画布尺寸
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     */
    resize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
    }

    /**
     * 更新池大小
     * @param {number} newSize - 新的池大小
     */
    updatePoolSize(newSize) {
        if (newSize === this.maxRays) return;

        // 如果新大小更小，则禁用多余的光线
        if (newSize < this.maxRays) {
            for (let i = newSize; i < this.maxRays; i++) {
                if (i < this.rays.length) {
                    this.rays[i].active = false;
                }
            }
        }

        // 如果新大小更大，则创建新光线
        else if (newSize > this.maxRays) {
            const addCount = newSize - this.maxRays;
            for (let i = 0; i < addCount; i++) {
                this.rays.push(new Sunray());
            }
        }

        this.maxRays = newSize;
        logger.debug('SunraysSystem: 光线池大小更新为', this.maxRays);
    }

    /**
     * 创建新光线
     * @param {number} currentTime - 当前时间戳
     */
    createRay(currentTime) {
        // 找到一个非活动的光线对象
        const inactiveRay = this.rays.find(ray => !ray.active);
        if (!inactiveRay) return;

        // 根据不同性能模式调整太阳位置
        const sunX = Math.random() * (this.canvasWidth * 0.2); // 太阳位于左侧20%的区域
        const sunY = this.canvasHeight * (0.4 + Math.random() * 0.2); // 太阳位于中部偏上

        // 重置光线属性
        inactiveRay.reset(sunX, sunY, currentTime);
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 按间隔创建新光线
        if (currentTime >= this.nextRayTime && this.getActiveCount() < this.maxRays) {
            this.createRay(currentTime);
            // 随机化下一次生成时间
            this.nextRayTime = currentTime + this.rayInterval * (0.8 + Math.random() * 0.4);
        }

        // 更新所有活动的光线
        this.rays.forEach(ray => {
            if (ray.active) {
                ray.update(currentTime);
            }
        });
    }

    /**
     * 获取当前活动的光线数量
     * @returns {number} 活动光线数
     */
    getActiveCount() {
        return this.rays.filter(ray => ray.active).length;
    }

    /**
     * 渲染光线
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isEnabled) return;

        // 渲染所有活动的光线
        this.rays.forEach(ray => {
            if (ray.active) {
                ray.render(ctx);
            }
        });
    }
} 