/**
 * 主题特效系统
 * 根据不同主题提供相应的视觉特效
 */
import logger from './utils/logger.js';

/**
 * 主题特效系统类
 * 用于管理和切换不同主题下的特效
 */
export class ThemeEffectSystem {
    /**
     * 构造函数
     * @param {HTMLCanvasElement} canvas - 游戏画布
     * @param {Object} themeManager - 主题管理器
     */
    constructor(canvas, themeManager) {
        this.canvas = canvas;
        this.themeManager = themeManager;
        this.currentThemeId = null;

        // 存储各主题的特效系统
        this.effectSystems = new Map();

        // 注册主题变更监听器
        this.themeManager.addThemeChangedListener(this.onThemeChanged.bind(this));

        logger.debug('ThemeEffectSystem: 初始化完成');
    }

    /**
     * 注册主题特效
     * @param {string} themeId - 主题ID
     * @param {Object} effectSystem - 特效系统实例
     */
    registerEffectSystem(themeId, effectSystem) {
        this.effectSystems.set(themeId, effectSystem);
        logger.debug(`ThemeEffectSystem: 已注册主题 "${themeId}" 的特效系统`);

        // 如果是当前主题，立即启用
        const currentTheme = this.themeManager.getCurrentTheme();
        if (currentTheme && themeId === this.getCurrentThemeId()) {
            this.enableEffectSystem(themeId);
        }

        return this;
    }

    /**
     * 获取当前主题ID
     * @returns {string|null} 当前主题ID
     */
    getCurrentThemeId() {
        const currentTheme = this.themeManager.getCurrentTheme();

        // 遍历themes找到当前主题的ID
        if (currentTheme) {
            const themes = this.themeManager.getThemes();
            for (const [id, theme] of Object.entries(themes)) {
                if (theme === currentTheme) {
                    return id;
                }
            }
        }

        return null;
    }

    /**
     * 主题变更处理函数
     * @param {string} themeId - 新主题ID
     */
    onThemeChanged(themeId) {
        logger.debug(`ThemeEffectSystem: 主题变更为 "${themeId}"`);

        // 禁用所有特效
        this.disableAllEffects();

        // 启用新主题的特效
        this.enableEffectSystem(themeId);

        // 记录当前主题ID
        this.currentThemeId = themeId;
    }

    /**
     * 启用指定主题的特效系统
     * @param {string} themeId - 主题ID
     */
    enableEffectSystem(themeId) {
        const effectSystem = this.effectSystems.get(themeId);
        if (effectSystem) {
            effectSystem.enable(this.canvas.width, this.canvas.height);
            logger.debug(`ThemeEffectSystem: 已启用主题 "${themeId}" 的特效系统`);
        }
    }

    /**
     * 禁用所有特效系统
     */
    disableAllEffects() {
        this.effectSystems.forEach((system, themeId) => {
            system.disable();
            logger.debug(`ThemeEffectSystem: 已禁用主题 "${themeId}" 的特效系统`);
        });
    }

    /**
     * 更新特效
     * @param {number} currentTime - 当前时间戳
     * @param {number} currentFps - 当前帧率
     */
    update(currentTime, currentFps) {
        const currentThemeId = this.getCurrentThemeId();
        if (!currentThemeId) return;

        const effectSystem = this.effectSystems.get(currentThemeId);
        if (effectSystem && effectSystem.isEnabled) {
            effectSystem.update(currentTime, this.canvas.width, this.canvas.height, currentFps);
        }
    }

    /**
     * 渲染特效
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        const currentThemeId = this.getCurrentThemeId();
        if (!currentThemeId) return;

        const effectSystem = this.effectSystems.get(currentThemeId);
        if (effectSystem && effectSystem.isEnabled) {
            effectSystem.render(ctx, Date.now());
        }
    }

    /**
     * 画布尺寸变化处理
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     */
    handleCanvasResize(width, height) {
        const currentThemeId = this.getCurrentThemeId();
        if (!currentThemeId) return;

        const effectSystem = this.effectSystems.get(currentThemeId);
        if (effectSystem && effectSystem.isEnabled && typeof effectSystem.resize === 'function') {
            effectSystem.resize(width, height);
        }
    }
} 