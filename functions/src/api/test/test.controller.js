import db from "../../../db/index.js";

export async function test(req, res) {
    try {
        await db.User.create({
            user_id:"test",
            password:"1234567",
            email:"test@naver.com",
        });
        return res.json({isSuccess:true});
    } catch (err) {
        console.error('Error in GetData:', err);
        return res.send(response(status.INTERNAL_SERVER_ERROR));
    }
}

