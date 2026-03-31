/**
 * 星星类，表示单个背景星星
 * @private
 */
class Star {
    /**
     * 初始化星星属性
     */
    constructor() {
        this.x = 0;                // X坐标
        this.y = 0;                // Y坐标
        this.size = 0;             // 星星大小
        this.baseAlpha = 0;        // 基础透明度
        this.alpha = 0;            // 当前透明度
        this.twinkleSpeed = 0;     // 闪烁速度
        this.twinkleOffset = 0;    // 闪烁偏移量(让星星闪烁不同步)
        this.color = '';           // 星星颜色
    }

    /**
     * 重置星星属性
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} size - 星星大小
     * @param {number} baseAlpha - 基础透明度
     * @param {number} twinkleSpeed - 闪烁速度
     * @param {string} color - 星星颜色
     */
    reset(x, y, size, baseAlpha, twinkleSpeed, color) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.baseAlpha = baseAlpha;
        this.alpha = baseAlpha;
        this.twinkleSpeed = twinkleSpeed;
        this.twinkleOffset = Math.random() * Math.PI * 2; // 随机偏移量，使每颗星星闪烁不同步
        this.color = color || '#FFFFFF';
    }

    /**
     * 更新星星状态(闪烁效果)
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        // 根据时间和偏移量计算闪烁透明度变化
        // 使用sin函数产生-1到1的值，然后映射到透明度变化范围
        const twinkleAmount = Math.sin((currentTime * this.twinkleSpeed / 1000) + this.twinkleOffset) * 0.3;

        // 透明度在基础值的±30%范围内变化
        this.alpha = Math.max(0, Math.min(1, this.baseAlpha * (1 + twinkleAmount)));
    }

    /**
     * 渲染星星
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D上下文
     */
    render(ctx) {
        ctx.save();

        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;

        // 根据星星大小决定渲染方式
        if (this.size <= 1) {
            // 小星星直接用1px方形点绘制，效率高
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), 1, 1);
        } else {
            // 大一点的星星用圆形绘制
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * 星星系统类
 * 用于在星空主题中渲染背景星星
 */
export class StarSystem {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        // 星星配置
        this.starCount = options.starCount || 80;
        this.stars = [];

        // 活动状态
        this.isEnabled = false;

        // 星星闪烁相关参数
        this.twinkleSpeed = options.twinkleSpeed || 0.5;  // 闪烁速度
        this.baseAlpha = options.baseAlpha || 0.6;        // 基础透明度
        this.alphaVariance = options.alphaVariance || 0.3; // 透明度变化范围
    }

    /**
     * 启用星星系统
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    enable(width, height) {
        this.isEnabled = true;
        this.createStars(width, height);
    }

    /**
     * 禁用星星系统
     */
    disable() {
        this.isEnabled = false;
        this.stars = [];
    }

    /**
     * 创建星星
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    createStars(width, height) {
        this.stars = [];

        // 创建指定数量的星星
        for (let i = 0; i < this.starCount; i++) {
            // 星星半径范围 - 大部分星星都很小，少数会大一些
            let radius;
            const sizeRandom = Math.random();
            if (sizeRandom < 0.7) {
                // 70% 的星星非常小 (0.5-1.2)
                radius = 0.5 + Math.random() * 0.7;
            } else if (sizeRandom < 0.95) {
                // 25% 的星星稍大 (1.2-2.0)
                radius = 1.2 + Math.random() * 0.8;
            } else {
                // 5% 的星星明显大 (2.0-3.0)
                radius = 2.0 + Math.random();
            }

            // 星星颜色 - 大多是白色和浅蓝色
            let color;
            const colorRandom = Math.random();
            if (colorRandom < 0.7) {
                // 70% 的星星是白色系
                const value = 220 + Math.floor(Math.random() * 35);
                color = `rgb(${value}, ${value}, ${value})`;
            } else {
                // 30% 的星星是蓝白色系
                const value = 200 + Math.floor(Math.random() * 55);
                color = `rgb(${value - 30}, ${value}, ${value + 30})`;
            }

            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: radius,
                color: color,
                twinkleOffset: Math.random() * Math.PI * 2, // 随机闪烁相位
                twinkleSpeed: 0.3 + Math.random() * 0.4 // 闪烁速度 (0.3-0.7)
            });
        }
    }

    /**
     * 调整星星数量
     * @param {number} newStarCount - 新的星星数量
     */
    resize(newStarCount) {
        this.starCount = newStarCount;
        if (this.isEnabled) {
            // 根据canvas尺寸重置星星
            // 注意：这里需要之前有保存canvas尺寸的地方
            // 先保留现有的星星
            const existingStars = [...this.stars];

            if (newStarCount > existingStars.length) {
                // 如果需要增加星星，保留现有的并添加新的
                this.stars = existingStars;
                // 这里不重新生成所有星星，而只是添加缺少的部分
            } else {
                // 如果需要减少星星，只保留前newStarCount个
                this.stars = existingStars.slice(0, newStarCount);
            }
        }
    }

    /**
     * 重置所有星星位置
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    resetPositions(width, height) {
        // 完全重新创建星星，确保尺寸适合新的画布
        this.createStars(width, height);
    }

    /**
     * 更新星星状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 星星不需要移动，只需计算闪烁效果
        // 闪烁效果在render中处理
    }

    /**
     * 渲染星星
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isEnabled || this.stars.length === 0) return;

        const currentTime = Date.now();

        ctx.save();

        // 绘制所有星星
        for (const star of this.stars) {
            // 计算闪烁效果的透明度
            const alpha = this.baseAlpha +
                Math.sin(currentTime * 0.001 * star.twinkleSpeed + star.twinkleOffset) * this.alphaVariance;

            // 绘制星星（简单的圆形）
            ctx.globalAlpha = alpha;
            ctx.fillStyle = star.color;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
} 