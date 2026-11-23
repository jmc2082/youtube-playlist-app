# TubeSort

Sort and play your YouTube playlists by **length** or **date**, all in one queue.
Built with Vue 3 (Composition API), TypeScript, Vite, Pinia and Dexie (IndexedDB). There's no backend: it runs entirely in the browser.

## Quick start

```bash
cd code
npm install
cp .env.example .env     # then fill in VITE_GOOGLE_CLIENT_ID (see below)
npm run dev              # http://localhost:5173
```

The app still runs without a client ID. You can import a list, but you'll need to sign in (or set an API key) before titles and lengths load.

## Google Cloud setup (one time, about 10 minutes)

1. Go to https://console.cloud.google.com/ and create a project, e.g. "TubeSort".
2. **APIs & Services → Library**: enable **YouTube Data API v3**.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform):
   - User type: **External**. Publishing status: leave it in **Testing**.
   - Add your own Google account under **Test users**.
   - Testing mode lets you use the `youtube` scope without Google's app verification.
4. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173`
   - Copy the client ID into `.env` as `VITE_GOOGLE_CLIENT_ID`.
5. *(Optional)* **Create credentials → API key**. Restrict it to YouTube Data API v3 and set it as `VITE_YOUTUBE_API_KEY`. This lets imported lists load details without signing in.

Restart `npm run dev` after editing `.env`.

## What it does

| Feature | How |
| --- | --- |
| Load your playlists and Liked videos | `playlists.list` / `playlistItems.list` (OAuth) |
| Sort by length, upload date, date added, title, channel, or playlist order (either direction) | Done locally, no API cost. Defaults to **Shortest first**. Change it from the toolbar ("Make default") or in Settings |
| Filter by length bucket, search, hide watched | Local |
| Play everything in the current order | YouTube IFrame Player, auto-advances, marks videos watched at 90% or when they end |
| Comments while playing | Collapsible panel in the player. Top/Newest sort, replies, clickable timestamps that jump the video. Loads only when opened: `commentThreads.list`, 1 unit per 50 comments, cached per video |
| Import Watch Later | Google Takeout CSV (`Watch later-videos.csv`) or pasted links |
| Choose which playlists show in the sidebar | Settings → *Playlists in the sidebar*. On first sign-in, the starter names in `src/stores/settings.ts` (`STARTER_PLAYLISTS`) are matched; after that they're remembered by ID |
| **Remove watched** | Removes every video you've watched from the open playlist on YouTube, in one confirmed batch (50 units each) |
| Add to playlist / copy all to playlist / remove / create playlist | `playlistItems.insert/delete`, `playlists.insert` |
| **Save order to YouTube** | Rewrites the real playlist to match your sort, using as few moves as it can |

### Known YouTube limits
- **Watch Later can't be read through the API.** YouTube has returned an empty list for it since 2016, which is why the Takeout import exists. Tip: save new videos to a normal playlist (e.g. "Queue") instead, and everything works live.
- **Watch history can't be written through the API.** The player uses `youtube.com` embeds, not `youtube-nocookie.com`. If you're signed into YouTube in the same browser, plays usually show up in your history, but YouTube doesn't guarantee it. TubeSort also keeps its own "watched" marks locally.
- **Quota:** 10,000 units per day. Reads cost about 1 unit per 50 videos. Each write (add, remove, move) costs 50. Reordering a 200-video playlist could use most of a day's quota, so the app shows the cost and asks before any bulk write. The header meter is a local estimate.
- To save an order, the playlist's sort setting on YouTube must be **Manual**.

## Deploying with AWS Amplify Hosting

Every push to your chosen branch builds, tests and deploys automatically. Your YouTube data stays protected by Google sign-in: keep the OAuth app in **Testing** mode with only your account as a test user, and no one else can sign in.

**Repo files:** `amplify.yml` (build spec, `appRoot: code`, Node 22, runs tests before building) and `customHttp.yml` (security and caching headers). Both live at the **repo root**.

### One-time setup
1. Push the repo to GitHub, GitLab, Bitbucket or CodeCommit.
2. **Amplify console → Create new app → Host web app**. Connect the repo and branch (e.g. `main`).
3. Tick **"My app is a monorepo"** and set the root directory to `code`. Amplify should detect `amplify.yml`.
4. **Advanced settings → Environment variables** (or later under *Hosting → Environment variables*):
   - `VITE_GOOGLE_CLIENT_ID`: required; the build fails without it.
   - `VITE_YOUTUBE_API_KEY`: needed for comments.
   - `AMPLIFY_MONOREPO_APP_ROOT` = `code`: Amplify usually sets this itself in step 3.
5. Save and deploy. When it finishes, copy the URL (`https://main.<id>.amplifyapp.com`).
6. In **Google Cloud Console**:
   - OAuth client → **Authorized JavaScript origins** → add that URL.
   - API key → **Application restrictions → Websites** → add `https://main.<id>.amplifyapp.com/*` and `http://localhost:5173/*`. The key ships in the JavaScript bundle, so this restriction is what stops others from using your quota.

After that, deploying is just `git push`. A custom domain can be added under **Hosting → Custom domains** (free certificate). Remember to add the new domain to both Google settings in step 6.

Notes:
- `VITE_` variables are baked into the public bundle at build time. They aren't secret; the restrictions above are what protect them.
- Never commit `.env` or anything in `access/`. Both are in `.gitignore`. The OAuth **client secret** JSON isn't used by this app at all; browser sign-in doesn't need it.
- Watched marks and imports live in each browser's storage per site address, so the deployed site starts with an empty local cache.
- Check the headers after the first deploy: `curl -sI https://main.<id>.amplifyapp.com | grep -iE 'strict|referrer|frame'`

## Scripts

```bash
npm run dev        # dev server
npm run build      # typecheck + production build
npm test           # unit tests (sorting, duration parsing, Takeout parsing, reorder planning)
```

## Project layout

```
src/
  services/   auth.ts (Google Identity Services token flow), youtube.ts (Data API v3)
  stores/     library (sources, videos, sort/filter, YouTube writes), player, auth, settings, quota, ui
  lib/        pure helpers: sort.ts, format.ts, takeout.ts, db.ts (Dexie) + tests
  components/ AppHeader, SideBar, LibraryView, SortToolbar, VideoCard, PlayerPanel, dialogs…
```

All data (playlists, video details, imports, watched marks) is cached in the browser's IndexedDB. Settings → "Reset all local data" clears it.
