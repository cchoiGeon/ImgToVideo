import { response } from "../../../utils/response/response.js";
import { status } from "../../../utils/response/response.status.js";
import { AnalyzeImg } from '../service/chatgpt.service.js';

export async function ImgaeToVideo(req, res) {
    try {
        let { img_urls } = req.body;
        
        AnalyzeImg(img_urls); // 이미지 분석하기 

        // 분석한 이미지 TTS로 만들기 + 해당 TTS 시간초 분석

        // 이미지 동영상으로 만들기 (TTS 시간초 분석 사용해서 각각 이미지 몇 초동안 유지해야 되는지 !)

        // TTS와 동영상 합쳐주기 

        return res.send(response(status.SUCCESS));
    } catch (err) {
        console.error('Error in GetData:', err);
        return res.send(response(status.INTERNAL_SERVER_ERROR));
    }
}

// export async function test2(req,res){
//     try {
//         let { data } = req.body;

//         const {publicUrl, duration} = await test2Service(data);
//         console.log(publicUrl, duration);
//         const result = {publicUrl, duration};
//         if(!result){
//             return res.send(response(status.CHATGPT_GET_QUERY_ERROR));
//         }
//         console.log(result);

//         return res.send(response(status.SUCCESS, result));
//     } catch (err) {
//         console.error('Error in GetData:', err);
//         return res.send(response(status.INTERNAL_SERVER_ERROR));
//     }
// }