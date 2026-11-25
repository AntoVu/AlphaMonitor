require("dotenv").config();
const { status } = require("minecraft-server-util");
const axios = require("axios");
const fs = require("fs");

const SERVER = "alpha.hypixel.net";
const INTERVAL = 30000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const STATE_FILE = "state.json";
// Role IDs live in .env (see .env.example). An unset role just means no ping.
const ALPHA_ROLE_ID = process.env.ALPHA_ROLE_ID;

const FORUM_INTERVAL = 60000;
// filter(thread) decides which new threads get posted; role is pinged with each one.
const FORUMS = [
  {
    name: "News and Announcements",
    url: "https://hypixel.net/forums/news-and-announcements.4/",
    filter: (t) => /skyblock/i.test(t.title),
    role: process.env.NEWS_ROLE_ID,
  },
  {
    name: "SkyBlock Patch Notes",
    url: "https://hypixel.net/forums/skyblock-patch-notes.158/",
    filter: () => true,
    role: process.env.PATCH_NOTES_ROLE_ID,
  },
  {
    name: "SkyBlock Alpha",
    url: "https://hypixel.net/skyblock-alpha/",
    filter: (t) => t.staff,
    role: process.env.ALPHA_THREAD_ROLE_ID,
  },
];

// state = { previousMax, seen: { [forumUrl]: [threadId, ...] }, posted: [title, ...] }
let state = { previousMax: null, seen: {}, posted: [] };

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) };
      console.log(`📂 Loaded previous max: ${state.previousMax}`);
    }
  } catch (err) {
    console.error("Could not load state file, starting fresh.");
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

function getStatus(max) {
  if (max === 0) return { label: "🔴 Closed", color: 0xff0000 };
  if (max <= 25) return { label: "🟡 Private Testing", color: 0xffff00 };
  if (max <= 50) return { label: "🟠 Limited Access", color: 0xff8800 };
  return { label: "🟢 Open", color: 0x00ff00 };
}

async function sendDiscordMessage(prevMax, currentMax, isStartup = false) {
  const { label, color } = getStatus(currentMax);

  const message = {
	content: ALPHA_ROLE_ID ? `<@&${ALPHA_ROLE_ID}>` : undefined,
    embeds: [
      {
        title: isStartup
          ? "🔔 Overnight Change Detected!"
          : "🔔 Player Limit Changed!",
        color: color,
        fields: [
          {
            name: "Max Players",
            value: `${prevMax} → ${currentMax}`,
            inline: true,
          },
          {
            name: "Status",
            value: label,
            inline: true,
          },
          {
            name: "Time",
            value: new Date().toLocaleTimeString(),
            inline: true,
          },
        ],
        footer: {
          text: isStartup
            ? "This change happened while the bot was offline"
            : "alpha.hypixel.net",
        },
        timestamp: new Date().toISOString(),
      },
    ],
	allowed_mentions: {
	  roles: ALPHA_ROLE_ID ? [ALPHA_ROLE_ID] : [],
	},
  };

  await axios.post(WEBHOOK_URL, message);
}

async function checkServer(isStartup = false) {
  try {
    const res = await status(SERVER);
    const currentMax = res.players.max;

    console.log(`[${new Date().toLocaleTimeString()}] Max players: ${currentMax}`);

    if (state.previousMax !== null && currentMax !== state.previousMax) {
      console.log(`Change detected! ${state.previousMax} → ${currentMax}`);
      await sendDiscordMessage(state.previousMax, currentMax, isStartup);
    }

    state.previousMax = currentMax;
    saveState();
  } catch (err) {
    console.error(`Error pinging server: ${err.message}`);
  }
}

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// Pulls threads out of a XenForo forum listing page. Regex over HTML: breaks if the forum theme changes.
function parseThreads(html) {
  return html.split('<div class="structItem structItem--thread').slice(1).flatMap((chunk) => {
    const cls = chunk.slice(0, chunk.indexOf('"'));
    const id = cls.match(/js-threadListItem-(\d+)/)?.[1];
    const link = chunk.match(/<a href="([^"]+)"[^>]*data-tp-primary="on"[^>]*>\s*([^<]*?)\s*<\/a>/);
    if (!id || !link) return [];
    return [{
      id,
      title: decode(link[2]),
      url: "https://hypixel.net" + link[1],
      author: decode(chunk.match(/data-author="([^"]*)"/)?.[1] ?? "?"),
      staff: cls.includes("structItem--thread-is-staff"),
    }];
  });
}

async function sendThreadMessage(forum, t) {
  await axios.post(WEBHOOK_URL, {
    content: forum.role ? `<@&${forum.role}>` : undefined,
    embeds: [{
      title: t.title.slice(0, 256),
      url: t.url,
      color: 0xffaa00,
      author: { name: forum.name },
      footer: { text: `Posted by ${t.author}` },
      timestamp: new Date().toISOString(),
    }],
    allowed_mentions: { roles: forum.role ? [forum.role] : [] },
  });
}

async function checkForum(forum) {
  try {
    const res = await fetch(forum.url, { headers: { "User-Agent": "AlphaMonitor (Discord webhook bot)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const threads = parseThreads(await res.text());
    if (threads.length === 0) throw new Error("no threads parsed, page layout may have changed");

    const seen = state.seen[forum.url];
    // First run for this forum: remember what's there without posting it all.
    if (seen) {
      for (const t of threads.filter((t) => !seen.includes(t.id) && forum.filter(t))) {
        // Major updates are posted as separate threads in News and Patch Notes; only send the title once.
        if (state.posted.includes(t.title)) continue;
        console.log(`📰 New thread in ${forum.name}: ${t.title}`);
        await sendThreadMessage(forum, t);
        state.posted = [t.title, ...state.posted].slice(0, 100);
      }
    }
    // ponytail: seen list capped at 200 per forum, enough since a listing page shows ~20-40 threads
    state.seen[forum.url] = [...new Set([...threads.map((t) => t.id), ...(seen ?? [])])].slice(0, 200);
    saveState();
  } catch (err) {
    console.error(`Error checking ${forum.name}: ${err.message}`);
  }
}

async function checkForums() {
  for (const forum of FORUMS) await checkForum(forum);
}

if (require.main === module) {
  console.log("👀 Watching alpha.hypixel.net every 30 seconds and the forums every 60 seconds...");
  loadState();
  checkServer(true);
  checkForums();
  setInterval(() => checkServer(false), INTERVAL);
  setInterval(checkForums, FORUM_INTERVAL);
}

module.exports = { parseThreads };