const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const MAX_LIMIT = 20;

exports.main = async (event) => {
    const db = cloud.database();

    try {
        const result = await db.collection('theme_votes')
            .limit(MAX_LIMIT)
            .get();

        return {
            success: true,
            data: result.data || []
        };
    } catch (error) {
        // 首次可能集合不存在，返回空
        if (error.errCode === -502001) { // DATABASE_COLLECTION_NOT_EXIST
            return { success: true, data: [] };
        }
        console.error(error);
        return { success: false, error: error.message };
    }
};
