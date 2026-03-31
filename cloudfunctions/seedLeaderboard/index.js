// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const COLLECTION_NAME = 'leaderboard'; // 确保与你的集合名称一致

// 逼真的昵称库
const MOCK_NAMES = [
    // 英文/简约
    "Seven", "Momo", "L.J", "Sunny", "Coco", "Jacky", "Rain", "Sky", "Blue", "Star",
    // 微信生活风
    "快乐每一天", "随风飘扬", "宁静致远", "往后余生", "平安是福", "岁月静好", "知足常乐", "心若向阳",
    // 可爱风
    "吃不饱的猫", "小丸子", "✨星河✨", "奶茶半糖", "芋泥波波", "一只小柴", "糖豆", "布丁",
    // 微商/工作风
    "A.专业房屋中介", "李总", "设计-小刘", "诚信水果批发", "A.美甲美睫",
    // 随意/酷炫
    "。。。", "123", "User", "阿白", "K", "R.", "Joker", "Assassin",
    // 文艺
    "南风", "北巷", "初晴", "晚安", "清欢", "半岛铁盒"
];

// 使用 DiceBear API 生成多样的头像
// 注意：实际生产中建议将这些图片转存到你自己的云存储，以防外链失效或被防盗链屏蔽
// 这里为了演示方便直接使用外链，微信小程序 Image 组件通常支持显示 HTTPS 外链
const AVATAR_STYLES = ['adventurer', 'personas', 'bottts', 'fun-emoji'];

function getRandomAvatar(seed) {
    const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

// 批量插入多少条数据
const BATCH_SIZE = 50;

// 云函数入口函数
exports.main = async (event, context) => {
    const { ENV, OPENID, APPID } = cloud.getWXContext();

    // 1. 检查是否已经初始化过（避免重复运行导致数据爆炸）
    // 这里简单判断：如果总数超过 100 条就不再插了
    const countResult = await db.collection(COLLECTION_NAME).count();
    if (countResult.total > 100) {
        return {
            success: false,
            message: 'Database already seeded (count > 100)',
            total: countResult.total
        };
    }

    const tasks = [];
    const timestamp = new Date().getTime();

    for (let i = 0; i < BATCH_SIZE; i++) {
        // 1. 随机昵称
        const nickname = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];

        // 2. 随机头像 (稍微加点随机后缀避免完全重名时头像一样)
        const avatarUrl = getRandomAvatar(nickname + i);

        // 3. 随机分数 (正态分布模拟)
        // 头部玩家 (2%): 3000 - 5000
        // 腰部玩家 (20%): 1000 - 3000
        // 普通玩家 (78%): 50 - 1000
        let score = 0;
        const rand = Math.random();

        if (rand > 0.98) {
            score = 3000 + Math.floor(Math.random() * 2000);
        } else if (rand > 0.8) {
            score = 1000 + Math.floor(Math.random() * 2000);
        } else {
            score = 50 + Math.floor(Math.random() * 950);
        }

        // 4. 随机时间 (最近7天)
        const updateTime = timestamp - Math.floor(Math.random() * 7 * 24 * 3600 * 1000);

        // 5. 生成伪造的 openid (避免冲突，使用随机串)
        // 注意：真实场景中 _openid 是由系统管理的，但如果是为了伪造排行数据，
        // 只要你的查询逻辑不强制校验 _openid 必须是当前用户（查排行榜显然不校验），
        // 那么我们可以手动插入带 _openid 字段的记录，或者干脆让数据库自动生成 _id
        // 通常如果是 admin 端插入，会自动带上 _openid 为 admin 的 openid
        // 为了模拟不同用户，我们通常不需要显式设置 _openid，因为排行榜查询只关心 score
        // 只要数据结构符合前端读取要求即可。

        const record = {
            nickname,
            avatarUrl,
            score,
            updateTime,
            isMock: true, // 标记为模拟数据，方便日后清理
            openid: `mock_user_${timestamp}_${i}` // 存一个假的 openid 字段以备用
        };

        const promise = db.collection(COLLECTION_NAME).add({
            data: record
        });
        tasks.push(promise);
    }

    // 等待所有插入完成
    try {
        await Promise.all(tasks);
        return {
            success: true,
            message: `Successfully added ${BATCH_SIZE} mock records`,
            count: BATCH_SIZE
        };
    } catch (err) {
        return {
            success: false,
            error: err
        };
    }
};
