/**
 * 基础配置文件
 */
import { LogLevel, logger } from './logger.js';

// 基础游戏配置，平台无关的配置项
export const BASE_CONFIG = {
    // 游戏基础配置
    INITIAL_TRACKS: 5,           // 初始轨道数量
    SAFE_TRACK_COUNT: 3,        // 安全区域轨道数量（最外层不生成障碍）
    SPECIAL_TRACK_INTERVAL: 10,  // 特殊轨道间隔，每隔10圈出现一个特殊轨道

    // 动画相关
    JUMP_DURATION: 300,         // 跳跃动画持续时间（毫秒）

    // 游戏机制
    SCORE_PER_JUMP: 1,         // 每次成功跳跃的基础得分
    COMBO_THRESHOLD: 5,         // 连击阈值
    COMBO_BONUS: 2,            // 连击额外奖励分数
    MILESTONE_THRESHOLD: 10,    // 里程碑阈值
    MILESTONE_BONUS: 5,        // 达到里程碑的额外奖励分数

    // 难度设置
    DIFFICULTY_INCREASE_INTERVAL: 15,  // 每跳多少次增加一次难度
    MAX_DIFFICULTY_LEVEL: 10,          // 最大难度等级

    // 音频设置
    BACKGROUND_MUSIC: {
        VOLUME: 1.0,           // 背景音乐音量
        FADE_DURATION: 1000,   // 淡入淡出持续时间（毫秒）
    },

    // 音效设置
    SOUND_EFFECTS: {
        VOLUME: 0.6,           // 音效音量
        FADE_DURATION: 200,    // 音效淡入淡出持续时间（毫秒）
    },

    // 日志系统配置
    LOGGER: {
        DEFAULT_LEVEL: LogLevel.DEBUG,  // 默认日志级别
        ENABLE_LOGS: true,            // 是否启用日志
        SHOW_TIMESTAMP: true          // 是否显示时间戳
    },

    // 开发环境配置
    DEV: {
        DEBUG_MODE: true,        // 默认关闭开发模式
        SHOW_FPS: false,         // 默认不显示FPS
        SHOW_DEV_BUTTONS: true, // 是否显示开发按钮（FPS、主题、音频系统、设置）
        PERFORMANCE_LOGGING: false,
        INVINCIBLE_MODE: false   // 默认关闭无敌模式
    },

    // 视觉舒适性设置
    VISUAL_COMFORT: {
        ENABLED: true,              // 默认启用视觉舒适模式
        REDUCE_ANIMATIONS: true,    // 减少动画效果
        HIGH_CONTRAST: false,       // 高对比度模式（默认关闭）
        REDUCE_MOTION: false        // 减少运动效果（默认关闭）
    },

    // 主题颜色配置
    THEME_COLORS: {
        // 渐变背景颜色配置
        GRADIENT_STEPS: 50,  // 渐变背景颜色生成的步数
        GRADIENT: {
            'starsky': {
                startColors: ['#0a205a', '#030019'],
                endColors: ['#010108', '#010001']
            },
            'light': {
                startColors: ['#f8f9fa', '#e9ecef'],
                endColors: ['#0d0f10', '#070809']
            },
            'cyberpunk': {
                startColors: ['#1a1025', '#0f0e17', '#060412'],
                endColors: ['#010156', '#010121', '#010102']
            },
            'forest': {
                startColors: ['#344e41', '#2b3b2f'],
                endColors: ['#040805', '#020302']
            },
            'sunrise': {
                startColors: ['#00A8E8', '#007EA7', '#003459'],
                endColors: ['#FFD700', '#FFB703', '#FB8500']
            }
        },
        // 纯色背景颜色配置
        SOLID: {
            'starsky': {
                startColor: '#040c24',
                endColor: '#010102'
            },
            'light': {
                startColor: '#f8f9fa',
                endColor: '#0d0f10'
            },
            'cyberpunk': {
                startColor: '#0f0e17',
                endColor: '#010102'
            },
            'forest': {
                startColor: '#344e41',
                endColor: '#020403'
            },
            'sunrise': {
                startColor: '#001220',
                endColor: '#FFD700'
            }
        }
    }
};

// 障碍物轨道阶段常量
const OBSTACLE_STAGES = {
    SAFE_ZONE_OFFSET: 3,    // 安全区域偏移（前几圈不计算在内）

    // 速度相关配置
    BASE_SPEED: 1.0,        // 基础速度（弧度/秒）
    MAX_SPEED: 1.5,         // 最大速度（弧度/秒）
    SPEED_INCREMENT: 0.01,   // 每个区间的速度增量
    ZONE_LENGTH: 10,        // 每个区间的轨道数量
    ZONE_START: 3,          // 第一个区间的起始轨道（与安全区域对应）
    ZONE_GAP: 1,            // 区间之间的间隔轨道数

    // 障碍物数量相关配置
    BASE_OBSTACLE_COUNT: 20,    // 基础障碍物总数
    OBSTACLE_INCREMENT: 2,      // 每个区间增加的障碍物数量
    MAX_OBSTACLE_COUNT: 50,     // 最大障碍物总数
    MIN_OBSTACLES_PER_TRACK: 2, // 每个轨道最少障碍物数量
    MAX_OBSTACLES_PER_TRACK: 8  // 每个轨道最多障碍物数量
};

// Web平台特定的配置项
const WEB_SPECIFIC_CONFIG = {
    // 轨道系统
    TRACK_SPACING: 40,          // 轨道间距
    TRACK_BASE_WIDTH: 12,       // 轨道基础线条宽度（增加到12）
    TRACK_BASE_ALPHA: 0.8,      // 轨道基础透明度
    TRACK_MIN_ALPHA: 0.3,       // 轨道最小透明度

    // 轨道颜色配置
    TRACK_COLOR_CONFIG: {
        MIN_LIGHTNESS: 30,      // 最内圈最小亮度
        MAX_LIGHTNESS: 80,      // 最外圈最大亮度
        SATURATION: 70,         // 固定饱和度
    },

    // 背景颜色
    BACKGROUND_COLORS: [
        '#1a1a2e',  // 深蓝色
        '#16213e',  // 靛蓝色
        '#1b1b2f',  // 深紫色
        '#2c061f',  // 深红色
        '#24243e',  // 深灰紫色
        '#1f2833',  // 深青色
        '#2d132c',  // 深紫红色
        '#142850',  // 深蓝色
        '#1f4068',  // 深灰蓝色
        '#2b2e4a',  // 深灰色
        '#1a1a40',  // 深靛青色
        '#2d3436',  // 深石墨色
        '#0f3460'   // 深海蓝色
    ],

    // 玩家
    PLAYER_RADIUS: 8,         // 玩家半径
    PLAYER_SPEED: 2,           // 玩家移动速度
    PLAYER_COLOR: '#FFD700',   // 玩家颜色（金色）

    // 障碍星球
    OBSTACLE_RADIUS: 8,       // 障碍星球半径（略小于轨道线条宽度）
    OBSTACLE_BASE_SPEED: 1.0, // 障碍星球基础移动速度（弧度/秒）
    OBSTACLE_SPEED_CONFIG: {
        // 速度配置从OBSTACLE_STAGES中获取
        get BASE_SPEED() { return OBSTACLE_STAGES.BASE_SPEED; },
        get MAX_SPEED() { return OBSTACLE_STAGES.MAX_SPEED; },
        get SPEED_INCREMENT() { return OBSTACLE_STAGES.SPEED_INCREMENT; },
        get ZONE_LENGTH() { return OBSTACLE_STAGES.ZONE_LENGTH; },
        get ZONE_START() { return OBSTACLE_STAGES.ZONE_START; },
        get ZONE_GAP() { return OBSTACLE_STAGES.ZONE_GAP; }
    },
    OBSTACLE_COLOR: '#FF4136', // 障碍星球颜色（红色）

    // 跳跃惯性配置
    JUMP_INERTIA: {
        BASE_ANGLE: Math.PI / 6,  // 基础惯性角度（30度）
        DIFFICULTY_FACTOR: 0.1,    // 难度系数（每层增加的角度）
    },

    // 手势控制配置
    GESTURE_CONTROL: {
        SWIPE_THRESHOLD: 20,       // 滑动阈值（像素），降低以便更容易触发
        MIN_INERTIA_FACTOR: -0.5,  // 最小惯性因子（逆向滑动）
        MAX_INERTIA_FACTOR: 1.4,   // 最大惯性因子（顺向滑动），增加以加强效果
        SWIPE_SENSITIVITY: 0.03,   // 滑动灵敏度，增加为0.03使效果更明显
        FEEDBACK_DURATION: 500,    // 视觉反馈持续时间（毫秒）
    },

    // 视觉效果
    VIEWPORT_PADDING: 50,      // 视口边距
    TRACK_BUFFER_COUNT: 10,    // 视野外保留的轨道数量

    // 障碍物配置
    OBSTACLE_CONFIG: {
        MIN_COUNT: 3,  // 每个轨道最少障碍物数量
        MAX_COUNT: 6,  // 每个轨道最多障碍物数量
        RANDOM_OFFSET: 0,  // 位置随机偏移量（相对于均匀间隔的比例）
        get MIN_TRACK_OBSTACLES() { return OBSTACLE_STAGES.MIN_OBSTACLES_PER_TRACK; },
        get MAX_TRACK_OBSTACLES() { return OBSTACLE_STAGES.MAX_OBSTACLES_PER_TRACK; }
    },

    // 视觉舒适模式配置
    VISUAL_COMFORT: {
        ENABLED: false,           // 默认关闭
        HIGH_CONTRAST: false,     // 高对比度模式
    },
};

// 合并基础配置和Web平台特定配置
export const GAME_CONFIG = {
    ...BASE_CONFIG,
    ...WEB_SPECIFIC_CONFIG,
    OBSTACLE_STAGES,  // 添加障碍物阶段常量
    BACKGROUND_COLORS: [
        '#001f3f',  // 深蓝色
        '#0074D9',  // 蓝色
        '#7FDBFF',  // 浅蓝色
        '#39CCCC',  // 青色
        '#3D9970',  // 绿色
        '#2ECC40',  // 亮绿色
        '#01FF70',  // 荧光绿
    ]
};

// 更新logger配置
logger.updateConfig(BASE_CONFIG.LOGGER);

export default BASE_CONFIG; 