/**
 * 日出主题特效系统
 * 整合日出主题的所有视觉特效
 */
import logger from '../utils/logger.js';
import { SunSystem } from './sun-system.js';
import { CloudSystem } from './cloud-system.js';
import { GAME_CONFIG } from '../utils/config.js';

/**
 * 日出效果系统类
 * 协调管理日出主题的所有特效
 */
export class SunriseEffectSystem {
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

        // 创建太阳系统
        this.sunSystem = new SunSystem({
            maxGlows: this.getMaxGlows(),
            maxBeams: this.getMaxBeams()
        });

        // 创建云彩系统
        this.cloudSystem = new CloudSystem({
            maxClouds: this.getMaxClouds(),
            cloudInterval: this.getCloudInterval() // 动态调整云生成间隔
        });

        logger.debug('SunriseEffectSystem: 初始化完成');
    }

    /**
     * 根据性能模式获取最大光晕数量
     * @returns {number} 光晕数量
     */
    getMaxGlows() {
        switch (this.performanceMode) {
            case 'low': return 2;
            case 'medium': return 3;
            default: return 4;
        }
    }

    /**
     * 根据性能模式获取最大光束数量
     * @returns {number} 光束数量
     */
    getMaxBeams() {
        switch (this.performanceMode) {
            case 'low': return 8;
            case 'medium': return 16;
            default: return 24;
        }
    }

    /**
     * 根据性能模式获取最大云彩数量
     * @returns {number} 云彩数量
     */
    getMaxClouds() {
        switch (this.performanceMode) {
            case 'low': return 2;    // 低性能模式下只显示2朵云
            case 'medium': return 4; // 中等性能模式下显示4朵云
            default: return 6;       // 高性能模式下最多显示6朵云
        }
    }

    /**
     * 根据性能模式获取云朵生成间隔
     * @returns {number} 间隔时间(毫秒)
     */
    getCloudInterval() {
        switch (this.performanceMode) {
            case 'low': return 6000;    // 低性能模式下6秒生成一朵云
            case 'medium': return 5000; // 中等性能模式下5秒生成一朵云
            default: return 4000;       // 高性能模式下4秒生成一朵云
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
        this.sunSystem.enable(width, height);
        this.cloudSystem.enable(width, height);

        // 重置性能调整计时器
        this.fpsAdjustTime = Date.now() + this.fpsCheckInterval;

        logger.debug('SunriseEffectSystem: 已启用');
    }

    /**
     * 禁用效果系统
     */
    disable() {
        if (!this.isEnabled) return;

        this.isEnabled = false;

        // 禁用子系统
        this.sunSystem.disable();
        this.cloudSystem.disable();

        logger.debug('SunriseEffectSystem: 已禁用');
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
        this.sunSystem.resize(width, height);
        this.cloudSystem.resize(width, height);
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
        this.sunSystem.updateGlowsPool(this.getMaxGlows());
        this.sunSystem.updateBeamsPool(this.getMaxBeams());
        this.cloudSystem.updatePoolSize(this.getMaxClouds());
    }

    /**
     * 设置性能模式
     * @param {string} mode - 性能模式('low', 'medium', 'high')
     */
    setPerformanceMode(mode) {
        if (this.performanceMode === mode) return;
        this.performanceMode = mode;

        // 更新云彩系统的配置
        if (this.cloudSystem) {
            this.cloudSystem.cloudInterval = this.getCloudInterval();
        }

        logger.debug(`SunriseEffectSystem: 性能模式设置为 ${mode}`);
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
        this.sunSystem.update(currentTime);
        this.cloudSystem.update(currentTime);
    }

    /**
     * 渲染特效
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.isEnabled) return;

        // 先渲染太阳（在底层）
        this.sunSystem.render(ctx, currentTime);

        // 再渲染云彩（在顶层）
        this.cloudSystem.render(ctx, currentTime);
    }
} 