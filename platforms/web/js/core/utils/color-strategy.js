/**
 * 颜色策略生成器
 * 基于色彩理论提供多种颜色方案生成策略
 */
export class ColorStrategy {
    /**
     * 构造函数
     * @param {number} baseHue - 基础色相 (0-360)
     */
    constructor(baseHue) {
        this.baseHue = baseHue;
    }

    /**
     * 获取互补色
     * @returns {number} 互补色色相
     */
    getComplementary() {
        return (this.baseHue + 180) % 360;
    }

    /**
     * 获取三元色
     * @returns {Array<number>} 三个等距色相
     */
    getTriadic() {
        return [
            this.baseHue,
            (this.baseHue + 120) % 360,
            (this.baseHue + 240) % 360
        ];
    }

    /**
     * 获取分裂互补色
     * @returns {Array<number>} 基础色相和两个邻近于互补色的色相
     */
    getSplitComplementary() {
        return [
            this.baseHue,
            (this.baseHue + 150) % 360,
            (this.baseHue + 210) % 360
        ];
    }

    /**
     * 获取四元色
     * @returns {Array<number>} 四个等距色相
     */
    getTetradic() {
        return [
            this.baseHue,
            (this.baseHue + 90) % 360,
            (this.baseHue + 180) % 360,
            (this.baseHue + 270) % 360
        ];
    }

    /**
     * 获取类似色
     * @param {number} range - 色相变化范围 (默认30)
     * @param {number} steps - 步数 (默认5)
     * @returns {Array<number>} 一系列相近色相
     */
    getAnalogous(range = 30, steps = 5) {
        const colors = [];
        const stepSize = range / (steps - 1);
        const start = this.baseHue - range / 2;

        for (let i = 0; i < steps; i++) {
            let hue = (start + stepSize * i) % 360;
            if (hue < 0) hue += 360;
            colors.push(hue);
        }

        return colors;
    }

    /**
     * 基于指定策略和圈层获取色相值
     * @param {number} layer - 圈层数 (从外向内)
     * @param {string} strategy - 色彩策略 ('analogous', 'complementary', 'triadic', 'splitComplementary', 'tetradic', 'rainbow', 'cosmic')
     * @returns {number} 色相值 (0-360)
     */
    getHueForLayer(layer, strategy = 'analogous') {
        switch (strategy) {
            case 'complementary':
                return layer % 2 === 0 ? this.baseHue : this.getComplementary();

            case 'triadic': {
                const triadicColors = this.getTriadic();
                return triadicColors[layer % triadicColors.length];
            }

            case 'splitComplementary': {
                const splitColors = this.getSplitComplementary();
                return splitColors[layer % splitColors.length];
            }

            case 'tetradic': {
                const tetradicColors = this.getTetradic();
                return tetradicColors[layer % tetradicColors.length];
            }

            case 'rainbow':
                // 彩虹模式，完整覆盖色相环
                return (this.baseHue + layer * 30) % 360;

            case 'cosmic': {
                // 宇宙天体色彩策略，基于太阳系行星和宇宙天体的特征颜色
                const cosmicHues = [
                    240, // 深蓝/海王星色
                    200, // 青色/天王星色
                    58,  // 土星黄色
                    36,  // 木星橙色
                    16,  // 火星红色
                    195, // 地球蓝色
                    45,  // 金星黄色
                    28,  // 水星褐色
                    290, // 星云紫色
                    220, // 星云青色
                    330, // 星云粉色
                    0    // 深红色
                ];
                return cosmicHues[layer % cosmicHues.length];
            }

            case 'analogous':
            default: {
                // 类似色，基于基础色相的微小变化
                const range = 40; // 色相变化范围
                let hue = (this.baseHue + (layer * range / 10) % range - (range / 2)) % 360;
                if (hue < 0) hue += 360;
                return hue;
            }
        }
    }

    /**
     * 生成非线性的亮度值
     * @param {number} layer - 圈层数 (从外向内)
     * @param {number} minLightness - 最小亮度值
     * @param {number} maxLightness - 最大亮度值
     * @param {string} strategy - 色彩策略
     * @returns {number} 亮度值 (0-100)
     */
    getLightnessForLayer(layer, minLightness = 35, maxLightness = 70, strategy = 'analogous') {
        // 宇宙主题的特别处理
        if (strategy === 'cosmic') {
            // 太阳系和宇宙天体的亮度变化
            const index = layer % 8;
            if (index === 0) return 30; // 深色星体亮度低
            if (index === 1) return 60; // 亮色恒星亮度高
            if (index === 2) return 45; // 行星中等亮度
            if (index === 3) return 55; // 较亮行星
            if (index === 4) return 40; // 较暗行星
            if (index === 5) return 50; // 中等行星
            if (index === 6) return 45; // 中等行星
            return 35; // 暗色小行星
        }

        const lightnessRange = maxLightness - minLightness;

        // 对于深层次轨道，限制最大圈层为15来计算基础亮度
        const baseProgress = Math.min(layer, 15) / 15;
        const baseLightness = minLightness + lightnessRange * baseProgress;

        // 添加波形变化，创造更丰富的明暗变化
        const phase = (layer % 12) / 12 * Math.PI * 2;
        const waveLightness = Math.sin(phase) * 10;

        // 确保最终亮度在有效范围内
        return Math.max(minLightness, Math.min(maxLightness, baseLightness + waveLightness));
    }

    /**
     * 生成非线性的饱和度值
     * @param {number} layer - 圈层数 (从外向内)
     * @param {number} baseSaturation - 基础饱和度
     * @param {string} strategy - 色彩策略
     * @returns {number} 饱和度值 (0-100)
     */
    getSaturationForLayer(layer, baseSaturation = 70, strategy = 'analogous') {
        // 宇宙主题的特别处理
        if (strategy === 'cosmic') {
            // 宇宙天体的饱和度通常比较高，但有些星体如中子星和黑洞周围物质色彩较淡
            const index = layer % 6;
            if (index === 0) return 85; // 深色星体饱和度高
            if (index === 1) return 70; // 中等饱和度
            if (index === 2) return 90; // 高饱和度行星
            if (index === 3) return 65; // 较低饱和度
            if (index === 4) return 80; // 星云高饱和度
            return 75; // 默认值
        }

        // 添加波形变化，让饱和度产生周期性变化
        const phase = (layer % 9) / 9 * Math.PI * 2;
        const waveSaturation = Math.cos(phase) * 15;

        // 确保饱和度在有效范围内
        return Math.max(40, Math.min(100, baseSaturation + waveSaturation));
    }
} 