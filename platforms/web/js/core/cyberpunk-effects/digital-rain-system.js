/**
 * 赛博朋克主题 - 数字雨系统
 * 生成经典Matrix风格数字瀑布效果
 */
import logger from '../utils/logger.js';

/**
 * 数字雨列类
 * @private
 */
class RainColumn {
    constructor() {
        // 基本属性
        this.x = 0;
        this.y = 0;
        this.length = 0;
        this.active = false;

        // 数字特性
        this.characterSize = 0;
        this.characters = [];
        this.color = '';
        this.headColor = '';
        this.fadeColor = '';

        // 动画属性
        this.speed = 0;
        this.updateSpeed = 0;
        this.lastUpdate = 0;
        this.createTime = 0;
        this.lifeTime = 0;
    }

    /**
     * 重置数字雨列属性
     * @param {number} x - X坐标
     * @param {number} canvasHeight - 画布高度
     * @param {number} currentTime - 当前时间戳
     */
    reset(x, canvasHeight, currentTime) {
        this.x = x;
        this.y = -50; // 从画布上方开始
        this.active = true;
        this.createTime = currentTime;

        // 数字特性
        this.characterSize = 8 + Math.floor(Math.random() * 6); // 8-13像素大小
        this.length = 5 + Math.floor(Math.random() * 15); // 数字长度

        // 生成随机字符
        this.characters = [];
        this.generateCharacters();

        // 颜色 - 使用霓虹绿系列
        const baseHue = 120 + Math.random() * 40; // 120-160 绿色系
        const baseSaturation = 50 + Math.random() * 50; // 50-100%
        const baseLightness = 40 + Math.random() * 20; // 40-60%

        this.color = `hsla(${baseHue}, ${baseSaturation}%, ${baseLightness}%, 0.5)`;
        this.headColor = `hsla(${baseHue}, ${baseSaturation}%, ${baseLightness + 20}%, 0.9)`; // 头部更亮
        this.fadeColor = `hsla(${baseHue}, ${baseSaturation}%, ${baseLightness - 10}%, 0.1)`; // 尾部更暗

        // 动画属性
        this.speed = 0.5 + Math.random() * 2.5; // 下落速度
        this.updateSpeed = 100 + Math.random() * 200; // 字符变化速度，每100-300ms变化一次
        this.lastUpdate = currentTime;
        this.lifeTime = 5000 + Math.random() * 10000; // 持续5-15秒
    }

    /**
     * 生成随机字符
     */
    generateCharacters() {
        const possibleChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@#$%^&*()_+{}|:<>?[];\',./'.split('');

        // 生成数字雨的字符序列
        this.characters = [];
        for (let i = 0; i < this.length; i++) {
            const charIndex = Math.floor(Math.random() * possibleChars.length);
            this.characters.push(possibleChars[charIndex]);
        }
    }

    /**
     * 更新数字雨状态
     * @param {number} currentTime - 当前时间戳
     * @param {number} canvasHeight - 画布高度
     */
    update(currentTime, canvasHeight) {
        if (!this.active) return;

        // 检查是否超过生命期
        if (currentTime - this.createTime > this.lifeTime) {
            // 如果整列都超出了屏幕，则设为不活动
            if (this.y - this.characterSize * this.length > canvasHeight) {
                this.active = false;
                return;
            }
        }

        // 更新位置
        this.y += this.speed;

        // 定期更新字符
        if (currentTime - this.lastUpdate > this.updateSpeed) {
            this.updateCharacters();
            this.lastUpdate = currentTime;
        }
    }

    /**
     * 更新字符内容
     */
    updateCharacters() {
        // 有30%的概率更新一个随机字符
        if (Math.random() < 0.3 && this.characters.length > 0) {
            const possibleChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@#$%^&*()_+{}|:<>?[];\',./'.split('');
            const randomIndex = Math.floor(Math.random() * this.characters.length);
            const charIndex = Math.floor(Math.random() * possibleChars.length);
            this.characters[randomIndex] = possibleChars[charIndex];
        }
    }

    /**
     * 渲染数字雨
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.active) return;

        // 设置字体
        ctx.font = `${this.characterSize}px monospace`;
        ctx.textAlign = 'center';

        // 渲染数字雨中的每个字符
        for (let i = 0; i < this.characters.length; i++) {
            const charY = this.y - i * this.characterSize;

            // 如果字符在屏幕内，才渲染
            if (charY > -this.characterSize && charY < ctx.canvas.height + this.characterSize) {
                // 根据位置设置不同的颜色
                if (i === 0) {
                    // 头部字符（最亮）
                    ctx.fillStyle = this.headColor;
                } else if (i < 3) {
                    // 前几个字符（较亮）
                    ctx.fillStyle = this.color;
                } else {
                    // 尾部字符（逐渐变暗）
                    const alpha = 0.1 + (1 - i / this.length) * 0.4;

                    // 安全解析颜色组件 - 修复正则表达式匹配问题
                    try {
                        // 提取色相(hue)
                        const hueMatch = this.color.match(/hsla?\((\d+)/);
                        const hue = hueMatch && hueMatch[1] ? hueMatch[1] : "120";

                        // 提取饱和度(saturation)
                        const satMatch = this.color.match(/,\s*(\d+)%/);
                        const saturation = satMatch && satMatch[1] ? satMatch[1] : "50";

                        // 提取亮度(lightness)
                        const lightMatch = this.color.match(/,\s*(\d+)%/g);
                        const lightness = lightMatch && lightMatch.length > 1 ?
                            lightMatch[1].match(/\d+/) : "40";

                        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
                    } catch (e) {
                        // 如果解析失败，使用安全的默认颜色
                        ctx.fillStyle = `hsla(120, 50%, 40%, ${alpha})`;
                    }
                }

                // 渲染字符
                ctx.fillText(this.characters[i], this.x, charY);
            }
        }
    }
}

/**
 * 数字雨系统类
 * 管理所有数字雨效果
 */
export class DigitalRainSystem {
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

        // 数字雨配置
        this.maxRainColumns = options.maxRainColumns || 30;
        this.rainColumns = [];
        this.nextColumnTime = 0;
        this.columnInterval = options.columnInterval || 500; // 每500ms尝试生成一列新数字雨

        // 初始化数字雨对象池
        this.initRainColumns();

        logger.debug('DigitalRainSystem: 初始化完成, 最大数字雨列数:', this.maxRainColumns);
    }

    /**
     * 初始化数字雨对象池
     */
    initRainColumns() {
        this.rainColumns = [];
        for (let i = 0; i < this.maxRainColumns; i++) {
            this.rainColumns.push(new RainColumn());
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
        this.nextColumnTime = Date.now() + Math.random() * 500;

        // 初始创建一些数字雨列
        const initialCount = Math.min(5, this.maxRainColumns);
        for (let i = 0; i < initialCount; i++) {
            this.createRainColumn(Date.now());
        }

        logger.debug('DigitalRainSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        this.isEnabled = false;

        // 清空所有活动的数字雨
        this.rainColumns.forEach(column => {
            column.active = false;
        });

        logger.debug('DigitalRainSystem: 已禁用');
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
        if (newSize === this.maxRainColumns) return;

        if (newSize > this.maxRainColumns) {
            // 增加数字雨列数量
            const addCount = newSize - this.maxRainColumns;
            for (let i = 0; i < addCount; i++) {
                this.rainColumns.push(new RainColumn());
            }
        } else {
            // 减少数字雨列数量，但保留活动的列
            const activeCount = this.rainColumns.filter(c => c.active).length;
            if (newSize < activeCount) {
                // 将部分活动列设为不活动
                let deactivateCount = activeCount - newSize;
                for (let i = 0; i < this.rainColumns.length && deactivateCount > 0; i++) {
                    if (this.rainColumns[i].active) {
                        this.rainColumns[i].active = false;
                        deactivateCount--;
                    }
                }
            }
            // 保留前newSize个元素
            this.rainColumns = this.rainColumns.slice(0, newSize);
        }

        this.maxRainColumns = newSize;
        logger.debug('DigitalRainSystem: 更新池大小为', newSize);
    }

    /**
     * 创建新数字雨列
     * @param {number} currentTime - 当前时间戳
     */
    createRainColumn(currentTime) {
        // 查找非活动的数字雨列
        const inactiveColumn = this.rainColumns.find(column => !column.active);
        if (!inactiveColumn) return;

        // 在画布宽度范围内随机位置生成新列
        const x = Math.random() * this.canvasWidth;
        inactiveColumn.reset(x, this.canvasHeight, currentTime);
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        // 检查是否需要生成新数字雨列
        if (currentTime >= this.nextColumnTime) {
            this.createRainColumn(currentTime);
            this.nextColumnTime = currentTime + this.columnInterval + Math.random() * 500; // 添加一点随机间隔
        }

        // 更新所有活动数字雨列
        for (const column of this.rainColumns) {
            if (column.active) {
                column.update(currentTime, this.canvasHeight);
            }
        }
    }

    /**
     * 获取活动数字雨列数量
     * @returns {number} 活动数字雨列数量
     */
    getActiveCount() {
        return this.rainColumns.filter(column => column.active).length;
    }

    /**
     * 渲染所有数字雨
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isEnabled) return;

        // 增加混合模式，使数字雨效果更好
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // 渲染所有活动数字雨列
        for (const column of this.rainColumns) {
            if (column.active) {
                column.render(ctx);
            }
        }

        ctx.restore();
    }
} 