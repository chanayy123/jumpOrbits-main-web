/**
 * 主题管理器
 * 管理游戏中的主题设置和应用
 */
import { BASE_CONFIG } from './config.js';
import logger from './logger.js';
import { ColorStrategy } from './color-strategy.js';

class ThemeManager {
    constructor() {
        // 当前应用的主题
        this.currentTheme = null;
        // 可用主题列表
        this.themes = {};
        // 默认主题
        this.defaultTheme = 'starsky';
        // 用于存储主题变更回调函数
        this.themeChangeCallbacks = [];
        // 初始化本地存储键
        this.storageKey = 'jumpOrbits_theme';
        // 轨道系统引用
        this.trackSystem = null;
    }

    /**
     * 初始化主题管理器
     */
    init() {
        // 注册默认主题
        this.registerDefaultThemes();
        // 从本地存储中加载主题设置
        this.loadSavedTheme();
        return this;
    }

    /**
     * 设置轨道系统引用
     * @param {Object} trackSystem - 轨道系统实例
     */
    setTrackSystem(trackSystem) {
        this.trackSystem = trackSystem;
        return this;
    }

    /**
     * 注册默认主题
     */
    registerDefaultThemes() {
        // 星空主题
        this.registerTheme('starsky', {
            name: '星空',
            background: '#040c24',
            backgroundGradient: {
                type: 'radial',
                colors: ['#0a205a', '#030019'],
                colorStops: [0.2, 0.9]
            },
            player: '#a6e1fa', // 蓝白色，类似中子星
            platform: {
                baseColor: '#3454df', // 深蓝色，类似海王星
                style: 'normal',
                width: 1.2,
                glowIntensity: 0.8
            },
            obstacle: {
                baseColor: '#e27b58', // 红色/橙红色，类似火星
                pulseEffect: true,
                pulseSpeed: 0.7
            },
            powerup: '#9966cc', // 紫色，类似星云色彩
            text: '#ffffff',
            scoreBoard: 'rgba(3, 9, 32, 0.75)',
            uiBackground: 'rgba(3, 0, 25, 0.85)',
            uiText: '#ffffff',
            uiButton: '#3454df',
            uiButtonHover: '#4b6aa3',
            specialTrackColor: {
                hue: 58, // 土星的金黄色
                saturation: 80,
                lightness: 60
            },
            colorStrategy: 'cosmic', // 自定义宇宙颜色策略，需要在ColorStrategy中添加
            particleSystem: {
                baseSize: 2.5,
                speedMultiplier: 1.1,
                glow: true
            }
        });

        // 轻快主题
        this.registerTheme('light', {
            name: '轻盈',
            background: '#f8f9fa',
            backgroundGradient: {
                type: 'linear',
                colors: ['#f8f9fa', '#e9ecef'],
                colorStops: [0.0, 1.0]
            },
            player: '#5390d9',
            platform: {
                baseColor: '#d90429',
                style: 'dotted',
                width: 0.8
            },
            obstacle: {
                baseColor: '#fb8500',
                pulseEffect: false
            },
            powerup: '#2a9d8f',
            text: '#212529',
            scoreBoard: 'rgba(240, 240, 245, 0.8)',
            uiBackground: 'rgba(255, 255, 255, 0.95)',
            uiPanelBg: 'rgba(248, 249, 250, 0.95)',
            uiMenuOverlay: 'rgba(255, 255, 255, 0.6)',
            uiText: '#212529',
            uiButton: '#3a86ff',
            uiButtonHover: '#4895ff',
            uiBorder: 'rgba(0, 0, 0, 0.1)',
            uiGlowColor: 'rgba(58, 134, 255, 0.3)',
            specialTrackColor: {
                hue: 210, // 蓝色的色相
                saturation: 70,
                lightness: 60
            },
            colorStrategy: 'triadic',
            particleSystem: {
                baseSize: 1.8,
                speedMultiplier: 0.9,
                glow: true
            },
            effects: {
                bubbles: true, // 气泡效果
                feathers: true // 羽毛效果
            }
        });

        // 赛博朋克主题
        this.registerTheme('cyberpunk', {
            name: '赛博朋克',
            background: '#0f0e17',
            backgroundGradient: {
                type: 'radial',
                colors: ['#1a1025', '#0f0e17', '#060412'],
                colorStops: [0.0, 0.5, 1.0]
            },
            player: '#ff8906',
            platform: {
                baseColor: '#e53170',
                style: 'neon',
                width: 1.5,
                glowIntensity: 1.0
            },
            obstacle: {
                baseColor: '#7f5af0',
                pulseEffect: true,
                pulseSpeed: 1.0
            },
            powerup: '#2cb67d',
            text: '#fffffe',
            scoreBoard: 'rgba(15, 14, 23, 0.8)',
            uiBackground: 'rgba(20, 20, 30, 0.9)',
            uiText: '#fffffe',
            uiButton: '#7f5af0',
            uiButtonHover: '#9050ff',
            specialTrackColor: {
                hue: 300, // 品红色的色相
                saturation: 90,
                lightness: 60
            },
            colorStrategy: 'splitComplementary',
            particleSystem: {
                baseSize: 3.0,
                speedMultiplier: 1.5,
                glow: true
            },
            effects: {
                neonLights: true,   // 霓虹灯特效
                digitalRain: true,  // 数字雨特效
                circuits: true      // 电路特效
            }
        });

        // 森林主题
        this.registerTheme('forest', {
            name: '森林',
            background: '#344e41',
            backgroundGradient: {
                type: 'linear',
                colors: ['#344e41', '#2b3b2f'],
                colorStops: [0.0, 1.0]
            },
            player: '#a3b18a',
            platform: {
                baseColor: '#588157',
                style: 'normal',
                width: 1.1
            },
            obstacle: {
                baseColor: '#bc6c25',
                pulseEffect: false
            },
            powerup: '#dad7cd',
            text: '#dad7cd',
            scoreBoard: 'rgba(52, 78, 65, 0.8)',
            uiBackground: 'rgba(60, 90, 75, 0.9)',
            uiText: '#dad7cd',
            uiButton: '#588157',
            uiButtonHover: '#6b9b6c',
            specialTrackColor: {
                hue: 120, // 绿色的色相
                saturation: 50,
                lightness: 70
            },
            colorStrategy: 'analogous',
            particleSystem: {
                baseSize: 2.2,
                speedMultiplier: 0.8
            }
        });

        // 日出主题
        this.registerTheme('sunrise', {
            name: '日出',
            background: '#003459',
            backgroundGradient: {
                type: 'linear',
                colors: ['#00A8E8', '#007EA7', '#003459'],
                colorStops: [0.0, 0.4, 1.0]
            },
            player: '#FF9E00',
            platform: {
                baseColor: '#DB504A',
                style: 'normal',
                width: 1.0
            },
            obstacle: {
                baseColor: '#F15946',
                pulseEffect: true,
                pulseSpeed: 1.0
            },
            powerup: '#FFCF56',
            text: '#ffffff',
            scoreBoard: 'rgba(0, 52, 89, 0.7)',
            uiBackground: 'rgba(0, 126, 167, 0.8)',
            uiText: '#ffffff',
            uiButton: '#00A8E8',
            uiButtonHover: '#00B5FF',
            specialTrackColor: {
                hue: 40, // 橙色的色相
                saturation: 100,
                lightness: 60
            },
            colorStrategy: 'tetradic',
            particleSystem: {
                baseSize: 2.4,
                speedMultiplier: 1.1
            }
        });
    }

    /**
     * 注册一个新主题
     * @param {string} id - 主题标识符
     * @param {Object} theme - 主题配置对象
     */
    registerTheme(id, theme) {
        if (!theme.name) {
            theme.name = id.charAt(0).toUpperCase() + id.slice(1);
        }
        this.themes[id] = theme;
        return this;
    }

    /**
     * 获取所有可用主题
     * @returns {Object} 主题对象
     */
    getThemes() {
        return this.themes;
    }

    /**
     * 获取特定主题
     * @param {string} id - 主题标识符
     * @returns {Object|null} 主题对象或null
     */
    getTheme(id) {
        return this.themes[id] || null;
    }

    /**
     * 获取当前主题
     * @returns {Object|null} 当前主题对象
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * 应用主题
     * @param {string} id - 主题标识符
     * @returns {boolean} 是否成功应用主题
     */
    applyTheme(id) {
        const theme = this.getTheme(id);
        if (!theme) {
            logger.warn(`主题 "${id}" 不存在，使用默认主题 "${this.defaultTheme}"`);
            id = this.defaultTheme;
        }

        // 如果主题已经应用，不需要重复应用
        if (this.currentTheme === theme) {
            return false;
        }

        this.currentTheme = theme;
        this.saveTheme(id);

        // 更新UI颜色
        this.updateUiColors(id);

        // 通知主题变更
        this.notifyThemeChange(id, theme);

        return true;
    }

    /**
     * 转换驼峰命名为短横线命名
     * @param {string} str - 驼峰命名字符串
     * @returns {string} 短横线命名字符串
     */
    kebabCase(str) {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    }

    /**
     * 保存主题设置到本地存储
     * @param {string} id - 主题标识符
     */
    saveTheme(id) {
        try {
            localStorage.setItem(this.storageKey, id);
        } catch (e) {
            logger.warn('无法保存主题设置:', e);
        }
    }

    /**
     * 从本地存储加载主题设置
     */
    loadSavedTheme() {
        try {
            const savedTheme = localStorage.getItem(this.storageKey) || this.defaultTheme;
            this.applyTheme(savedTheme);
        } catch (e) {
            logger.warn('无法加载保存的主题设置:', e);
        }
    }

    /**
     * 获取随机背景颜色
     * @returns {string} 颜色值
     */
    getRandomBackgroundColor() {
        // 如果有当前主题，使用当前主题的背景颜色
        if (this.currentTheme && this.currentTheme.background) {
            return this.currentTheme.background;
        }

        // 如果没有当前主题，从所有主题中随机选择一个背景颜色
        const allThemes = Object.values(this.themes);
        if (allThemes.length === 0) {
            // 如果没有任何主题，返回默认颜色
            return '#1a1a2e';
        }

        // 随机选择一个主题
        const randomTheme = allThemes[Math.floor(Math.random() * allThemes.length)];
        return randomTheme.background || '#1a1a2e';
    }

    /**
     * 获取当前主题的背景渐变配置
     * @returns {Object|null} 背景渐变配置
     */
    getBackgroundGradient() {
        if (this.currentTheme && this.currentTheme.backgroundGradient) {
            return this.currentTheme.backgroundGradient;
        }
        return null;
    }

    /**
     * 生成背景渐变色数组
     * @param {string} startColor - 起始颜色（十六进制）
     * @param {string} endColor - 结束颜色（十六进制）
     * @param {number} steps - 生成的颜色数量
     * @returns {Array} 颜色数组
     */
    generateBackgroundGradientColors(startColor, endColor, progress = 0) {
        // 提取起始颜色的RGB值
        const startRGB = this.extractRGBFromColor(startColor);
        // 提取结束颜色的RGB值
        const endRGB = this.extractRGBFromColor(endColor);

        // 确保进度值在0到1之间
        const clampedProgress = Math.min(Math.max(progress, 0), 1);

        // 计算当前进度下的RGB值
        const r = Math.round(startRGB.r + (endRGB.r - startRGB.r) * clampedProgress);
        const g = Math.round(startRGB.g + (endRGB.g - startRGB.g) * clampedProgress);
        const b = Math.round(startRGB.b + (endRGB.b - startRGB.b) * clampedProgress);

        // 转换为十六进制
        return '#' +
            r.toString(16).padStart(2, '0') +
            g.toString(16).padStart(2, '0') +
            b.toString(16).padStart(2, '0');
    }

    /**
     * 根据玩家跳跃深度获取背景渐变配置
     * @param {number} depth - 玩家跳跃深度（从外向内的圈数）
     * @returns {Object|null} 背景渐变配置
     */
    getBackgroundGradientByDepth(depth) {
        const baseGradient = this.getBackgroundGradient();
        if (!baseGradient) return null;

        // 创建渐变配置的深拷贝
        const newGradient = {
            type: baseGradient.type,
            colorStops: baseGradient.colorStops ? [...baseGradient.colorStops] : null
        };

        // 获取当前主题ID
        const currentThemeId = this.getCurrentThemeId();

        // 从配置中获取当前主题的颜色配置
        const colorConfig = BASE_CONFIG.THEME_COLORS.GRADIENT[currentThemeId] || BASE_CONFIG.THEME_COLORS.GRADIENT['starsky'];

        // 生成颜色数组
        const gradientColors = [];
        for (let i = 0; i < colorConfig.startColors.length; i++) {
            const startColor = colorConfig.startColors[i];
            const endColor = colorConfig.endColors[i];
            gradientColors.push(this.generateBackgroundGradientColors(startColor, endColor, depth / (BASE_CONFIG.THEME_COLORS.GRADIENT_STEPS - 1)));
        }

        // 从每个颜色数组中选择对应深度的颜色
        newGradient.colors = gradientColors;

        return newGradient;
    }

    /**
     * 获取当前主题ID
     * @returns {string} 当前主题ID，如果未设置则返回默认主题ID
     */
    getCurrentThemeId() {
        // 遍历主题列表，查找当前主题
        for (const [id, theme] of Object.entries(this.themes)) {
            if (theme === this.currentTheme) {
                return id;
            }
        }
        return this.defaultTheme;
    }

    /**
     * 获取指定圈层的轨道颜色
     * @param {number} circle - 轨道圈层（从外向内计数）
     * @returns {Object} 包含 hue, saturation, lightness 的颜色对象
     */
    getTrackColorForLayer(circle) {
        // 如果没有当前主题，返回默认颜色
        if (!this.currentTheme) {
            // 返回默认的HSL颜色对象
            return {
                hue: Math.random() * 360, // 随机色相
                saturation: 70,
                lightness: 50
            };
        }

        // 特殊轨道颜色处理
        // 使用isSpecialTrackCircle方法判断是否为特殊轨道
        if (this.currentTheme.specialTrackColor && this.isSpecialTrackCircle(circle)) {
            return this.currentTheme.specialTrackColor;
        }

        // 为不同圈层生成不同的颜色
        // 使用主题的基础色相，但根据圈层调整亮度和饱和度
        let baseHue = 0;

        // 从主题中提取基础色相
        if (this.currentTheme.player) {
            if (typeof this.currentTheme.player === 'string') {
                baseHue = this.extractHueFromColor(this.currentTheme.player);
            } else if (this.currentTheme.player.baseColor) {
                baseHue = this.extractHueFromColor(this.currentTheme.player.baseColor);
            }
        } else if (this.currentTheme.platform) {
            if (typeof this.currentTheme.platform === 'string') {
                baseHue = this.extractHueFromColor(this.currentTheme.platform);
            } else if (this.currentTheme.platform.baseColor) {
                baseHue = this.extractHueFromColor(this.currentTheme.platform.baseColor);
            }
        } else {
            baseHue = Math.random() * 360; // 随机色相作为后备
        }

        // 使用颜色策略生成器
        const colorStrategy = new ColorStrategy(baseHue);

        // 获取当前主题的颜色策略类型，默认为类似色
        const strategyType = this.currentTheme.colorStrategy || 'analogous';

        // 获取对应圈层的色相
        const hue = colorStrategy.getHueForLayer(circle, strategyType);

        // 获取光度和饱和度
        const lightness = colorStrategy.getLightnessForLayer(circle, 35, 70, strategyType);
        const saturation = colorStrategy.getSaturationForLayer(circle, 70, strategyType);

        return {
            hue,
            saturation,
            lightness
        };
    }

    /**
     * 从颜色值中提取色相
     * @param {string} color - 颜色值（支持十六进制和rgb格式）
     * @returns {number} 色相值（0-360）
     */
    extractHueFromColor(color) {
        // 处理十六进制颜色
        if (color.startsWith('#')) {
            return this.extractHueFromHex(color);
        }
        // 处理rgb或rgba颜色
        else if (color.startsWith('rgb')) {
            return this.extractHueFromRgb(color);
        }
        // 默认返回随机色相
        return Math.random() * 360;
    }

    /**
     * 从十六进制颜色中提取色相
     * @param {string} hexColor - 十六进制颜色值
     * @returns {number} 色相值（0-360）
     */
    extractHueFromHex(hexColor) {
        // 移除#号
        const hex = hexColor.replace('#', '');
        // 转换为RGB
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;

        return this.rgbToHue(r, g, b);
    }

    /**
     * 从RGB颜色中提取色相
     * @param {string} rgbColor - RGB或RGBA颜色字符串
     * @returns {number} 色相值（0-360）
     */
    extractHueFromRgb(rgbColor) {
        // 匹配rgb或rgba颜色中的数值
        const matches = rgbColor.match(/\d+/g);
        if (!matches || matches.length < 3) {
            return Math.random() * 360;
        }

        const r = parseInt(matches[0]) / 255;
        const g = parseInt(matches[1]) / 255;
        const b = parseInt(matches[2]) / 255;

        return this.rgbToHue(r, g, b);
    }

    /**
     * 将RGB值转换为色相
     * @param {number} r - 红色分量（0-1）
     * @param {number} g - 绿色分量（0-1）
     * @param {number} b - 蓝色分量（0-1）
     * @returns {number} 色相值（0-360）
     */
    rgbToHue(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let hue = 0;

        if (max === min) {
            hue = 0; // 灰色没有色相
        } else {
            const d = max - min;
            switch (max) {
                case r:
                    hue = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    hue = (b - r) / d + 2;
                    break;
                case b:
                    hue = (r - g) / d + 4;
                    break;
            }
            hue *= 60;
        }

        return hue;
    }

    /**
     * 检查指定圈层是否是特殊轨道
     * @param {number} circle - 轨道圈层（从外向内计数）
     * @returns {boolean} 是否为特殊轨道
     */
    isSpecialTrackCircle(circle) {
        // 如果已设置轨道系统，优先使用轨道系统的判断方法
        if (this.trackSystem && typeof this.trackSystem.isSpecialCircle === 'function') {
            return this.trackSystem.isSpecialCircle(circle);
        }

        // 如果没有设置轨道系统，使用备用方法（与原来的逻辑相同）
        // 从配置获取安全区域轨道数量
        const safeAreaCircles = BASE_CONFIG.SAFE_TRACK_COUNT || 3;
        if (circle <= safeAreaCircles) {
            return false;
        }

        // 计算第一个特殊轨道的位置 = 安全区轨道数量 + 1 + 特殊轨道间隔(10)
        const specialTrackInterval = BASE_CONFIG.SPECIAL_TRACK_INTERVAL || 10;
        const firstSpecialTrackCircle = safeAreaCircles + 1 + specialTrackInterval;

        // 检查是否为第一个特殊轨道
        if (circle === firstSpecialTrackCircle) return true;

        // 计算与第一个特殊轨道的差距
        const diff = circle - firstSpecialTrackCircle;

        // 特殊轨道的位置规律是：第一个特殊轨道 + n*(间隔+1)
        const intervalPlusOne = specialTrackInterval + 1;
        return diff > 0 && diff % intervalPlusOne === 0;
    }

    /**
     * 添加主题变更回调
     * @param {Function} callback - 回调函数，接收主题id和主题对象作为参数
     */
    onThemeChange(callback) {
        if (typeof callback === 'function') {
            this.themeChangeCallbacks.push(callback);
        }
        return this;
    }

    /**
     * 添加主题变更监听器（onThemeChange的别名）
     * @param {Function} callback - 回调函数，接收主题对象作为参数
     * @returns {ThemeManager} 主题管理器实例，便于链式调用
     */
    addThemeChangedListener(callback) {
        return this.onThemeChange(callback);
    }

    /**
     * 通知所有注册的回调主题已变更
     * @param {string} id - 主题标识符
     * @param {Object} theme - 主题对象
     */
    notifyThemeChange(id, theme) {
        this.themeChangeCallbacks.forEach(callback => {
            try {
                callback(id, theme);
            } catch (e) {
                logger.error('主题变更回调执行错误:', e);
            }
        });
    }

    /**
     * 将RGB颜色转换为HSL
     * @param {number} r - 红色分量 (0-255)
     * @param {number} g - 绿色分量 (0-255)
     * @param {number} b - 蓝色分量 (0-255)
     * @returns {Object} HSL颜色对象 {h: 色相(0-360), s: 饱和度(0-100), l: 亮度(0-100)}
     */
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }

            h /= 6;
        }

        return {
            h: h * 360,
            s: s * 100,
            l: l * 100
        };
    }

    /**
     * 将HSL颜色转换为RGB
     * @param {number} h - 色相 (0-360)
     * @param {number} s - 饱和度 (0-100)
     * @param {number} l - 亮度 (0-100)
     * @returns {Object} RGB颜色对象 {r: 红(0-255), g: 绿(0-255), b: 蓝(0-255)}
     */
    hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return {
            r: r * 255,
            g: g * 255,
            b: b * 255
        };
    }

    /**
     * 从颜色字符串中提取RGB值
     * @param {string} color - CSS颜色字符串
     * @returns {Object} RGB颜色对象 {r, g, b}
     */
    extractRGBFromColor(color) {
        if (color.startsWith('#')) {
            // 处理十六进制颜色
            const hex = color.replace('#', '');
            return {
                r: parseInt(hex.substr(0, 2), 16),
                g: parseInt(hex.substr(2, 2), 16),
                b: parseInt(hex.substr(4, 2), 16)
            };
        } else if (color.startsWith('rgb')) {
            // 处理rgb/rgba颜色
            const matches = color.match(/\d+/g);
            if (matches && matches.length >= 3) {
                return {
                    r: parseInt(matches[0]),
                    g: parseInt(matches[1]),
                    b: parseInt(matches[2])
                };
            }
        }
        // 默认返回黑色
        return { r: 0, g: 0, b: 0 };
    }

    /**
     * 更新UI CSS变量，使界面颜色与当前主题匹配
     * @param {string} id - 主题ID
     */
    updateUiColors(id) {
        const theme = this.getTheme(id) || this.getTheme(this.defaultTheme);
        if (!theme) return;

        // 获取根元素
        const root = document.documentElement;

        // 设置UI主要颜色
        const primaryColorStr = theme.uiButton || theme.platform.baseColor || '#3454df';
        root.style.setProperty('--ui-primary', primaryColorStr);

        // 设置UI强调色
        const accentColorStr = theme.uiButtonHover || theme.powerup || theme.obstacle.baseColor || '#ff3a5e';
        root.style.setProperty('--ui-accent', accentColorStr);

        // 设置UI背景色
        const bgColor = theme.uiBackground || 'rgba(10, 12, 25, 0.85)';
        root.style.setProperty('--ui-background', bgColor);

        // 设置面板背景色
        const panelBg = theme.uiPanelBg || theme.uiBackground || 'rgba(20, 20, 35, 0.95)';
        root.style.setProperty('--ui-panel-bg', panelBg);

        // 设置菜单遮罩背景
        const menuOverlay = theme.uiMenuOverlay || 'rgba(0, 0, 0, 0.4)';
        root.style.setProperty('--ui-menu-overlay', menuOverlay);

        // 设置UI文字颜色
        root.style.setProperty('--ui-text', theme.uiText || '#ffffff');

        // 设置UI边框颜色
        const borderColor = theme.uiBorder || 'rgba(255, 255, 255, 0.2)';
        root.style.setProperty('--ui-border', borderColor);

        // 设置UI光晕颜色
        let glowColor;
        if (theme.uiGlowColor) {
            glowColor = theme.uiGlowColor;
        } else {
            const primaryColor = this.parseColorToRGBA(primaryColorStr);
            glowColor = `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, 0.6)`;
        }
        root.style.setProperty('--ui-glow', glowColor);

        const intenseGlowColor = theme.uiGlowColorIntense || glowColor.replace('0.6', '0.8');
        root.style.setProperty('--ui-glow-intense', intenseGlowColor);

        // 按钮背景色
        root.style.setProperty('--ui-button-bg', theme.uiButtonBg || 'rgba(30, 30, 50, 0.7)');
        root.style.setProperty('--ui-button-hover', theme.uiButtonHover || '#4b6aa3');
    }

    /**
     * 解析各种颜色格式为RGBA对象
     * @param {string} color - 颜色值
     * @returns {Object} 包含r, g, b, a值的对象
     */
    parseColorToRGBA(color) {
        if (color.startsWith('#')) {
            return this.parseHexToRGBA(color);
        } else if (color.startsWith('rgb')) {
            const matches = color.match(/\d+(\.\d+)?/g);
            if (matches && matches.length >= 3) {
                return {
                    r: parseInt(matches[0]),
                    g: parseInt(matches[1]),
                    b: parseInt(matches[2]),
                    a: matches[3] ? parseFloat(matches[3]) : 1
                };
            }
        }
        return { r: 52, g: 84, b: 223, a: 1 }; // 默认返回蓝色
    }

    /**
     * 解析十六进制颜色为RGBA对象
     * @param {string} hex - 十六进制颜色值
     * @returns {Object} 包含r, g, b, a值的对象
     */
    parseHexToRGBA(hex) {
        // 去除井号
        hex = hex.replace('#', '');

        // 处理简写形式（#RGB）
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        // 解析RGB值
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;

        return { r, g, b, a };
    }
}

// 导出主题管理器类
export { ThemeManager }; 