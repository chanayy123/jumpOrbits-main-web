/**
 * 平台特定配置
 */

/**
 * 平台配置定义
 */
export const PLATFORM_CONFIGS = {
    wechat: {
        width: 414,   // 微信小游戏适合的分辨率 (iPhone 12系列逻辑分辨率)
        height: 896,  // 现代手机屏幕比例，更清晰的显示效果
        debug: false,
        volume: 1.0
    },
    web: {
        width: 800,   // Web端适合的分辨率
        height: 600,  // 4:3比例，适合桌面浏览器
        debug: false,
        volume: 1.0
    },
    phaser: {
        width: 800,   // Phaser平台标准分辨率
        height: 800,  // 正方形比例，适合桌面应用
        debug: false,
        volume: 1.0
    }
};

/**
 * 获取当前平台类型
 */
export function getCurrentPlatform() {
    // 检测微信小游戏环境
    if (typeof wx !== 'undefined') {
        return 'wechat';
    }

    // 检测是否在浏览器环境中
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        // 如果是Phaser环境，可以通过特定标识判断
        if (typeof Phaser !== 'undefined') {
            return 'phaser';
        }
        return 'web';
    }

    // 默认返回web平台
    return 'web';
}

/**
 * 获取当前平台的配置
 */
export function getCurrentPlatformConfig() {
    const platform = getCurrentPlatform();
    return PLATFORM_CONFIGS[platform];
}

/**
 * 获取指定平台的配置
 */
export function getPlatformConfig(platform) {
    return PLATFORM_CONFIGS[platform];
}