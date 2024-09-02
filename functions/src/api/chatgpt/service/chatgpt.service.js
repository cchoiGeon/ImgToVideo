import { openai } from "../../../../config/chatgpt.config.js";
import { bucket } from "../../../../config/firebase.config.js";
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import axios from "axios";
import { promisify } from 'util';
import exif from 'exif-parser';
import say from 'say';

// ffmpeg 및 ffprobe 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

async function getRotationFromExif(imagePath) {
    const readFile = promisify(fs.readFile);
    const buffer = await readFile(imagePath);
    const parser = exif.create(buffer);
    const result = parser.parse();
    return result.tags.Orientation || 1; // 기본값 1: 회전 없음
}

// 이미지 회전을 처리하는 FFmpeg 필터 추가
function getRotationFilter(rotation) {
    switch (rotation) {
        case 3:
            return 'transpose=2,transpose=2'; // 180도 회전
        case 6:
            return 'transpose=1'; // 90도 회전
        case 8:
            return 'transpose=2'; // -90도 회전
        default:
            return ''; // 회전 없음
    }
}

export async function AnalyzeImg(img_urls) {
    try {
        const promises = img_urls.map(async (img_url) => {
            const response = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "이 그림을 한글로 자세히 설명해줘" },
                            { type: "image_url", image_url: { url: img_url } }
                        ]
                    }
                ],
                max_tokens: 3000,
            });

            const description = response.choices[0]?.message.content;
            return { img_url, description: description || "Description not available" };
        });

        const completedResults = await Promise.all(promises);

        const descriptions = completedResults.map(item => item.description);
        const img_url_data = completedResults.map(item => item.img_url);
        const { finalMp3Path, durations } = await TextToSpeech(descriptions);

        console.log("MP3 생성 완료, 비디오 생성 시작");
        await createVideoFromImages(img_url_data, durations);
        const finalVideoUrl = await createFinalVideo(finalMp3Path);
        console.log(finalVideoUrl);
        return finalVideoUrl;
    } catch (error) {
        console.error('Error processing images:', error);
        return false;
    }
}

export const TextToSpeech = async (datas) => {
    const tempDir = path.resolve('./temp');
    const mp3Files = [];
    const durations = [];
    const finalMp3Path = path.resolve(tempDir, 'final-output.mp3');

    try {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const processingPromises = datas.map(async (data) => {
            const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const tempWavPath = path.resolve(tempDir, `${uniqueId}-output.wav`);
            const tempMp3Path = path.resolve(tempDir, `${uniqueId}-output.mp3`);

            await new Promise((resolve, reject) => {
                say.export(data, null, 1.0, tempWavPath, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            await new Promise((resolve, reject) => {
                ffmpeg(tempWavPath)
                    .toFormat('mp3')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(tempMp3Path);
            });

            const duration = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(tempMp3Path, (err, metadata) => {
                    if (err) return reject(err);
                    resolve(metadata.format.duration);
                });
            });

            durations.push(duration);
            mp3Files.push(tempMp3Path);

            if (fs.existsSync(tempWavPath)) {
                fs.unlinkSync(tempWavPath);
            }
        });

        await Promise.all(processingPromises);

        await new Promise((resolve, reject) => {
            const ffmpegCommand = ffmpeg();

            mp3Files.forEach(file => {
                ffmpegCommand.input(file);
            });

            ffmpegCommand
                .on('end', resolve)
                .on('error', reject)
                .mergeToFile(finalMp3Path);
        });

        mp3Files.forEach((file) => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });

        return { finalMp3Path, durations };
    } catch (error) {
        console.error('Error processing TTS:', error);

        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        return false;
    }
};

export async function createVideoFromImages(img_urls, durations) {
    const tempDir = './temps';
    const outputDir = './output';
    const outputVideo = path.resolve(outputDir, `video.mp4`);
    const downloadedImages = [];

    const images = img_urls.map((url, index) => ({
        url,
        duration: durations[index],
    }));

    async function downloadImage(url, outputPath) {
        const response = await axios({
            url,
            responseType: 'stream',
        });

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    try {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const downloadPromises = images.map((image, i) => {
            const outputPath = path.resolve(tempDir, `image-${i}.jpeg`);
            return downloadImage(image.url, outputPath).then(() => {
                downloadedImages.push({ path: outputPath, duration: image.duration });
            });
        });

        await Promise.all(downloadPromises);

        let command = ffmpeg();
        let filterComplex = '';

        for (let i = 0; i < downloadedImages.length; i++) {
            const image = downloadedImages[i];
            command = command.input(image.path);
            const rotation = await getRotationFromExif(image.path);
            const rotationFilter = getRotationFilter(rotation);
            filterComplex += `[${i}:v]fps=25,scale=1920:1080,setsar=1${rotationFilter ? `,${rotationFilter}` : ''},loop=${Math.round(image.duration * 25)}:1:0,setpts=N/(25*TB)[v${i}];`;
        }

        filterComplex += downloadedImages.map((_, index) => `[v${index}]`).join('') + `concat=n=${downloadedImages.length}:v=1:a=0[outv]`;

        return new Promise((resolve, reject) => {
            command
                .complexFilter(filterComplex)
                .outputOptions('-map', '[outv]')
                .output(outputVideo)
                .videoCodec('libx264')
                .on('end', () => {
                    console.log('비디오 생성 완료!');
                    downloadedImages.forEach(image => {
                        if (fs.existsSync(image.path)) {
                            fs.unlinkSync(image.path);
                        }
                    });

                    if (fs.existsSync(tempDir)) {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                        console.log("Temporary directory deleted");
                    }

                    resolve(outputVideo);
                })
                .on('error', (err) => {
                    console.error('비디오 생성 중 오류 발생:', err.message);
                    reject(err);
                })
                .run();
        });
    } catch (error) {
        console.error('이미지 다운로드 중 오류 발생:', error.message);

        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                fs.unlinkSync(path.join(tempDir, file));
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log("Temporary directory deleted after error");
        }

        return false;
    }
}

export async function createFinalVideo(finalMp3Path) {
    console.log("createFinalVideo 실행됨");

    const tempDir = './result';
    const outputVideo = './output/video.mp4';
    const resultVideo = path.resolve(tempDir, `result-video-${Date.now()}.mp4`);

    try {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        if (!fs.existsSync(outputVideo)) throw new Error(`Output video file does not exist: ${outputVideo}`);

        return new Promise((resolve, reject) => {
            ffmpeg(outputVideo)
                .input(finalMp3Path)
                .outputOptions('-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac')
                .output(resultVideo)
                .on('start', commandLine => {
                    console.log('FFmpeg command: ' + commandLine);
                })
                .on('end', async () => {
                    console.log('Final video creation complete.');

                    // Firebase Storage에 업로드
                    const finalVideoDestination = `video/result-video-${Date.now()}.mp4`;
                    const finalVideoFile = bucket.file(finalVideoDestination);

                    await new Promise((resolve, reject) => {
                        fs.createReadStream(resultVideo)
                            .pipe(finalVideoFile.createWriteStream({
                                metadata: { contentType: 'video/mp4' },
                                public: true,
                            }))
                            .on('finish', resolve)
                            .on('error', reject);
                    });

                    const finalVideoUrl = finalVideoFile.publicUrl();
                    console.log("Final video URL: ", finalVideoUrl);

                    // 임시 파일 및 디렉토리 삭제
                    if (fs.existsSync(finalMp3Path)) {
                        fs.unlinkSync(finalMp3Path);
                    }
                    if (fs.existsSync(tempDir)) {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                    }
                    if (fs.existsSync(outputVideo)){
                        fs.rmSync(outputVideo, { recursive: true, force: true });
                    }

                    resolve(finalVideoUrl); // Firebase에 업로드된 비디오의 URL 반환
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('Final video creation error:', err.message);
                    console.error('FFmpeg stderr:', stderr);
                    reject(err);
                })
                .run();
        });
    } catch (error) {
        console.error('Error during createFinalVideo:', error);
        if (fs.existsSync(finalMp3Path)) {
            fs.unlinkSync(finalMp3Path);
        }
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        if (fs.existsSync(outputVideo)){
            fs.rmSync(outputVideo, { recursive: true, force: true });
        }

        return false;
    }
}