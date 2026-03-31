/**
 * 赛博朋克主题 - 电路系统
 * 生成赛博朋克风格的电路图案
 */
import logger from '../utils/logger.js';

/**
 * 电路类
 * @private
 */
class Circuit {
    constructor() {
        // 基本属性
        this.startX = 0;
        this.startY = 0;
        this.points = [];
        this.active = false;

        // 电路特性
        this.lineWidth = 0;
        this.color = '';
        this.pulseColor = '';
        this.nodeColor = '';
        this.nodeRadius = 0;
        this.maxSegments = 0;
        this.segmentLength = 0;

        // 动画属性
        this.pulseSpeed = 0;
        this.pulsePosition = 0;
        this.createTime = 0;
        this.lifeTime = 0;
        this.growthSpeed = 0;
        this.currentSegments = 0;
        this.lastGrowthTime = 0;
        this.growthInterval = 0;
    }

    /**
     * 重置电路属性
     * @param {number} x - 起始X坐标
     * @param {number} y - 起始Y坐标
     * @param {number} currentTime - 当前时间戳
     * @param {number} canvasWidth - 画布宽度
     * @param {number} canvasHeight - 画布高度
     */
    reset(x, y, currentTime, canvasWidth, canvasHeight) {
        this.startX = x;
        this.startY = y;
        this.active = true;
        this.createTime = currentTime;
        this.points = [{ x, y }]; // 起始点

        // 电路特性
        this.lineWidth = 1 + Math.random() * 2; // 线宽1-3像素
        this.nodeRadius = 2 + Math.random() * 4; // 节点半径2-6像素
        this.maxSegments = 8 + Math.floor(Math.random() * 10); // 8-17个线段
        this.segmentLength = 30 + Math.random() * 50; // 线段长度30-80像素

        // 生成电路颜色 - 使用霓虹色系
        const colors = [
            [0, 255, 255], // 青色
            [255, 0, 255], // 紫色
            [0, 255, 128], // 绿色
            [255, 0, 128]  // 粉色
        ];

        const colorIndex = Math.floor(Math.random() * colors.length);
        const [r, g, b] = colors[colorIndex];

        this.color = `rgba(${r}, ${g}, ${b}, 0.6)`;
        this.pulseColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
        this.nodeColor = `rgba(${r}, ${g}, ${b}, 0.8)`;

        // 动画属性
        this.pulseSpeed = 0.2 + Math.random() * 0.4; // 脉冲速度
        this.pulsePosition = 0; // 脉冲位置百分比（0-1）
        this.lifeTime = 8000 + Math.random() * 12000; // 持续8-20秒
        this.growthSpeed = 0.5 + Math.random() * 1.5; // 生长速度
        this.currentSegments = 1;
        this.lastGrowthTime = currentTime;
        this.growthInterval = 300 + Math.random() * 700; // 每0.3-1秒生长一个段

        // 生成电路路径
        this.generateCircuitPath(canvasWidth, canvasHeight);
    }

    /**
     * 生成电路路径
     * @param {number} canvasWidth - 画布宽度
     * @param {number} canvasHeight - 画布高度
     */
    generateCircuitPath(canvasWidth, canvasHeight) {
        // 从起始点开始
        let lastX = this.startX;
        let lastY = this.startY;

        // 生成路径点
        for (let i = 1; i < this.maxSegments; i++) {
            // 确定新段的方向 - 45度的倍数方向
            const directionAngle = Math.floor(Math.random() * 8) * (Math.PI / 4);

            // 计算新点的位置
            const segLength = this.segmentLength * (0.7 + Math.random() * 0.6); // 变化一下长度
            const newX = lastX + Math.cos(directionAngle) * segLength;
            const newY = lastY + Math.sin(directionAngle) * segLength;

            // 检查是否超出画布，如果超出则尝试其他方向
            if (newX < 0 || newX > canvasWidth || newY < 0 || newY > canvasHeight) {
                // 反向
                const oppositeAngle = directionAngle + Math.PI;
                const bounceX = lastX + Math.cos(oppositeAngle) * (segLength * 0.8);
                const bounceY = lastY + Math.sin(oppositeAngle) * (segLength * 0.8);

                // 确保还在画布内
                const validX = Math.max(10, Math.min(canvasWidth - 10, bounceX));
                const validY = Math.max(10, Math.min(canvasHeight - 10, bounceY));

                this.points.push({ x: validX, y: validY });
                lastX = validX;
                lastY = validY;
            } else {
                this.points.push({ x: newX, y: newY });
                lastX = newX;
                lastY = newY;
            }
        }
    }

    /**
     * 更新电路状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 检查是否超过生命期
        const elapsed = currentTime - this.createTime;
        if (elapsed > this.lifeTime) {
            this.active = false;
            return;
        }

        // 更新脉冲位置
        const totalLength = this.getTotalLength();
        this.pulsePosition = (this.pulsePosition + this.pulseSpeed / 1000) % 1;

        // 增加电路段数，直到达到最大值
        if (this.currentSegments < this.maxSegments &&
            currentTime - this.lastGrowthTime > this.growthInterval) {
            this.currentSegments = Math.min(this.currentSegments + 1, this.maxSegments);
            this.lastGrowthTime = currentTime;
        }
    }

    /**
     * 获取电路总长度
     * @returns {number} 总长度
     */
    getTotalLength() {
        let totalLength = 0;
        for (let i = 1; i < this.points.length; i++) {
            const dx = this.points[i].x - this.points[i - 1].x;
            const dy = this.points[i].y - this.points[i - 1].y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
        }
        return totalLength;
    }

    /**
     * 绘制电路
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.active) return;

        ctx.save();

        // 设置混合模式，让电路看起来更亮
        ctx.globalCompositeOperation = 'lighter';

        // 绘制电路线段
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        // 只绘制当前已生长的段数
        for (let i = 1; i < Math.min(this.currentSegments, this.points.length); i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.stroke();

        // 在每个节点处绘制圆点
        for (let i = 0; i < Math.min(this.currentSegments, this.points.length); i++) {
            ctx.fillStyle = this.nodeColor;
            ctx.beginPath();
            ctx.arc(this.points[i].x, this.points[i].y, this.nodeRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制脉冲效果
        this.renderPulse(ctx);

        ctx.restore();
    }

    /**
     * 绘制脉冲效果
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    renderPulse(ctx) {
        // 只有当电路已完全生长才显示脉冲
        if (this.currentSegments < this.maxSegments) return;

        const totalLength = this.getTotalLength();
        let currentLength = 0;
        let pulsePosition = this.pulsePosition * totalLength;
        let prevX = this.points[0].x;
        let prevY = this.points[0].y;

        // 找到脉冲所在的位置
        for (let i = 1; i < this.points.length; i++) {
            const dx = this.points[i].x - prevX;
            const dy = this.points[i].y - prevY;
            const segmentLength = Math.sqrt(dx * dx + dy * dy);

            if (currentLength <= pulsePosition && currentLength + segmentLength >= pulsePosition) {
                // 脉冲在当前线段上
                const segmentPercent = (pulsePosition - currentLength) / segmentLength;
                const pulseX = prevX + dx * segmentPercent;
                const pulseY = prevY + dy * segmentPercent;

                // 绘制脉冲点
                const pulseRadius = this.nodeRadius * 1.5;
                const gradient = ctx.createRadialGradient(
                    pulseX, pulseY, 0,
                    pulseX, pulseY, pulseRadius * 2
                );
                gradient.addColorStop(0, this.pulseColor);
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(pulseX, pulseY, pulseRadius * 2, 0, Math.PI * 2);
                ctx.fill();

                break;
            }

            currentLength += segmentLength;
            prevX = this.points[i].x;
            prevY = this.points[i].y;
        }
    }
}

/**
 * 电路系统类
 * 管理所有电路效果
 */
export class CircuitSystem {
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

        // 电路配置
        this.maxCircuits = options.maxCircuits || 8;
        this.circuits = [];
        this.nextCircuitTime = 0;
        this.circuitInterval = options.circuitInterval || 3000; // 每3秒尝试生成一条新电路

        // 初始化电路对象池
        this.initCircuits();

        logger.debug('CircuitSystem: 初始化完成, 最大电路数:', this.maxCircuits);
    }

    /**
     * 初始化电路对象池
     */
    initCircuits() {
        this.circuits = [];
        for (let i = 0; i < this.maxCircuits; i++) {
            this.circuits.push(new Circuit());
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
        this.nextCircuitTime = Date.now() + Math.random() * 1000;

        // 初始创建一些电路
        const initialCount = Math.min(3, this.maxCircuits);
        for (let i = 0; i < initialCount; i++) {
            this.createCircuit(Date.now());
        }

        logger.debug('CircuitSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;

        // 清空所有活动的电路
        this.circuits.forEach(circuit => {
            circuit.active = false;
        });

        logger.debug('CircuitSystem: 已禁用');
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
        if (newSize === this.maxCircuits) return;

        if (newSize > this.maxCircuits) {
            // 增加电路数量
            const addCount = newSize - this.maxCircuits;
            for (let i = 0; i < addCount; i++) {
                this.circuits.push(new Circuit());
            }
        } else {
            // 减少电路数量，但保留活动的电路
            const activeCount = this.circuits.filter(c => c.active).length;
            if (newSize < activeCount) {
                // 将部分活动电路设为不活动
                let deactivateCount = activeCount - newSize;
                for (let i = 0; i < this.circuits.length && deactivateCount > 0; i++) {
                    if (this.circuits[i].active) {
                        this.circuits[i].active = false;
                        deactivateCount--;
                    }
                }
            }
            // 保留前newSize个元素
            this.circuits = this.circuits.slice(0, newSize);
        }

        this.maxCircuits = newSize;
        logger.debug('CircuitSystem: 更新池大小为', newSize);
    }

    /**
     * 创建新电路
     * @param {number} currentTime - 当前时间戳
     */
    createCircuit(currentTime) {
        // 查找非活动的电路
        const inactiveCircuit = this.circuits.find(circuit => !circuit.active);
        if (!inactiveCircuit) return;

        // 在画布边缘随机位置生成新电路
        const side = Math.floor(Math.random() * 4); // 0=上, 1=右, 2=下, 3=左
        let x, y;

        switch (side) {
            case 0: // 上边
                x = Math.random() * this.canvasWidth;
                y = 0;
                break;
            case 1: // 右边
                x = this.canvasWidth;
                y = Math.random() * this.canvasHeight;
                break;
            case 2: // 下边
                x = Math.random() * this.canvasWidth;
                y = this.canvasHeight;
                break;
            case 3: // 左边
                x = 0;
                y = Math.random() * this.canvasHeight;
                break;
        }

        inactiveCircuit.reset(x, y, currentTime, this.canvasWidth, this.canvasHeight);
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 检查是否需要生成新电路
        if (currentTime >= this.nextCircuitTime) {
            this.createCircuit(currentTime);
            this.nextCircuitTime = currentTime + this.circuitInterval + Math.random() * 2000; // 添加一点随机间隔
        }

        // 更新所有活动电路
        for (const circuit of this.circuits) {
            if (circuit.active) {
                circuit.update(currentTime);
            }
        }
    }

    /**
     * 获取活动电路数量
     * @returns {number} 活动电路数量
     */
    getActiveCount() {
        return this.circuits.filter(circuit => circuit.active).length;
    }

    /**
     * 渲染所有电路
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.isEnabled) return;

        // 渲染所有活动电路
        for (const circuit of this.circuits) {
            if (circuit.active) {
                circuit.render(ctx, currentTime);
            }
        }
    }
} 