require("dotenv").config();
const { status } = require("minecraft-server-util");
const axios = require("axios");

const SERVER = "alpha.hypixel.net";
const INTERVAL = 30000; // 30 seconds
const WEBHOOK_URL = process.env.WEBHOOK_URL;

let previousMax = null;

function getStatus(max) {
  if (max === 0) return { label: "🔴 Closed", color: 0xff0000 };
  if (max <= 25) return { label: "🟡 Private Testing", color: 0xffff00 };
  if (max <= 49) return { label: "🟠 Limited Access", color: 0xff8800 };
  return { label: "🟢 Open", color: 0x00ff00 };
}

function shouldPingEveryone(prevMax, currentMax) {
  // Only ping @everyone if it goes from 0/private to a large open state
  return prevMax <= 25 && currentMax > 25;
}

async function sendDiscordMessage(prevMax, currentMax) {
  const { label, color } = getStatus(currentMax);

  const message = {
    embeds: [
      {
        title: "🔔 Alpha Hypixel — Player Limit Changed!",
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
          text: "alpha.hypixel.net",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  await axios.post(WEBHOOK_URL, message);
}

async function checkServer() {
  try {
    const res = await status(SERVER);
    const currentMax = res.players.max;

    console.log(`[${new Date().toLocaleTimeString()}] Max players: ${currentMax}`);

    if (previousMax !== null && currentMax !== previousMax) {
      console.log(`Change detected! ${previousMax} → ${currentMax}`);
      await sendDiscordMessage(previousMax, currentMax);
    }

    previousMax = currentMax;
  } catch (err) {
    console.error(`Error pinging server: ${err.message}`);
  }
}

console.log("👀 Watching alpha.hypixel.net every 30 seconds...");
checkServer();
setInterval(checkServer, INTERVAL);