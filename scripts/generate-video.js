// Usage: npm run video -- "prompt text" [out.mp4] [duration] [aspect]
import { generate, ENDPOINTS } from '../src/bfl.js';

const [prompt, out = 'output/test-clip.mp4', duration = '8', aspect = '16:9'] = process.argv.slice(2);
if (!prompt) {
  console.error('Usage: npm run video -- "prompt" [out.mp4] [duration 5-20] [aspect 16:9|9:16|...]');
  process.exit(1);
}

await generate(
  ENDPOINTS.video,
  {
    prompt,
    duration: Number(duration),
    aspect_ratio: aspect,
    resolution: 'hd',
    generate_audio: true,
    draft: true, // cheap preview first; re-render finals at full quality
  },
  out,
);
