<p align="center"><img src="assets/brand/flux-key-art.jpg" alt="FLUX In Production — RTL TV Series key art" width="100%"></p>

# FLUX: In Production — TV Series with RTL

Our entry to **FLUX: In Production**, the Black Forest Labs × Encode Club AI film programme (30 Nov – 13 Dec 2026), on the **TV Series with RTL** track.

**FLUX Studio** is a local web app for the whole production: series bible → character keyframes → shot list → FLUX 3 video with native audio → stitched episode.

## Setup (Windows PowerShell)

```powershell
git clone https://github.com/grahamaine/flux-in-production.git
cd flux-in-production
npm install
```

Add your Black Forest Labs key (from https://dashboard.bfl.ai) to a `.env` file:

```powershell
$k = Read-Host "Paste your BFL API key"
Set-Content -Path .env -Value "BFL_API_KEY=$k`nBFL_API_BASE=https://api.bfl.ai" -Encoding ascii
```

> If PowerShell says "running scripts is disabled", run once:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

Needs Node 20.11+ and, for stitching, ffmpeg (`winget install Gyan.FFmpeg`).

## Run the Studio

```powershell
npm run studio
```

Open **http://localhost:3000**.

| Page | What it does |
|------|--------------|
| Overview | Progress checklist and counts |
| Series bible | Title, logline, hook, world, visual style, characters, episode plan |
| Shot list | Per-episode shots: reorder, edit prompts, render **Draft** or **Final**, preview each clip |
| Keyframes | Generate character and location stills to lock the look |
| Render queue | Live status of every render this session |

Writing works without a key; rendering unlocks once `.env` has one. The server only listens on your own machine, and the key never reaches the browser.

## Command line (optional)

```powershell
npm run video -- "prompt" output/test.mp4 8 16:9
npm run image -- "prompt" assets/keyframes/lead.jpg
npm run shots -- episode-01            # render missing shots as drafts
npm run shots -- episode-01 --final    # full quality
npm run stitch -- episode-01           # output/episode-01.mp4
```

Result URLs from the BFL API expire after about 10 minutes; files are downloaded immediately, each with a secret-free `.json` record of the request.

## Layout

| Path | What |
|------|------|
| `web/` | Studio front end |
| `server/` | Local API (Express) |
| `src/bfl.js` | BFL client: submit → poll → download |
| `src/project.js` | Bible, shot lists, renders, ffmpeg stitch |
| `story/` | `series-bible.json` and `episode-XX/shotlist.json` |
| `briefs/` | Track brief and rules checklist |
| `assets/brand/` | Key art, FLUX wordmark, thee AGENCY logo, app icon and favicons |
| `assets/keyframes/` | Generated stills |
| `output/` | Renders (git-ignored) |
| `.claude/skills/` | Official BFL prompting and API skills |

## References
- BFL API docs: https://docs.bfl.ai
- Official BFL skills: https://github.com/black-forest-labs/skills

---

<p align="center">
  <sub>Powered and rendered by</sub><br>
  <img src="assets/brand/thee-agency-logo.jpg" alt="thee AGENCY Consults (UG) Limited — Innovation Unleashed" width="320">
</p>
