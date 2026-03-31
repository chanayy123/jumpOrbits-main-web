const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event) => {
    const db = cloud.database();
    const _ = db.command;
    const { score, collection, nickname, avatarUrl } = event || {};

    const MAX_SCORE = 1000000; // 反作弊：合理上限
    const MIN_SUBMIT_INTERVAL_MS = 5000; // 频控：5 秒内重复提交不写入（非新高）

    if (typeof score !== 'number' || !collection) {
        return { success: false, error: 'INVALID_PARAMS' };
    }

    const normalizedScore = Math.floor(score);
    if (Number.isNaN(normalizedScore) || normalizedScore < 0 || normalizedScore > MAX_SCORE) {
        return { success: false, error: 'INVALID_SCORE' };
    }

    const sanitizeNickname = (name) => {
        if (typeof name !== 'string') return undefined;
        const trimmed = name.trim().replace(/[\u0000-\u001f\u007f]/g, '');
        return trimmed.slice(0, 20);
    };

    const sanitizeAvatar = (url) => {
        if (typeof url !== 'string') return undefined;
        if (!/^https?:\/\//i.test(url)) return undefined;
        return url.slice(0, 256);
    };

    const wxContext = cloud.getWXContext();
    const openId = wxContext.OPENID;

    try {
        const now = Date.now();
        const col = db.collection(collection);
        let existing = null;
        try {
            const res = await col.doc(openId).get();
            existing = res.data || null;
        } catch (e) {
            existing = null;
        }

        // 频控：短时间内非新高直接忽略
        if (existing && (now - (existing.updatedAt || 0) < MIN_SUBMIT_INTERVAL_MS) && normalizedScore <= (existing.score || 0)) {
            return { success: true, throttled: true };
        }

        const safeNickname = sanitizeNickname(nickname);
        const safeAvatar = sanitizeAvatar(avatarUrl);

        if (!existing || normalizedScore > (existing.score || 0)) {
            const data = {
                openId,
                score: normalizedScore,
                updatedAt: now
            };
            if (safeNickname) data.nickname = safeNickname;
            if (safeAvatar) data.avatarUrl = safeAvatar;
            await col.doc(openId).set({ data });
        } else {
            const updateData = {
                updatedAt: now,
                score: _.max(existing.score)
            };
            if (safeNickname && !existing.nickname) updateData.nickname = safeNickname;
            if (safeAvatar && !existing.avatarUrl) updateData.avatarUrl = safeAvatar;
            await col.doc(openId).update({ data: updateData });
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};
