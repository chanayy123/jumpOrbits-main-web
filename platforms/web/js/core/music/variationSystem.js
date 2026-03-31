/**
 * 简谱变奏系统 - 为重复播放的简谱提供变化效果
 */
import { AUDIO_CONSTANTS } from '../utils/constants.js';
import logger from '../utils/logger.js';

class VariationSystem {
    constructor() {
        // 变奏类型（从常量获取）
        this.VARIATION_TYPES = AUDIO_CONSTANTS.VARIATION_TYPES;

        // 默认配置
        this.config = {
            enabled: true,                  // 是否启用变奏
            variationOnLoop: true,          // 是否在每次循环时应用变奏
            activeVariations: [             // 启用的变奏类型
                this.VARIATION_TYPES.KEY_SHIFT,
                this.VARIATION_TYPES.TEMPO_CHANGE
            ],

            // 各变奏类型的具体参数
            keyShiftRange: [-2, 2],         // 调性变化范围（半音数）
            tempoFactorRange: [0.9, 1.1],   // 速度变化因子范围
            timbreOptions: AUDIO_CONSTANTS.WAVEFORM_OPTIONS, // 可用音色
            octaveShiftRange: [-1, 1]       // 八度变化范围
        };

        // 当前应用的变奏
        this.currentVariation = {
            keyShift: 0,
            tempoFactor: 1,
            timbre: 'sine',
            octaveShift: 0
        };
    }

    /**
     * 配置变奏系统
     * @param {Object} options - 配置选项
     */
    configure(options) {
        this.config = { ...this.config, ...options };
        logger.debug('变奏系统配置已更新:', this.config);
    }

    /**
     * 生成新的变奏
     * @returns {Object} 变奏参数对象
     */
    generateVariation() {
        if (!this.config.enabled) {
            return this.currentVariation;
        }

        try {
            const newVariation = { ...this.currentVariation };

            // 确保currentVariation包含所有必要的属性
            if (!newVariation.keyShift && newVariation.keyShift !== 0) newVariation.keyShift = 0;
            if (!newVariation.tempoFactor && newVariation.tempoFactor !== 0) newVariation.tempoFactor = 1;
            if (!newVariation.timbre) newVariation.timbre = 'sine';
            if (!newVariation.octaveShift && newVariation.octaveShift !== 0) newVariation.octaveShift = 0;

            // 为每个启用的变奏类型生成新的参数
            if (Array.isArray(this.config.activeVariations)) {
                this.config.activeVariations.forEach(type => {
                    switch (type) {
                        case this.VARIATION_TYPES.KEY_SHIFT:
                            // 在指定范围内随机生成调性变化
                            if (Array.isArray(this.config.keyShiftRange) && this.config.keyShiftRange.length >= 2) {
                                newVariation.keyShift = this.getRandomInt(
                                    this.config.keyShiftRange[0],
                                    this.config.keyShiftRange[1]
                                );
                            }
                            break;

                        case this.VARIATION_TYPES.TEMPO_CHANGE:
                            // 生成速度变化因子
                            if (Array.isArray(this.config.tempoFactorRange) && this.config.tempoFactorRange.length >= 2) {
                                newVariation.tempoFactor = this.getRandomFloat(
                                    this.config.tempoFactorRange[0],
                                    this.config.tempoFactorRange[1]
                                );
                            }
                            break;

                        case this.VARIATION_TYPES.TIMBRE_CHANGE:
                            // 随机选择音色
                            if (Array.isArray(this.config.timbreOptions) && this.config.timbreOptions.length > 0) {
                                newVariation.timbre = this.getRandomElement(this.config.timbreOptions);
                            }
                            break;

                        case this.VARIATION_TYPES.OCTAVE_SHIFT:
                            // 生成八度变化
                            if (Array.isArray(this.config.octaveShiftRange) && this.config.octaveShiftRange.length >= 2) {
                                newVariation.octaveShift = this.getRandomInt(
                                    this.config.octaveShiftRange[0],
                                    this.config.octaveShiftRange[1]
                                );
                            }
                            break;
                    }
                });
            }

            this.currentVariation = newVariation;
            logger.debug('已生成新的变奏:', newVariation);
            return newVariation;
        } catch (e) {
            logger.error('生成变奏时发生错误:', e);
            // 发生错误时返回默认变奏
            const defaultVariation = {
                keyShift: 0,
                tempoFactor: 1,
                timbre: 'sine',
                octaveShift: 0
            };
            this.currentVariation = defaultVariation;
            return defaultVariation;
        }
    }

    /**
     * 应用变奏到音符频率
     * @param {number} baseFrequency - 基准频率
     * @returns {number} 变奏后的频率
     */
    applyToFrequency(baseFrequency) {
        // 应用调性变化和八度变化
        let frequency = baseFrequency;

        // 调性变化 (每半音相差约5.9%的频率)
        if (this.currentVariation.keyShift !== 0) {
            frequency *= Math.pow(2, this.currentVariation.keyShift / 12);
        }

        // 八度变化 (每八度相差一倍频率)
        if (this.currentVariation.octaveShift !== 0) {
            frequency *= Math.pow(2, this.currentVariation.octaveShift);
        }

        return frequency;
    }

    /**
     * 获取当前变奏后的音色
     * @returns {string} 音色名称
     */
    getTimbre() {
        return this.currentVariation.timbre;
    }

    /**
     * 获取速度变化因子
     * @returns {number} 速度变化因子
     */
    getTempoFactor() {
        return this.currentVariation.tempoFactor;
    }

    /**
     * 生成指定范围内的随机整数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 随机整数
     */
    getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * 生成指定范围内的随机浮点数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 随机浮点数
     */
    getRandomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * 从数组中随机选择一个元素
     * @param {Array} array - 数组
     * @returns {*} 随机选中的元素
     */
    getRandomElement(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * 重置变奏
     */
    resetVariation() {
        this.currentVariation = {
            keyShift: 0,
            tempoFactor: 1,
            timbre: 'sine',
            octaveShift: 0
        };
    }
}

export default VariationSystem; 