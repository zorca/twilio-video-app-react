import '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';

export default async function backgroundBlur(inputTrack: MediaStreamTrack): Promise<MediaStreamTrack> {
  const { frameRate = 0, height = 0, width = 0 } = inputTrack.getSettings();

  const $inputVideo = document.createElement('video');
  $inputVideo.height = height;
  $inputVideo.srcObject = new MediaStream([inputTrack]);
  $inputVideo.width = width;

  const [model] = await Promise.all([
    bodyPix.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.5,
      quantBytes: 4,
    }),
    $inputVideo.play(),
  ]);

  const $canvas = document.createElement('canvas');
  const outputStream = ($canvas as any).captureStream(frameRate);
  const outputTrack = outputStream.getTracks()[0];

  ($inputVideo as any).requestVideoFrameCallback(async function step() {
    if (inputTrack.readyState === 'ended') {
      return;
    }
    if (inputTrack.enabled && !inputTrack.muted) {
      const bodySegment = await model.segmentPerson($inputVideo);
      requestAnimationFrame(() => bodyPix.drawBokehEffect($canvas, $inputVideo, bodySegment, 5, 5, false));
    }
    ($inputVideo as any).requestVideoFrameCallback(step);
  });

  return outputTrack;
}
