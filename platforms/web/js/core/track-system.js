import { WebTrack } from './track.js';
import { WebObstacle } from './obstacle.js';
import { GAME_CONFIG } from './utils/config.js';
import { logger } from './utils/logger.js';
import { BASE_CONFIG } from './utils/config.js';

export class WebTrackSystem {
    constructor(canvas) {
        // 基础TrackSystem类的属性
        this.tracks = [];
        this.totalTracks = BASE_CONFIG.INITIAL_TRACKS; // 使用基础配置
        this.centerX = 0;
        this.centerY = 0;
        this.visibleTracks = []; // 缓存视口内的轨道

        // WebTrackSystem特有属性
        this.canvas = canvas;
        this.game = null;
        this.updateCenter(canvas.width / 2, canvas.height / 2);
        this.themeManager = null; // 添加主题管理器引用

        // 特殊轨道配置
        this.specialTrackInterval = GAME_CONFIG.SPECIAL_TRACK_INTERVAL || 10; // 每隔10圈出现特殊轨道
        this.specialTrackCount = 1; // 每次出现1个特殊轨道

        // 根据安全区轨道数量和特殊轨道间隔动态计算第一个特殊轨道的位置
        // 安全区域有3个圈，从第4圈开始计算特殊轨道间隔，因此第一个特殊轨道应该是在第4+10=14圈
        const safeAreaCircles = GAME_CONFIG.SAFE_TRACK_COUNT || 3; // 使用配置中的安全区轨道数量，默认为3
        this.firstSpecialTrackCircle = safeAreaCircles + 1 + this.specialTrackInterval; // 第一个特殊轨道的圈数

        // 非特殊区域的障碍物数量计划
        this.nonSpecialAreaObstaclePlan = new Map(); // 圈数 -> 障碍物数量
        this.betweenSpecialObstaclePlan = new Map(); // 圈数 -> 障碍物数量

        // 跟踪最后一个特殊轨道的圈数
        this.lastSpecialTrackCircle = -1;

        // 标记障碍物计划是否已初始化
        this.isObstaclePlanInitialized = false;
    }

    // 计算给定圈数所在的障碍物区间
    calculateObstacleZone(circle) {
        const {
            ZONE_START,
            ZONE_LENGTH,
            ZONE_GAP
        } = GAME_CONFIG.OBSTACLE_STAGES;

        // 安全区后才开始计算区间
        if (circle <= ZONE_START) {
            return -1; // 安全区不属于任何区间
        }

        // 考虑到区间长度和间隔，每个完整周期的长度是 ZONE_LENGTH + ZONE_GAP
        const adjustedCircle = circle - ZONE_START;
        const cyclePeriod = ZONE_LENGTH + ZONE_GAP;
        const currentZone = Math.floor(adjustedCircle / cyclePeriod);
        const positionInCycle = adjustedCircle % cyclePeriod;

        // 如果在区间间隔中，返回上一个区间
        if (positionInCycle >= ZONE_LENGTH) {
            return currentZone;
        }

        // 返回当前区间（从0开始）
        return currentZone;
    }

    // 根据区间获取障碍物总数
    getObstacleCountForZone(zone) {
        const {
            BASE_OBSTACLE_COUNT,
            OBSTACLE_INCREMENT,
            MAX_OBSTACLE_COUNT
        } = GAME_CONFIG.OBSTACLE_STAGES;

        if (zone < 0) {
            return 0; // 安全区没有障碍物
        }

        // 计算区间障碍物总数 = 基础数量 + (区间序号 * 增量)
        const count = BASE_OBSTACLE_COUNT + (zone * OBSTACLE_INCREMENT);

        // 确保不超过最大总数
        return Math.min(count, MAX_OBSTACLE_COUNT);
    }

    // 初始化障碍物分配计划
    initializeObstaclePlans() {
        // 预先为非特殊区域生成障碍物分配计划
        this.generateNonSpecialAreaObstaclePlan();

        // 预先生成多个特殊轨道之后的障碍物计划
        // 我们预先生成5个特殊轨道后的区域，这样能覆盖到约70圈
        let currentSpecialCircle = this.firstSpecialTrackCircle;
        const preGenerateCount = 5; // 预先生成5个特殊轨道区域的障碍物计划

        logger.info(`开始预生成${preGenerateCount}个特殊轨道之后的障碍物计划`);
        logger.info(`第一个特殊轨道在第${currentSpecialCircle}圈`);

        const specialCircles = [currentSpecialCircle];

        // 生成每个特殊轨道之后的障碍物计划
        for (let i = 0; i < preGenerateCount; i++) {
            this.generateBetweenSpecialObstaclePlan(currentSpecialCircle);

            // 获取下一个特殊轨道
            const nextSpecialCircle = this.getNextSpecialCircle(currentSpecialCircle);
            currentSpecialCircle = nextSpecialCircle;
            specialCircles.push(currentSpecialCircle);
        }

        // 更新最后一个特殊轨道的圈数，确保下次新建轨道时能正确识别区域
        this.lastSpecialTrackCircle = this.firstSpecialTrackCircle;

        logger.info(`初始化障碍物计划完成，已生成非特殊区域和${preGenerateCount}个特殊轨道之后的障碍物计划`);
        logger.info(`预生成的特殊轨道圈数: ${specialCircles.join(', ')}`);
    }

    // 为非特殊区域生成障碍物分配计划
    generateNonSpecialAreaObstaclePlan() {
        const {
            MIN_OBSTACLES_PER_TRACK,
            MAX_OBSTACLES_PER_TRACK
        } = GAME_CONFIG.OBSTACLE_STAGES;

        // 清空现有计划
        this.nonSpecialAreaObstaclePlan.clear();

        // 非特殊区域是安全区后的第一个圈到第一个特殊轨道之前
        const safeAreaCircles = GAME_CONFIG.SAFE_TRACK_COUNT || 3;
        const startCircle = safeAreaCircles + 1; // 从安全区后的第一个圈开始
        const endCircle = this.firstSpecialTrackCircle - 1; // 到第一个特殊轨道之前
        const nonSpecialTrackCount = endCircle - startCircle + 1; // 计算轨道数量

        if (nonSpecialTrackCount <= 0) return;

        // 按区间分组轨道
        const tracksByZone = new Map(); // 区间 -> 轨道圈数数组
        for (let circle = startCircle; circle <= endCircle; circle++) {
            const zone = this.calculateObstacleZone(circle);
            if (!tracksByZone.has(zone)) {
                tracksByZone.set(zone, []);
            }
            tracksByZone.get(zone).push(circle);
        }

        logger.debug(`非特殊区域共分为${tracksByZone.size}个障碍物区间`);

        // 为每个区间分配障碍物
        tracksByZone.forEach((circles, zone) => {
            const totalObstaclesForZone = this.getObstacleCountForZone(zone);
            const tracksInZone = circles.length;

            logger.debug(`区间${zone}（圈数${circles.join(',')})：总计${totalObstaclesForZone}个障碍物，${tracksInZone}个轨道`);

            // 步骤1: 确保每个轨道至少有MIN_OBSTACLES_PER_TRACK个障碍物
            // 如果轨道数量过多，无法满足最小需求，则平均分配
            if (tracksInZone * MIN_OBSTACLES_PER_TRACK > totalObstaclesForZone) {
                logger.warn(`警告: 区间${zone}轨道数量(${tracksInZone})过多，无法满足每个轨道最少${MIN_OBSTACLES_PER_TRACK}个障碍物的要求`);

                // 平均分配
                const baseObstaclesPerTrack = Math.floor(totalObstaclesForZone / tracksInZone);
                let extra = totalObstaclesForZone % tracksInZone;

                circles.forEach(circle => {
                    let count = baseObstaclesPerTrack;
                    if (extra > 0) {
                        count++;
                        extra--;
                    }
                    this.nonSpecialAreaObstaclePlan.set(circle, count);
                });
            } else {
                // 步骤2: 随机分配，但确保每个轨道至少有MIN_OBSTACLES_PER_TRACK个，且不超过MAX_OBSTACLES_PER_TRACK个

                // 先给每个轨道分配最小数量
                let remainingObstacles = totalObstaclesForZone;
                circles.forEach(circle => {
                    this.nonSpecialAreaObstaclePlan.set(circle, MIN_OBSTACLES_PER_TRACK);
                    remainingObstacles -= MIN_OBSTACLES_PER_TRACK;
                });

                logger.debug(`区间${zone}已分配最小障碍物数量，剩余${remainingObstacles}个待分配`);

                // 创建轨道圈数数组，用于随机分配
                let trackCircles = [...circles];

                // 随机打乱轨道顺序
                trackCircles = this.shuffleArray(trackCircles);

                // 随机分配剩余的障碍物
                while (remainingObstacles > 0 && trackCircles.length > 0) {
                    // 重新筛选可以分配的轨道（未达到最大值的轨道）
                    trackCircles = trackCircles.filter(circle => {
                        return this.nonSpecialAreaObstaclePlan.get(circle) < MAX_OBSTACLES_PER_TRACK;
                    });

                    if (trackCircles.length === 0) break;

                    // 随机选择一个轨道
                    const randomIndex = Math.floor(Math.random() * trackCircles.length);
                    const circle = trackCircles[randomIndex];

                    // 给选中的轨道增加一个障碍物
                    const currentCount = this.nonSpecialAreaObstaclePlan.get(circle);
                    this.nonSpecialAreaObstaclePlan.set(circle, currentCount + 1);
                    remainingObstacles--;
                }
            }
        });

        // 打印生成的计划
        logger.debug("非特殊区域障碍物最终分配计划:");
        let totalPlanned = 0;
        for (let circle = startCircle; circle <= endCircle; circle++) {
            const count = this.nonSpecialAreaObstaclePlan.get(circle) || 0;
            const zone = this.calculateObstacleZone(circle);
            logger.debug(`  第${circle}圈(区间${zone}): ${count}个障碍物`);
            totalPlanned += count;
        }
        logger.debug(`总计划分配: ${totalPlanned}个障碍物`);
    }

    // 对两个特殊轨道之间的区域生成障碍物分配计划
    generateBetweenSpecialObstaclePlan(startCircle) {
        const {
            MIN_OBSTACLES_PER_TRACK,
            MAX_OBSTACLES_PER_TRACK
        } = GAME_CONFIG.OBSTACLE_STAGES;

        // 计算下一个特殊轨道的圈数
        const nextSpecialCircle = this.getNextSpecialCircle(startCircle);

        // 计算两个特殊轨道之间的轨道数量
        const trackCount = nextSpecialCircle - startCircle - 1;

        if (trackCount <= 0) return;

        // 清除这段区域的现有计划
        for (let circle = startCircle + 1; circle < nextSpecialCircle; circle++) {
            this.betweenSpecialObstaclePlan.delete(circle);
        }

        // 按区间分组轨道
        const tracksByZone = new Map(); // 区间 -> 轨道圈数数组
        for (let circle = startCircle + 1; circle < nextSpecialCircle; circle++) {
            const zone = this.calculateObstacleZone(circle);
            if (!tracksByZone.has(zone)) {
                tracksByZone.set(zone, []);
            }
            tracksByZone.get(zone).push(circle);
        }

        logger.debug(`特殊轨道${startCircle}到${nextSpecialCircle}之间共分为${tracksByZone.size}个障碍物区间`);

        // 为每个区间分配障碍物
        tracksByZone.forEach((circles, zone) => {
            const totalObstaclesForZone = this.getObstacleCountForZone(zone);
            const tracksInZone = circles.length;

            logger.debug(`区间${zone}（圈数${circles.join(',')})：总计${totalObstaclesForZone}个障碍物，${tracksInZone}个轨道`);

            // 步骤1: 确保每个轨道至少有MIN_OBSTACLES_PER_TRACK个障碍物
            // 如果轨道数量过多，无法满足最小需求，则平均分配
            if (tracksInZone * MIN_OBSTACLES_PER_TRACK > totalObstaclesForZone) {
                logger.warn(`警告: 区间${zone}轨道数量(${tracksInZone})过多，无法满足每个轨道最少${MIN_OBSTACLES_PER_TRACK}个障碍物的要求`);

                // 平均分配
                const baseObstaclesPerTrack = Math.floor(totalObstaclesForZone / tracksInZone);
                let extra = totalObstaclesForZone % tracksInZone;

                circles.forEach(circle => {
                    let count = baseObstaclesPerTrack;
                    if (extra > 0) {
                        count++;
                        extra--;
                    }
                    this.betweenSpecialObstaclePlan.set(circle, count);
                });
            } else {
                // 步骤2: 随机分配，但确保每个轨道至少有MIN_OBSTACLES_PER_TRACK个，且不超过MAX_OBSTACLES_PER_TRACK个

                // 先给每个轨道分配最小数量
                let remainingObstacles = totalObstaclesForZone;
                circles.forEach(circle => {
                    this.betweenSpecialObstaclePlan.set(circle, MIN_OBSTACLES_PER_TRACK);
                    remainingObstacles -= MIN_OBSTACLES_PER_TRACK;
                });

                logger.debug(`区间${zone}已分配最小障碍物数量，剩余${remainingObstacles}个待分配`);

                // 创建轨道圈数数组，用于随机分配
                let trackCircles = [...circles];

                // 随机打乱轨道顺序
                trackCircles = this.shuffleArray(trackCircles);

                // 随机分配剩余的障碍物
                while (remainingObstacles > 0 && trackCircles.length > 0) {
                    // 重新筛选可以分配的轨道（未达到最大值的轨道）
                    trackCircles = trackCircles.filter(circle => {
                        return this.betweenSpecialObstaclePlan.get(circle) < MAX_OBSTACLES_PER_TRACK;
                    });

                    if (trackCircles.length === 0) break;

                    // 随机选择一个轨道
                    const randomIndex = Math.floor(Math.random() * trackCircles.length);
                    const circle = trackCircles[randomIndex];

                    // 给选中的轨道增加一个障碍物
                    const currentCount = this.betweenSpecialObstaclePlan.get(circle);
                    this.betweenSpecialObstaclePlan.set(circle, currentCount + 1);
                    remainingObstacles--;
                }
            }
        });

        // 打印生成的计划
        logger.debug("特殊轨道之间障碍物最终分配计划:");
        let totalPlanned = 0;
        for (let circle = startCircle + 1; circle < nextSpecialCircle; circle++) {
            const count = this.betweenSpecialObstaclePlan.get(circle) || 0;
            const zone = this.calculateObstacleZone(circle);
            logger.debug(`  第${circle}圈(区间${zone}): ${count}个障碍物`);
            totalPlanned += count;
        }
        logger.debug(`总计划分配: ${totalPlanned}个障碍物`);
    }

    // 数组随机打乱
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // 判断某个圈数是否是特殊轨道
    isSpecialCircle(circle) {
        const safeAreaCircles = GAME_CONFIG.SAFE_TRACK_COUNT || 3; // 使用配置中的安全区轨道数量，默认为3
        if (circle <= safeAreaCircles) return false; // 安全区不是特殊轨道

        // 检查是否是特殊轨道
        if (circle === this.firstSpecialTrackCircle) return true; // 第一个特殊轨道

        // 按照设计，特殊轨道之间的间隔是固定的(specialTrackInterval)
        // 特殊轨道位于: 第一个特殊轨道 + n*(特殊轨道间隔+1)
        // 例如: 第一个在14圈，间隔为10，则后续特殊轨道在: 14, 25, 36, 47...

        // 检查是否是第n个特殊轨道 (n > 1)
        // 计算与第一个特殊轨道的差距
        const diff = circle - this.firstSpecialTrackCircle;

        // 特殊轨道的位置规律是：第一个特殊轨道 + n*(间隔+1)
        // 所以我们检查diff是否能被(间隔+1)整除
        return diff > 0 && diff % (this.specialTrackInterval + 1) === 0;
    }

    // 获取第一个特殊轨道的圈数
    getFirstSpecialCircle(startCircle) {
        if (startCircle <= this.firstSpecialTrackCircle) return this.firstSpecialTrackCircle;

        // 计算下一个特殊轨道
        const offset = startCircle - this.firstSpecialTrackCircle;
        const intervals = Math.ceil(offset / this.specialTrackInterval);
        return this.firstSpecialTrackCircle + intervals * this.specialTrackInterval;
    }

    // 获取下一个特殊轨道的圈数
    getNextSpecialCircle(currentCircle) {
        if (currentCircle < this.firstSpecialTrackCircle) return this.firstSpecialTrackCircle;

        // 如果当前圈数正好是特殊轨道
        if (this.isSpecialCircle(currentCircle)) {
            return currentCircle + 1 + this.specialTrackInterval;
        }

        // 否则找到下一个特殊轨道
        // 计算第一个大于currentCircle的特殊轨道
        const diff = currentCircle - this.firstSpecialTrackCircle;
        const intervalPlusOne = this.specialTrackInterval + 1;
        const nextMultiple = Math.ceil(diff / intervalPlusOne);
        return this.firstSpecialTrackCircle + nextMultiple * intervalPlusOne;
    }

    // 设置game引用并初始化
    setGame(game) {
        this.game = game;
        // 在设置game后进行初始化
        this.createInitialTracks();

        // 如果已经设置了主题管理器，更新轨道颜色
        if (this.themeManager) {
            this.updateTrackColors();
        }
    }

    // 判断轨道是否是从外向内的第n圈
    isNthTrackFromOutside(track, n) {
        // 计算这个轨道是从外向内数第几圈
        const trackFromOutside = this.totalTracks - track.index;
        return trackFromOutside === n;
    }

    // 根据轨道获取其圈数
    getTrackCircle(track) {
        return this.totalTracks - track.index;
    }

    // 获取当前最深轨道的圈数
    getDeepestTrack() {
        // 最深轨道就是最内层的轨道，即index为0的轨道
        return this.totalTracks;
    }

    // 覆盖基类的setup方法，确保正确初始化轨道系统
    setup() {
        // 如果轨道已经创建，就不需要再次创建
        if (this.tracks.length > 0) {
            return;
        }

        // 清空现有轨道
        this.tracks = [];
        this.visibleTracks = [];

        // 使用createInitialTracks方法创建初始轨道
        this.createInitialTracks();

        // 如果已设置主题管理器，初始化轨道颜色
        if (this.themeManager) {
            this.updateTrackColors();
        }

        // 测试区间分配
        this.testZoneDistribution();
    }

    // 创建初始轨道
    createInitialTracks() {
        // 初始创建轨道
        this.totalTracks = GAME_CONFIG.INITIAL_TRACKS;

        // 重新生成非特殊区域障碍物分配计划
        if (!this.isObstaclePlanInitialized) {
            this.initializeObstaclePlans();
            this.isObstaclePlanInitialized = true;
        }

        // 从外到内创建轨道
        for (let i = this.totalTracks - 1; i >= 0; i--) {
            const track = this.createTrack(i);
            // 设置初始半径
            track.radius = this.getTrackSpacing() * (i + 1);
            this.tracks.unshift(track);
        }

        // 更新可见轨道
        this.visibleTracks = [...this.tracks];

        // 修正障碍物数量，确保与计划一致
        this.verifyAndCorrectObstacleCount();

        // 打印当前生成的轨道信息
        logger.debug("初始轨道创建完成:");
        for (let i = 0; i < this.tracks.length; i++) {
            const track = this.tracks[i];
            const circle = this.getTrackCircle(track);
            logger.debug(`  第${circle}圈: ${track.isSpecial ? '特殊轨道' : '普通轨道'}, 障碍物数量: ${track.obstacles.length}`);
        }
    }

    // 为轨道创建障碍星球
    createObstaclesForTrack(track) {
        const circleNumber = this.getTrackCircle(track);
        const safeAreaCircles = GAME_CONFIG.SAFE_TRACK_COUNT || 3; // 使用配置中的安全区轨道数量，默认为3

        // 在安全区后的轨道上生成障碍球
        if (circleNumber > safeAreaCircles) {
            // 特殊轨道不生成障碍物
            if (track.isSpecial) {
                // 如果是特殊轨道，更新最后一个特殊轨道的圈数
                this.lastSpecialTrackCircle = circleNumber;

                // 为两个特殊轨道之间的区域生成障碍物分配计划
                this.generateBetweenSpecialObstaclePlan(circleNumber);

                return;
            }

            let obstacleCount = 0;

            // 检查是否在特殊轨道之间区域
            const prevSpecialCircle = this.getPreviousSpecialCircle(circleNumber);
            const nextSpecialCircle = this.getNextSpecialCircle(prevSpecialCircle);

            // 确定这个轨道应该有多少个障碍物
            if (circleNumber > prevSpecialCircle && circleNumber < nextSpecialCircle) {
                // 如果在两个特殊轨道之间
                obstacleCount = this.betweenSpecialObstaclePlan.get(circleNumber) || 0;
                logger.debug(`轨道处于特殊轨道之间区域: 第${circleNumber}圈，从${prevSpecialCircle}到${nextSpecialCircle}，分配${obstacleCount}个障碍物`);
            } else if (circleNumber >= 4 && circleNumber <= this.firstSpecialTrackCircle - 1) {
                // 如果在非特殊区域（第4圈到第一个特殊轨道之间）
                obstacleCount = this.nonSpecialAreaObstaclePlan.get(circleNumber) || 0;
                logger.debug(`轨道处于非特殊区域: 第${circleNumber}圈，分配${obstacleCount}个障碍物`);
            } else {
                logger.debug(`轨道处于未分类区域: 第${circleNumber}圈，不分配障碍物`);
            }

            // 如果障碍物数量为0，不需要创建
            if (obstacleCount <= 0) return;

            // 创建障碍物
            this.createObstaclesForTrackWithCount(track, obstacleCount);
        }
    }

    updateCenter(x, y) {
        this.centerX = x;
        this.centerY = y;
        // 更新所有轨道的中心点
        if (this.tracks) {
            this.tracks.forEach(track => {
                track.x = this.centerX;
                track.y = this.centerY;
            });
        }
    }

    // 修改createTrack方法以使用主题管理器
    createTrack(index) {
        const circle = this.totalTracks - index;

        // 判断是否为特殊轨道
        const isSpecial = this.isSpecialCircle(circle);

        // 创建Web轨道
        const track = new WebTrack(this.canvas, {
            centerX: this.centerX,
            centerY: this.centerY,
            radius: 0, // 初始半径为0，会在后续设置
            index: index,
            totalTracks: this.totalTracks,
            lineWidth: this.getTrackBaseWidth() * (1 - index * 0.05), // 外层轨道线条更粗
            isSpecial: isSpecial
        });

        // 如果有主题管理器，设置轨道颜色
        if (this.themeManager) {
            const color = track.generateColor(this.themeManager, circle);
            track.updateColor(color);
        }

        // 如果不是最安全区（前三层）且不是特殊轨道，添加障碍物
        if (circle > GAME_CONFIG.SAFE_TRACK_COUNT && !isSpecial) {
            this.createObstaclesForTrack(track);
        }

        return track;
    }

    getTrack(index) {
        return this.tracks[index];
    }

    calculateViewportRadius() {
        return Math.sqrt(
            Math.pow(this.canvas.width / 2, 2) +
            Math.pow(this.canvas.height / 2, 2)
        );
    }

    getTrackBaseWidth() {
        return GAME_CONFIG.TRACK_BASE_WIDTH;
    }

    getTrackSpacing() {
        return GAME_CONFIG.TRACK_SPACING;
    }

    render(ctx) {
        // 从外到内渲染轨道，这样内层轨道会覆盖外层轨道的线条交叉处
        for (let i = this.visibleTracks.length - 1; i >= 0; i--) {
            this.visibleTracks[i].render(ctx);
        }
    }

    // 玩家开始跳跃时调用
    onPlayerStartJump() {
        // 创建新轨道并更新现有轨道（基础TrackSystem逻辑）
        this.onPlayerStartJumpBasic();

        // 检查新创建的轨道是否为特殊轨道
        const newTrack = this.tracks[0];
        const circle = this.getTrackCircle(newTrack);

        // 判断是否为特殊轨道圈数
        if (this.isSpecialCircle(circle)) {
            newTrack.isSpecial = true;
        }

        // 为新轨道创建障碍物(如果不是安全区)
        if (circle > GAME_CONFIG.SAFE_TRACK_COUNT) {
            // 确定轨道所在区域和计划的障碍物数量
            let plannedCount = 0;

            if (circle > this.firstSpecialTrackCircle) {
                // 获取前一个特殊轨道
                const prevSpecialCircle = this.getPreviousSpecialCircle(circle);

                // 检查是否在特殊轨道之间
                const nextSpecialCircle = this.getNextSpecialCircle(prevSpecialCircle);

                if (circle > prevSpecialCircle && circle < nextSpecialCircle) {
                    // 特殊轨道之间
                    plannedCount = this.betweenSpecialObstaclePlan.get(circle) || 0;

                    if (!this.betweenSpecialObstaclePlan.has(circle)) {
                        // 如果轨道不在计划中，动态生成一个
                        this.generateBetweenSpecialObstaclePlan(prevSpecialCircle);
                        plannedCount = this.betweenSpecialObstaclePlan.get(circle) || 0;
                    }
                }
            } else {
                // 非特殊区域
                plannedCount = this.nonSpecialAreaObstaclePlan.get(circle) || 0;
            }

            // 创建障碍物
            if (!newTrack.isSpecial && plannedCount > 0) {
                this.createObstaclesForTrackWithCount(newTrack, plannedCount);
            }
        }

        // 如果有主题管理器，更新新创建的轨道颜色
        if (this.themeManager) {
            const color = newTrack.generateColor(this.themeManager, circle);
            newTrack.updateColor(color);
        }
    }

    // 旧的更新轨道颜色方法，保留以便兼容，但不再使用
    updateTrackColor(color) {
        // 这个方法保留但不再使用
    }

    // 处理玩家进入特殊轨道的效果
    handleSpecialTrackEffect(trackIndex) {
        // 获取特殊轨道
        const specialTrack = this.tracks[trackIndex];
        if (!specialTrack || !specialTrack.isSpecial) return 0;

        // 清除外层轨道的障碍物
        let clearedObstacles = 0;
        for (let i = trackIndex + 1; i < this.tracks.length; i++) {
            clearedObstacles += this.tracks[i].obstacles.length;
            this.tracks[i].clearObstacles();
            // 标记轨道已被特殊轨道清除
            this.tracks[i].clearedBySpecialTrack = true;
        }

        return clearedObstacles;
    }

    // 玩家落地时调用
    onPlayerLand() {
        // 检查玩家是否落在特殊轨道上
        if (this.game && this.game.player) {
            const currentTrackIndex = this.game.player.currentTrackIndex;
            if (currentTrackIndex >= 0 && currentTrackIndex < this.tracks.length) {
                const currentTrack = this.tracks[currentTrackIndex];
                if (currentTrack.isSpecial) {
                    // 触发特殊轨道效果
                    const clearedObstacles = this.handleSpecialTrackEffect(currentTrackIndex);
                    // 添加额外得分 - 在游戏的onPlayerJump方法中已经处理，这里不需要再次添加分数
                    // if (this.game && clearedObstacles > 0) {
                    //     this.game.addScore(clearedObstacles);
                    // }

                    logger.debug(`玩家落在特殊轨道上，清除了${clearedObstacles}个障碍物`);
                }
            }
        }
    }

    // 为轨道创建指定数量的障碍物
    createObstaclesForTrackWithCount(track, count) {
        if (count <= 0) return;

        // 先清空现有的障碍物
        track.obstacles = [];

        // 生成一个随机的起始角度
        const startAngle = Math.random() * Math.PI * 2;

        // 计算每个障碍物之间的角度间隔，确保均匀分布
        const angleStep = (Math.PI * 2) / count;

        // 获取当前轨道的圈数
        const circle = this.getTrackCircle(track);

        for (let j = 0; j < count; j++) {
            // 完全均匀分布，不添加随机偏移
            const angle = startAngle + j * angleStep;
            const obstacle = new WebObstacle(track, angle);
            track.addObstacle(obstacle);

            // 打印每个障碍球的信息
            logger.debug(`生成障碍球 - 第${circle}圈 - 第${j + 1}/${count}个 - 速度: ${obstacle.speed.toFixed(2)}弧度/秒 - 角度: ${(angle * 180 / Math.PI).toFixed(2)}度`);
        }
    }

    // 打印当前障碍物分配计划
    printObstaclePlans() {
        logger.debug("=== 当前障碍物分配计划 ===");

        logger.debug("非特殊区域障碍物计划:");
        let totalNonSpecial = 0;
        for (const [circle, count] of this.nonSpecialAreaObstaclePlan) {
            logger.debug(`  第${circle}圈: 计划${count}个障碍物`);
            totalNonSpecial += count;
        }
        logger.debug(`非特殊区域总计划: ${totalNonSpecial}个障碍物`);

        logger.debug("特殊轨道之间障碍物计划:");
        let totalBetweenSpecial = 0;
        for (const [circle, count] of this.betweenSpecialObstaclePlan) {
            logger.debug(`  第${circle}圈: 计划${count}个障碍物`);
            totalBetweenSpecial += count;
        }
        logger.debug(`特殊轨道之间总计划: ${totalBetweenSpecial}个障碍物`);
    }

    // 统计当前轨道上的障碍物总数
    countCurrentObstacles() {
        logger.debug("=== 当前轨道障碍物统计 ===");
        let nonSpecialAreaObstacles = 0;
        let betweenSpecialObstacles = 0;

        for (const track of this.tracks) {
            const circle = this.getTrackCircle(track);

            if (track.isSpecial) {
                logger.debug(`  第${circle}圈: 特殊轨道`);
                continue;
            }

            // 检查轨道所在区域
            if (circle >= 4 && circle <= this.firstSpecialTrackCircle - 1) {
                // 非特殊区域
                nonSpecialAreaObstacles += track.obstacles.length;
                logger.debug(`  第${circle}圈: 非特殊区域，有${track.obstacles.length}个障碍物`);
            } else {
                // 检查是否在特殊轨道之间
                const prevSpecialCircle = this.getPreviousSpecialCircle(circle);
                const nextSpecialCircle = this.getNextSpecialCircle(prevSpecialCircle);

                if (circle > prevSpecialCircle && circle < nextSpecialCircle) {
                    betweenSpecialObstacles += track.obstacles.length;
                    logger.debug(`  第${circle}圈: 特殊轨道之间区域(${prevSpecialCircle}-${nextSpecialCircle})，有${track.obstacles.length}个障碍物`);
                } else {
                    logger.debug(`  第${circle}圈: 未分类区域，有${track.obstacles.length}个障碍物`);
                }
            }
        }

        logger.debug(`非特殊区域总计: ${nonSpecialAreaObstacles}个障碍物`);
        logger.debug(`特殊轨道之间总计: ${betweenSpecialObstacles}个障碍物`);

        return { nonSpecialAreaObstacles, betweenSpecialObstacles };
    }

    // 验证并修正轨道上的障碍物数量，确保与计划一致
    verifyAndCorrectObstacleCount() {
        // 遍历所有轨道，根据计划修正障碍物数量
        logger.debug("=== 验证并修正轨道障碍物数量 ===");
        for (const track of this.tracks) {
            // 如果轨道被特殊轨道清除过，跳过障碍物重生
            if (track.clearedBySpecialTrack) {
                continue;
            }

            const circle = this.getTrackCircle(track);

            if (track.isSpecial) continue;

            let plannedCount = 0;
            let areaType = '';

            // 确定轨道所在区域和计划的障碍物数量
            if (circle >= 4 && circle <= this.firstSpecialTrackCircle - 1) {
                // 非特殊区域
                plannedCount = this.nonSpecialAreaObstaclePlan.get(circle) || 0;
                areaType = '非特殊区域';
            } else {
                // 检查是否在特殊轨道之间
                const prevSpecialCircle = this.getPreviousSpecialCircle(circle);
                const nextSpecialCircle = this.getNextSpecialCircle(prevSpecialCircle);

                if (circle > prevSpecialCircle && circle < nextSpecialCircle) {
                    plannedCount = this.betweenSpecialObstaclePlan.get(circle) || 0;
                    areaType = '特殊轨道之间';
                }
            }

            // 如果有计划的障碍物数量，检查并修正
            if (plannedCount > 0) {
                const actualCount = track.obstacles.length;
                if (actualCount !== plannedCount) {
                    logger.debug(`  第${circle}圈 (${areaType}): 实际${actualCount}个障碍物，计划${plannedCount}个，正在修正...`);
                    // 先清空轨道上现有的障碍物，然后重新创建
                    track.obstacles = [];
                    this.createObstaclesForTrackWithCount(track, plannedCount);
                } else {
                    logger.debug(`  第${circle}圈 (${areaType}): 障碍物数量正确，为${actualCount}个`);
                }
            } else {
                logger.debug(`  第${circle}圈: 无障碍物计划`);
            }
        }
    }

    // 获取前一个特殊轨道的圈数
    getPreviousSpecialCircle(currentCircle) {
        const safeAreaCircles = GAME_CONFIG.SAFE_TRACK_COUNT || 3; // 使用配置中的安全区轨道数量，默认为3
        if (currentCircle <= this.firstSpecialTrackCircle) return safeAreaCircles; // 安全区边界

        // 如果当前圈数正好是特殊轨道
        if (this.isSpecialCircle(currentCircle)) {
            // 如果是第一个特殊轨道，前一个就是安全区边界
            if (currentCircle === this.firstSpecialTrackCircle) return safeAreaCircles;

            // 否则，前一个特殊轨道应该位于当前特殊轨道 - (1 + 特殊轨道间隔)
            return currentCircle - (1 + this.specialTrackInterval);
        }

        // 找到前一个特殊轨道（小于当前圈数的最大特殊轨道）
        const diff = currentCircle - this.firstSpecialTrackCircle;
        const intervalPlusOne = this.specialTrackInterval + 1;
        const prevMultiple = Math.floor(diff / intervalPlusOne);
        return this.firstSpecialTrackCircle + prevMultiple * intervalPlusOne;
    }

    // 设置主题管理器
    setThemeManager(themeManager) {
        this.themeManager = themeManager;
        // 如果已有轨道，则更新它们的颜色
        if (this.tracks.length > 0) {
            this.updateTrackColors();
        }
    }

    // 更新所有轨道的颜色
    updateTrackColors() {
        if (!this.themeManager) return;

        this.tracks.forEach(track => {
            const circle = this.getTrackCircle(track);
            const color = track.generateColor(this.themeManager, circle);
            track.updateColor(color);
        });
    }

    update(deltaTime) {
        // 计算视口范围
        const viewportRadius = this.calculateViewportRadius();

        // 更新视口内的轨道列表
        this.visibleTracks = this.tracks.filter(track =>
            track.radius <= viewportRadius + this.getTrackBaseWidth() * 3
        );

        // 只更新视口内的轨道
        this.visibleTracks.forEach(track => {
            track.update(deltaTime); // track.update() 内部会更新其上的障碍物
        });
    }

    // 测试函数：打印各个圈层所在区间和对应的障碍物数量
    testZoneDistribution() {
        const maxCircle = 80; // 测试前80圈
        logger.info("----- 障碍物区间分配测试 -----");

        // 记录每个区间的轨道
        const zoneMap = new Map();

        // 遍历每个圈，计算所在区间和障碍物数量
        for (let circle = 1; circle <= maxCircle; circle++) {
            const zone = this.calculateObstacleZone(circle);
            const obstacleCount = this.getObstacleCountForZone(zone);

            if (!zoneMap.has(zone)) {
                zoneMap.set(zone, []);
            }
            zoneMap.get(zone).push(circle);

            // 计算特殊轨道
            const isSpecial = this.isSpecialCircle(circle);
            const specialMark = isSpecial ? " (特殊轨道)" : "";
            const safeZone = circle <= GAME_CONFIG.SAFE_TRACK_COUNT ? " (安全区)" : "";

            logger.debug(`圈数: ${circle}, 区间: ${zone}, 障碍物数量: ${obstacleCount}${specialMark}${safeZone}`);
        }

        // 打印区间汇总
        logger.info("----- 障碍物区间汇总 -----");
        for (const [zone, circles] of zoneMap.entries()) {
            if (zone === -1) {
                logger.info(`安全区 (圈数: ${circles.join(", ")})`);
            } else {
                const obstacleCount = this.getObstacleCountForZone(zone);
                logger.info(`区间 ${zone}: 总障碍物数量 ${obstacleCount}, 轨道数量 ${circles.length}, 圈数: ${circles.join(", ")}`);
            }
        }
    }

    // 重置轨道系统
    reset() {
        // 重置特殊轨道相关状态
        this.lastSpecialTrackCircle = -1;
        this.isObstaclePlanInitialized = false;

        // 清空轨道和计划
        this.tracks = [];
        this.visibleTracks = [];
        this.nonSpecialAreaObstaclePlan.clear();
        this.betweenSpecialObstaclePlan.clear();

        // 重置总轨道数
        this.totalTracks = GAME_CONFIG.INITIAL_TRACKS;

        // 重新创建初始轨道
        this.createInitialTracks();

        // 如果已设置主题管理器，更新轨道颜色
        if (this.themeManager) {
            this.updateTrackColors();
        }

        logger.debug("轨道系统已重置");
    }

    // ===== 基础TrackSystem类的方法（原来通过继承获得，现在直接实现） =====

    /**
     * 基础设置方法（基础TrackSystem类方法）
     * 注意：WebTrackSystem类已经重写了setup方法，这里保留基础实现作为参考
     */
    setupBasic() {
        // 清空现有轨道
        this.tracks = [];
        this.visibleTracks = [];

        // 从内到外创建轨道
        for (let i = 0; i < this.totalTracks; i++) {
            this.tracks.push(this.createTrack(i));
        }
    }

    /**
     * 基础更新方法（基础TrackSystem类方法）
     * 注意：WebTrackSystem类已经重写了update方法，这里保留基础实现作为参考
     */
    updateBasic(deltaTime) {
        // 计算视口范围
        const viewportRadius = this.calculateViewportRadius();

        // 更新视口内的轨道列表
        this.visibleTracks = this.tracks.filter(track =>
            track.radius <= viewportRadius + this.getTrackBaseWidth() * 3
        );

        // 只更新视口内的轨道
        this.visibleTracks.forEach(track => track.update(deltaTime));
    }

    /**
     * 基础渲染方法（基础TrackSystem类方法）
     * 注意：WebTrackSystem类已经重写了render方法，这里保留基础实现作为参考
     */
    renderBasic() {
        // 从外到内渲染轨道，这样内层轨道会覆盖外层轨道的线条交叉处
        for (let i = this.visibleTracks.length - 1; i >= 0; i--) {
            this.visibleTracks[i].render();
        }
    }

    /**
     * 获取指定索引的轨道（基础TrackSystem类方法）
     */
    getTrack(index) {
        return this.tracks[index];
    }

    /**
     * 玩家开始跳跃时的基础处理（基础TrackSystem类方法）
     */
    onPlayerStartJumpBasic() {
        // 增加总轨道数
        this.totalTracks++;

        // 更新所有现有轨道的索引（它们都向外移动一层）
        this.tracks.forEach(track => {
            track.index++;
            // 开始动画到新位置
            track.startAnimation(track.index, this.totalTracks);
        });

        // 创建新的最内层轨道（索引为0）
        const newTrack = this.createTrack(0);

        // 设置新轨道的初始半径为0，然后启动动画到目标位置
        newTrack.radius = 0;
        newTrack.startAnimation(0, this.totalTracks);

        // 将新轨道插入到数组开头
        this.tracks.unshift(newTrack);
    }
} 