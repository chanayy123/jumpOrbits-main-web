/**
 * 森林主题特效系统
 * 整合森林主题的所有视觉特效
 */
import logger from '../utils/logger.js';
import { LeafSystem } from './leaf-system.js';
import { FireflySystem } from './firefly-system.js';
import { LightSpotSystem } from './light-spot-system.js';
import { GAME_CONFIG } from '../utils/config.js';

/**
 * 森林效果系统类
 * 协调管理森林主题的所有特效
 */
export class ForestEffectSystem {
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

        // 创建落叶系统
        this.leafSystem = new LeafSystem({
            maxLeaves: this.getMaxLeaves(),
            leafInterval: 1000 // 每1秒尝试生成一片新叶子
        });

        // 创建萤火虫系统
        this.fireflySystem = new FireflySystem({
            maxFireflies: this.getMaxFireflies(),
            fireflyInterval: 1500 // 每1.5秒尝试生成一只新萤火虫
        });

        // 创建光斑系统
        this.lightSpotSystem = new LightSpotSystem({
            maxSpots: this.getMaxLightSpots(),
        });

        logger.debug('ForestEffectSystem: 初始化完成');
    }

    /**
     * 根据性能模式获取最大叶子数量
     * @returns {number} 最大叶子数量
     */
    getMaxLeaves() {
        switch (this.performanceMode) {
            case 'low':
                return 8; // 低性能模式
            case 'medium':
                return 15; // 中性能模式
            case 'high':
            default:
                return 20; // 高性能模式
        }
    }

    /**
     * 根据性能模式获取最大萤火虫数量
     * @returns {number} 最大萤火虫数量
     */
    getMaxFireflies() {
        switch (this.performanceMode) {
            case 'low':
                return 10; // 低性能模式
            case 'medium':
                return 17; // 中性能模式
            case 'high':
            default:
                return 25; // 高性能模式
        }
    }

    /**
     * 根据性能模式获取最大光斑数量
     * @returns {number} 最大光斑数量
     */
    getMaxLightSpots() {
        switch (this.performanceMode) {
            case 'low':
                return 5; // 低性能模式
            case 'medium':
                return 8; // 中性能模式
            case 'high':
            default:
                return 12; // 高性能模式
        }
    }

    /**
     * 启用系统
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    enable(width, height) {
        if (this.isEnabled) return;

        this.isEnabled = true;
        this.canvasWidth = width;
        this.canvasHeight = height;

        // 启用子系统
        this.leafSystem.enable(width, height);
        this.fireflySystem.enable(width, height);
        this.lightSpotSystem.enable(width, height);

        // 重置性能调整计时器
        this.fpsAdjustTime = Date.now() + this.fpsCheckInterval;

        logger.debug('ForestEffectSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        if (!this.isEnabled) return;

        this.isEnabled = false;

        // 禁用子系统
        this.leafSystem.disable();
        this.fireflySystem.disable();
        this.lightSpotSystem.disable();

        logger.debug('ForestEffectSystem: 已禁用');
    }

    /**
     * 调整画布尺寸
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     */
    resize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;

        // 调整子系统尺寸
        this.leafSystem.resize(width, height);
        this.fireflySystem.resize(width, height);
        this.lightSpotSystem.resize(width, height);
    }

    /**
     * 设置性能模式
     * @param {string} mode - 性能模式 ('low', 'medium', 'high')
     */
    setPerformanceMode(mode) {
        if (this.performanceMode === mode) return;

        this.performanceMode = mode;
        logger.debug(`ForestEffectSystem: 性能模式设置为 ${mode}`);

        // 重新调整子系统
        this.adjustForPerformance();
    }

    /**
     * 根据性能调整特效强度
     * @param {number} currentFps - 当前帧率
     */
    adjustForPerformance(currentFps) {
        // 如果提供了当前帧率，则根据帧率动态调整
        if (currentFps) {
            // 帧率太低，降低特效强度
            if (currentFps < this.fpsTarget - 10) {
                if (this.performanceMode === 'high') {
                    this.setPerformanceMode('medium');
                } else if (this.performanceMode === 'medium') {
                    this.setPerformanceMode('low');
                }
            }
            // 帧率充足，可以考虑增加特效强度
            else if (currentFps > this.fpsTarget + 5 && this.performanceMode !== 'high') {
                if (this.performanceMode === 'low') {
                    this.setPerformanceMode('medium');
                } else if (this.performanceMode === 'medium') {
                    this.setPerformanceMode('high');
                }
            }
        }

        // 根据当前性能模式调整子系统
        // 调整落叶系统
        const targetLeaves = this.getMaxLeaves();
        if (this.leafSystem.maxLeaves !== targetLeaves) {
            this.leafSystem.maxLeaves = targetLeaves;
        }

        // 调整萤火虫系统
        const targetFireflies = this.getMaxFireflies();
        if (this.fireflySystem.maxFireflies !== targetFireflies) {
            this.fireflySystem.maxFireflies = targetFireflies;
        }

        // 调整光斑系统
        const targetLightSpots = this.getMaxLightSpots();
        if (this.lightSpotSystem.maxSpots !== targetLightSpots) {
            this.lightSpotSystem.maxSpots = targetLightSpots;
            if (this.isEnabled) {
                this.lightSpotSystem.createLightSpots(); // 重新创建光斑
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
        this.leafSystem.update(currentTime);
        this.fireflySystem.update(currentTime);
        this.lightSpotSystem.update(currentTime);
    }

    /**
     * 渲染特效
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.isEnabled) return;

        // 先渲染光斑（在底层）
        this.lightSpotSystem.render(ctx, currentTime);

        // 再渲染萤火虫
        this.fireflySystem.render(ctx, currentTime);

        // 最后渲染落叶（在最上层）
        this.leafSystem.render(ctx, currentTime);
    }
} 