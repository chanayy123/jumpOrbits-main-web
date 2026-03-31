/**
 * 赛博朋克主题 - 霓虹灯系统
 * 生成城市霓虹灯效果
 */
import logger from '../utils/logger.js';

/**
 * 霓虹灯类
 * @private
 */
class NeonLight {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.rotation = 0;
        this.active = false;

        // 霓虹灯特性
        this.color = '';
        this.glowColor = '';
        this.glowSize = 0;
        this.alpha = 1;
        this.shape = 0; // 形状类型: 0=条形, 1=圆形, 2=矩形

        // 动画属性
        this.blinkSpeed = 0;
        this.blinkPhase = 0;
        this.fadeSpeed = 0;
        this.lifeTime = 0;
        this.createTime = 0;
        this.flickerChance = 0; // 闪烁概率
    }

    /**
     * 重置霓虹灯属性
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} currentTime - 当前时间戳
     */
    reset(x, y, currentTime) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.createTime = currentTime;

        // 决定霓虹灯类型和外观
        this.shape = Math.floor(Math.random() * 3); // 0-2 三种形状

        if (this.shape === 0) { // 条形霓虹灯
            this.width = 20 + Math.random() * 120; // 宽度在20-140之间
            this.height = 3 + Math.random() * 6; // 高度在3-9之间
        } else if (this.shape === 1) { // 圆形霓虹灯
            this.width = this.height = 10 + Math.random() * 30; // 圆直径在10-40之间
        } else { // 矩形霓虹灯
            this.width = 10 + Math.random() * 60; // 宽度在10-70之间
            this.height = 10 + Math.random() * 40; // 高度在10-50之间
        }

        this.rotation = Math.random() * Math.PI * 2; // 随机旋转角度
        this.alpha = 0.6 + Math.random() * 0.4; // 透明度在0.6-1.0之间

        // 设置霓虹灯颜色 - 使用鲜艳的霓虹色
        const colors = [
            [255, 0, 128], // 霓虹粉
            [0, 255, 255], // 霓虹青
            [255, 0, 255], // 霓虹紫
            [0, 255, 128], // 霓虹绿
            [255, 128, 0], // 霓虹橙
            [128, 0, 255]  // 霓虹蓝紫
        ];

        const colorIndex = Math.floor(Math.random() * colors.length);
        const [r, g, b] = colors[colorIndex];
        this.color = `rgb(${r}, ${g}, ${b})`;
        this.glowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
        this.glowSize = this.shape === 1 ? this.width * 0.6 : Math.max(this.width, this.height) * 0.3;

        // 设置动画参数
        this.blinkSpeed = 0.001 + Math.random() * 0.009; // 闪烁速度
        this.blinkPhase = Math.random() * Math.PI * 2; // 随机初始相位
        this.fadeSpeed = 0.1 + Math.random() * 0.3; // 淡入淡出速度
        this.lifeTime = 5000 + Math.random() * 15000; // 存在时间5-20秒
        this.flickerChance = Math.random() * 0.15; // 0-15%的闪烁概率
    }

    /**
     * 更新霓虹灯状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.active) return;

        // 计算存在时间
        const elapsed = currentTime - this.createTime;

        // 超过生命周期，设为不活动
        if (elapsed > this.lifeTime) {
            this.active = false;
            return;
        }

        // 计算当前alpha值（考虑闪烁效果）
        // 前10%时间淡入，后10%时间淡出
        const normalizedTime = elapsed / this.lifeTime;
        let alphaMultiplier = 1;

        if (normalizedTime < 0.1) {
            // 淡入阶段
            alphaMultiplier = normalizedTime * 10;
        } else if (normalizedTime > 0.9) {
            // 淡出阶段
            alphaMultiplier = (1 - normalizedTime) * 10;
        }

        // 闪烁效果
        const blinkFactor = 0.7 + 0.3 * Math.sin(currentTime * this.blinkSpeed + this.blinkPhase);
        this.currentAlpha = this.alpha * blinkFactor * alphaMultiplier;

        // 随机闪烁
        if (Math.random() < this.flickerChance) {
            this.currentAlpha *= Math.random() < 0.5 ? 0.3 : 1;
        }
    }

    /**
     * 绘制霓虹灯
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active) return;

        ctx.save();

        // 设置混合模式，让霓虹灯更加明亮
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.currentAlpha;

        // 移动到霓虹灯位置并应用旋转
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // 绘制发光效果
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.glowSize);
        gradient.addColorStop(0, this.glowColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;

        // 根据形状类型绘制
        if (this.shape === 0) { // 条形霓虹灯
            ctx.fillRect(-this.width / 2 - this.glowSize, -this.height / 2 - this.glowSize,
                this.width + this.glowSize * 2, this.height + this.glowSize * 2);
        } else if (this.shape === 1) { // 圆形霓虹灯
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 2 + this.glowSize, 0, Math.PI * 2);
            ctx.fill();
        } else { // 矩形霓虹灯
            ctx.fillRect(-this.width / 2 - this.glowSize, -this.height / 2 - this.glowSize,
                this.width + this.glowSize * 2, this.height + this.glowSize * 2);
        }

        // 绘制霓虹灯主体
        ctx.fillStyle = this.color;

        if (this.shape === 0) { // 条形霓虹灯
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        } else if (this.shape === 1) { // 圆形霓虹灯
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        } else { // 矩形霓虹灯
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        ctx.restore();
    }
}

/**
 * 霓虹灯系统类
 * 管理所有霓虹灯效果
 */
export class NeonSystem {
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

        // 霓虹灯配置
        this.maxNeonLights = options.maxNeonLights || 15;
        this.neonLights = [];
        this.nextNeonTime = 0;
        this.neonInterval = options.neonInterval || 2000; // 每2秒尝试生成一个新霓虹灯

        // 初始化霓虹灯对象池
        this.initNeonLights();

        logger.debug('NeonSystem: 初始化完成, 最大霓虹灯数:', this.maxNeonLights);
    }

    /**
     * 初始化霓虹灯对象池
     */
    initNeonLights() {
        this.neonLights = [];
        for (let i = 0; i < this.maxNeonLights; i++) {
            this.neonLights.push(new NeonLight());
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
        this.nextNeonTime = Date.now() + Math.random() * 1000;

        // 初始创建一些霓虹灯
        const initialCount = Math.min(5, this.maxNeonLights);
        for (let i = 0; i < initialCount; i++) {
            this.createNeonLight(Date.now());
        }

        logger.debug('NeonSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;

        // 清空所有活动的霓虹灯
        this.neonLights.forEach(light => {
            light.active = false;
        });

        logger.debug('NeonSystem: 已禁用');
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
        if (newSize === this.maxNeonLights) return;

        if (newSize > this.maxNeonLights) {
            // 增加霓虹灯数量
            const addCount = newSize - this.maxNeonLights;
            for (let i = 0; i < addCount; i++) {
                this.neonLights.push(new NeonLight());
            }
        } else {
            // 减少霓虹灯数量，但保留活动的灯
            const activeCount = this.neonLights.filter(l => l.active).length;
            if (newSize < activeCount) {
                // 将部分活动霓虹灯设为不活动
                let deactivateCount = activeCount - newSize;
                for (let i = 0; i < this.neonLights.length && deactivateCount > 0; i++) {
                    if (this.neonLights[i].active) {
                        this.neonLights[i].active = false;
                        deactivateCount--;
                    }
                }
            }
            // 保留前newSize个元素
            this.neonLights = this.neonLights.slice(0, newSize);
        }

        this.maxNeonLights = newSize;
        logger.debug('NeonSystem: 更新池大小为', newSize);
    }

    /**
     * 创建新霓虹灯
     * @param {number} currentTime - 当前时间戳
     */
    createNeonLight(currentTime) {
        // 查找非活动的霓虹灯
        const inactiveLight = this.neonLights.find(light => !light.active);
        if (!inactiveLight) return;

        // 在画布范围内随机位置生成霓虹灯
        const margin = 20;
        const x = margin + Math.random() * (this.canvasWidth - margin * 2);
        const y = margin + Math.random() * (this.canvasHeight - margin * 2);

        inactiveLight.reset(x, y, currentTime);
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 检查是否需要生成新霓虹灯
        if (currentTime >= this.nextNeonTime) {
            this.createNeonLight(currentTime);
            this.nextNeonTime = currentTime + this.neonInterval + Math.random() * 2000; // 添加一点随机间隔
        }

        // 更新所有活动霓虹灯
        for (const light of this.neonLights) {
            if (light.active) {
                light.update(currentTime);
            }
        }
    }

    /**
     * 获取活动霓虹灯数量
     * @returns {number} 活动霓虹灯数量
     */
    getActiveCount() {
        return this.neonLights.filter(light => light.active).length;
    }

    /**
     * 渲染所有霓虹灯
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isEnabled) return;

        // 渲染所有活动霓虹灯
        for (const light of this.neonLights) {
            if (light.active) {
                light.render(ctx);
            }
        }
    }
} 