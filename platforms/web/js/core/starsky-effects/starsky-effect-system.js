/**
 * 星空主题特效系统
 * 整合星空主题的所有视觉特效
 */
import logger from '../utils/logger.js';
import { MeteorSystem } from '../meteor-system.js';
import { StarSystem } from '../star-system.js';
import { GAME_CONFIG } from '../utils/config.js';

/**
 * 星空效果系统类
 * 协调管理星空主题的所有特效
 */
export class StarSkyEffectSystem {
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

        // 初始化流星系统
        this.meteorSystem = new MeteorSystem({
            poolSize: this.getMaxMeteors(),     // 流星池大小
            spawnInterval: 5000,                // 每5秒检查一次是否生成新流星
            spawnChance: this.getMeteorChance() // 生成概率
        });

        // 初始化星星系统
        this.starSystem = new StarSystem({
            starCount: this.getStarCount()      // 星星数量
        });

        logger.debug('StarSkyEffectSystem: 初始化完成');
    }

    /**
     * 根据性能模式获取最大流星数量
     * @returns {number} 最大流星数量
     */
    getMaxMeteors() {
        switch (this.performanceMode) {
            case 'low':
                return 5; // 低性能模式
            case 'medium':
                return 8; // 中性能模式
            case 'high':
            default:
                return 10; // 高性能模式
        }
    }

    /**
     * 根据性能模式获取流星生成概率
     * @returns {number} 流星生成概率
     */
    getMeteorChance() {
        switch (this.performanceMode) {
            case 'low':
                return 0.2; // 低性能模式，20%概率
            case 'medium':
                return 0.3; // 中性能模式，30%概率
            case 'high':
            default:
                return 0.4; // 高性能模式，40%概率
        }
    }

    /**
     * 根据性能模式获取星星数量
     * @returns {number} 星星数量
     */
    getStarCount() {
        switch (this.performanceMode) {
            case 'low':
                return 50; // 低性能模式
            case 'medium':
                return 65; // 中性能模式
            case 'high':
            default:
                return 80; // 高性能模式
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
        this.meteorSystem.enable();
        this.starSystem.enable(width, height);

        // 重置性能调整计时器
        this.fpsAdjustTime = Date.now() + this.fpsCheckInterval;

        logger.debug('StarSkyEffectSystem: 已启用');
    }

    /**
     * 禁用系统
     */
    disable() {
        if (!this.isEnabled) return;

        this.isEnabled = false;

        // 禁用子系统
        this.meteorSystem.disable();
        this.starSystem.disable();

        logger.debug('StarSkyEffectSystem: 已禁用');
    }

    /**
     * 调整画布尺寸
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     */
    resize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;

        // 调整星星系统尺寸
        if (this.starSystem) {
            this.starSystem.resetPositions(width, height);
        }
    }

    /**
     * 设置性能模式
     * @param {string} mode - 性能模式 ('low', 'medium', 'high')
     */
    setPerformanceMode(mode) {
        if (this.performanceMode === mode) return;

        this.performanceMode = mode;
        logger.debug(`StarSkyEffectSystem: 性能模式设置为 ${mode}`);

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
        if (this.meteorSystem) {
            // 调整流星系统
            this.meteorSystem.poolSize = this.getMaxMeteors();
            this.meteorSystem.spawnChance = this.getMeteorChance();
        }

        if (this.starSystem) {
            // 调整星星系统
            const newStarCount = this.getStarCount();
            if (this.starSystem.stars.length !== newStarCount) {
                this.starSystem.resize(newStarCount);
                if (this.isEnabled) {
                    this.starSystem.resetPositions(this.canvasWidth, this.canvasHeight);
                }
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
        if (this.meteorSystem) {
            this.meteorSystem.update(currentTime, width, height);
        }

        if (this.starSystem) {
            this.starSystem.update(currentTime);
        }
    }

    /**
     * 渲染特效
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.isEnabled) return;

        // 先渲染星星（作为背景）
        if (this.starSystem) {
            this.starSystem.render(ctx, currentTime);
        }

        // 再渲染流星
        if (this.meteorSystem) {
            this.meteorSystem.render(ctx, currentTime);
        }
    }
} 