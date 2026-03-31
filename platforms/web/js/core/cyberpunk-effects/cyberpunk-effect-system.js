/**
 * 赛博朋克主题特效系统
 * 整合赛博朋克主题的所有视觉特效
 */
import logger from '../utils/logger.js';
import { NeonSystem } from './neon-system.js';
import { DigitalRainSystem } from './digital-rain-system.js';
import { CircuitSystem } from './circuit-system.js';
import { GAME_CONFIG } from '../utils/config.js';

/**
 * 赛博朋克效果系统类
 * 协调管理赛博朋克主题的所有特效
 */
export class CyberpunkEffectSystem {
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

        // 创建霓虹灯系统
        this.neonSystem = new NeonSystem({
            maxNeonLights: this.getMaxNeonLights(),
            neonInterval: 2000 // 每2秒尝试生成一个新霓虹灯
        });

        // 创建数字雨系统
        this.digitalRainSystem = new DigitalRainSystem({
            maxRainColumns: this.getMaxRainColumns(),
            columnInterval: 500 // 每0.5秒尝试生成一列新数字雨
        });

        // 创建电路系统
        this.circuitSystem = new CircuitSystem({
            maxCircuits: this.getMaxCircuits(),
            circuitInterval: 3000 // 每3秒尝试生成一条新电路
        });

        logger.debug('CyberpunkEffectSystem: 初始化完成');
    }

    /**
     * 根据性能模式获取最大霓虹灯数量
     * @returns {number} 霓虹灯数量
     */
    getMaxNeonLights() {
        switch (this.performanceMode) {
            case 'low': return 5;
            case 'medium': return 10;
            default: return 15;
        }
    }

    /**
     * 根据性能模式获取最大数字雨列数
     * @returns {number} 数字雨列数
     */
    getMaxRainColumns() {
        switch (this.performanceMode) {
            case 'low': return 10;
            case 'medium': return 20;
            default: return 30;
        }
    }

    /**
     * 根据性能模式获取最大电路数量
     * @returns {number} 电路数量
     */
    getMaxCircuits() {
        switch (this.performanceMode) {
            case 'low': return 3;
            case 'medium': return 6;
            default: return 8;
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
        this.neonSystem.enable(width, height);
        this.digitalRainSystem.enable(width, height);
        this.circuitSystem.enable(width, height);

        logger.debug('CyberpunkEffectSystem: 已启用');
    }

    /**
     * 禁用效果系统
     */
    disable() {
        if (!this.isEnabled) return;

        this.isEnabled = false;

        // 禁用子系统
        this.neonSystem.disable();
        this.digitalRainSystem.disable();
        this.circuitSystem.disable();

        logger.debug('CyberpunkEffectSystem: 已禁用');
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
        this.neonSystem.resize(width, height);
        this.digitalRainSystem.resize(width, height);
        this.circuitSystem.resize(width, height);
    }

    /**
     * 根据性能调整效果参数
     * @param {number} currentFps - 当前帧率
     */
    adjustForPerformance(currentFps) {
        if (!this.isEnabled) return;

        // 如果帧率低于目标帧率的85%，则减少特效数量
        if (currentFps < this.fpsTarget * 0.85) {
            if (this.performanceMode === 'high') {
                this.performanceMode = 'medium';
                logger.debug(`CyberpunkEffectSystem: 性能优化 - 降低特效 (FPS: ${currentFps}), 模式: high -> medium`);
            } else if (this.performanceMode === 'medium') {
                this.performanceMode = 'low';
                logger.debug(`CyberpunkEffectSystem: 性能优化 - 降低特效 (FPS: ${currentFps}), 模式: medium -> low`);
            }

            // 更新各子系统的参数
            this.neonSystem.updatePoolSize(this.getMaxNeonLights());
            this.digitalRainSystem.updatePoolSize(this.getMaxRainColumns());
            this.circuitSystem.updatePoolSize(this.getMaxCircuits());
        }
        // 如果帧率高于目标帧率的95%且特效数量低于初始设置，则增加特效数量
        else if (currentFps > this.fpsTarget * 0.95) {
            if (this.performanceMode === 'low') {
                this.performanceMode = 'medium';
                logger.debug(`CyberpunkEffectSystem: 性能优化 - 增加特效 (FPS: ${currentFps}), 模式: low -> medium`);
            } else if (this.performanceMode === 'medium' && currentFps > this.fpsTarget * 1.1) {
                this.performanceMode = 'high';
                logger.debug(`CyberpunkEffectSystem: 性能优化 - 增加特效 (FPS: ${currentFps}), 模式: medium -> high`);
            }

            // 更新各子系统的参数
            this.neonSystem.updatePoolSize(this.getMaxNeonLights());
            this.digitalRainSystem.updatePoolSize(this.getMaxRainColumns());
            this.circuitSystem.updatePoolSize(this.getMaxCircuits());
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
        this.neonSystem.update(currentTime);
        this.digitalRainSystem.update(currentTime);
        this.circuitSystem.update(currentTime);
    }

    /**
     * 渲染特效
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} currentTime - 当前时间戳
     */
    render(ctx, currentTime) {
        if (!this.isEnabled) return;

        // 按层次渲染各系统
        // 先渲染电路（在底层）
        this.circuitSystem.render(ctx, currentTime);

        // 再渲染数字雨（中层）
        this.digitalRainSystem.render(ctx, currentTime);

        // 最后渲染霓虹灯（顶层）
        this.neonSystem.render(ctx, currentTime);
    }
} 