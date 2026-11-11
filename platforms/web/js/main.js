import { WebGame } from './core/game.js';

// ?show=audio → 打开音效系统 v2 试听台（不启动游戏）
if (new URLSearchParams(location.search).get('show') === 'audio') {
    location.replace('./audio-lab.html' + location.search);
}

// 确保DOM完全加载后再创建游戏实例
document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('show') === 'audio') return;
    // 创建canvas元素
    const canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';

    // 获取游戏容器并添加canvas
    const gameContainer = document.getElementById('gameContainer');
    if (!gameContainer) {
        throw new Error('找不到游戏容器元素');
    }
    gameContainer.appendChild(canvas);

    // 创建游戏实例并传入canvas
    const game = new WebGame(canvas);
    game.start();
}); 