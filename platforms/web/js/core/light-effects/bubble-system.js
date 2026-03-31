/**
 * 轻盈主题 - 气泡系统
 * 生成轻盈浮动的气泡效果
 */
import logger from '../utils/logger.js';

/**
 * 气泡类
 * @private
 */
class Bubble {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.radius = 0;
        this.active = false;

        // 气泡特性
        this.alpha = 1;
        this.color = '';
        this.borderColor = '';
        this.borderWidth = 0;
        this.glowColor = '';
        this.glowSize = 0;

        // 运动属性
        this.speedY = 0;
        this.swayFactor = 0;
        this.swayOffset = 0;
        this.pulseSpeed = 0;
        this.pulseMin = 0;
        this.pulseMax = 0;
    }

    /**
     * 重置气泡属性
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 5 + Math.random() * 15; // 气泡大小在5-20像素之间
        this.active = true;
        this.alpha = 0.3 + Math.random() * 0.4; // 透明度在0.3-0.7之间

        // 设置气泡颜色 - 使用浅蓝色调
        const colorValue = 180 + Math.floor(Math.random() * 75);
        const r = Math.floor(colorValue * 0.8);
        const g = Math.floor(colorValue * 0.9);
        const b = colorValue;
        this.color = `rgba(${r}, ${g}, ${b}, ${this.alpha})`;

        // 边框和发光效果
        this.borderColor = `rgba(${r + 20}, ${g + 20}, ${b}, 0.6)`;
        this.borderWidth = 0.5 + Math.random() * 0.5;
        this.glowColor = `rgba(${r + 30}, ${g + 30}, ${b + 30}, 0.3)`;
        this.glowSize = this.radius * (0.5 + Math.random() * 0.5);

        // 设置运动参数
        this.speedY = -(0.3 + Math.random() * 1.0); // 上升速度为负值
        this.swayFactor = 0.2 + Math.random() * 0.4; // 摆动幅度
        this.swayOffset = Math.random() * Math.PI * 2; // 随机初始相位

        // 脉动参数
        this.pulseSpeed = 0.05 + Math.random() * 0.1;
        this.pulseMin = 0.85 + Math.random() * 0.1;
        this.pulseMax = 1.0;
    }

    /**
     * 更新气泡状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 垂直上升
        this.y += this.speedY;

        // 水平摆动效果
        const swayAmount = Math.sin(currentTime * 0.001 + this.swayOffset) * this.swayFactor;
        this.x += swayAmount;

        // 脉动效果 - 轻微改变大小和透明度
        const pulseFactor = this.pulseMin + (this.pulseMax - this.pulseMin) *
            (0.5 + 0.5 * Math.sin(currentTime * 0.001 * this.pulseSpeed + this.swayOffset));
        this.currentRadius = this.radius * pulseFactor;
        this.currentAlpha = this.alpha * (0.8 + 0.2 * pulseFactor);
    }

    /**
     * 检查气泡是否在屏幕范围内
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     * @param {number} margin - 边缘余量
     * @returns {boolean} 是否在屏幕范围内
     */
    isInBounds(width, height, margin = 50) {
        return this.x > -margin &&
            this.x < width + margin &&
            this.y > -margin &&
            this.y < height + margin;
    }

    /**
     * 绘制气泡
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.active) return;

        // 计算当前大小和透明度（考虑脉动）
        const pulseFactor = this.pulseMin + (this.pulseMax - this.pulseMin) *
            (0.5 + 0.5 * Math.sin(currentTime * 0.001 * this.pulseSpeed + this.swayOffset));
        const currentRadius = this.radius * pulseFactor;
        const currentAlpha = this.alpha * pulseFactor;

        ctx.save();

        // 绘制发光效果
        if (this.glowSize > 0) {
            const gradient = ctx.createRadialGradient(
                this.x, this.y, currentRadius * 0.5,
                this.x, this.y, currentRadius + this.glowSize
            );
            gradient.addColorStop(0, this.glowColor);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius + this.glowSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制气泡主体
        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // 绘制气泡边框
        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = this.borderWidth;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制气泡反光高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(this.x - currentRadius * 0.3, this.y - currentRadius * 0.3, currentRadius * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

/**
 * 气泡系统类
 * 管理所有气泡效果
 */
export class BubbleSystem {
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

        // 气泡配置
        this.maxBubbles = options.maxBubbles || 25;
        this.bubbles = [];
        this.nextBubbleTime = 0;
        this.bubbleInterval = options.bubbleInterval || 800; // 每800ms生成一个新气泡

        // 初始化气泡对象池
        this.initBubbles();

        logger.debug('BubbleSystem: 初始化完成, 最大气泡数:', this.maxBubbles);
    }

    /**
     * 初始化气泡对象池
     */
    initBubbles() {
        this.bubbles = [];
        for (let i = 0; i < this.maxBubbles; i++) {
            this.bubbles.push(new Bubble());
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
        this.nextBubbleTime = Date.now() + Math.random() * 1000;

        // 初始创建一些气泡
        const initialCount = Math.min(8, this.maxBubbles);
        for (let i = 0; i < initialCount; i++) {
            this.createBubble();
        }

        logger.debug('BubbleSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;

        // 清空所有活动的气泡
        this.bubbles.forEach(bubble => {
            bubble.active = false;
        });

        logger.debug('BubbleSystem: 已禁用');
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
        if (newSize === this.maxBubbles) return;

        if (newSize > this.maxBubbles) {
            // 增加气泡数量
            const addCount = newSize - this.maxBubbles;
            for (let i = 0; i < addCount; i++) {
                this.bubbles.push(new Bubble());
            }
        } else {
            // 减少气泡数量，但保留活动的气泡
            const activeCount = this.bubbles.filter(b => b.active).length;
            if (newSize < activeCount) {
                // 将部分活动气泡设为不活动
                let deactivateCount = activeCount - newSize;
                for (let i = 0; i < this.bubbles.length && deactivateCount > 0; i++) {
                    if (this.bubbles[i].active) {
                        this.bubbles[i].active = false;
                        deactivateCount--;
                    }
                }
            }
            // 保留前newSize个元素
            this.bubbles = this.bubbles.slice(0, newSize);
        }

        this.maxBubbles = newSize;
        logger.debug('BubbleSystem: 更新池大小为', newSize);
    }

    /**
     * 创建新气泡
     */
    createBubble() {
        // 查找非活动的气泡
        const inactiveBubble = this.bubbles.find(bubble => !bubble.active);
        if (!inactiveBubble) return;

        // 在画布底部随机位置生成气泡
        const x = Math.random() * this.canvasWidth;
        const y = this.canvasHeight + 10; // 从画布底部稍微下方生成

        inactiveBubble.reset(x, y);
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 检查是否需要生成新气泡
        if (currentTime >= this.nextBubbleTime) {
            this.createBubble();
            this.nextBubbleTime = currentTime + this.bubbleInterval + Math.random() * 500; // 添加一点随机间隔
        }

        // 更新所有活动气泡
        for (const bubble of this.bubbles) {
            if (bubble.active) {
                bubble.update(currentTime);

                // 检查气泡是否超出屏幕
                if (!bubble.isInBounds(this.canvasWidth, this.canvasHeight)) {
                    bubble.active = false;
                }
            }
        }
    }

    /**
     * 获取活动气泡数量
     * @returns {number} 活动气泡数量
     */
    getActiveCount() {
        return this.bubbles.filter(bubble => bubble.active).length;
    }

    /**
     * 渲染所有气泡
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.isEnabled) return;

        // 渲染所有活动气泡
        for (const bubble of this.bubbles) {
            if (bubble.active) {
                bubble.render(ctx, currentTime);
            }
        }
    }
} 