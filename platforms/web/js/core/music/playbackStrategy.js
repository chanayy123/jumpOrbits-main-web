/**
 * 简谱播放策略 - 管理简谱播放完成后的行为
 */
import { AUDIO_CONSTANTS } from '../utils/constants.js';
import logger from '../utils/logger.js';

class PlaybackStrategy {
    constructor() {
        // 播放策略模式（从常量获取）
        this.MODES = AUDIO_CONSTANTS.PLAYBACK_MODES;

        // 默认配置
        this.config = {
            mode: this.MODES.SMART_MIX,     // 默认使用智能混合模式
            loopCount: 2,                   // 在智能混合模式下，每首简谱默认重复次数
            fadeTransition: true,           // 在切换简谱时使用淡入淡出效果
            transitionTime: 2000,           // 切换过渡时间(毫秒)
            currentCategory: null           // 当前选择的分类
        };

        // 智能模式状态
        this.playCount = 0;               // 当前简谱已播放次数

        // 分类顺序播放状态
        this.currentCategoryIndex = -1;   // 当前分类中的索引位置
    }

    /**
     * 配置播放策略
     * @param {Object} options - 配置选项
     */
    configure(options) {
        // 如果更改了当前分类，重置分类内索引
        if (options && options.currentCategory !== undefined &&
            options.currentCategory !== this.config.currentCategory) {
            this.currentCategoryIndex = -1;
        }

        this.config = { ...this.config, ...options };
        logger.debug('播放策略已更新:', this.config);
    }

    /**
     * 处理简谱播放完成事件
     * @param {Object} context - 播放上下文信息
     * @returns {Object} 处理结果，包含动作和参数
     */
    handleMelodyComplete(context) {
        const { currentMelodyId, availableMelodies, melodyManager } = context;

        // 根据当前模式确定下一步动作
        switch (this.config.mode) {
            case this.MODES.LOOP_CURRENT:
                return { action: 'replay', melodyId: currentMelodyId };

            case this.MODES.AUTO_NEXT:
                return this.selectNextMelody(currentMelodyId, availableMelodies);

            case this.MODES.SMART_MIX:
                this.playCount++;

                // 检查是否达到重复次数上限
                if (this.playCount >= this.config.loopCount) {
                    this.playCount = 0; // 重置计数器
                    return this.selectNextMelody(currentMelodyId, availableMelodies);
                } else {
                    return { action: 'replay', melodyId: currentMelodyId };
                }

            case this.MODES.CATEGORY_SEQUENCE:
                // 如果没有设置分类，回退到普通的下一首逻辑
                if (!this.config.currentCategory || !melodyManager) {
                    return this.selectNextMelody(currentMelodyId, availableMelodies);
                }

                // 获取当前分类的简谱列表
                const categoryMelodies = melodyManager.getMelodiesByCategory(this.config.currentCategory);

                if (categoryMelodies.length === 0) {
                    logger.warn(`当前分类 ${this.config.currentCategory} 没有可用的简谱`);
                    return { action: 'replay', melodyId: currentMelodyId };
                }

                // 找到当前简谱在分类中的位置
                const currentIndexInCategory = categoryMelodies.indexOf(currentMelodyId);

                // 如果当前简谱不在该分类中，或者是第一次播放（索引为-1）
                if (currentIndexInCategory === -1) {
                    this.currentCategoryIndex = 0; // 从分类的第一首开始
                } else {
                    // 否则选择分类中的下一首
                    this.currentCategoryIndex = (currentIndexInCategory + 1) % categoryMelodies.length;
                }

                // 返回分类中的下一首简谱
                return {
                    action: 'switchTo',
                    melodyId: categoryMelodies[this.currentCategoryIndex],
                    transition: this.config.fadeTransition,
                    transitionTime: this.config.transitionTime
                };

            default:
                logger.warn('未知的播放策略模式:', this.config.mode);
                return { action: 'replay', melodyId: currentMelodyId };
        }
    }

    /**
     * 选择下一首简谱
     * @param {string} currentMelodyId - 当前简谱ID
     * @param {Array} availableMelodies - 可用简谱ID列表
     * @returns {Object} 包含下一首简谱信息的动作对象
     */
    selectNextMelody(currentMelodyId, availableMelodies) {
        if (!availableMelodies || availableMelodies.length <= 1) {
            return { action: 'replay', melodyId: currentMelodyId };
        }

        // 找到当前简谱的索引
        const currentIndex = availableMelodies.indexOf(currentMelodyId);

        // 计算下一首简谱的索引
        let nextIndex = (currentIndex + 1) % availableMelodies.length;

        return {
            action: 'switchTo',
            melodyId: availableMelodies[nextIndex],
            transition: this.config.fadeTransition,
            transitionTime: this.config.transitionTime
        };
    }

    /**
     * 重置播放计数
     */
    resetPlayCount() {
        this.playCount = 0;
    }

    /**
     * 重置分类播放状态
     */
    resetCategoryPlayback() {
        this.currentCategoryIndex = -1;
    }
}

export default PlaybackStrategy; 