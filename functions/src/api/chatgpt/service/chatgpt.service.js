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
        // 병렬로 API 호출
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

        // 모든 API 호출이 완료될 때까지 기다림
        const completedResults = await Promise.all(promises);

        const descriptions = completedResults.map(item => item.description);
        const img_url_data = completedResults.map(item => item.img_url);

        const { finalPublicUrl, durations } = await TextToSpeech(descriptions);
        console.log(" 여기 옴  1");
        await createVideoFromImages(img_url_data, durations);
        console.log(" 여기 옴  2");
        const finalVideoUrl = await createFinalVideo(finalPublicUrl);

        return finalVideoUrl;
    } catch (error) {
        console.error('Error calling GPT-4:', error);
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

        for (let data of datas) {
            try {
                console.log("Processing data: ", data);
                // 1. 텍스트를 WAV 파일로 변환
                const tempWavPath = path.resolve(tempDir, `${Date.now()}-output.wav`);
                await new Promise((resolve, reject) => {
                    say.export(data, null, 1.0, tempWavPath, (err) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve();
                    });
                });

                // 2. WAV 파일을 MP3로 변환
                const tempMp3Path = path.resolve(tempDir, `${Date.now()}-output.mp3`);
                await new Promise((resolve, reject) => {
                    ffmpeg(tempWavPath)
                        .toFormat('mp3')
                        .on('end', () => {
                            resolve();
                        })
                        .on('error', (err) => {
                            reject(err);
                        })
                        .save(tempMp3Path);
                });

                // MP3 파일 길이 측정
                const duration = await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(tempMp3Path, (err, metadata) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(metadata.format.duration);
                    });
                });

                durations.push(duration); // MP3 길이 저장
                mp3Files.push(tempMp3Path);

                // WAV 파일 삭제
                if (fs.existsSync(tempWavPath)) {
                    fs.unlinkSync(tempWavPath);
                }

            } catch (error) {
                console.error('Error processing data:', error);
                continue;
            }
        }

        // 3. MP3 파일을 합쳐서 하나의 MP3로 만들기
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

        // 4. 최종 MP3 파일 Firebase Storage에 업로드
        const finalDestination = `audio/final-output-${Date.now()}.mp3`;
        const finalFile = bucket.file(finalDestination);

        await new Promise((resolve, reject) => {
            fs.createReadStream(finalMp3Path)
                .pipe(finalFile.createWriteStream({
                    metadata: {
                        contentType: 'audio/mpeg',
                    },
                    public: true,
                }))
                .on('finish', resolve)
                .on('error', reject);
        });

        // 5. 최종 Firebase Storage URL 반환
        const finalPublicUrl = finalFile.publicUrl();

        // 6. 임시 폴더 및 파일 삭제
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        // 최종적으로 생성된 MP3 파일의 URL과 각 MP3 파일의 길이 배열을 반환
        return { finalPublicUrl, durations };
    } catch (error) {
        console.error('Error processing TTS:', error);

        // 오류 발생 시 임시 폴더 삭제
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        return false;
    }
};

export async function createVideoFromImages(img_urls, durations) {
    const tempDir = './temps';
    const outputDir = './output';
    const outputVideo = path.resolve(outputDir, 'video.mp4');
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

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const outputPath = path.resolve(tempDir, `image-${i}.jpeg`);
            await downloadImage(image.url, outputPath);
            downloadedImages.push({ path: outputPath, duration: image.duration });
        }

        let command = ffmpeg();
        let filterComplex = '';

        for (let i = 0; i < downloadedImages.length; i++) {
            const image = downloadedImages[i];
            command = command.input(image.path);
            const rotation = await getRotationFromExif(image.path);
            const rotationFilter = getRotationFilter(rotation);
            filterComplex += `[${i}:v]fps=25,scale=1920:1080,setsar=1${rotationFilter ? `,${rotationFilter}` : ''},loop=${image.duration * 25}:1:0,setpts=N/(25*TB)[v${i}];`;
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

                    resolve(true);
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

export async function createFinalVideo(finalMp3Url) {
    console.log("createFinalVideo 실행됨");

    const tempDir = './result';
    const outputVideo = './output/video.mp4';
    const resultVideo = path.resolve(tempDir, 'result-video.mp4');

    try {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        if (!fs.existsSync(outputVideo)) throw new Error(`Output video file does not exist: ${outputVideo}`);

        const tempMp3Path = path.resolve(tempDir, 'final-audio.mp3');
        const response = await axios({
            url: finalMp3Url,
            responseType: 'stream',
        });

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(tempMp3Path);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        return new Promise((resolve, reject) => {
            ffmpeg(outputVideo)
                .input(tempMp3Path)
                .outputOptions('-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac')
                .output(resultVideo)
                .on('start', commandLine => {
                    console.log('FFmpeg command: ' + commandLine);
                })
                .on('end', async () => {
                    console.log('Final video creation complete.');

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

                    if (fs.existsSync(tempDir)) {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                        console.log("Result directory deleted");
                    }

                    resolve(finalVideoUrl);
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

        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        return false;
    }
}
