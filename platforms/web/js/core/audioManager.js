// 音频管理器 - 管理默认和高级音频系统
import { AUDIO_CONSTANTS } from './utils/constants.js';
import logger from './utils/logger.js';

export class AudioManager {
    constructor() {
        // 系统状态常量
        this.AUDIO_SYSTEM_TYPES = {
            DEFAULT: 'default',      // 游戏默认音频系统
            ADVANCED: 'advanced'     // 高级音乐系统(可变奏)
        };

        // 高级系统解锁状态
        this.unlockState = {
            isUnlocked: false,        // 是否已解锁
            isEnabled: false          // 是否启用(解锁后可切换)
        };

        // 当前激活的系统
        this.activeSystem = this.AUDIO_SYSTEM_TYPES.DEFAULT;

        // 高级音乐系统实例(延迟初始化)
        this.advancedMusicPlayer = null;

        // 默认音频系统引用
        this.defaultAudioSystem = null;

        // 系统切换事件处理函数
        this.onSystemSwitch = null;

        // 测试模式配置
        this.testingMode = {
            enabled: false,            // 是否启用测试模式
            autoUnlock: false,         // 是否自动解锁高级系统
            forceAdvanced: false,       // 是否强制使用高级系统
            testMelodies: false        // 是否加载测试数据
        };

        // 记录初始化状态
        this.initialized = false;
        this.initializationPromise = null;
    }

    /**
     * 初始化音频管理器
     * @param {Object} defaultAudioSystem - 游戏原有的音频系统引用
     * @returns {Promise} 初始化完成的Promise
     */
    init(defaultAudioSystem) {
        // 避免重复初始化
        if (this.initialized) {
            // logger.warn('音频管理器已初始化');
            return Promise.resolve();
        }

        // 保存默认音频系统引用
        this.defaultAudioSystem = defaultAudioSystem;

        this.initializationPromise = new Promise(async (resolve) => {
            // 保存默认音频系统引用
            if (!this.defaultAudioSystem) {
                logger.warn('未提供默认音频系统，音频管理器功能将受限');
            } else {
                logger.debug('默认音频系统已设置');

                // 加载解锁状态 - 在设置音频系统信息之前先加载状态
                this.loadUnlockState();

                // 设置音频系统信息（如果支持）
                if (typeof this.defaultAudioSystem.setAudioSystemInfo === 'function') {
                    // 使用当前活动的系统类型（可能已从localStorage恢复）
                    this.defaultAudioSystem.setAudioSystemInfo({
                        systemType: this.activeSystem,
                        volumeModifier: this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED ? 0.3 : 1.0
                    });

                    logger.debug('设置音频系统信息:', this.activeSystem);
                }
            }

            // 加载测试模式配置
            this.loadTestingMode();

            // 测试模式下的处理
            if (this.testingMode.enabled) {
                if (this.testingMode.autoUnlock) {
                    logger.debug('测试模式：自动解锁高级音频系统');
                    this.unlockState.isUnlocked = true;
                    this.saveUnlockState();
                }

                if (this.testingMode.forceAdvanced) {
                    logger.debug('测试模式：强制启用高级音频系统');
                    this.unlockState.isEnabled = true;
                    this.activeSystem = this.AUDIO_SYSTEM_TYPES.ADVANCED;
                }
            }

            // 如果当前设置为高级系统，则初始化高级系统
            if (this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED) {
                try {
                    logger.debug('当前为高级音频系统模式，初始化高级音频系统...');
                    await this.initAdvancedMusicSystem();

                    // 获取设置面板中的基础音量值
                    let baseVolume = 1.0; // 默认音量
                    const settingsKey = 'jumpOrbits_audioSettings';
                    try {
                        const savedSettings = localStorage.getItem(settingsKey);
                        if (savedSettings) {
                            const settings = JSON.parse(savedSettings);
                            if (settings.musicVolume !== undefined) {
                                baseVolume = settings.musicVolume;
                                // logger.debug('[初始化] 使用设置面板的音量:', baseVolume);
                            }
                        }
                    } catch (e) {
                        // logger.warn('[初始化] 读取设置面板音量失败:', e);
                    }

                    // 高级系统音量为基础音量的30%
                    if (this.defaultAudioSystem && this.defaultAudioSystem.bgMusicGainNode) {
                        const targetVolume = baseVolume * 0.3;
                        await this.defaultAudioSystem.fadeBackgroundMusicVolume(targetVolume);
                        // logger.debug('[初始化] 高级系统设置音量(基础音量*0.3):', targetVolume);
                    }
                } catch (err) {
                    // logger.error('初始化高级音乐系统失败:', err);
                    this.activeSystem = this.AUDIO_SYSTEM_TYPES.DEFAULT;
                }
            }

            // logger.debug('音频管理器基础初始化完成，当前系统:', this.activeSystem);
            // logger.debug('高级音乐系统解锁状态:', this.unlockState.isUnlocked ? '已解锁' : '未解锁');

            if (this.testingMode.enabled) {
                // logger.debug('音频系统测试模式已启用:', this.testingMode);
            }

            this.initialized = true;

            // 确保初始化完成后，系统设置正确
            // 只有当unlockState.isEnabled为true但activeSystem不是ADVANCED时才需要切换
            if (this.unlockState.isUnlocked && this.unlockState.isEnabled &&
                this.activeSystem !== this.AUDIO_SYSTEM_TYPES.ADVANCED) {
                try {
                    logger.debug('初始化完成，需要切换到高级系统');
                    await this.switchToSystem(this.AUDIO_SYSTEM_TYPES.ADVANCED);
                } catch (error) {
                    logger.error('初始化后切换系统失败:', error);
                }
            } else {
                logger.debug('初始化完成，当前音频系统:', this.activeSystem);
            }

            resolve();
        }).catch(err => {
            // logger.error('音频管理器初始化失败:', err);
            // 失败时也标记为初始化完成，以避免重复尝试
            this.initialized = true;
            this.initializationPromise = null;
        }).finally(() => {
            this.initializationPromise = null;
        });

        return this.initializationPromise;
    }

    /**
     * 从本地存储加载解锁状态
     */
    loadUnlockState() {
        try {
            const savedState = localStorage.getItem(AUDIO_CONSTANTS.STORAGE_KEY);
            if (savedState) {
                this.unlockState = JSON.parse(savedState);

                // 立即更新当前活动系统状态，与保存的状态保持一致
                if (this.unlockState.isUnlocked && this.unlockState.isEnabled) {
                    logger.debug('从本地存储恢复高级音频系统状态');
                    this.activeSystem = this.AUDIO_SYSTEM_TYPES.ADVANCED;
                } else {
                    this.activeSystem = this.AUDIO_SYSTEM_TYPES.DEFAULT;
                }

                logger.debug('已加载音乐系统解锁状态，当前系统:', this.activeSystem);
            }
        } catch (e) {
            logger.warn('加载音乐系统解锁状态失败:', e);
        }
    }

    /**
     * 加载测试模式配置
     */
    loadTestingMode() {
        try {
            const testingConfig = localStorage.getItem(AUDIO_CONSTANTS.TESTING_MODE_KEY);
            if (testingConfig) {
                this.testingMode = JSON.parse(testingConfig);
            }
        } catch (e) {
            // logger.warn('加载音频测试模式配置失败:', e);
        }
    }

    /**
     * 保存测试模式配置
     */
    saveTestingMode() {
        try {
            localStorage.setItem(AUDIO_CONSTANTS.TESTING_MODE_KEY, JSON.stringify(this.testingMode));
        } catch (e) {
            // logger.warn('保存音频测试模式配置失败:', e);
        }
    }

    /**
     * 设置测试模式
     * @param {Object} options - 测试模式选项
     */
    setTestingMode(options) {
        this.testingMode = { ...this.testingMode, ...options };
        this.saveTestingMode();

        // 如果启用了测试模式且需要自动解锁
        if (this.testingMode.enabled && this.testingMode.autoUnlock) {
            this.unlockAdvancedSystem();

            // 确保音频管理器已初始化，才能切换系统
            if (this.initialized && this.testingMode.forceAdvanced) {
                // 如果需要强制使用高级系统
                try {
                    this.switchToSystem(this.AUDIO_SYSTEM_TYPES.ADVANCED);
                } catch (error) {
                    // logger.error('测试模式切换到高级系统失败:', error);
                }
            } else if (this.testingMode.forceAdvanced) {
                // 未初始化但设置了强制高级模式，记录状态等待初始化完成
                // logger.debug('记录强制使用高级系统设置，待初始化完成后应用');
                this.unlockState.isEnabled = true;
            }
        }

        // logger.debug('音频系统测试模式已更新:', this.testingMode);
        return this.testingMode;
    }

    /**
     * 获取测试模式配置
     * @returns {Object} 测试模式配置
     */
    getTestingMode() {
        return { ...this.testingMode };
    }

    /**
     * 保存解锁状态到本地存储
     */
    saveUnlockState() {
        try {
            localStorage.setItem(AUDIO_CONSTANTS.STORAGE_KEY, JSON.stringify(this.unlockState));
        } catch (e) {
            // logger.warn('保存音乐系统解锁状态失败:', e);
        }
    }

    /**
     * 解锁高级音乐系统
     * @returns {boolean} 是否解锁成功
     */
    unlockAdvancedSystem() {
        // 如果已经解锁，则直接返回true
        if (this.unlockState.isUnlocked) {
            return true;
        }

        // 执行解锁逻辑
        this.unlockState.isUnlocked = true;
        this.saveUnlockState();

        // logger.debug('恭喜! 高级音乐系统已解锁!');
        return true;
    }

    /**
     * 切换到指定的音频系统
     * @param {string} systemType - 要切换到的系统类型
     * @returns {Promise<boolean>} 切换是否成功
     */
    async switchToSystem(systemType) {
        // logger.debug('开始切换音频系统:', systemType);

        // 验证系统类型
        const validKeys = Object.keys(this.AUDIO_SYSTEM_TYPES);
        const validValues = Object.values(this.AUDIO_SYSTEM_TYPES);

        // 检查systemType是否在有效的键或值中
        if (!validValues.includes(systemType) && !validKeys.includes(systemType.toUpperCase())) {
            // logger.error('无效的音频系统类型:', systemType);
            return false;
        }

        // 标准化系统类型，确保使用的是值而不是键
        let normalizedSystemType = systemType;
        if (validKeys.includes(systemType.toUpperCase())) {
            normalizedSystemType = this.AUDIO_SYSTEM_TYPES[systemType.toUpperCase()];
        }

        // 检查是否已初始化
        if (!this.initialized) {
            // logger.error('音频管理器尚未初始化，无法切换系统');
            return false;
        }

        // 检查是否与当前系统相同
        if (this.activeSystem === normalizedSystemType) {
            // logger.debug('已经是指定的音频系统，无需切换');
            return true;
        }

        // 如果要切换到高级系统，先检查是否已解锁
        if (normalizedSystemType === this.AUDIO_SYSTEM_TYPES.ADVANCED && !this.unlockState.isUnlocked) {
            // logger.error('高级音频系统尚未解锁，无法切换');
            return false;
        }

        // 记录系统切换前状态
        const previousSystem = this.activeSystem;
        // logger.debug('从音频系统切换:', previousSystem, '->', normalizedSystemType);

        try {
            // 先更新系统状态
            this.activeSystem = normalizedSystemType;
            this.unlockState.isEnabled = (normalizedSystemType === this.AUDIO_SYSTEM_TYPES.ADVANCED);
            this.saveUnlockState();

            // 如果要切换到高级系统，确保已经初始化
            if (normalizedSystemType === this.AUDIO_SYSTEM_TYPES.ADVANCED) {
                if (!this.advancedMusicPlayer) {
                    // logger.debug('初始化高级音乐系统...');
                    try {
                        await this.initAdvancedMusicSystem();
                    } catch (err) {
                        // logger.error('高级音乐系统初始化失败，无法切换:', err);
                        // 回退到默认系统
                        this.activeSystem = this.AUDIO_SYSTEM_TYPES.DEFAULT;
                        this.unlockState.isEnabled = false;
                        this.saveUnlockState();
                        return false;
                    }
                }
            }

            // 更新音频系统信息
            if (this.defaultAudioSystem && typeof this.defaultAudioSystem.setAudioSystemInfo === 'function') {
                this.defaultAudioSystem.setAudioSystemInfo({
                    systemType: normalizedSystemType,
                    volumeModifier: normalizedSystemType === this.AUDIO_SYSTEM_TYPES.ADVANCED ? 0.3 : 1.0
                });
            }

            // 处理音量调整
            if (this.defaultAudioSystem) {
                try {
                    // 直接从设置面板中读取原始音量值
                    let baseVolume = 1.0; // 默认音量
                    const settingsKey = 'jumpOrbits_audioSettings';
                    try {
                        const savedSettings = localStorage.getItem(settingsKey);
                        if (savedSettings) {
                            const settings = JSON.parse(savedSettings);
                            if (settings.musicVolume !== undefined) {
                                baseVolume = settings.musicVolume;
                                logger.debug('[音量调整] 使用设置面板的原始音量:', baseVolume);
                            }
                        }
                    } catch (e) {
                        // logger.warn('[音量调整] 读取设置面板音量失败:', e);
                    }

                    // 根据系统类型计算目标音量
                    let targetVolume;
                    if (normalizedSystemType === this.AUDIO_SYSTEM_TYPES.ADVANCED) {
                        // 切换到高级系统：降低音量到30%
                        targetVolume = baseVolume * 0.3;
                        logger.debug('[音量调整] 高级系统降低音量(基础音量*0.3):', targetVolume);
                    } else {
                        // 切换到默认系统：直接使用基础音量
                        targetVolume = baseVolume;
                        logger.debug('[音量调整] 默认系统使用基础音量:', targetVolume);
                    }

                    logger.debug('[音量调整] 目标音量:', targetVolume);

                    // 使用渐变方式调整音量
                    if (this.defaultAudioSystem.fadeBackgroundMusicVolume) {
                        await this.defaultAudioSystem.fadeBackgroundMusicVolume(targetVolume);
                    } else {
                        // 如果没有渐变方法，直接设置音量
                        if (this.defaultAudioSystem.bgMusicGainNode) {
                            this.defaultAudioSystem.bgMusicGainNode.gain.value = targetVolume;
                            // logger.debug('[音量调整] 直接设置音量:', targetVolume);
                        }
                    }

                    // 验证音量是否正确设置
                    if (this.defaultAudioSystem.bgMusicGainNode) {
                        const actualVolume = this.defaultAudioSystem.bgMusicGainNode.gain.value;
                        // logger.debug('[音量调整] 实际音量:', actualVolume);

                        if (Math.abs(actualVolume - targetVolume) > 0.01) {
                            // logger.warn('[音量调整] 音量未正确设置，手动修正');
                            this.defaultAudioSystem.bgMusicGainNode.gain.value = targetVolume;
                        }
                    }

                } catch (err) {
                    // logger.error('[音量调整] 音量调整失败:', err);
                    // 在出错的情况下，尝试直接设置音量
                    if (this.defaultAudioSystem.bgMusicGainNode) {
                        // 确保从设置面板读取原始音量值
                        let baseVolume = 1.0; // 默认音量
                        const settingsKey = 'jumpOrbits_audioSettings';
                        try {
                            const savedSettings = localStorage.getItem(settingsKey);
                            if (savedSettings) {
                                const settings = JSON.parse(savedSettings);
                                if (settings.musicVolume !== undefined) {
                                    baseVolume = settings.musicVolume;
                                    logger.debug('[备用音量设置] 使用设置面板的原始音量:', baseVolume);
                                }
                            }
                        } catch (e) {
                            // logger.warn('[备用音量设置] 读取设置面板音量失败:', e);
                        }

                        // 根据系统类型计算目标音量
                        let targetVolume = normalizedSystemType === this.AUDIO_SYSTEM_TYPES.ADVANCED ?
                            baseVolume * 0.3 : baseVolume;

                        this.defaultAudioSystem.bgMusicGainNode.gain.value = targetVolume;
                        logger.debug('[备用音量设置] 直接设置音量为:', targetVolume);
                    }
                }
            }

            // 触发事件
            if (this.onSystemSwitch) {
                this.onSystemSwitch(normalizedSystemType, previousSystem);
            }

            // logger.debug('音频系统切换成功:', normalizedSystemType);
            return true;
        } catch (error) {
            // logger.error('音频系统切换失败:', error);
            // 尝试恢复到之前的状态
            this.activeSystem = previousSystem;
            this.unlockState.isEnabled = (previousSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED);
            this.saveUnlockState();
            return false;
        }
    }

    /**
     * 获取当前激活的音频系统类型
     * @returns {string} 系统类型
     */
    getActiveSystem() {
        // 增加防御性检查
        if (!this.initialized) {
            // logger.warn('音频管理器尚未初始化，使用默认音频系统类型');
            return this.AUDIO_SYSTEM_TYPES.DEFAULT;
        }
        return this.activeSystem;
    }

    /**
     * 初始化高级音乐系统
     * @private
     * @returns {Promise} 初始化完成的Promise
     */
    initAdvancedMusicSystem() {
        return new Promise((resolve, reject) => {
            try {
                // 避免重复初始化
                if (this.advancedMusicPlayer) {
                    resolve(this.advancedMusicPlayer);
                    return;
                }

                // 使用动态导入延迟加载高级音乐系统模块
                import('./music/musicPlayer.js').then(module => {
                    const MusicPlayer = module.default;
                    this.advancedMusicPlayer = new MusicPlayer();

                    // 初始化高级音乐系统并传递默认音频系统引用
                    // 跳过初始变奏生成，避免游戏开始时生成两个变奏
                    this.advancedMusicPlayer.init({ skipInitialVariation: true })
                        .then(() => {
                            // 设置默认音频系统引用
                            this.advancedMusicPlayer.defaultAudioSystem = this.defaultAudioSystem;
                            // logger.debug('高级音乐系统初始化完成');

                            // 如果有测试数据要加载
                            if (this.testingMode.enabled && this.testingMode.testMelodies) {
                                this.loadTestMelodies();
                            }

                            resolve(this.advancedMusicPlayer);
                        })
                        .catch(err => {
                            // logger.error('初始化高级音乐系统实例失败:', err);
                            reject(err);
                        });
                }).catch(err => {
                    // logger.error('加载高级音乐系统模块失败:', err);
                    reject(err);
                });
            } catch (error) {
                // logger.error('初始化高级音乐系统失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 加载测试用的简谱数据
     */
    loadTestMelodies() {
        if (!this.advancedMusicPlayer) return;

        // 创建几个基本的测试简谱
        const testMelodies = [
            {
                id: 'test_melody_1',
                name: '测试简谱1',
                notation: '1 2 3 4 5 6 7 1+',
                tempo: 120
            },
            {
                id: 'test_melody_2',
                name: '测试简谱2',
                notation: '5 3 5 3 5 6 5 3 1',
                tempo: 150
            },
            {
                id: 'test_melody_3',
                name: '测试简谱3',
                notation: '1 3 5 3 1 3 5 3',
                tempo: 100
            }
        ];

        // 加载到高级音乐系统
        testMelodies.forEach(melody => {
            this.advancedMusicPlayer.createMelodyFromNotation(
                melody.id,
                melody.name,
                melody.notation
            );
        });

        // logger.debug('测试简谱数据已加载:', testMelodies.length, '首简谱');
    }

    /**
     * 设置音乐音量
     * 这个方法用于在AudioManager层面设置音量，它会根据当前的音频系统类型应用适当的音量调整
     * @param {number} volume - 基础音量值 (0.0 到 1.0)
     */
    setMusicVolume(volume) {
        if (!this.defaultAudioSystem || !this.defaultAudioSystem.setBackgroundMusicVolume) {
            // logger.warn('[音量设置] 默认音频系统不可用或缺少setBackgroundMusicVolume方法');
            return;
        }

        // 确保音量在有效范围内
        const baseVolume = Math.max(0, Math.min(1, volume));
        // logger.debug('[音量设置] 设置基础音量:', baseVolume);

        // 根据当前系统类型计算实际音量
        const actualVolume = this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED ?
            baseVolume * 0.3 : baseVolume;

        // logger.debug(`[音量设置] ${this.activeSystem}系统实际设置音量:`, actualVolume);

        // 设置音频系统信息（如果支持）
        if (typeof this.defaultAudioSystem.setAudioSystemInfo === 'function') {
            this.defaultAudioSystem.setAudioSystemInfo({
                systemType: this.activeSystem,
                volumeModifier: this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED ? 0.3 : 1.0
            });
        }

        // 调用默认音频系统的方法设置音量
        this.defaultAudioSystem.setBackgroundMusicVolume(actualVolume);
    }

    /**
     * 处理播放音效
     * @param {string} soundId - 音效ID
     * @param {Object} options - 播放选项
     */
    playSound(soundId, options = {}) {
        if (this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED && this.advancedMusicPlayer) {
            // 使用高级系统播放音效
            this.advancedMusicPlayer.handleSoundPlayback(soundId, options);
        } else if (this.defaultAudioSystem) {
            // 使用默认系统播放音效
            this.defaultAudioSystem.playSound(soundId, options);
        }
    }

    /**
     * 处理玩家点击事件（用于音乐播放）
     */
    handlePlayerClick() {
        if (this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED && this.advancedMusicPlayer) {
            // 使用高级音乐系统处理点击
            this.advancedMusicPlayer.handlePlayerClick();
        }
    }

    /**
     * 获取高级音乐系统实例
     * @returns {Object|null} 高级音乐系统实例
     */
    getAdvancedMusicPlayer() {
        return this.advancedMusicPlayer;
    }

    /**
     * 获取解锁状态
     * @returns {Object} 解锁状态对象
     */
    getUnlockState() {
        // 增加防御性检查
        if (!this.initialized) {
            // logger.warn('音频管理器尚未初始化，使用默认解锁状态');
            return { isUnlocked: false, isEnabled: false };
        }
        return { ...this.unlockState };
    }

    /**
     * 设置系统切换事件处理函数
     * @param {Function} callback - 回调函数
     */
    setOnSystemSwitch(callback) {
        this.onSystemSwitch = callback;
    }

    /**
     * 停止所有声音
     */
    stopAll() {
        if (this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED && this.advancedMusicPlayer) {
            // 停止高级系统的声音
            this.advancedMusicPlayer.stopAll();
        } else if (this.defaultAudioSystem) {
            // 停止默认系统的声音
            Object.keys(this.defaultAudioSystem.sounds).forEach(id => {
                this.defaultAudioSystem.stopSound(id);
            });
        }
    }

    /**
     * 处理游戏暂停
     * 彻底停止所有音频系统
     */
    handlePause() {
        // 先尝试直接停止音频的Web Audio Context
        if (this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED && this.advancedMusicPlayer) {
            try {
                // 直接访问AudioSystem进行彻底清理，确保任何可能正在播放的音符都会被中断
                if (this.advancedMusicPlayer.audioSystem) {
                    // 首先完全重置MusicPlayer
                    if (typeof this.advancedMusicPlayer.stopAll === 'function') {
                        this.advancedMusicPlayer.stopAll();
                    }

                    // 然后直接重置AudioSystem
                    if (this.advancedMusicPlayer.audioSystem) {
                        if (typeof this.advancedMusicPlayer.audioSystem.reset === 'function') {
                            this.advancedMusicPlayer.audioSystem.reset();
                        } else if (typeof this.advancedMusicPlayer.audioSystem.stopAll === 'function') {
                            this.advancedMusicPlayer.audioSystem.stopAll();
                        }

                        // 尝试直接修改索引
                        this.advancedMusicPlayer.audioSystem.currentNoteIndex = 0;

                        // 尝试直接暂停音频上下文
                        if (this.advancedMusicPlayer.audioSystem.audioContext &&
                            this.advancedMusicPlayer.audioSystem.audioContext.state === 'running') {
                            this.advancedMusicPlayer.audioSystem.audioContext.suspend();
                        }
                    }
                }
            } catch (e) {
                // logger.warn('彻底停止高级音频系统失败:', e);
                // 即使失败也继续执行，尝试使用标准的stopAll方法
            }
        }

        // 最后还是调用标准的stopAll方法作为后备
        this.stopAll();
    }

    /**
     * 处理游戏恢复
     */
    handleResume() {
        // 根据需要恢复音乐播放
        if (this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED && this.advancedMusicPlayer) {
            this.advancedMusicPlayer.resumeMusic();
            logger.debug('已恢复高级音频系统音乐播放');
        } else if (this.defaultAudioSystem) {
            // 设置音频系统信息（如果支持）
            if (typeof this.defaultAudioSystem.setAudioSystemInfo === 'function') {
                this.defaultAudioSystem.setAudioSystemInfo({
                    systemType: this.activeSystem,
                    volumeModifier: this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED ? 0.3 : 1.0
                });
            }

            // 处理默认系统的恢复
            try {
                // 直接从设置面板中读取原始音量值
                let baseVolume = 1.0; // 默认音量
                const settingsKey = 'jumpOrbits_audioSettings';
                try {
                    const savedSettings = localStorage.getItem(settingsKey);
                    if (savedSettings) {
                        const settings = JSON.parse(savedSettings);
                        if (settings.musicVolume !== undefined) {
                            baseVolume = settings.musicVolume;
                            logger.debug('[恢复] 使用设置面板的原始音量:', baseVolume);
                        }
                    }
                } catch (e) {
                    // logger.warn('[恢复] 读取设置面板音量失败:', e);
                }

                // 根据当前激活的系统类型计算目标音量
                const targetVolume = (this.activeSystem === this.AUDIO_SYSTEM_TYPES.ADVANCED) ?
                    baseVolume * 0.3 : baseVolume;
                logger.debug('[恢复] 计算目标音量:', targetVolume);

                // 更新音量
                if (this.defaultAudioSystem.bgMusicGainNode && targetVolume !== undefined) {
                    this.defaultAudioSystem.bgMusicGainNode.gain.value = this.defaultAudioSystem.muted ? 0 : targetVolume;
                    logger.debug('[恢复] 设置音量为:', targetVolume);
                }

            } catch (e) {
                // logger.warn('[恢复] 设置背景音乐音量失败:', e);
            }
        }
    }

    /**
     * 处理游戏重新开始
     */
    handleRestart() {
        // 检查当前活动的音频系统类型
        const systemType = this.getActiveSystem();
        // logger.debug('[重启] 当前音频系统:', systemType);

        // 设置音频系统信息（如果支持）
        if (this.defaultAudioSystem && typeof this.defaultAudioSystem.setAudioSystemInfo === 'function') {
            this.defaultAudioSystem.setAudioSystemInfo({
                systemType: systemType,
                volumeModifier: systemType === this.AUDIO_SYSTEM_TYPES.ADVANCED ? 0.3 : 1.0
            });
            // logger.debug('[重启] 已更新音频系统信息');
        }

        // 确保音量设置正确
        if (this.defaultAudioSystem) {
            // 直接从设置面板中读取原始音量值
            let baseVolume = 1.0; // 默认音量
            const settingsKey = 'jumpOrbits_audioSettings';
            try {
                const savedSettings = localStorage.getItem(settingsKey);
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    if (settings.musicVolume !== undefined) {
                        baseVolume = settings.musicVolume;
                        logger.debug('[重启] 使用设置面板的原始音量:', baseVolume);
                    }
                }
            } catch (e) {
                // logger.warn('[重启] 读取设置面板音量失败:', e);
            }

            // 根据系统类型计算目标音量
            const targetVolume = systemType === this.AUDIO_SYSTEM_TYPES.ADVANCED ?
                baseVolume * 0.3 : baseVolume;
            logger.debug('[重启] 计算目标音量:', targetVolume);

            // 设置音量
            if (this.defaultAudioSystem.bgMusicGainNode) {
                this.defaultAudioSystem.bgMusicGainNode.gain.value = this.defaultAudioSystem.muted ? 0 : targetVolume;
                logger.debug('[重启] 设置音量为:', targetVolume);
            }
        }

        // 只有高级音频系统需要特殊处理
        if (systemType === this.AUDIO_SYSTEM_TYPES.ADVANCED) {
            try {
                // logger.debug('游戏重启：重置高级音频系统...');

                // 确保高级音频系统存在并已初始化
                if (!this.advancedMusicPlayer || !this.advancedMusicPlayer.isInitialized) {
                    // logger.warn('高级音频系统不可用或未初始化，跳过重启处理');
                    return;
                }

                // 重置音频系统但保持简谱状态
                try {
                    // 保存当前简谱ID，以便重新加载
                    const currentMelodyId = this.advancedMusicPlayer.currentMelodyId;
                    // logger.debug('当前简谱ID:', currentMelodyId);

                    // 重置音频系统的播放位置（非重新初始化）
                    if (this.advancedMusicPlayer.audioSystem) {
                        this.advancedMusicPlayer.audioSystem.currentNoteIndex = 0;
                        // logger.debug('已重置音频系统播放位置');
                    }

                    // 如果有当前简谱，重新加载
                    if (currentMelodyId && this.advancedMusicPlayer.melodyManager) {
                        const melody = this.advancedMusicPlayer.melodyManager.getMelody(currentMelodyId);
                        if (melody) {
                            this.advancedMusicPlayer.loadMelody(currentMelodyId);
                            // logger.debug('已重新加载简谱:', currentMelodyId);
                        }
                    }

                } catch (resetError) {
                    // logger.error('重置高级音频系统失败:', resetError);
                }

            } catch (error) {
                // logger.error('处理高级音频系统重启失败:', error);
            }
        }
    }

    /**
     * 销毁音频管理器
     */
    destroy() {
        // 停止所有音频
        this.stopAll();

        // 清理高级音乐系统
        if (this.advancedMusicPlayer) {
            if (typeof this.advancedMusicPlayer.destroy === 'function') {
                this.advancedMusicPlayer.destroy();
            }
            this.advancedMusicPlayer = null;
        }

        // 清理引用
        this.defaultAudioSystem = null;
        this.onSystemSwitch = null;

        // 重置状态
        this.initialized = false;
        this.initializationPromise = null;

        // logger.debug('音频管理器已销毁');
    }
}

export default AudioManager;