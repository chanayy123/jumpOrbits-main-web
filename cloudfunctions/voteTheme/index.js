const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event) => {
    const db = cloud.database();
    const _ = db.command;
    const { themeId, voteType } = event || {};

    if (!themeId || !['like', 'dislike'].includes(voteType)) {
        return { success: false, error: 'INVALID_PARAMS' };
    }

    try {
        const col = db.collection('theme_votes');

        try {
            // 尝试直接更新
            const updateRes = await col.where({
                themeId: themeId
            }).update({
                data: {
                    [voteType === 'like' ? 'likes' : 'dislikes']: _.inc(1),
                    updatedAt: Date.now()
                }
            });

            // 如果没有匹配的记录，说明该主题还没人投过，需要创建
            // 注意：云函数 update 如果没匹配到不会自动插入，需要判断 stats
            if (updateRes.stats.updated === 0) {
                // 尝试创建记录（为了避免并发冲突，使用 try-catch 或 safe create）
                // 简化起见，先查一次是否存在 (并发低时可行)
                const countRes = await col.where({ themeId }).count();
                if (countRes.total === 0) {
                    await col.add({
                        data: {
                            themeId,
                            likes: voteType === 'like' ? 1 : 0,
                            dislikes: voteType === 'dislike' ? 1 : 0,
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        }
                    });
                } else {
                    // 既然存在了，再试一次 Update
                    await col.where({ themeId }).update({
                        data: {
                            [voteType === 'like' ? 'likes' : 'dislikes']: _.inc(1),
                            updatedAt: Date.now()
                        }
                    });
                }
            }
        } catch (e) {
            // 集合不存在时自动创建集合并写入
            if (e.errCode === -502001) {
                await db.createCollection('theme_votes');
                await col.add({
                    data: {
                        themeId,
                        likes: voteType === 'like' ? 1 : 0,
                        dislikes: voteType === 'dislike' ? 1 : 0,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }
                });
            } else {
                throw e;
            }
        }

        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: error.message };
    }
};
