/**
 * 表示单个粒子的类
 * @private
 */
class Particle {
    /**
     * 初始化粒子属性
     */
    constructor() {
        this.x = 0;          // 粒子X坐标
        this.y = 0;          // 粒子Y坐标
        this.vx = 0;         // X方向速度
        this.vy = 0;         // Y方向速度
        this.life = 0;       // 当前生命值（毫秒）
        this.maxLife = 0;    // 最大生命值（毫秒）
        this.color = '';     // 粒子颜色
        this.size = 0;       // 粒子大小
        this.active = false; // 是否处于活跃状态
        this.lastUpdateTime = 0; // 上次更新时间
        this.alpha = 1;      // 透明度
    }

    /**
     * 重置粒子属性
     * @param {number} x - 初始X坐标
     * @param {number} y - 初始Y坐标
     * @param {number} vx - X方向初始速度
     * @param {number} vy - Y方向初始速度
     * @param {number} life - 生命周期（毫秒）
     * @param {string} color - 粒子颜色
     * @param {number} size - 粒子大小
     */
    reset(x, y, vx, vy, life, color, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.active = true;
        this.lastUpdateTime = performance.now();
        this.alpha = 1;
    }

    /**
     * 更新粒子状态
     * 包括生命周期、位置和速度的更新
     */
    update() {
        if (!this.active) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // 转换为秒
        this.lastUpdateTime = currentTime;

        // 更新生命值（毫秒）
        this.life -= deltaTime * 1000;
        if (this.life <= 0) {
            this.active = false;
            return;
        }

        // 基于时间更新位置
        this.x += this.vx * deltaTime * 60; // 乘以60使速度与60fps时相同
        this.y += this.vy * deltaTime * 60;

        // 添加一点重力效果，也基于时间
        this.vy += 0.1 * deltaTime * 60;

        // 更新透明度
        this.alpha = this.life / this.maxLife;
    }

    /**
     * 渲染粒子
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D上下文
     */
    render(ctx) {
        if (!this.active) return;

        // 使用缓存的透明度
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * 粒子系统类，管理所有粒子效果
 * 使用对象池模式优化性能
 * @export
 */
export class ParticleSystem {
    /**
     * 初始化粒子系统
     */
    constructor() {
        // 对象池大小
        this.poolSize = 200;
        this.particles = [];
        this.initPool();

        // 批量渲染优化
        this.batchRenderStates = new Map();

        // 当前主题
        this.currentTheme = 'default';
    }

    /**
     * 设置当前主题
     * @param {string} theme - 主题名称
     */
    setTheme(theme) {
        this.currentTheme = theme;
    }

    /**
     * 初始化粒子对象池
     * @private
     */
    initPool() {
        for (let i = 0; i < this.poolSize; i++) {
            this.particles.push(new Particle());
        }
    }

    /**
     * 创建爆炸效果
     * @param {number} x - 爆炸中心X坐标
     * @param {number} y - 爆炸中心Y坐标
     * @param {string} color - 粒子颜色
     */
    createExplosion(x, y, color) {
        // 根据主题调整参数
        let particleCount, baseSpeed, baseLife, baseSize;

        if (this.currentTheme === 'cyberpunk') {
            // 赛博朋克主题使用优化后的参数
            particleCount = 8;
            baseSpeed = 2;
            baseLife = 400;
            baseSize = 1.5;
        } else {
            // 其他主题使用原有参数
            particleCount = 12;
            baseSpeed = 3;
            baseLife = 500;
            baseSize = 2;
        }

        for (let i = 0; i < particleCount; i++) {
            // 找到一个未激活的粒子
            const particle = this.particles.find(p => !p.active);
            if (!particle) continue;

            // 根据主题调整随机范围
            const angleRandomness = this.currentTheme === 'cyberpunk' ? 0.3 : 0.5;
            const speedRandomness = this.currentTheme === 'cyberpunk' ? 1 : 2;

            // 计算随机角度和速度
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * angleRandomness;
            const speed = baseSpeed + Math.random() * speedRandomness;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            // 随机化生命周期和大小
            const lifeRandomness = this.currentTheme === 'cyberpunk' ? 100 : 200;
            const sizeRandomness = this.currentTheme === 'cyberpunk' ? 0.5 : 1;
            const life = baseLife + Math.random() * lifeRandomness;
            const size = baseSize + Math.random() * sizeRandomness;

            particle.reset(x, y, vx, vy, life, color, size);
        }
    }

    /**
     * 更新所有活跃粒子的状态
     */
    update() {
        // 只更新活跃的粒子
        for (let i = 0; i < this.particles.length; i++) {
            if (this.particles[i].active) {
                this.particles[i].update();
            }
        }
    }

    /**
     * 渲染所有活跃粒子
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D上下文
     */
    render(ctx) {
        if (this.currentTheme === 'cyberpunk') {
            // 赛博朋克主题使用批量渲染优化
            ctx.save();
            this.batchRenderStates.clear();

            // 收集相同颜色的粒子
            for (let i = 0; i < this.particles.length; i++) {
                const particle = this.particles[i];
                if (!particle.active) continue;

                if (!this.batchRenderStates.has(particle.color)) {
                    this.batchRenderStates.set(particle.color, []);
                }
                this.batchRenderStates.get(particle.color).push(particle);
            }

            // 批量渲染相同颜色的粒子
            this.batchRenderStates.forEach((particles, color) => {
                ctx.fillStyle = color;
                particles.forEach(particle => {
                    ctx.globalAlpha = particle.life / particle.maxLife;
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                    ctx.fill();
                });
            });

            ctx.restore();
        } else {
            // 其他主题使用原有渲染方式
            this.particles.forEach(particle => {
                if (!particle.active) return;
                ctx.save();
                ctx.globalAlpha = particle.life / particle.maxLife;
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        }
    }
} 