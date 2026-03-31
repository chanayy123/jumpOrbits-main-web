/**
 * 轻盈主题 - 羽毛系统
 * 生成轻盈飘落的羽毛效果
 */
import logger from '../utils/logger.js';

/**
 * 羽毛类
 * @private
 */
class Feather {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.size = 0;
        this.rotation = 0;
        this.active = false;

        // 羽毛特性
        this.color = '';
        this.alpha = 1;
        this.type = 0; // 羽毛类型

        // 运动属性
        this.speedY = 0;
        this.speedX = 0;
        this.rotationSpeed = 0;
        this.swayFactor = 0;
        this.swayOffset = 0;
    }

    /**
     * 重置羽毛属性
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.size = 8 + Math.random() * 12; // 羽毛大小在8-20像素之间
        this.active = true;
        this.rotation = Math.random() * Math.PI * 2; // 随机初始旋转角度
        this.alpha = 0.5 + Math.random() * 0.5; // 透明度在0.5-1.0之间

        // 设置羽毛颜色 - 使用非常浅的颜色
        const colorBase = 230 + Math.floor(Math.random() * 25);
        const colorVariation = Math.random() * 20 - 10;
        const r = Math.max(0, Math.min(255, colorBase + colorVariation));
        const g = Math.max(0, Math.min(255, colorBase + colorVariation));
        const b = Math.max(0, Math.min(255, colorBase + colorVariation + 5)); // 稍微偏蓝
        this.color = `rgba(${r}, ${g}, ${b}, ${this.alpha})`;

        // 随机羽毛类型(0-2)
        this.type = Math.floor(Math.random() * 3);

        // 设置运动参数
        this.speedY = 0.2 + Math.random() * 0.4; // 下落速度（慢）
        this.speedX = (Math.random() - 0.5) * 0.3; // 初始水平速度
        this.rotationSpeed = (Math.random() - 0.5) * 0.02; // 旋转速度
        this.swayFactor = 0.3 + Math.random() * 0.7; // 摆动幅度
        this.swayOffset = Math.random() * Math.PI * 2; // 随机初始相位
    }

    /**
     * 更新羽毛状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 垂直下落（慢）
        this.y += this.speedY;

        // 水平摆动效果
        const swayAmount = Math.sin(currentTime * 0.001 + this.swayOffset) * this.swayFactor;
        this.x += swayAmount * 0.1 + this.speedX;

        // 旋转效果
        this.rotation += this.rotationSpeed;
    }

    /**
     * 检查羽毛是否在屏幕范围内
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
     * 绘制羽毛
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active) return;

        ctx.save();

        // 设置透明度
        ctx.globalAlpha = this.alpha;

        // 移动到羽毛位置并应用旋转
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // 根据羽毛类型绘制不同形状
        switch (this.type) {
            case 0:
                this.drawFeatherType1(ctx);
                break;
            case 1:
                this.drawFeatherType2(ctx);
                break;
            case 2:
                this.drawFeatherType3(ctx);
                break;
            default:
                this.drawFeatherType1(ctx);
        }

        ctx.restore();
    }

    /**
     * 绘制第一种羽毛类型 - 细长型
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    drawFeatherType1(ctx) {
        const s = this.size;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.darkenColor(this.color, 15);
        ctx.lineWidth = 0.5;

        // 主轴
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(0, s);
        ctx.stroke();

        // 羽毛须（左右两侧）
        for (let i = 1; i <= 8; i++) {
            const offset = (s * 2 / 9) * i - s;
            const length = (s / 2) * Math.sin(Math.PI * i / 8);

            // 左侧
            ctx.beginPath();
            ctx.moveTo(0, offset);
            ctx.quadraticCurveTo(-length * 0.7, offset + length * 0.2, -length, offset + length * 0.3);
            ctx.stroke();

            // 右侧
            ctx.beginPath();
            ctx.moveTo(0, offset);
            ctx.quadraticCurveTo(length * 0.7, offset + length * 0.2, length, offset + length * 0.3);
            ctx.stroke();
        }
    }

    /**
     * 绘制第二种羽毛类型 - 椭圆型
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    drawFeatherType2(ctx) {
        const s = this.size;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.darkenColor(this.color, 15);
        ctx.lineWidth = 0.5;

        // 羽毛椭圆形主体
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.4, s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 羽毛主轴
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(0, s);
        ctx.stroke();

        // 羽毛须
        for (let i = 1; i <= 4; i++) {
            const offset = (s * 2 / 5) * i - s;

            // 左侧
            ctx.beginPath();
            ctx.moveTo(0, offset);
            ctx.lineTo(-s * 0.4, offset);
            ctx.stroke();

            // 右侧
            ctx.beginPath();
            ctx.moveTo(0, offset);
            ctx.lineTo(s * 0.4, offset);
            ctx.stroke();
        }
    }

    /**
     * 绘制第三种羽毛类型 - 圆型
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    drawFeatherType3(ctx) {
        const s = this.size;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.darkenColor(this.color, 15);
        ctx.lineWidth = 0.5;

        // 圆形主体
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.7);
        ctx.bezierCurveTo(s * 0.7, -s * 0.7, s * 0.7, s * 0.7, 0, s * 0.7);
        ctx.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.7, -s * 0.7, 0, -s * 0.7);
        ctx.fill();
        ctx.stroke();

        // 内部纹理
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, 0);
        ctx.lineTo(s * 0.5, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.lineTo(0, s * 0.5);
        ctx.stroke();
    }

    /**
     * 加深颜色
     * @param {string} color - rgba颜色字符串
     * @param {number} amount - 加深量(0-255)
     * @returns {string} 加深后的颜色
     */
    darkenColor(color, amount) {
        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/);
        if (!rgbaMatch) return color;

        const r = Math.max(0, parseInt(rgbaMatch[1]) - amount);
        const g = Math.max(0, parseInt(rgbaMatch[2]) - amount);
        const b = Math.max(0, parseInt(rgbaMatch[3]) - amount);
        const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;

        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
}

/**
 * 羽毛系统类
 * 管理所有羽毛效果
 */
export class FeatherSystem {
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

        // 羽毛配置
        this.maxFeathers = options.maxFeathers || 15;
        this.feathers = [];
        this.nextFeatherTime = 0;
        this.featherInterval = options.featherInterval || 2000; // 每2000ms生成一根新羽毛

        // 初始化羽毛对象池
        this.initFeathers();

        logger.debug('FeatherSystem: 初始化完成, 最大羽毛数:', this.maxFeathers);
    }

    /**
     * 初始化羽毛对象池
     */
    initFeathers() {
        this.feathers = [];
        for (let i = 0; i < this.maxFeathers; i++) {
            this.feathers.push(new Feather());
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
        this.nextFeatherTime = Date.now() + Math.random() * 2000;

        // 初始创建一些羽毛
        const initialCount = Math.min(5, this.maxFeathers);
        for (let i = 0; i < initialCount; i++) {
            this.createFeather();
        }

        logger.debug('FeatherSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;

        // 清空所有活动的羽毛
        this.feathers.forEach(feather => {
            feather.active = false;
        });

        logger.debug('FeatherSystem: 已禁用');
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
        if (newSize === this.maxFeathers) return;

        if (newSize > this.maxFeathers) {
            // 增加羽毛数量
            const addCount = newSize - this.maxFeathers;
            for (let i = 0; i < addCount; i++) {
                this.feathers.push(new Feather());
            }
        } else {
            // 减少羽毛数量，但保留活动的羽毛
            const activeCount = this.feathers.filter(f => f.active).length;
            if (newSize < activeCount) {
                // 将部分活动羽毛设为不活动
                let deactivateCount = activeCount - newSize;
                for (let i = 0; i < this.feathers.length && deactivateCount > 0; i++) {
                    if (this.feathers[i].active) {
                        this.feathers[i].active = false;
                        deactivateCount--;
                    }
                }
            }
            // 保留前newSize个元素
            this.feathers = this.feathers.slice(0, newSize);
        }

        this.maxFeathers = newSize;
        logger.debug('FeatherSystem: 更新池大小为', newSize);
    }

    /**
     * 创建新羽毛
     */
    createFeather() {
        // 查找非活动的羽毛
        const inactiveFeather = this.feathers.find(feather => !feather.active);
        if (!inactiveFeather) return;

        // 在画布上方随机位置生成羽毛
        const x = Math.random() * this.canvasWidth;
        const y = -20; // 从画布上方稍微外部生成

        inactiveFeather.reset(x, y);
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 检查是否需要生成新羽毛
        if (currentTime >= this.nextFeatherTime) {
            this.createFeather();
            this.nextFeatherTime = currentTime + this.featherInterval + Math.random() * 1000; // 添加一点随机间隔
        }

        // 更新所有活动羽毛
        for (const feather of this.feathers) {
            if (feather.active) {
                feather.update(currentTime);

                // 检查羽毛是否超出屏幕
                if (!feather.isInBounds(this.canvasWidth, this.canvasHeight)) {
                    feather.active = false;
                }
            }
        }
    }

    /**
     * 获取活动羽毛数量
     * @returns {number} 活动羽毛数量
     */
    getActiveCount() {
        return this.feathers.filter(feather => feather.active).length;
    }

    /**
     * 渲染所有羽毛
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isEnabled) return;

        // 渲染所有活动羽毛
        for (const feather of this.feathers) {
            if (feather.active) {
                feather.render(ctx);
            }
        }
    }
} 