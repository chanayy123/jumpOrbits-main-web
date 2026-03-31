/**
 * 性能面板UI组件
 * 显示FPS和其他性能相关指标
 */
import { GAME_CONFIG } from '../utils/config.js';
import logger from '../utils/logger.js';

export class PerformancePanel {
    constructor(game) {
        this.game = game;
        this.visible = GAME_CONFIG.DEV.SHOW_FPS;

        // 性能统计
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdateTime = 0;
        this.fpsUpdateInterval = 500; // 每500ms更新一次FPS

        // 渲染统计
        this.renderTime = 0;
        this.updateTime = 0;
        this.maxRenderTime = 0;
        this.maxUpdateTime = 0;

        // 对象统计
        this.trackCount = 0;
        this.obstacleCount = 0;
        this.particleCount = 0;

        // 创建UI元素
        this.createUI();

        logger.debug('性能面板已初始化');
    }

    /**
     * 创建UI元素
     */
    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'performance-panel';
        this.container.className = 'performance-panel';
        document.body.appendChild(this.container);

        // 设置样式
        this.container.style.position = 'absolute';
        this.container.style.top = '10px';
        this.container.style.left = '10px';
        this.container.style.padding = '5px 10px';
        this.container.style.background = 'rgba(0, 0, 0, 0.5)';
        this.container.style.color = '#fff';
        this.container.style.fontFamily = 'monospace';
        this.container.style.fontSize = '12px';
        this.container.style.zIndex = '1000';
        this.container.style.borderRadius = '4px';
        this.container.style.display = this.visible ? 'block' : 'none';

        // 创建FPS显示
        this.fpsDisplay = document.createElement('div');
        this.fpsDisplay.textContent = 'FPS: --';
        this.container.appendChild(this.fpsDisplay);

        // 创建渲染时间显示
        this.renderTimeDisplay = document.createElement('div');
        this.renderTimeDisplay.textContent = '渲染: --ms | 更新: --ms';
        this.container.appendChild(this.renderTimeDisplay);

        // 创建对象统计显示
        this.objectStatsDisplay = document.createElement('div');
        this.objectStatsDisplay.textContent = '轨道: -- | 障碍物: -- | 粒子: --';
        this.container.appendChild(this.objectStatsDisplay);
    }

    /**
     * 更新性能统计
     * @param {number} timestamp - 当前时间戳
     */
    update(timestamp) {
        if (!this.visible) return;

        // 更新帧计数
        this.frameCount++;

        // 每隔指定时间更新FPS显示
        if (timestamp - this.lastFpsUpdateTime >= this.fpsUpdateInterval) {
            // 计算FPS
            this.fps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdateTime));

            // 收集对象统计数据
            this.collectObjectStats();

            // 更新显示
            this.updateDisplay();

            // 重置计数器
            this.frameCount = 0;
            this.lastFpsUpdateTime = timestamp;
        }
    }

    /**
     * 收集对象统计数据
     */
    collectObjectStats() {
        if (!this.game || !this.game.trackSystem) return;

        // 收集轨道数量
        this.trackCount = this.game.trackSystem.tracks ? this.game.trackSystem.tracks.length : 0;

        // 收集障碍物数量
        this.obstacleCount = 0;
        if (this.game.trackSystem.tracks) {
            this.game.trackSystem.tracks.forEach(track => {
                if (track.obstacles) {
                    this.obstacleCount += track.obstacles.length;
                }
            });
        }

        // 收集粒子数量
        this.particleCount = 0;
        if (this.game.trackSystem.tracks) {
            this.game.trackSystem.tracks.forEach(track => {
                if (track.particleSystem) {
                    this.particleCount += track.particleSystem.activeCount || 0;
                }
            });
        }
    }

    /**
     * 开始计时（用于测量渲染和更新时间）
     * @param {string} type - 计时类型（'render'或'update'）
     */
    startTiming(type) {
        if (!this.visible) return;
        this[`${type}StartTime`] = performance.now();
    }

    /**
     * 结束计时
     * @param {string} type - 计时类型（'render'或'update'）
     */
    endTiming(type) {
        if (!this.visible) return;
        if (!this[`${type}StartTime`]) return;

        const time = performance.now() - this[`${type}StartTime`];
        this[`${type}Time`] = time;

        // 更新最大值
        if (time > this[`max${type.charAt(0).toUpperCase() + type.slice(1)}Time`]) {
            this[`max${type.charAt(0).toUpperCase() + type.slice(1)}Time`] = time;
        }
    }

    /**
     * 更新显示
     */
    updateDisplay() {
        if (!this.visible) return;

        // 更新FPS显示
        this.fpsDisplay.textContent = `FPS: ${this.fps}`;

        // 更新渲染时间显示
        this.renderTimeDisplay.textContent =
            `渲染: ${this.renderTime.toFixed(1)}ms | 更新: ${this.updateTime.toFixed(1)}ms`;

        // 更新对象统计显示
        this.objectStatsDisplay.textContent =
            `轨道: ${this.trackCount} | 障碍物: ${this.obstacleCount} | 粒子: ${this.particleCount}`;
    }

    /**
     * 切换面板显示状态
     */
    toggle() {
        this.visible = !this.visible;
        this.container.style.display = this.visible ? 'block' : 'none';
        logger.debug(`性能面板已${this.visible ? '显示' : '隐藏'}`);
    }

    /**
     * 设置面板可见性
     * @param {boolean} visible - 是否可见
     */
    setVisible(visible) {
        this.visible = visible;
        this.container.style.display = this.visible ? 'block' : 'none';
    }

    /**
     * 更新对象统计数据
     * @param {Object} stats - 对象统计数据
     */
    updateObjectStats(stats) {
        if (!this.visible) return;

        this.trackCount = stats.trackCount || 0;
        this.obstacleCount = stats.obstacleCount || 0;
        this.particleCount = stats.particleCount || 0;

        // 立即更新显示
        this.objectStatsDisplay.textContent =
            `轨道: ${this.trackCount} | 障碍物: ${this.obstacleCount} | 粒子: ${this.particleCount}`;
    }
}
