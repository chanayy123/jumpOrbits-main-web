const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event) => {
    const db = cloud.database();
    const _ = db.command;
    const { collection, limit = 20 } = event || {};

    if (!collection) {
        return { success: false, error: 'INVALID_PARAMS' };
    }

    try {
        const res = await db.collection(collection)
            .where({ score: _.gte(0) })
            .orderBy('score', 'desc')
            .field({ openId: true, nickname: true, avatarUrl: true, score: true, updatedAt: true })
            .limit(Math.max(1, Math.min(100, Number(limit) || 20)))
            .get();

        // compute myRank for caller
        const wxContext = cloud.getWXContext();
        const openId = wxContext.OPENID;
        let myRank = null;
        let myEntry = null;
        try {
            const myDoc = await db.collection(collection).doc(openId).get();
            if (myDoc && myDoc.data && typeof myDoc.data.score === 'number') {
                myEntry = {
                    openId: myDoc.data.openId,
                    nickname: myDoc.data.nickname || '',
                    avatarUrl: myDoc.data.avatarUrl || '',
                    score: myDoc.data.score,
                    updatedAt: myDoc.data.updatedAt || 0
                };
                const greaterCountRes = await db.collection(collection)
                    .where({ score: _.gt(myDoc.data.score) })
                    .count();
                const greaterCount = (greaterCountRes && greaterCountRes.total) || 0;
                myRank = greaterCount + 1;
            }
        } catch (_) {
            // ignore
        }

        return {
            success: true,
            data: res.data || [],
            myRank,
            myEntry
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};
