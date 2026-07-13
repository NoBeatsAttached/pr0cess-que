# PR0CESS // QUEUE

Your own submission site for PR0CESS_LIVE feedback streams. Viewers hit the link,
drop a SoundCloud/Dropbox link, it lands in a live queue. You run the queue from a
PIN-locked dashboard. OBS overlay included. Free, and it's yours.

- `your-url/` — submit form (what `!submit` links to)
- `your-url/#queue` — dashboard (PIN-locked)
- `your-url/#overlay` — OBS browser source (transparent)

## Setup — 4 steps

**1. Backend (one paste).** Go to [supabase.com](https://supabase.com) → sign in with
GitHub → New project (free plan) → pick any name/password/region → wait ~1 min for it
to spin up. Then click **SQL Editor** in the left sidebar → paste the ENTIRE contents
of `setup.sql` → **Run**. It prints your dashboard PIN when it finishes. That's the
whole backend — you never touch the Supabase console again.

**2. Two strings.** Left sidebar → ⚙️ **Settings** → **API**. Copy **Project URL**
and the **anon public** key. Open `config.js`, paste them into the two PASTE_ slots.

**3. GitHub Pages.** New public repo → Add file → Upload files → drag in
`index.html`, `app.js`, `config.js`, `styles.css`, `icon.svg` (NOT setup.sql — that
stays on your computer) → Commit. Then Settings → Pages → Deploy from a branch →
main / root → Save. Your site is `https://YOURNAME.github.io/REPONAME/` in ~1 min.

**4. StreamElements command.** Type this in G-REX's chat (as the broadcaster or a mod):

```
!command add !submit Drop your track for feedback → https://YOURNAME.github.io/REPONAME/
```

Now anyone typing `!submit` gets the link. Done.

## Wire into the stream
- OBS → add **Browser** source → URL: `your-url/#overlay` → it's transparent, place it anywhere.
- Open `your-url/#queue` on your machine, enter the PIN once. It stays unlocked on that browser.

## Running a stream
- **Submissions OPEN/CLOSED** toggle at the top of the dashboard.
- **Review** arms a track → shows on the overlay. **Done** finishes it.
- **Bump ↑** to front, **Skip**, **✕** delete, **Clear reviewed** wipes the night's pile.
- Everything updates live everywhere — dashboard, overlay, and the "N waiting" count
  on the submit page.

## Built-in guards
- One active track per handle — enforced by the database, not the honor system.
- Submissions only accepted while the session is OPEN.
- Nobody can touch the queue without the PIN — reads are public, writes are locked.

## If you update files later
GitHub Pages caches hard. After editing a file, also bump the `?v=1` at the bottom of
`index.html` to `?v=2` (etc.) and commit — that forces every browser and OBS to load
the new version. In OBS you can also right-click the source → Refresh cache.
