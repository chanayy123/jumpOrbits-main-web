/**
 * 森林主题 - 萤火虫系统
 * 生成随机闪烁的萤火虫，增强森林主题的氛围
 */
import logger from '../utils/logger.js';

/**
 * 萤火虫类
 * @private
 */
class Firefly {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.radius = 0;
        this.active = false;

        // 闪烁相关属性
        this.alpha = 0;
        this.maxAlpha = 0;
        this.phase = 0;
        this.blinkSpeed = 0;
        this.timeOffset = 0;

        // 移动相关属性
        this.dx = 0;
        this.dy = 0;
        this.directionChangeTimer = 0;
        this.directionChangeInterval = 0;
    }

    /**
     * 重置萤火虫属性
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 1 + Math.random() * 1.5;
        this.active = true;

        // 设置闪烁属性
        this.maxAlpha = 0.4 + Math.random() * 0.3;
        this.alpha = this.maxAlpha * Math.random() * 0.5;
        this.phase = Math.random() * Math.PI * 2;
        this.blinkSpeed = 0.3 + Math.random() * 1.5;
        this.timeOffset = Math.random() * 5000;

        // 设置移动属性
        this.dx = (Math.random() - 0.5) * 0.5;
        this.dy = (Math.random() - 0.5) * 0.5;
        this.directionChangeTimer = 0;
        this.directionChangeInterval = 2000 + Math.random() * 4000;
    }

    /**
     * 更新萤火虫状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 更新位置
        this.x += this.dx;
        this.y += this.dy;

        // 计算闪烁
        const time = currentTime + this.timeOffset;
        this.alpha = this.maxAlpha * (0.3 + 0.7 * Math.sin(time * 0.001 * this.blinkSpeed + this.phase));

        // 随机改变方向
        this.directionChangeTimer += 16; // 假设约16ms一帧
        if (this.directionChangeTimer >= this.directionChangeInterval) {
            this.directionChangeTimer = 0;
            this.dx = (Math.random() - 0.5) * 0.5;
            this.dy = (Math.random() - 0.5) * 0.5;
        }
    }

    /**
     * 检查萤火虫是否在屏幕范围内
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
     * 绘制萤火虫
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active || this.alpha <= 0.02) return;

        ctx.save();

        // 创建发光效果
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius * 8
        );

        gradient.addColorStop(0, `rgba(230, 255, 180, ${this.alpha})`);
        gradient.addColorStop(0.4, `rgba(180, 230, 130, ${this.alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(100, 160, 70, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 8, 0, Math.PI * 2);
        ctx.fill();

        // 绘制中心点
        ctx.fillStyle = `rgba(230, 255, 180, ${this.alpha * 1.5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

/**
 * 萤火虫系统类
 * 管理所有萤火虫
 */
export class FireflySystem {
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

        // 萤火虫配置
        this.maxFireflies = options.maxFireflies || 25;
        this.fireflies = [];
        this.nextFireflyTime = 0;
        this.fireflyInterval = options.fireflyInterval || 1000; // 每1000ms生成一个新萤火虫

        // 初始化萤火虫对象池
        this.initFireflies();

        logger.debug('FireflySystem: 初始化完成, 最大萤火虫数:', this.maxFireflies);
    }

    /**
     * 初始化萤火虫对象池
     */
    initFireflies() {
        this.fireflies = [];
        for (let i = 0; i < this.maxFireflies; i++) {
            this.fireflies.push(new Firefly());
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
        this.nextFireflyTime = Date.now() + Math.random() * 1000;

        // 立即创建一些萤火虫
        const initialCount = Math.min(10, this.maxFireflies);
        for (let i = 0; i < initialCount; i++) {
            this.createFirefly();
        }

        logger.debug('FireflySystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;
        // 清空所有活动的萤火虫
        this.fireflies.forEach(firefly => {
            firefly.active = false;
        });
        logger.debug('FireflySystem: 已禁用');
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
     * 创建新萤火虫
     * @param {boolean} randomPosition - 是否随机位置生成
     */
    createFirefly(randomPosition = true) {
        // 查找非活动的萤火虫
        const inactiveFirefly = this.fireflies.find(firefly => !firefly.active);
        if (!inactiveFirefly) return;

        let x, y;

        if (randomPosition) {
            // 随机位置生成:
            // 70%的几率在屏幕边缘生成，30%的几率在屏幕内部生成
            const edgeSpawn = Math.random() < 0.7;

            if (edgeSpawn) {
                // 在屏幕四边随机选择一边生成
                const edge = Math.floor(Math.random() * 4); // 0: 上，1: 右，2: 下，3: 左

                switch (edge) {
                    case 0: // 上边
                        x = Math.random() * this.canvasWidth;
                        y = -10;
                        break;
                    case 1: // 右边
                        x = this.canvasWidth + 10;
                        y = Math.random() * this.canvasHeight;
                        break;
                    case 2: // 下边
                        x = Math.random() * this.canvasWidth;
                        y = this.canvasHeight + 10;
                        break;
                    case 3: // 左边
                        x = -10;
                        y = Math.random() * this.canvasHeight;
                        break;
                }
            } else {
                // 在屏幕内部生成
                x = Math.random() * this.canvasWidth;
                y = Math.random() * this.canvasHeight;
            }
        } else {
            // 在屏幕内部生成
            x = Math.random() * this.canvasWidth;
            y = Math.random() * this.canvasHeight;
        }

        // 重置萤火虫属性
        inactiveFirefly.reset(x, y);
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 检查是否需要创建新萤火虫
        if (currentTime >= this.nextFireflyTime) {
            const activeCount = this.getActiveCount();
            if (activeCount < this.maxFireflies) {
                this.createFirefly();
                // 根据当前活动萤火虫数量动态调整生成间隔
                const scaleFactor = 1 + (activeCount / this.maxFireflies);
                this.nextFireflyTime = currentTime + this.fireflyInterval * scaleFactor + Math.random() * 1000;
            } else {
                this.nextFireflyTime = currentTime + 3000;
            }
        }

        // 更新所有活动萤火虫
        this.fireflies.forEach(firefly => {
            if (firefly.active) {
                firefly.update(currentTime);

                // 检查萤火虫是否超出屏幕范围
                if (!firefly.isInBounds(this.canvasWidth, this.canvasHeight)) {
                    firefly.active = false; // 标记为非活动状态
                }
            }
        });
    }

    /**
     * 获取活动萤火虫数量
     * @returns {number} 活动萤火虫数量
     */
    getActiveCount() {
        return this.fireflies.filter(firefly => firefly.active).length;
    }

    /**
     * 渲染萤火虫
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isEnabled) return;

        // 绘制所有活动萤火虫
        this.fireflies.forEach(firefly => {
            if (firefly.active) {
                firefly.render(ctx);
            }
        });
    }
} 