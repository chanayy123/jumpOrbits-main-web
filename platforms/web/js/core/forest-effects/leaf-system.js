/**
 * 森林主题 - 落叶系统
 * 生成随机飘落的树叶，增强森林主题的氛围
 */
import logger from '../utils/logger.js';

/**
 * 单个树叶类
 * @private
 */
class Leaf {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.size = 0;
        this.type = 0;
        this.rotation = 0;
        this.alpha = 1;
        this.active = false;

        // 运动属性
        this.speedY = 0;
        this.speedX = 0;
        this.rotationSpeed = 0;
        this.swayFactor = 0;
        this.swayOffset = 0;

        // 颜色
        this.color = '';
    }

    /**
     * 重置树叶属性
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} size - 叶子大小
     * @param {number} type - 叶子类型(0-3)
     * @param {string} color - 颜色
     */
    reset(x, y, size, type, color) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.type = type;
        this.color = color;
        this.active = true;
        this.alpha = 0.6 + Math.random() * 0.4; // 随机透明度

        // 设置随机旋转
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;

        // 设置随机下落速度
        this.speedY = 0.3 + Math.random() * 0.7;

        // 设置随机水平摇摆
        this.swayFactor = 0.2 + Math.random() * 0.5;
        this.swayOffset = Math.random() * Math.PI * 2;

        // 初始水平速度
        this.speedX = (Math.random() - 0.5) * 0.3;
    }

    /**
     * 更新树叶状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 垂直方向匀速下落
        this.y += this.speedY;

        // 水平方向摇摆
        const swayAmount = Math.sin(currentTime * 0.001 + this.swayOffset) * this.swayFactor;
        this.x += swayAmount * 0.1 + this.speedX;

        // 旋转
        this.rotation += this.rotationSpeed;
    }

    /**
     * 绘制树叶
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active) return;

        ctx.save();

        // 设置透明度和颜色
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.darkenColor(this.color, 20);
        ctx.lineWidth = 0.5;

        // 应用位置和旋转
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // 根据不同类型绘制不同形状的叶子
        switch (this.type) {
            case 0: // 椭圆形叶子
                this.drawOvalLeaf(ctx);
                break;
            case 1: // 心形叶子
                this.drawHeartLeaf(ctx);
                break;
            case 2: // 枫叶形状（简化版）
                this.drawMapleLeaf(ctx);
                break;
            case 3: // 圆形叶子
                this.drawRoundLeaf(ctx);
                break;
            default:
                this.drawOvalLeaf(ctx);
        }

        ctx.restore();
    }

    /**
     * 绘制椭圆形叶子
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    drawOvalLeaf(ctx) {
        const width = this.size;
        const height = this.size * 2;

        ctx.beginPath();
        ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 添加叶脉
        ctx.beginPath();
        ctx.moveTo(0, -height / 2);
        ctx.lineTo(0, height / 2);
        ctx.stroke();

        // 添加侧叶脉
        for (let i = 1; i <= 3; i++) {
            const offset = (height / 4) * i - height / 2;
            ctx.beginPath();
            ctx.moveTo(0, offset);
            ctx.lineTo(width / 3, offset + width / 8);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, offset);
            ctx.lineTo(-width / 3, offset + width / 8);
            ctx.stroke();
        }
    }

    /**
     * 绘制心形叶子
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    drawHeartLeaf(ctx) {
        const s = this.size;

        ctx.beginPath();
        ctx.moveTo(0, s * 0.3);
        ctx.bezierCurveTo(s * 0.5, -s * 0.5, s, s * 0.3, 0, s);
        ctx.bezierCurveTo(-s, s * 0.3, -s * 0.5, -s * 0.5, 0, s * 0.3);
        ctx.fill();
        ctx.stroke();

        // 添加叶脉
        ctx.beginPath();
        ctx.moveTo(0, s * 0.3);
        ctx.lineTo(0, s);
        ctx.stroke();
    }

    /**
     * 绘制枫叶形状
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    drawMapleLeaf(ctx) {
        const s = this.size;

        ctx.beginPath();
        // 主干
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.3, -s * 0.5);
        ctx.lineTo(s, -s * 0.6);
        ctx.lineTo(s * 0.4, -s * 0.1);
        ctx.lineTo(s * 0.7, s * 0.7);
        ctx.lineTo(0, s * 0.3);
        ctx.lineTo(-s * 0.7, s * 0.7);
        ctx.lineTo(-s * 0.4, -s * 0.1);
        ctx.lineTo(-s, -s * 0.6);
        ctx.lineTo(-s * 0.3, -s * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 添加叶脉
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(0, s * 0.3);
        ctx.stroke();

        // 左侧叶脉
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.lineTo(-s * 0.6, -s * 0.2);
        ctx.stroke();

        // 右侧叶脉
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.lineTo(s * 0.6, -s * 0.2);
        ctx.stroke();

        // 左下叶脉
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-s * 0.5, s * 0.5);
        ctx.stroke();

        // 右下叶脉
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s * 0.5, s * 0.5);
        ctx.stroke();
    }

    /**
     * 绘制圆形叶子
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    drawRoundLeaf(ctx) {
        const radius = this.size * 0.7;

        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 添加叶脉
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(0, radius);
        ctx.moveTo(-radius * 0.7, 0);
        ctx.lineTo(radius * 0.7, 0);
        ctx.stroke();

        // 添加弧形叶脉
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * 使颜色变暗
     * @param {string} color - 原颜色的十六进制值
     * @param {number} amount - 变暗的程度 (0-255)
     * @returns {string} 变暗后的颜色
     */
    darkenColor(color, amount) {
        const num = parseInt(color.slice(1), 16);
        const r = Math.max(0, (num >> 16) - amount);
        const g = Math.max(0, ((num >> 8) & 0xff) - amount);
        const b = Math.max(0, (num & 0xff) - amount);
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
}

/**
 * 树叶系统类
 * 管理所有飘落的树叶
 */
export class LeafSystem {
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

        // 树叶配置
        this.maxLeaves = options.maxLeaves || 20;
        this.leaves = [];
        this.nextLeafTime = 0;
        this.leafInterval = options.leafInterval || 800; // 每800ms生成一片新叶子

        // 叶子颜色集
        this.leafColors = [
            '#7eb356', // 亮绿色
            '#5c8944', // 中绿色
            '#a0c273', // 浅绿色
            '#d2a24c', // 金黄色
            '#e67e30', // 橙色
            '#8d4e32'  // 棕色
        ];

        // 初始化树叶对象池
        this.initLeaves();

        logger.debug('LeafSystem: 初始化完成, 最大叶子数:', this.maxLeaves);
    }

    /**
     * 初始化树叶对象池
     */
    initLeaves() {
        this.leaves = [];
        for (let i = 0; i < this.maxLeaves; i++) {
            this.leaves.push(new Leaf());
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
        this.nextLeafTime = Date.now() + Math.random() * 2000; // 初始随机延迟
        logger.debug('LeafSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;
        // 清空所有活动的叶子
        this.leaves.forEach(leaf => {
            leaf.active = false;
        });
        logger.debug('LeafSystem: 已禁用');
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
     * 创建新叶子
     */
    createLeaf() {
        // 查找一片非活动的叶子
        const inactiveLeaf = this.leaves.find(leaf => !leaf.active);
        if (!inactiveLeaf) return;

        // 随机生成叶子属性
        const x = Math.random() * this.canvasWidth;
        const y = -20; // 从屏幕上方生成
        const size = 5 + Math.random() * 10; // 大小范围在5-15之间
        const type = Math.floor(Math.random() * 4); // 随机选择叶子类型(0-3)
        const color = this.leafColors[Math.floor(Math.random() * this.leafColors.length)];

        // 重置叶子属性
        inactiveLeaf.reset(x, y, size, type, color);
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 检查是否需要创建新叶子
        if (currentTime >= this.nextLeafTime) {
            this.createLeaf();
            this.nextLeafTime = currentTime + this.leafInterval + Math.random() * 1000; // 添加随机间隔
        }

        // 更新所有活动叶子
        this.leaves.forEach(leaf => {
            if (leaf.active) {
                leaf.update(currentTime);

                // 检查叶子是否超出屏幕范围
                if (leaf.y > this.canvasHeight + 20 ||
                    leaf.x < -50 ||
                    leaf.x > this.canvasWidth + 50) {
                    leaf.active = false; // 标记为非活动状态
                }
            }
        });
    }

    /**
     * 渲染叶子
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isEnabled) return;

        // 绘制所有活动叶子
        this.leaves.forEach(leaf => {
            if (leaf.active) {
                leaf.render(ctx);
            }
        });
    }
} 