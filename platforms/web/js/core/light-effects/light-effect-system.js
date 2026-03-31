/**
 * 轻盈主题特效系统
 * 整合轻盈主题的所有视觉特效
 */
import logger from '../utils/logger.js';
import { BubbleSystem } from './bubble-system.js';
import { FeatherSystem } from './feather-system.js';
import { GAME_CONFIG } from '../utils/config.js';

/**
 * 轻盈效果系统类
 * 协调管理轻盈主题的所有特效
 */
export class LightEffectSystem {
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

        // 性能配置
        this.performanceMode = GAME_CONFIG.PERFORMANCE_MODE || 'high';
        this.fpsTarget = options.fpsTarget || 60;
        this.fpsAdjustTime = 0;
        this.fpsCheckInterval = 5000; // 每5秒检查一次性能

        // 创建气泡系统
        this.bubbleSystem = new BubbleSystem({
            maxBubbles: this.getMaxBubbles(),
            bubbleInterval: 800 // 每0.8秒尝试生成一个新气泡
        });

        // 创建羽毛系统
        this.featherSystem = new FeatherSystem({
            maxFeathers: this.getMaxFeathers(),
            featherInterval: 2000 // 每2秒尝试生成一根新羽毛
        });

        logger.debug('LightEffectSystem: 初始化完成');
    }

    /**
     * 根据性能模式获取最大气泡数量
     * @returns {number} 气泡数量
     */
    getMaxBubbles() {
        switch (this.performanceMode) {
            case 'low': return 8;
            case 'medium': return 15;
            default: return 25;
        }
    }

    /**
     * 根据性能模式获取最大羽毛数量
     * @returns {number} 羽毛数量
     */
    getMaxFeathers() {
        switch (this.performanceMode) {
            case 'low': return 5;
            case 'medium': return 10;
            default: return 15;
        }
    }

    /**
     * 启用效果系统
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    enable(width, height) {
        if (this.isEnabled) return;

        this.isEnabled = true;
        this.resize(width, height);

        // 启用子系统
        this.bubbleSystem.enable(width, height);
        this.featherSystem.enable(width, height);

        logger.debug('LightEffectSystem: 已启用');
    }

    /**
     * 禁用效果系统
     */
    disable() {
        if (!this.isEnabled) return;

        this.isEnabled = false;

        // 禁用子系统
        this.bubbleSystem.disable();
        this.featherSystem.disable();

        logger.debug('LightEffectSystem: 已禁用');
    }

    /**
     * 调整尺寸
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     */
    resize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;

        // 调整子系统尺寸
        this.bubbleSystem.resize(width, height);
        this.featherSystem.resize(width, height);
    }

    /**
     * 根据性能调整效果参数
     * @param {number} currentFps - 当前帧率
     */
    adjustForPerformance(currentFps) {
        if (!this.isEnabled) return;

        // 如果帧率低于目标帧率的85%，则减少特效数量
        if (currentFps < this.fpsTarget * 0.85) {
            const currentBubbles = this.bubbleSystem.maxBubbles;
            const currentFeathers = this.featherSystem.maxFeathers;

            // 减少10%
            const newBubbles = Math.max(5, Math.floor(currentBubbles * 0.9));
            const newFeathers = Math.max(3, Math.floor(currentFeathers * 0.9));

            this.bubbleSystem.updatePoolSize(newBubbles);
            this.featherSystem.updatePoolSize(newFeathers);

            logger.debug(`LightEffectSystem: 性能优化 - 减少特效 (FPS: ${currentFps}), 气泡: ${currentBubbles} -> ${newBubbles}, 羽毛: ${currentFeathers} -> ${newFeathers}`);
        }
        // 如果帧率高于目标帧率的95%且特效数量低于初始设置，则增加特效数量
        else if (currentFps > this.fpsTarget * 0.95) {
            const currentBubbles = this.bubbleSystem.maxBubbles;
            const currentFeathers = this.featherSystem.maxFeathers;
            const maxBubbles = this.getMaxBubbles();
            const maxFeathers = this.getMaxFeathers();

            if (currentBubbles < maxBubbles || currentFeathers < maxFeathers) {
                // 增加5%，但不超过最大值
                const newBubbles = Math.min(maxBubbles, Math.floor(currentBubbles * 1.05));
                const newFeathers = Math.min(maxFeathers, Math.floor(currentFeathers * 1.05));

                this.bubbleSystem.updatePoolSize(newBubbles);
                this.featherSystem.updatePoolSize(newFeathers);

                logger.debug(`LightEffectSystem: 性能优化 - 增加特效 (FPS: ${currentFps}), 气泡: ${currentBubbles} -> ${newBubbles}, 羽毛: ${currentFeathers} -> ${newFeathers}`);
            }
        }
    }

    /**
     * 更新系统状态
     * @param {number} currentTime - 当前时间戳
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     * @param {number} currentFps - 当前帧率
     */
    update(currentTime, width, height, currentFps) {
        if (!this.isEnabled) return;

        // 性能动态调整
        if (currentTime >= this.fpsAdjustTime) {
            this.adjustForPerformance(currentFps);
            this.fpsAdjustTime = currentTime + this.fpsCheckInterval;
        }

        // 更新画布尺寸（如果有变化）
        if (this.canvasWidth !== width || this.canvasHeight !== height) {
            this.resize(width, height);
        }

        // 更新子系统
        this.bubbleSystem.update(currentTime);
        this.featherSystem.update(currentTime);
    }

    /**
     * 渲染特效
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.isEnabled) return;

        // 渲染子系统
        this.bubbleSystem.render(ctx, currentTime);
        this.featherSystem.render(ctx, currentTime);
    }
} 