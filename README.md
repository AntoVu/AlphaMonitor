# AlphaMonitor

Posts to a Discord channel when:

- the player limit on `alpha.hypixel.net` changes (checked every 30 seconds)
- a new thread appears in one of these Hypixel forums (checked every 60 seconds):

| Forum | What gets posted |
|---|---|
| [News and Announcements](https://hypixel.net/forums/news-and-announcements.4/) | Threads with "SkyBlock" in the title |
| [SkyBlock Patch Notes](https://hypixel.net/forums/skyblock-patch-notes.158/) | Every new thread |
| [SkyBlock Alpha](https://hypixel.net/skyblock-alpha/) | Threads posted by Hypixel staff only |

Each alert can ping its own Discord role. A forum is only monitored when you set a role for it.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- A Discord server where you can create webhooks

## Setup

1. Clone the repo and install dependencies:

   ```sh
   git clone https://github.com/AntoVu/AlphaMonitor.git
   cd AlphaMonitor
   npm install
   ```

2. Create a webhook in Discord: **Channel Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL**.

3. Get the IDs of the roles you want pinged. Turn on **User Settings → Advanced → Developer Mode**, then go to
   **Server Settings → Roles**, right-click a role and choose **Copy Role ID**.

4. Copy `.env.example` to `.env` and fill it in:

   ```sh
   WEBHOOK_URL=https://discord.com/api/webhooks/...

   # Role pinged when the alpha server's player limit changes. Blank = post without a ping.
   ALPHA_ROLE_ID=

   # Forum roles. A blank one turns that forum off.
   ALPHA_THREAD_ROLE_ID=
   NEWS_ROLE_ID=
   PATCH_NOTES_ROLE_ID=
   ```

5. Start it:

   ```sh
   npm start
   ```

   It prints which forums it is watching. Leave the window open; the monitor stops when you close it.

## How it works

- **Server:** pings `alpha.hypixel.net` with a Minecraft status request and compares the max player count to
  the last one seen. If the limit changed while the bot was off, it reports that on startup.
- **Forums:** downloads each forum's thread list (about 20 KB) and posts threads it hasn't seen before. On the
  first run it only records what's already there, so you don't get flooded with old threads.
- Major updates are posted as separate threads in both News and Patch Notes; each title is only sent once.
- What it has seen is stored in `state.json`. Delete that file to start fresh.

If the forum layout changes, the console shows `no threads parsed` for that forum and the other checks keep
running.

## Tests

```sh
npm test
```
