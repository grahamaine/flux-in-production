// Usage: npm run image -- "prompt text" [out.jpg] [aspect]
// Use for character sheets and keyframes that pin continuity across shots.
import { generate, ENDPOINTS } from '../src/bfl.js';

const [prompt, out = 'output/keyframe.jpg', aspect = '16:9'] = process.argv.slice(2);
if (!prompt) {
  console.error('Usage: npm run image -- "prompt" [out.jpg] [aspect]');
  process.exit(1);
}

await generate(ENDPOINTS.image, { prompt, aspect_ratio: aspect }, out);
