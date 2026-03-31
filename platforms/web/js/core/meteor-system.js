/**
 * 流星类，表示单个流星
 * @private
 */
class Meteor {
    /**
     * 初始化流星属性
     */
    constructor() {
        this.x = 0;          // 流星头部X坐标
        this.y = 0;          // 流星头部Y坐标
        this.length = 0;     // 流星尾迹长度
        this.angle = 0;      // 流星移动角度
        this.speed = 0;      // 移动速度
        this.size = 0;       // 流星大小
        this.alpha = 0;      // 透明度
        this.active = false; // 是否处于活跃状态
        this.color = '';     // 流星颜色
    }

    /**
     * 重置流星属性
     * @param {number} x - 初始X坐标
     * @param {number} y - 初始Y坐标
     * @param {number} length - 尾迹长度
     * @param {number} angle - 移动角度
     * @param {number} speed - 移动速度
     * @param {number} size - 流星大小
     * @param {string} color - 流星颜色
     */
    reset(x, y, length, angle, speed, size, color) {
        this.x = x;
        this.y = y;
        this.length = length;
        this.angle = angle;
        this.speed = speed;
        this.size = size;
        this.alpha = 1.0;
        this.active = true;
        this.color = color || '#FFFFFF';
    }

    /**
     * 更新流星状态
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    update(width, height) {
        if (!this.active) return;

        // 根据角度和速度更新位置
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // 检查是否移出画布，如果是则停用
        if (this.x < -this.length || this.x > width + this.length ||
            this.y < -this.length || this.y > height + this.length) {
            this.active = false;
        }
    }

    /**
     * 渲染流星
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D上下文
     */
    render(ctx) {
        if (!this.active) return;

        ctx.save();

        // 计算尾迹起点
        const tailX = this.x - Math.cos(this.angle) * this.length;
        const tailY = this.y - Math.sin(this.angle) * this.length;

        // 创建渐变效果
        const gradient = ctx.createLinearGradient(
            this.x, this.y,
            tailX, tailY
        );

        // 头部白色不透明，尾部透明
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        // 设置渲染样式
        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.size;
        ctx.lineCap = 'round';
        ctx.globalAlpha = this.alpha;

        // 绘制流星线条
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // 绘制流星头部（小圆点）
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

/**
 * 流星系统类，管理所有流星效果
 * @export
 */
export class MeteorSystem {
    /**
     * 初始化流星系统
     * @param {Object} options - 配置选项
     * @param {number} options.poolSize - 流星池大小（最大同时显示的流星数）
     * @param {number} options.spawnInterval - 生成间隔（毫秒）
     * @param {number} options.spawnChance - 生成概率（0-1）
     */
    constructor(options = {}) {
        // 流星池配置
        this.poolSize = options.poolSize || 10;
        this.meteorPool = [];

        // 生成配置
        this.spawnInterval = options.spawnInterval || 3000;
        this.spawnChance = options.spawnChance || 0.3;
        this.nextSpawnTime = 0;

        // 系统状态
        this.isEnabled = false;

        // 初始化流星池
        this.initMeteorPool();
    }

    /**
     * 初始化流星池
     */
    initMeteorPool() {
        this.meteorPool = [];
        for (let i = 0; i < this.poolSize; i++) {
            this.meteorPool.push(this.createMeteor(false));
        }
    }

    /**
     * 创建一个流星对象
     * @param {boolean} isActive - 是否激活
     * @returns {Object} 流星对象
     */
    createMeteor(isActive = false) {
        return {
            x: 0,
            y: 0,
            length: 0,       // 流星长度
            speed: 0,        // 移动速度
            angle: 0,        // 移动角度
            width: 0,        // 流星宽度
            active: isActive, // 是否激活
            trail: [],       // 尾迹点
            color: '',       // 颜色
            fadeSpeed: 0,    // 尾迹淡出速度
            tailLength: 0    // 尾迹长度
        };
    }

    /**
     * 启用流星系统
     */
    enable() {
        this.isEnabled = true;
        this.nextSpawnTime = Date.now() + Math.random() * this.spawnInterval;
    }

    /**
     * 禁用流星系统
     */
    disable() {
        this.isEnabled = false;
        // 清空所有活动的流星
        this.meteorPool.forEach(meteor => {
            meteor.active = false;
        });
    }

    /**
     * 更新池大小
     * @param {number} newSize - 新的池大小
     */
    updatePoolSize(newSize) {
        if (newSize === this.poolSize) return;

        if (newSize > this.poolSize) {
            // 增加流星数量
            const addCount = newSize - this.poolSize;
            for (let i = 0; i < addCount; i++) {
                this.meteorPool.push(this.createMeteor(false));
            }
        } else {
            // 减少流星数量，但保留活动的流星
            const activeCount = this.meteorPool.filter(m => m.active).length;
            if (newSize < activeCount) {
                // 将部分活动流星设为不活动
                let deactivateCount = activeCount - newSize;
                for (let i = 0; i < this.meteorPool.length && deactivateCount > 0; i++) {
                    if (this.meteorPool[i].active) {
                        this.meteorPool[i].active = false;
                        deactivateCount--;
                    }
                }
            }
            // 保留前newSize个元素
            this.meteorPool = this.meteorPool.slice(0, newSize);
        }

        this.poolSize = newSize;
    }

    /**
     * 重置流星属性并激活
     * @param {Object} meteor - 流星对象
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    resetMeteor(meteor, width, height) {
        // 设置流星出现在屏幕左上角区域
        meteor.x = -50 + Math.random() * (width / 3);
        meteor.y = -50 + Math.random() * (height / 3);

        // 设置流星长度和宽度
        meteor.length = 20 + Math.random() * 80;
        meteor.width = 1 + Math.random() * 2;

        // 设置流星速度和角度（右下方向）
        meteor.speed = 5 + Math.random() * 10;
        meteor.angle = Math.PI / 4 + (Math.random() - 0.5) * (Math.PI / 6);

        // 设置流星颜色（明亮的白色或淡蓝色）
        const colorBase = 220 + Math.floor(Math.random() * 35);
        meteor.color = Math.random() > 0.7
            ? `rgb(${colorBase - 20}, ${colorBase}, ${colorBase + 20})` // 淡蓝色
            : `rgb(${colorBase}, ${colorBase}, ${colorBase})`; // 白色

        // 设置尾迹相关属性
        meteor.trail = [];
        meteor.fadeSpeed = 0.03 + Math.random() * 0.02;
        meteor.tailLength = 10 + Math.random() * 20;

        // 激活流星
        meteor.active = true;
    }

    /**
     * 尝试生成新流星
     * @param {number} currentTime - 当前时间戳
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    spawnMeteor(currentTime, width, height) {
        if (!this.isEnabled) return;

        if (currentTime >= this.nextSpawnTime) {
            // 根据概率决定是否生成流星
            if (Math.random() < this.spawnChance) {
                // 查找非活动的流星
                const inactiveMeteor = this.meteorPool.find(meteor => !meteor.active);
                if (inactiveMeteor) {
                    this.resetMeteor(inactiveMeteor, width, height);
                }
            }

            // 设置下次生成时间
            this.nextSpawnTime = currentTime + this.spawnInterval;
        }
    }

    /**
     * 更新所有流星状态
     * @param {number} currentTime - 当前时间戳
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    update(currentTime, width, height) {
        if (!this.isEnabled) return;

        // 尝试生成新流星
        this.spawnMeteor(currentTime, width, height);

        // 更新所有活动流星
        for (const meteor of this.meteorPool) {
            if (!meteor.active) continue;

            // 计算移动距离
            const dx = Math.cos(meteor.angle) * meteor.speed;
            const dy = Math.sin(meteor.angle) * meteor.speed;

            // 更新位置
            meteor.x += dx;
            meteor.y += dy;

            // 添加当前位置到尾迹
            meteor.trail.unshift({ x: meteor.x, y: meteor.y, alpha: 1 });

            // 限制尾迹长度
            if (meteor.trail.length > meteor.tailLength) {
                meteor.trail.pop();
            }

            // 淡化尾迹
            for (let i = 0; i < meteor.trail.length; i++) {
                meteor.trail[i].alpha -= meteor.fadeSpeed;
            }

            // 移除完全透明的尾迹点
            meteor.trail = meteor.trail.filter(point => point.alpha > 0);

            // 检查流星是否超出屏幕
            if (meteor.x > width + 100 || meteor.y > height + 100 || meteor.trail.length === 0) {
                meteor.active = false;
            }
        }
    }

    /**
     * 渲染所有流星
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isEnabled) return;

        ctx.save();

        // 设置全局合成模式为"lighter"，使重叠部分更亮
        ctx.globalCompositeOperation = 'lighter';

        // 渲染所有活动流星
        for (const meteor of this.meteorPool) {
            if (!meteor.active || meteor.trail.length === 0) continue;

            // 绘制流星头部（亮点）
            const head = meteor.trail[0];
            ctx.beginPath();
            ctx.arc(head.x, head.y, meteor.width * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = meteor.color;
            ctx.fill();

            // 绘制流星尾迹
            if (meteor.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(meteor.trail[0].x, meteor.trail[0].y);

                // 绘制尾迹线段
                for (let i = 1; i < meteor.trail.length; i++) {
                    ctx.lineTo(meteor.trail[i].x, meteor.trail[i].y);
                }

                // 创建尾迹渐变
                const gradient = ctx.createLinearGradient(
                    meteor.trail[0].x, meteor.trail[0].y,
                    meteor.trail[meteor.trail.length - 1].x, meteor.trail[meteor.trail.length - 1].y
                );

                gradient.addColorStop(0, `rgba(255, 255, 255, ${meteor.trail[0].alpha})`);
                gradient.addColorStop(0.3, `rgba(240, 240, 255, ${meteor.trail[Math.floor(meteor.trail.length * 0.3)].alpha})`);
                gradient.addColorStop(1, `rgba(180, 180, 220, 0)`);

                ctx.strokeStyle = gradient;
                ctx.lineWidth = meteor.width;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
            }
        }

        ctx.restore();
    }
} 