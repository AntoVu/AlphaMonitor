require("dotenv").config();
const { status } = require("minecraft-server-util");
const axios = require("axios");
const fs = require("fs");

const SERVER = "alpha.hypixel.net";
const INTERVAL = 30000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const STATE_FILE = "state.json";

let previousMax = null;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      console.log(`📂 Loaded previous max: ${data.previousMax}`);
      return data.previousMax;
    }
  } catch (err) {
    console.error("Could not load state file, starting fresh.");
  }
  return null;
}

function saveState(max) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ previousMax: max }));
}

function getStatus(max) {
  if (max === 0) return { label: "🔴 Closed", color: 0xff0000 };
  if (max <= 25) return { label: "🟡 Private Testing", color: 0xffff00 };
  if (max <= 49) return { label: "🟠 Limited Access", color: 0xff8800 };
  return { label: "🟢 Open", color: 0x00ff00 };
}

async function sendDiscordMessage(prevMax, currentMax, isStartup = false) {
  const { label, color } = getStatus(currentMax);

  const message = {
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
  };

  await axios.post(WEBHOOK_URL, message);
}

async function checkServer(isStartup = false) {
  try {
    const res = await status(SERVER);
    const currentMax = res.players.max;

    console.log(`[${new Date().toLocaleTimeString()}] Max players: ${currentMax}`);

    if (previousMax !== null && currentMax !== previousMax) {
      console.log(`Change detected! ${previousMax} → ${currentMax}`);
      await sendDiscordMessage(previousMax, currentMax, isStartup);
    }

    previousMax = currentMax;
    saveState(currentMax);
  } catch (err) {
    console.error(`Error pinging server: ${err.message}`);
  }
}

console.log("👀 Watching alpha.hypixel.net every 30 seconds...");
previousMax = loadState();
checkServer(true);
setInterval(() => checkServer(false), INTERVAL);