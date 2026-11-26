// Usage: npm run stitch -- [episode-01]   (works in PowerShell, needs ffmpeg)
import { stitch } from '../src/project.js';

const ep = process.argv[2] || 'episode-01';
try {
  const r = await stitch(ep);
  console.log(`Wrote output/${r.file} from ${r.shots} shots${r.skipped ? ` (${r.skipped} not rendered yet)` : ''}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
