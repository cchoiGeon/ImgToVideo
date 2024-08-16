import { response } from "../../../utils/response/response.js";
import { status } from "../../../utils/response/response.status.js";
import { AnalyzeImg } from '../service/chatgpt.service.js';

export async function ImgaeToVideo(req, res) {
    try {
        let { img_urls } = req.body;
        
        await AnalyzeImg(img_urls); // 이미지 분석하기 

        return res.send(response(status.SUCCESS));
    } catch (err) {
        console.error('Error in GetData:', err);
        return res.send(response(status.INTERNAL_SERVER_ERROR));
    }
}

