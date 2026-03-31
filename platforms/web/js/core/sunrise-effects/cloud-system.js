/**
 * 日出主题 - 云彩系统
 * 生成带有日出映照效果的漂浮云彩
 */
import logger from '../utils/logger.js';

/**
 * 云彩类
 * @private
 */
class Cloud {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.active = false;

        // 云彩特性
        this.circles = []; // 组成云朵的圆形
        this.color = '';
        this.type = 0; // 云彩类型：0-普通白云，1-带有日出映照的云

        // 运动属性
        this.speedX = 0;
        this.speedY = 0;
        this.driftPhase = 0;
        this.driftAmplitude = 0;
    }

    /**
     * 重置云彩属性
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} type - 云彩类型
     */
    reset(x, y, type = 0) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.type = type;

        // 设置云彩基本尺寸
        this.width = 100 + Math.random() * 60; // 云彩宽度在100-160像素之间
        this.height = this.width * 0.5; // 高度约为宽度的一半

        // 根据云彩类型设置不同的颜色
        if (type === 1) {
            // 日出映照的云 - 带有暖黄色调，不透明
            const hue = 35 + Math.random() * 10; // 色相范围在35-45之间（橙黄色）
            const saturation = 70 + Math.random() * 20; // 较高饱和度
            const lightness = 92 + Math.random() * 5; // 高亮度但不完全是白色
            this.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        } else {
            // 普通白云 - 纯白色，不透明
            this.color = '#ffffff'; // 纯白色
        }

        // 生成简单圆形组合的云朵
        this.generateSimpleCloud();

        // 设置运动参数
        this.speedX = (0.1 + Math.random() * 0.2) * (Math.random() < 0.5 ? -1 : 1);
        this.speedY = (0.01 + Math.random() * 0.01) * (Math.random() < 0.5 ? -1 : 1);
        this.driftPhase = Math.random() * Math.PI * 2; // 随机初始相位
        this.driftAmplitude = 0.02 + Math.random() * 0.03; // 减小漂移幅度
    }

    /**
     * 生成2-6个不同半径实心圆叠加组成的云朵
     */
    generateSimpleCloud() {
        this.circles = [];

        // 确定云朵的圆形数量（2-6个）
        const circleCount = 2 + Math.floor(Math.random() * 5);

        // 基础圆形半径（相对于云朵高度）
        const baseRadius = this.height * 0.4;

        // 计算中心点
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // 创建中心圆（作为云朵的主体）
        this.circles.push({
            x: centerX,
            y: centerY,
            radius: baseRadius * (0.9 + Math.random() * 0.3)
        });

        // 添加其余圆形，围绕主圆创建
        for (let i = 1; i < circleCount; i++) {
            // 确定这个圆相对于中心的位置
            const angle = Math.random() * Math.PI * 2;
            const distance = baseRadius * (0.6 + Math.random() * 0.5);

            // 计算圆心坐标
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;

            // 随机半径，但保持合理范围
            const radius = baseRadius * (0.4 + Math.random() * 0.8);

            this.circles.push({
                x: x,
                y: y,
                radius: radius
            });
        }

        // 添加一些小的装饰圆（如果圆形数量足够多）
        if (circleCount >= 4) {
            const decorativeCircles = Math.min(2, circleCount - 4);
            for (let i = 0; i < decorativeCircles; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = baseRadius * (1.0 + Math.random() * 0.8);

                const x = centerX + Math.cos(angle) * distance;
                const y = centerY + Math.sin(angle) * distance;
                const radius = baseRadius * (0.2 + Math.random() * 0.3);

                this.circles.push({
                    x: x,
                    y: y,
                    radius: radius
                });
            }
        }
    }

    /**
     * 更新云彩状态
     * @param {number} currentTime - 当前时间戳
     * @param {number} canvasWidth - 画布宽度
     * @param {number} canvasHeight - 画布高度
     */
    update(currentTime, canvasWidth, canvasHeight) {
        if (!this.active) return;

        // 水平移动
        this.x += this.speedX;

        // 垂直漂移（使用正弦函数创建平滑的上下漂浮）
        const driftOffset = Math.sin(currentTime * 0.0003 + this.driftPhase) * this.driftAmplitude;
        this.y += this.speedY + driftOffset;

        // 检查是否离开画布（加上边距）
        const margin = Math.max(this.width, this.height) * 1.5;
        if (this.x < -margin || this.x > canvasWidth + margin ||
            this.y < -margin || this.y > canvasHeight + margin) {
            this.active = false;
        }
    }

    /**
     * 绘制云彩
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active || this.circles.length === 0) return;

        ctx.save();

        ctx.fillStyle = this.color;

        // 根据云彩类型使用不同的绘制模式
        if (this.type === 1) {
            // 日出映照的云彩 - 使用叠加混合模式使颜色更亮
            ctx.globalCompositeOperation = 'source-over';
        }

        // 绘制所有圆形
        for (const circle of this.circles) {
            ctx.beginPath();
            ctx.arc(
                this.x + circle.x,
                this.y + circle.y,
                circle.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * 云彩系统类
 * 管理所有漂浮云彩效果
 */
export class CloudSystem {
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

        // 云彩配置
        this.maxClouds = options.maxClouds || 6; // 最大云数量
        this.clouds = [];
        this.nextCloudTime = 0;
        this.cloudInterval = options.cloudInterval || 4000; // 云生成间隔

        // 日出映照云彩的概率
        this.sunlitCloudChance = 0.3; // 30%的概率生成日出映照云彩

        // 初始化云彩对象池
        this.initClouds();

        logger.debug('CloudSystem: 初始化完成, 最大云彩数:', this.maxClouds);
    }

    /**
     * 初始化云彩对象池
     */
    initClouds() {
        this.clouds = [];
        for (let i = 0; i < this.maxClouds; i++) {
            this.clouds.push(new Cloud());
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
        this.nextCloudTime = Date.now();

        // 初始创建少量云
        const initialCount = Math.min(3, this.maxClouds);
        for (let i = 0; i < initialCount; i++) {
            this.createCloud();
        }

        logger.debug('CloudSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;

        // 清除所有活动的云彩
        this.clouds.forEach(cloud => {
            cloud.active = false;
        });

        logger.debug('CloudSystem: 已禁用');
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
        if (newSize === this.maxClouds) return;

        // 如果新大小更小，则禁用多余的云彩
        if (newSize < this.maxClouds) {
            for (let i = newSize; i < this.maxClouds; i++) {
                if (i < this.clouds.length) {
                    this.clouds[i].active = false;
                }
            }
        }

        // 如果新大小更大，则创建新云彩
        else if (newSize > this.maxClouds) {
            const addCount = newSize - this.maxClouds;
            for (let i = 0; i < addCount; i++) {
                this.clouds.push(new Cloud());
            }
        }

        this.maxClouds = newSize;
        logger.debug('CloudSystem: 云彩池大小更新为', this.maxClouds);
    }

    /**
     * 创建新云彩
     */
    createCloud() {
        // 找到一个非活动的云彩对象
        const inactiveCloud = this.clouds.find(cloud => !cloud.active);
        if (!inactiveCloud) return;

        // 确定云彩类型 - 根据概率生成日出映照的云彩
        const cloudType = Math.random() < this.sunlitCloudChance ? 1 : 0;

        // 决定云彩出现位置
        let x, y;

        if (cloudType === 1) {
            // 日出映照云彩 - 出现在左侧和底部
            if (Math.random() < 0.6) {
                // 60%概率从左侧入场
                x = -100;
                y = this.canvasHeight * (0.5 + Math.random() * 0.3); // 中下部
            } else {
                // 40%概率从底部入场
                x = this.canvasWidth * Math.random() * 0.3; // 左侧30%区域
                y = this.canvasHeight + 50;
            }
        } else {
            // 普通白云 - 随机位置
            if (Math.random() < 0.5) {
                // 从侧边入场
                x = Math.random() < 0.5 ? -100 : this.canvasWidth + 100;
                y = Math.random() * this.canvasHeight * 0.5; // 上半部分
            } else {
                // 从顶部入场
                x = Math.random() * this.canvasWidth;
                y = -100;
            }
        }

        // 重置云彩属性
        inactiveCloud.reset(x, y, cloudType);
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 按间隔创建新云彩，但确保不超过最大数量
        if (currentTime >= this.nextCloudTime && this.getActiveCount() < this.maxClouds) {
            this.createCloud();
            // 随机化下一次生成时间，增加间隔
            this.nextCloudTime = currentTime + this.cloudInterval * (1 + Math.random() * 0.5);
        }

        // 更新所有活动的云彩
        this.clouds.forEach(cloud => {
            if (cloud.active) {
                cloud.update(currentTime, this.canvasWidth, this.canvasHeight);
            }
        });
    }

    /**
     * 获取当前活动的云彩数量
     * @returns {number} 活动云彩数
     */
    getActiveCount() {
        return this.clouds.filter(cloud => cloud.active).length;
    }

    /**
     * 渲染云彩
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isEnabled) return;

        // 先渲染普通云彩（在底层）
        this.clouds.forEach(cloud => {
            if (cloud.active && cloud.type === 0) {
                cloud.render(ctx);
            }
        });

        // 再渲染日出映照云彩（在顶层）
        this.clouds.forEach(cloud => {
            if (cloud.active && cloud.type === 1) {
                cloud.render(ctx);
            }
        });
    }
} 