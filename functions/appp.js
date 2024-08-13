const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

// 이미지 파일과 각 이미지의 지속 시간(초)을 설정
const images = [
  { path: './image-001.jpeg', duration: 3 },
  { path: './image-002.jpeg', duration: 5 },
  { path: './image-003.jpeg', duration: 10 },
];

const outputVideo = './output/video.mp4';

// 이미지 입력 및 필터 설정
let command = ffmpeg();
let filterComplex = '';

images.forEach((image, index) => {
  command = command.input(image.path);
  filterComplex += `[${index}:v]fps=25,scale=1920:1080,setsar=1,loop=${image.duration * 25}:1:0,setpts=N/(25*TB)[v${index}];`;
});
filterComplex += images.map((_, index) => `[v${index}]`).join('') + `concat=n=${images.length}:v=1:a=0[outv]`;

command = command
  .complexFilter(filterComplex)
  .outputOptions('-map', '[outv]')
  .output(outputVideo)
  .videoCodec('libx264')
  .on('end', () => console.log('비디오 생성 완료!'))
  .on('error', (err) => console.error('비디오 생성 중 오류 발생:', err.message))
  .run();
