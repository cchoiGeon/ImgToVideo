import { response } from "../../../utils/response/response.js";
import { status } from "../../../utils/response/response.status.js";
import { test2Service, testService } from '../service/chatgpt.service.js';

export async function test(req,res){
    try {
        let { img_url } = req.body;

        const result = await testService(img_url);

        if(!result){
            return res.send(response(status.CHATGPT_GET_QUERY_ERROR));
        }
        console.log(result);

        return res.send(response(status.SUCCESS, result));
    } catch (err) {
        console.error('Error in GetData:', err);
        return res.send(response(status.INTERNAL_SERVER_ERROR));
    }
}

export async function test2(req,res){
    try {
        let { data } = req.body;

        const {publicUrl, duration} = await test2Service(data);
        console.log(publicUrl, duration);
        const result = {publicUrl, duration};
        if(!result){
            return res.send(response(status.CHATGPT_GET_QUERY_ERROR));
        }
        console.log(result);

        return res.send(response(status.SUCCESS, result));
    } catch (err) {
        console.error('Error in GetData:', err);
        return res.send(response(status.INTERNAL_SERVER_ERROR));
    }
}