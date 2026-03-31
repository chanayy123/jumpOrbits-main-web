/**
 * 音乐播放器 - 处理玩家点击和简谱播放
 */
import AudioSystem from './audioSystem.js';
import MelodyManager from './melodyManager.js';
import PlaybackStrategy from './playbackStrategy.js';
import VariationSystem from './variationSystem.js';
import logger from '../utils/logger.js';

class MusicPlayer {
    constructor() {
        this.audioSystem = new AudioSystem();
        this.melodyManager = new MelodyManager();
        this.playbackStrategy = new PlaybackStrategy();
        this.variationSystem = new VariationSystem();

        this.isInitialized = false;
        this.currentMelodyId = null;
        this.currentVariation = null;

        // 初始化Promise，用于跟踪初始化状态
        this.initPromise = null;

        // 默认音频系统引用
        this.defaultAudioSystem = null;

        // 设置简谱完成事件处理
        this.audioSystem.on('onMelodyComplete', this.handleMelodyComplete.bind(this));
    }

    /**
     * 初始化音乐播放器
     * @param {Object} options - 初始化选项
     * @param {boolean} options.skipInitialVariation - 是否跳过初始变奏生成（默认false）
     * @returns {Promise} 初始化完成的Promise
     */
    init(options = {}) {
        // 如果已经初始化，返回resolved Promise
        if (this.isInitialized) {
            return Promise.resolve();
        }

        // 如果正在初始化过程中，返回当前的初始化Promise
        if (this.initPromise) {
            return this.initPromise;
        }

        // 创建并保存初始化Promise
        this.initPromise = new Promise(async (resolve, reject) => {
            try {
                // 初始化音频系统（异步）
                await this.audioSystem.init();

                // 延迟加载默认简谱，避免启动时的阻塞
                setTimeout(() => {
                    try {
                        // 获取并加载默认简谱
                        const melodyList = this.melodyManager.getMelodyList();
                        if (melodyList.length > 0) {
                            // 加载默认简谱时，跳过变奏更新
                            this.loadMelody(melodyList[0], { skipVariation: options.skipInitialVariation !== false });
                        }

                        // 只有在不跳过初始变奏的情况下才生成初始变奏
                        if (!options.skipInitialVariation) {
                            // 在下一帧再更新变奏，减少对主线程的阻塞
                            requestAnimationFrame(() => {
                                this.updateVariation();
                            });
                        }

                        this.isInitialized = true;
                        logger.info('音乐播放器初始化完成');

                        // 清除初始化Promise引用
                        this.initPromise = null;

                        // 解析Promise
                        resolve();
                    } catch (err) {
                        logger.error('加载默认简谱失败:', err);
                        // 出错时也标记为已初始化，避免卡住初始化流程
                        this.isInitialized = true;
                        this.initPromise = null;
                        // 仍然解析Promise，不拒绝，以避免阻塞游戏流程
                        resolve();
                    }
                }, 0); // 使用0延时将操作推入下一个事件循环
            } catch (err) {
                logger.error('初始化音频系统失败:', err);
                this.initPromise = null;
                reject(err);
            }
        });

        return this.initPromise;
    }

    /**
     * 加载指定ID的简谱
     * @param {string} melodyId - 简谱ID
     * @param {Object} options - 加载选项
     * @param {boolean} options.skipVariation - 是否跳过更新变奏（当已经有变奏更新时设置为true）
     * @returns {boolean} 是否成功加载
     */
    loadMelody(melodyId, options = {}) {
        const melody = this.melodyManager.getMelody(melodyId);
        if (!melody) {
            logger.warn(`找不到ID为"${melodyId}"的简谱`);
            return false;
        }

        // 加载简谱到音频系统
        this.audioSystem.loadMelody(melody.notes, {
            tempo: melody.tempo || 120
        });

        this.currentMelodyId = melodyId;

        // 只有在不跳过变奏更新的情况下才更新变奏
        if (!options.skipVariation) {
            // 重置变奏
            this.variationSystem.resetVariation();
            this.updateVariation();
            logger.info('已更新变奏配置');
        } else {
            logger.info('跳过变奏更新');
        }

        logger.info(`已加载简谱: ${melody.name}`);
        return true;
    }

    /**
     * 更新当前变奏
     */
    updateVariation() {
        // 添加安全检查，确保variationSystem和其config属性存在
        if (!this.variationSystem || !this.variationSystem.config) {
            logger.warn('变奏系统或配置不可用，无法更新变奏');
            this.currentVariation = null;
            return;
        }

        if (this.variationSystem.config.enabled) {
            try {
                this.currentVariation = this.variationSystem.generateVariation();
                // 添加调用堆栈信息，便于调试，但不使用Error.stack（可能在某些情况下不可靠）
                logger.info('变奏已更新:', this.currentVariation);
            } catch (e) {
                logger.warn('生成变奏时出错:', e);
                // 出错时设置为null，避免使用错误的变奏
                this.currentVariation = null;
            }
        } else {
            this.currentVariation = null;
            logger.info('变奏系统已禁用，不生成变奏');
        }
    }

    /**
     * 处理玩家点击，播放下一个音符
     */
    async handlePlayerClick() {
        // 第一次点击时初始化（因为AudioContext需要用户交互才能创建）
        if (!this.isInitialized) {
            try {
                await this.init();
            } catch (err) {
                logger.warn('播放点击音符失败 - 初始化错误:', err);
                return;
            }
        }

        // 获取音效音量设置
        let soundVolume = 0.6; // 默认音量
        try {
            const settingsKey = 'jumpOrbits_audioSettings';
            const savedSettings = localStorage.getItem(settingsKey);
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                if (settings.soundVolume !== undefined) {
                    soundVolume = settings.soundVolume;
                    logger.debug('跳跃音效使用设置面板的音效音量:', soundVolume);
                }
            }
        } catch (e) {
            logger.warn('读取设置面板音效音量失败:', e);
        }

        // 如果音量为0，则不播放音效
        if (soundVolume <= 0) {
            logger.debug('音效音量为0，不播放跳跃音效');
            return;
        }

        // 播放下一个音符（应用当前变奏和音量设置）
        const variationWithVolume = {
            ...(this.currentVariation || {}),
            volumeFactor: soundVolume
        };
        this.audioSystem.playNextNote(variationWithVolume);
    }

    /**
     * 处理简谱播放完成事件
     */
    handleMelodyComplete() {
        // 如果启用了循环变奏，生成新的变奏
        if (this.variationSystem.config.enabled &&
            this.variationSystem.config.variationOnLoop) {
            this.updateVariation();
        }

        // 准备上下文信息
        const context = {
            currentMelodyId: this.currentMelodyId,
            availableMelodies: this.melodyManager.getMelodyList(),
            melodyManager: this.melodyManager
        };

        // 获取策略决策
        const decision = this.playbackStrategy.handleMelodyComplete(context);

        // 执行决策
        switch (decision.action) {
            case 'replay':
                logger.info('重新播放当前简谱');
                this.restartMelody();
                break;
            case 'next':
            case 'switchTo':
                logger.info(`切换到下一首简谱: ${decision.melodyId}`);
                this.loadMelody(decision.melodyId);
                break;
            default:
                logger.warn('未知的播放动作:', decision.action);
        }
    }

    /**
     * 配置播放策略
     * @param {Object} options - 配置选项
     */
    configurePlayback(options) {
        this.playbackStrategy.configure(options);
    }

    /**
     * 配置变奏系统
     * @param {Object} options - 配置选项
     */
    configureVariation(options) {
        this.variationSystem.configure(options);

        // 如果禁用了变奏，重置当前变奏
        if (options && options.enabled === false) {
            this.currentVariation = null;
        } else {
            // 生成新的变奏
            this.updateVariation();
        }
    }

    /**
     * 获取当前播放策略配置
     * @returns {Object} 当前配置
     */
    getPlaybackConfig() {
        return this.playbackStrategy.config;
    }

    /**
     * 获取当前变奏系统配置
     * @returns {Object} 当前配置
     */
    getVariationConfig() {
        return this.variationSystem.config;
    }

    /**
     * 从JSON文件加载简谱
     * @param {string} url - JSON文件路径
     * @returns {Promise} 加载结果
     */
    loadMelodiesFromJson(url) {
        return this.melodyManager.loadFromJson(url)
            .then(() => {
                logger.info('简谱数据已从JSON加载');
                return this.melodyManager.getMelodyList();
            });
    }

    /**
     * 获取可用的简谱列表
     * @returns {Array} 简谱ID数组
     */
    getAvailableMelodies() {
        return this.melodyManager.getMelodyList();
    }

    /**
     * 添加自定义简谱（通过音符数组）
     * @param {string} id - 简谱ID
     * @param {string} name - 简谱名称
     * @param {Array} notes - 音符数组
     */
    addCustomMelody(id, name, notes) {
        return this.melodyManager.addCustomMelody(id, name, notes);
    }

    /**
     * 从简谱字符串创建简谱
     * @param {string} id - 简谱ID
     * @param {string} name - 简谱名称
     * @param {string} notation - 简谱字符串，如"1 2 3 1"
     */
    createMelodyFromNotation(id, name, notation) {
        return this.melodyManager.parseFromNotation(id, name, notation);
    }

    /**
     * 处理音效播放请求，根据soundId播放相应的音效
     * @param {string} soundId - 音效标识符
     */
    handleSoundPlayback(soundId) {
        // 日志记录
        logger.debug(`高级音频系统接收到播放音效请求：${soundId}`);

        // 根据音效ID执行相应的播放逻辑
        switch (soundId) {
            case 'buttonClick':
                // 按钮点击音效直接使用默认音频系统播放，确保UI交互反馈
                if (this.defaultAudioSystem) {
                    this.defaultAudioSystem.playSound(soundId);
                } else if (window.game && window.game.audio) {
                    window.game.audio.playSound(soundId);
                }
                break;
            case 'jump':
                // 跳跃音效已经由handlePlayerClick方法处理，这里无需额外处理
                // 注意：如果直接调用playSound('jump')而不是通过点击事件，
                // 我们可能需要这里播放一个跳跃音效，但目前通过handlePlayerClick已处理
                break;
            case 'collision':
                // 如果当前旋律有碰撞变奏，播放对应变奏
                if (this.variationSystem.config.collision) {
                    this.playVariation('collision');
                } else {
                    // 如果没有变奏，播放默认碰撞音效
                    this.defaultAudioSystem.playSound(soundId);
                }
                break;
            case 'clear':
                // 如果当前旋律有清除障碍物变奏，播放对应变奏
                if (this.variationSystem.config.clear) {
                    this.playVariation('clear');
                } else {
                    // 如果没有变奏，播放默认清除音效
                    this.defaultAudioSystem.playSound(soundId);
                }
                break;
            case 'specialTrack':
                // 如果当前旋律有特殊轨道变奏，播放对应变奏
                if (this.variationSystem.config.specialTrack) {
                    this.playVariation('specialTrack');
                } else {
                    // 如果没有变奏，播放默认特殊轨道音效
                    this.defaultAudioSystem.playSound(soundId);
                }
                break;
            case 'score':
                // 如果当前旋律有得分变奏，播放对应变奏
                if (this.variationSystem.config.score) {
                    this.playVariation('score');
                } else {
                    // 如果没有变奏，播放默认得分音效
                    this.defaultAudioSystem.playSound(soundId);
                }
                break;
            default:
                // 对于未专门处理的音效，使用默认音频系统播放
                if (this.defaultAudioSystem) {
                    this.defaultAudioSystem.playSound(soundId);
                } else if (window.game && window.game.audio) {
                    window.game.audio.playSound(soundId);
                }
                break;
        }
    }

    /**
     * 停止所有声音
     */
    stopAll() {
        if (this.audioSystem) {
            // 多层防护：首先尝试使用实例方法
            if (typeof this.audioSystem.reset === 'function') {
                this.audioSystem.reset();
            } else if (typeof this.audioSystem.stopAll === 'function') {
                // 回退方案1：使用stopAll并手动重置索引
                this.audioSystem.stopAll();
                this.audioSystem.currentNoteIndex = 0;
                logger.warn('AudioSystem.reset方法不存在，已回退到stopAll');
            } else {
                // 回退方案2：使用静态方法
                try {
                    AudioSystem.resetInstance(this.audioSystem);
                    logger.warn('AudioSystem方法不存在，已使用静态resetInstance方法');
                } catch (e) {
                    logger.error('所有重置尝试均失败:', e);
                    // 最后尝试：直接修改属性
                    if (this.audioSystem.audioContext) {
                        try {
                            this.audioSystem.audioContext.suspend();
                        } catch (err) { }
                    }
                    this.audioSystem.currentNoteIndex = 0;
                }
            }
        }
    }

    /**
     * 恢复音乐播放
     * 只恢复AudioContext状态，不会主动播放任何音符
     */
    resumeMusic() {
        try {
            if (!this.audioSystem) {
                logger.warn('无法恢复音乐播放：audioSystem不可用');
                return;
            }

            // 确保变奏系统状态正确
            if (this.variationSystem && (!this.currentVariation || Object.keys(this.currentVariation).length === 0)) {
                try {
                    // 尝试重新生成变奏
                    this.updateVariation();
                } catch (e) {
                    logger.warn('恢复音乐时重新生成变奏失败:', e);
                }
            }

            this.audioSystem.resume();
        } catch (e) {
            logger.warn('恢复音乐播放时出错:', e);
        }
    }

    /**
     * 重新开始当前简谱的播放
     * 重置当前音符索引到开始位置并确保所有声音停止
     * @param {boolean} skipReload - 是否跳过重新加载简谱（当由audioManager.handleRestart调用时设置为true）
     */
    restartMelody(skipReload = false) {
        if (!this.audioSystem) return;

        // 保存当前旋律ID，以便重置后可以重新加载
        const currentId = this.currentMelodyId;

        // 多层防护：首先尝试使用实例方法
        if (typeof this.audioSystem.reset === 'function') {
            // 在重置前记录当前旋律信息
            const melodyData = this.audioSystem.melody ? [...this.audioSystem.melody] : [];

            try {
                this.audioSystem.reset();

                // 如果reset导致旋律丢失，尝试恢复它
                if ((!this.audioSystem.melody || this.audioSystem.melody.length === 0) && melodyData.length > 0) {
                    logger.info('重置后恢复旋律数据:', melodyData);
                    this.audioSystem.melody = melodyData;
                }
            } catch (e) {
                logger.warn('重置音频系统失败:', e);
                // 回退到简单重置
                this.audioSystem.stopAll();
                this.audioSystem.currentNoteIndex = 0;
            }
        } else if (typeof this.audioSystem.stopAll === 'function') {
            // 回退方案1：使用stopAll并手动重置索引
            this.audioSystem.stopAll();
            this.audioSystem.currentNoteIndex = 0;
            logger.warn('AudioSystem.reset方法不存在，已回退到stopAll');
        } else {
            // 回退方案2：使用静态方法
            try {
                AudioSystem.resetInstance(this.audioSystem);
                logger.warn('AudioSystem方法不存在，已使用静态resetInstance方法');
            } catch (e) {
                logger.error('所有重置尝试均失败:', e);
                // 最后尝试：直接修改属性
                if (this.audioSystem.audioContext) {
                    try {
                        this.audioSystem.audioContext.suspend();
                    } catch (err) {
                        logger.warn('暂停AudioContext失败:', err);
                    }
                }
                this.audioSystem.currentNoteIndex = 0;
            }
        }

        // 如果当前简谱ID存在且没有跳过重新加载标志，尝试重新加载以确保数据完整
        if (currentId && !skipReload) {
            try {
                this.loadMelody(currentId);
                logger.info('重新加载简谱成功:', currentId);
            } catch (err) {
                logger.warn('重新加载简谱失败:', err);
            }
        } else if (!currentId) {
            logger.warn('没有当前简谱ID，无法重新加载简谱');
        } else {
            logger.info('跳过简谱重新加载，由外部处理');
        }
    }

    /**
     * 播放指定类型的变奏
     * @param {string} variationType - 变奏类型（'collision', 'clear', 'specialTrack', 'score'等）
     */
    playVariation(variationType) {
        if (!this.audioSystem || !variationType) {
            return;
        }

        // 根据变奏类型获取对应的变奏配置
        let variationConfig = null;
        if (this.variationSystem && this.variationSystem.config) {
            variationConfig = this.variationSystem.config[variationType];
        }

        if (!variationConfig) {
            logger.warn(`找不到${variationType}类型的变奏配置`);
            return;
        }

        // 播放变奏音效
        // 这里我们假设变奏配置包含了播放此类变奏所需的所有信息
        // 可能是特殊音符序列或音效名称
        try {
            if (typeof variationConfig === 'string') {
                // 如果变奏配置是字符串，可能是音效名称
                this.audioSystem.playSound(variationConfig);
            } else if (Array.isArray(variationConfig)) {
                // 如果是数组，可能是音符序列
                this.audioSystem.playNotes(variationConfig);
            } else if (typeof variationConfig === 'object') {
                // 如果是对象，可能包含更复杂的播放配置
                this.audioSystem.playVariation(variationConfig);
            }
        } catch (e) {
            logger.error(`播放${variationType}变奏时出错:`, e);
            // 出错时使用默认音频系统尝试播放
            if (this.defaultAudioSystem) {
                this.defaultAudioSystem.playSound(variationType);
            }
        }
    }

    /**
     * 根据分类加载并播放简谱
     * @param {string} category - 简谱分类ID
     * @returns {boolean} 是否成功加载分类简谱
     */
    playMelodyByCategory(category) {
        // 检查分类是否存在
        const categories = this.melodyManager.getCategories();
        if (!categories[category]) {
            logger.warn(`找不到分类: ${category}`);
            return false;
        }

        // 获取该分类的所有简谱
        const melodies = this.melodyManager.getMelodiesByCategory(category);
        if (melodies.length === 0) {
            logger.warn(`分类 ${category} 没有可用的简谱`);
            return false;
        }

        // 配置播放策略为按分类顺序播放
        this.playbackStrategy.configure({
            mode: this.playbackStrategy.MODES.CATEGORY_SEQUENCE,
            currentCategory: category
        });

        // 重置分类播放状态
        this.playbackStrategy.resetCategoryPlayback();

        // 加载该分类的第一首简谱
        this.loadMelody(melodies[0]);

        logger.info(`已加载分类 ${categories[category]} 的简谱，共 ${melodies.length} 首`);
        return true;
    }

    /**
     * 获取所有可用分类
     * @returns {Object} 分类ID到分类名称的映射
     */
    getAvailableCategories() {
        return this.melodyManager.getCategories();
    }

    /**
     * 获取指定分类的所有简谱
     * @param {string} category - 分类ID
     * @returns {Array} 简谱ID数组
     */
    getMelodiesByCategory(category) {
        return this.melodyManager.getMelodiesByCategory(category);
    }
}

export default MusicPlayer; 