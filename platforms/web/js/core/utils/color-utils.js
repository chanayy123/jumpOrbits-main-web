/**
 * 颜色工具类
 * 提供颜色格式转换和处理的工具函数
 */
import { BASE_CONFIG } from './config.js';

export class ColorUtils {
    /**
     * 从颜色字符串中提取RGB值
     * @param {string} color - 颜色字符串（支持十六进制和rgb/rgba格式）
     * @returns {{r: number, g: number, b: number}} RGB颜色值对象
     */
    static extractRGB(color) {
        let r = 255, g = 215, b = 0; // 默认金色

        if (color.startsWith('#')) {
            // 处理十六进制颜色
            const hex = color.substring(1);
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        } else if (color.startsWith('rgb')) {
            // 处理rgb/rgba颜色
            const matches = color.match(/\d+/g);
            if (matches && matches.length >= 3) {
                r = parseInt(matches[0]);
                g = parseInt(matches[1]);
                b = parseInt(matches[2]);
            }
        }

        return { r, g, b };
    }

    /**
     * 创建带有透明度的颜色字符串
     * @param {string} color - 原始颜色
     * @param {number} alpha - 透明度（0-1）
     * @returns {string} rgba颜色字符串
     */
    static withAlpha(color, alpha) {
        const { r, g, b } = this.extractRGB(color);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * 根据深度计算背景颜色
     * @param {string} baseColor - 基础颜色
     * @param {number} depth - 当前深度（从0开始）
     * @param {number} maxDepth - 最大深度
     * @returns {string} 计算后的颜色
     */
    static calculateBackgroundColor(baseColor, depth, maxDepth) {
        const { h, s, l } = this.rgbToHsl(this.extractRGB(baseColor));
        const config = BASE_CONFIG.BACKGROUND;

        // 随着深度增加，降低亮度，增加饱和度
        const depthRatio = depth / maxDepth;
        const newL = config.MAX_LIGHTNESS - (depthRatio * (config.MAX_LIGHTNESS - config.MIN_LIGHTNESS));
        const newS = config.MIN_SATURATION + (depthRatio * (config.MAX_SATURATION - config.MIN_SATURATION));

        // 色相也随深度略微变化，但变化较小
        const hueShift = (depth / maxDepth) * config.HUE_SHIFT_RANGE;
        let newH = h + hueShift;
        if (newH > 360) newH -= 360;

        return this.hslToRgbString(newH, newS, newL);
    }

    /**
     * RGB转HSL
     * @param {{r: number, g: number, b: number}} rgb - RGB颜色对象
     * @returns {{h: number, s: number, l: number}} HSL颜色对象
     */
    static rgbToHsl({ r, g, b }) {
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
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }

            h *= 60;
        }

        return { h, s, l };
    }

    /**
     * HSL转RGB字符串
     * @param {number} h - 色相 (0-360)
     * @param {number} s - 饱和度 (0-1)
     * @param {number} l - 亮度 (0-1)
     * @returns {string} RGB颜色字符串
     */
    static hslToRgbString(h, s, l) {
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

            r = hue2rgb(p, q, (h / 360) + 1 / 3);
            g = hue2rgb(p, q, h / 360);
            b = hue2rgb(p, q, (h / 360) - 1 / 3);
        }

        return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    }
} 