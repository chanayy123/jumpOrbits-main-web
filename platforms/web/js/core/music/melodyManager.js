import logger from '../utils/logger.js';

/**
 * 简谱管理器 - 负责简谱的获取、存储和管理
 */
class MelodyManager {
    constructor() {
        // 存储简谱的对象
        this.melodies = {};

        // 按主题分类的简谱集合
        this.categories = {
            'children': '儿童歌曲',
            'folk': '民乐经典',
            'game': '游戏音乐',
            'classical': '古典名曲'
        };

        // 每个简谱关联的分类
        this.melodyCategories = {};

        // 加载内置简谱
        this.loadBuiltInMelodies();
    }

    /**
     * 加载内置的简谱
     */
    loadBuiltInMelodies() {
        // 定义儿童歌曲简谱
        const childrenSongs = {
            // 小星星（完整版）
            'littleStar': {
                name: '小星星',
                notes: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
                    'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4', 'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
                    'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4'],
                tempo: 120 // BPM
            },
            // 生日快乐歌（完整版）
            'happyBirthday': {
                name: '生日快乐歌',
                notes: ['G3', 'G3', 'A3', 'G3', 'C4', 'B3',
                    'G3', 'G3', 'A3', 'G3', 'D4', 'C4',
                    'G3', 'G3', 'G4', 'E4', 'C4', 'B3', 'A3',
                    'F4', 'F4', 'E4', 'C4', 'D4', 'C4'],
                tempo: 100
            },
            // 两只老虎（完整版）
            'twoTigers': {
                name: '两只老虎',
                notes: ['C4', 'D4', 'E4', 'C4', 'C4', 'D4', 'E4', 'C4',
                    'E4', 'F4', 'G4', 'E4', 'F4', 'G4',
                    'G4', 'A4', 'G4', 'F4', 'E4', 'C4', 'G4', 'A4', 'G4', 'F4', 'E4', 'C4',
                    'D4', 'G3', 'C4', 'D4', 'G3', 'C4'],
                tempo: 110
            },
            // 新增：童话镇
            'fairytaleTown': {
                name: '童话镇',
                notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4',
                    'C4', 'D4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4',
                    'A3', 'C4', 'D4', 'E4', 'G4', 'E4', 'D4', 'C4', 'A3',
                    'A3', 'C4', 'D4', 'C4', 'A3', 'G3', 'E3', 'G3', 'A3'],
                tempo: 90
            },
            // 新增：粉刷匠
            'painter': {
                name: '粉刷匠',
                notes: ['C4', 'E4', 'G4', 'G4', 'A4', 'G4', 'E4', 'C4',
                    'C4', 'E4', 'G4', 'G4', 'A4', 'G4', 'E4', 'C4',
                    'G4', 'E4', 'G4', 'A4', 'G4', 'E4', 'C4', 'D4', 'E4',
                    'G4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4'],
                tempo: 115
            }
        };

        // 定义民乐经典简谱
        const folkSongs = {
            // 茉莉花
            'jasmineFrag': {
                name: '茉莉花',
                notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'A4', 'G4', 'E4', 'G4',
                    'C4', 'D4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4',
                    'D4', 'E4', 'C4', 'D4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4',
                    'A3', 'C4', 'D4', 'E4', 'G4', 'E4', 'D4', 'C4'],
                tempo: 80
            },
            // 高山流水
            'highMountain': {
                name: '高山流水',
                notes: ['G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'E5', 'D5', 'C5', 'A4', 'G4',
                    'E4', 'G4', 'A4', 'C5', 'D5', 'C5', 'A4', 'G4', 'E4',
                    'D4', 'E4', 'G4', 'A4', 'C5', 'A4', 'G4', 'E4', 'D4',
                    'C4', 'D4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4'],
                tempo: 90
            },
            // 渔舟唱晚
            'fishingBoat': {
                name: '渔舟唱晚',
                notes: ['G4', 'E4', 'G4', 'A4', 'C5', 'A4', 'G4', 'E4', 'D4',
                    'C4', 'D4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4',
                    'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'E4', 'D4', 'C4', 'A3', 'G3'],
                tempo: 75
            }
        };

        // 定义游戏音乐简谱
        const gameSongs = {
            // 超级马里奥主题
            'mario': {
                name: '超级马里奥',
                notes: ['E4', 'E4', 'E4', 'C4', 'E4', 'G4', 'G3',
                    'C4', 'G3', 'E3', 'A3', 'B3', 'Bb3', 'A3',
                    'G3', 'E4', 'G4', 'A4', 'F4', 'G4', 'E4', 'C4', 'D4', 'B3'],
                tempo: 160
            },
            // 塞尔达传说主题
            'zelda': {
                name: '塞尔达传说',
                notes: ['A3', 'D4', 'F4', 'G4', 'A4', 'D5', 'F5', 'G5', 'A5',
                    'A5', 'A5', 'A3', 'D4', 'F4', 'G4', 'A4'],
                tempo: 120
            },
            // 俄罗斯方块主题
            'tetris': {
                name: '俄罗斯方块',
                notes: ['E5', 'B4', 'C5', 'D5', 'C5', 'B4', 'A4', 'A4', 'C5', 'E5', 'D5', 'C5', 'B4', 'C5', 'D5', 'E5', 'C5', 'A4', 'A4',
                    'D5', 'F5', 'A5', 'G5', 'F5', 'E5', 'C5', 'E5', 'D5', 'C5', 'B4', 'B4', 'C5', 'D5', 'E5', 'C5', 'A4', 'A4'],
                tempo: 140
            }
        };

        // 定义古典名曲简谱片段
        const classicalSongs = {
            // 欢乐颂
            'odeToJoy': {
                name: '欢乐颂',
                notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4', 'C4', 'D4', 'E4', 'E4', 'D4', 'D4',
                    'E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4', 'C4', 'D4', 'E4', 'D4', 'C4', 'C4'],
                tempo: 110
            },
            // 天鹅湖
            'swanLake': {
                name: '天鹅湖',
                notes: ['B3', 'D4', 'G4', 'A4', 'B4', 'G4', 'A4', 'B4', 'G4', 'A4', 'B4', 'C5', 'D5',
                    'D5', 'C5', 'B4', 'A4', 'G4', 'D4', 'G4', 'A4', 'B4', 'G4'],
                tempo: 80
            },
            // 四季-春
            'fourSeasons': {
                name: '四季-春',
                notes: ['E4', 'G4', 'E4', 'G4', 'E4', 'B4', 'E4', 'G4', 'E4', 'G4', 'E4', 'B4', 'E4', 'G4',
                    'E5', 'Eb5', 'D5', 'G4', 'B4', 'D5', 'G4', 'B4', 'D5', 'G4'],
                tempo: 105
            }
        };

        // 合并所有分类的简谱
        const allMelodies = {
            ...childrenSongs,
            ...folkSongs,
            ...gameSongs,
            ...classicalSongs
        };

        // 设置各简谱的分类
        for (const id in childrenSongs) {
            this.melodyCategories[id] = 'children';
        }
        for (const id in folkSongs) {
            this.melodyCategories[id] = 'folk';
        }
        for (const id in gameSongs) {
            this.melodyCategories[id] = 'game';
        }
        for (const id in classicalSongs) {
            this.melodyCategories[id] = 'classical';
        }

        // 将所有简谱添加到集合中
        for (const [id, melody] of Object.entries(allMelodies)) {
            this.melodies[id] = melody;
        }

        logger.info(`加载了${Object.keys(this.melodies).length}个内置简谱`);
        return this.melodies;
    }

    /**
     * 获取所有可用简谱的ID列表
     * @returns {Array} 简谱ID数组
     */
    getMelodyList() {
        return Object.keys(this.melodies);
    }

    /**
     * 获取指定分类的简谱列表
     * @param {string} category - 分类ID
     * @returns {Array} 符合分类的简谱ID数组
     */
    getMelodiesByCategory(category) {
        if (!this.categories[category]) {
            return [];
        }

        return Object.keys(this.melodies).filter(id =>
            this.melodyCategories[id] === category
        );
    }

    /**
     * 获取所有分类
     * @returns {Object} 分类ID到分类名称的映射
     */
    getCategories() {
        return { ...this.categories };
    }

    /**
     * 根据ID获取简谱
     * @param {string} melodyId - 简谱ID
     * @returns {Object|null} 简谱对象或null
     */
    getMelody(melodyId) {
        return this.melodies[melodyId] || null;
    }

    /**
     * 从JSON文件加载简谱
     * @param {string} url - JSON文件路径
     * @returns {Promise} 加载结果
     */
    loadFromJson(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP错误! 状态: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // 处理获取的简谱数据
                if (Array.isArray(data)) {
                    // 处理简谱数组
                    data.forEach(melody => {
                        if (melody.id && melody.notes) {
                            this.melodies[melody.id] = melody;

                            // 若有分类信息，记录简谱分类
                            if (melody.category && this.categories[melody.category]) {
                                this.melodyCategories[melody.id] = melody.category;
                            }
                        }
                    });
                } else if (data.id && data.notes) {
                    // 处理单个简谱对象
                    this.melodies[data.id] = data;

                    // 若有分类信息，记录简谱分类
                    if (data.category && this.categories[data.category]) {
                        this.melodyCategories[data.id] = data.category;
                    }
                }

                logger.info(`从${url}加载了${Array.isArray(data) ? data.length : 1}个简谱`);
                return this.melodies;
            })
            .catch(error => {
                logger.error('加载简谱文件失败:', error);
                throw error;
            });
    }

    /**
     * 添加自定义简谱
     * @param {string} id - 简谱唯一标识
     * @param {string} name - 简谱名称
     * @param {Array} notes - 音符数组
     * @param {Object} options - 其他选项
     * @param {number} options.tempo - 速度(BPM)
     * @param {string} options.category - 分类ID
     * @returns {Object} 新添加的简谱
     */
    addCustomMelody(id, name, notes, options = {}) {
        const melody = {
            name: name,
            notes: notes,
            tempo: options.tempo || 120
        };

        this.melodies[id] = melody;

        // 若有分类信息，记录简谱分类
        if (options.category && this.categories[options.category]) {
            this.melodyCategories[id] = options.category;
        }

        logger.info(`添加了自定义简谱「${name}」`);
        return melody;
    }

    /**
     * 从简谱字符串解析
     * @param {string} id - 简谱唯一标识
     * @param {string} name - 简谱名称
     * @param {string} notation - 简谱字符串，如"1 2 3 1"
     * @param {Object} options - 其他选项
     * @param {number} options.tempo - 速度(BPM)
     * @param {string} options.category - 分类ID
     * @returns {Object} 解析后的简谱
     */
    parseFromNotation(id, name, notation, options = {}) {
        // 简谱数字到音符的基础映射 (默认中音区域，4表示第4八度)
        const baseNoteMap = {
            '1': 'C4', '2': 'D4', '3': 'E4', '4': 'F4',
            '5': 'G4', '6': 'A4', '7': 'B4',
            '0': '0'  // 休止符
        };

        // 分割并解析简谱字符串
        const notes = notation.split(/\s+/).map(token => {
            // 如果是休止符
            if (token === '0') return '0';

            // 处理基本音高
            let octave = 4; // 默认中音区域
            let note = '';
            let accidental = '';

            // 提取音高数字
            const numMatch = token.match(/[1-7]/);
            if (!numMatch) return null;

            const baseNum = numMatch[0];
            const baseNote = baseNoteMap[baseNum].charAt(0);

            // 处理升降号
            if (token.includes('#')) accidental = '#';
            else if (token.includes('b')) accidental = 'b';

            // 处理八度记号
            if (token.includes('+')) {
                // 数+'表示高八度
                const plusCount = (token.match(/\+/g) || []).length;
                octave += plusCount;
            } else if (token.includes('-')) {
                // 数-表示低八度
                const minusCount = (token.match(/\-/g) || []).length;
                octave -= minusCount;
            }

            // 组合最终的音符
            note = baseNote + accidental + octave;
            return note;
        }).filter(note => note !== null);

        return this.addCustomMelody(id, name, notes, {
            tempo: options.tempo || 120,
            category: options.category
        });
    }

    /**
     * 导出简谱为JSON字符串
     * @param {string} melodyId - 简谱ID
     * @returns {string} JSON字符串
     */
    exportMelodyToJson(melodyId) {
        const melody = this.getMelody(melodyId);
        if (!melody) return '{}';

        const exportData = {
            id: melodyId,
            ...melody,
            category: this.melodyCategories[melodyId] || ''
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * 导出全部简谱
     * @returns {string} JSON字符串
     */
    exportAllMelodies() {
        const allData = Object.keys(this.melodies).map(id => ({
            id,
            ...this.melodies[id],
            category: this.melodyCategories[id] || ''
        }));

        return JSON.stringify(allData, null, 2);
    }
}

export default MelodyManager; 