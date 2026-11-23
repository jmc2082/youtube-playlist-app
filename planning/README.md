# YouTube Videos Organizer Player App

## An application that allows you to organize and sort youtube video urls by their time length or date when created, create watch later playlists ext. If logged in you should be able to sort and organize your "Watch Later" playlist.

### Features Wishlist

* Leverage any cli tools or sdks offered by Youtube or Google Cloud Platform (GCP) to allow a user/developer to manipulate their personal youtube playlists. This would only include things that you normally do by hand like: organizing playlists, adding videos urls to a playlist, sorting watch later videos by date or time length ext.
* Use a framework like Vue.js with TypeScript, Composition API setup to consume the youtube / google sdk apis and load the videos, play them and manipulate the playlist with a custom ui built out.
* Ensure that once the videos are played in the Vue.js webapp, they are recorded as have been watched on the YouTube side, meaning that if I physically pull up my YouTube account, it will show that I have previously watched the videos even though they were played externally.

### Why I'm building this tool?

* I've been watching YouTube for years and I have several playlists, saved videos and most often videos that I watch for current events. Having the ability to sort videos in the way that I described above would save so much time. Having some videos that are 2 hours or more and some that are 30 seconds is annoying when you want to get the short videos watched first before we get into the long form content videos. 

### Project built in the past

* I've attempted to build a version of this that was purely JavaScript scripts that run in the Chrome console years ago when you could easily manipulate the DOM on the fly. I would literally write these scripts and drop them in for some quick browser changes. Now Google Chrome locks down the console so you cannot easily do this sort of thing. Besides, I do want all of my efforts to be within a UI that has it's actions programmed and invokable without copying and pasting scripts into a browser console. I also used localStorage to store my playlist order.

### Realizations

* I realize this may not be possible and if it is, I'm prepared to create any Google API keys needed to make this happen.

### Potential Tech Stack and Tools

* Vue.js with TypeScript, Composition API setup (Webapp or Electron App)
* Google GCP or YouTube SKD API access
* AWS SAM CLI Project for serverless REST endpoints to power the vue.js app (only if the google sdk is not enough).
* Data persistance options if needed: localStorage in browser, SQLite, MongoDB if needed.

---

## Feasibility findings & decisions (Nov 2026)

### What YouTube allows
* **Watch Later can't be read through the API.** Since 2016, the YouTube Data API v3 returns an empty list for the `WL` (Watch Later) and `HL` (History) playlists, even with full OAuth access.
  * **Decision:** import Watch Later from a **Google Takeout** CSV (`Watch later-videos.csv`) or pasted links. Longer term, save new videos to a normal playlist (e.g. "Queue") so everything works live.
* **Watch history can't be written through the API.** There's no endpoint to mark a video as watched.
  * **Decision:** play videos with the official `youtube.com` IFrame player. If you're signed into YouTube in the same browser, plays *usually* count toward your history. It isn't guaranteed, and we decided not to fight it. The app keeps its own local "watched" marks.
* **Regular playlists work fully:** list, add, remove, create, and reorder (`playlistItems.update` with `position`).
* **Quota:** 10,000 units per day. Reads are cheap (1 unit per 50 videos for durations and dates). Writes cost 50 units each.
  * **Decision:** all sorting and filtering happens locally. Writing an order back to YouTube is an explicit, confirmed action that shows the cost first.

### Stack decisions
* **Vue 3 + TypeScript + Composition API + Vite + Pinia.** Web app first; Electron later only if needed, since Electron complicates the watch-history cookie behavior.
* **No backend** (AWS SAM dropped for now). OAuth runs in the browser through Google Identity Services, and the YouTube API supports CORS.
* **IndexedDB via Dexie** instead of localStorage for the video/playlist cache. localStorage holds only small preferences.
* **Sorting:** after fetching, the list sorts by the default (**Length, shortest first**, configurable), and you can re-sort anytime by upload date, date added, title, channel, or original order, in either direction.

### Build order
1. ~~Embedded-playback history spike~~ — skipped; best effort only (see above).
2. ✅ Sign in → list playlists → fetch and sort by duration and date.
3. ✅ Local queue player (shortest first, auto-advance, watched tracking).
4. ✅ Watch Later import from a Takeout CSV or pasted links.
5. ✅ Write back to YouTube: add, copy, remove, create playlist, save sorted order.

The app lives in [`../code`](../code); setup steps are in [`../code/README.md`](../code/README.md).
