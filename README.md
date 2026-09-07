# ✈️ Global Flight Tracker — Live 24/7

A premium, dark-mode live flight tracking dashboard, built to run unattended and stream
to YouTube 24/7 using GitHub Actions.

- **Dashboard:** `index.html` — a real world map built from actual country
  border polygons (no raster tile server to break), a live day/night
  terminator computed from real solar position, live stats, a scrolling
  "on radar" ticker, UTC/local clocks, and a live session badge.
- **Earth:** country polygons come from
  [datasets/geo-countries](https://github.com/datasets/geo-countries)
  (Natural Earth data), fetched once per session and rendered client-side —
  there's no tile server in the loop to rate-limit or paywall you.
- **Aircraft:** rendered as a detailed top-down jet silhouette (fuselage,
  swept wings, tail, engine pods), colored by flight phase, and animated with
  real dead-reckoning (heading + ground speed) every 400ms so they glide
  continuously instead of jumping between data refreshes.
- **Data:** pulled from the free [OpenSky Network](https://opensky-network.org/) API.
- **Streaming:** a GitHub Actions workflow drives a real headless Chromium window
  inside a virtual display, captures it with `ffmpeg`, and pushes it straight to
  YouTube Live via RTMP — no local machine required.

---

## 1. Try it locally first

```bash
npm install
npm run fetch     # pulls one live snapshot into data/flights.json
npm run serve     # serves the dashboard at http://localhost:8080
```

Open `http://localhost:8080` — you should see live aircraft. If OpenSky is
unreachable or rate-limited, the dashboard automatically falls back to a
simulated traffic model so it never looks broken.

## 2. Host the dashboard (optional, e.g. GitHub Pages)

Enable Pages on the repo (Settings → Pages → Deploy from branch → `main`).
The `update-data.yml` workflow refreshes `data/flights.json` every 10 minutes
and commits it, so a static Pages deployment stays reasonably live even with
no stream running.

## 3. Set up the YouTube live stream

1. In YouTube Studio, go to **Create → Go live**.
2. Choose **Stream** (not "Webcam"), give it a title/thumbnail, and set it to
   **24/7** friendly settings (persistent stream key recommended so it survives
   restarts): Settings → Stream → enable "Reusable stream key".
3. Copy the **Stream key**.
4. In your GitHub repo: **Settings → Secrets and variables → Actions → New
   repository secret**, name it `YOUTUBE_STREAM_KEY`, and paste the key.
5. (Optional, recommended) Register a free OpenSky account and add
   `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` secrets (OAuth2 client
   credentials, from opensky-network.org → My Account → API Client) — this
   raises your daily request allowance well above the anonymous limit.

## 4. Start streaming

- Go to the **Actions** tab → **24/7 YouTube live stream** → **Run workflow**
  to start immediately, or just wait — it's scheduled to (re)launch every
  6 hours automatically (`0 */6 * * *`), which is how the "24/7" effect is
  achieved (see below).
- In YouTube Studio your stream should go live within roughly a minute of the
  job reaching the `ffmpeg` step.

### How the "24/7" part actually works

GitHub-hosted runners are hard-capped at ~6 hours per job. There's no way
around that on the free tier, so this project **chains sessions**: each run
streams for ~5h50m and a new run is scheduled to start right after, giving a
reconnect gap of well under a minute between sessions. YouTube will show a
brief "stream interrupted" blip roughly every 6 hours — for a genuinely
gapless 24/7 signal you'd need a self-hosted runner or a small always-on VM
instead of GitHub-hosted runners, since those aren't time-limited.

## Project structure

```
index.html                        the dashboard itself (single file, no build step)
data/flights.json                 latest flight snapshot (committed by update-data.yml)
scripts/fetch-flights.js          server-side OpenSky fetch -> data/flights.json
scripts/poll-loop.sh              re-runs fetch-flights.js every 20s during a stream
scripts/launch-browser.js         opens the dashboard in a real Chromium window (Puppeteer)
.github/workflows/update-data.yml refreshes committed data every 10 minutes
.github/workflows/live-stream.yml Xvfb + Chromium + ffmpeg -> YouTube RTMP, chained every 6h
```

## Customizing the look

Colors, fonts and layout are all defined as CSS custom properties at the top
of `index.html` (`:root { --amber, --cyan, ... }`) — change the palette there.
The world itself is drawn from the `COUNTRIES_URL` GeoJSON (land fill/border
colors are in the `L.geoJSON` `style` block); if that fetch ever fails
(offline dev, GitHub outage, etc.) it automatically falls back to a keyless
Esri raster basemap so the map never goes blank. The day/night terminator
recomputes every 60 seconds from the current time — no configuration needed.

## Notes & limits

- OpenSky's free tier is rate-limited (anonymous ~400 credits/day, registered
  ~4,000/day) and only ever returns *current* positions — this is normal for
  the free tier, not a bug.
- This is built for **non-commercial / research use**, matching OpenSky's
  terms. Check their terms before any commercial use of the data.
- `ffmpeg`'s bitrate/preset in `live-stream.yml` is tuned for GitHub's shared
  runners; raise `-b:v` if you move to a beefier self-hosted runner.
