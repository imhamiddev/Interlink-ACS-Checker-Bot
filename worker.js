const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;
const INTERLINK_API = (id) =>
  `https://prod.interlinklabs.ai/api/v1/ambassador-profile/get-profile/${id}`;
const PROFILE_URL = (id) => `https://ambassador.interlinklabs.ai/en/${id}`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/setup") {
      return await setupWebhook(request, env);
    }

    if (
      request.method === "POST" &&
      url.pathname === `/webhook/${env.SECRET}`
    ) {
      const update = await request.json();
      await handleUpdate(update, env);
      return new Response("OK", { status: 200 });
    }

    return new Response("Interlink ACS Bot is running!", { status: 200 });
  },
};

async function setupWebhook(request, env) {
  const workerUrl = new URL(request.url).origin;
  const webhookUrl = `${workerUrl}/webhook/${env.SECRET}`;

  const res = await fetch(`${TELEGRAM_API(env.BOT_TOKEN)}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

// ===== ACS Text Builder =====
function buildAcsLine(p) {
  const totalAcs =
    typeof p.acs === "number" ? parseFloat(p.acs.toFixed(2)) : null;
  const teamAcs =
    typeof p.userMetadata?.acs === "number"
      ? parseFloat(p.userMetadata.acs.toFixed(2))
      : null;

  if (totalAcs === null) return `⭐ <b>ACS:</b> N/A`;

  if (teamAcs !== null) {
    const ambassadorAcs = parseFloat((totalAcs - teamAcs).toFixed(2));
    return (
      `⭐ <b>ACS:</b> ${totalAcs}\n` +
      `   ├ 🧑‍💼 Ambassador: ${ambassadorAcs}\n` +
      `   └ 👥 Team Grant: ${teamAcs}`
    );
  }

  return `⭐ <b>ACS:</b> ${totalAcs}`;
}

// ===== Profile Text Builder =====
function buildProfileText(p, userId) {
  return (
    `<b>Profile Found Successfully ✅</b>\n\n` +
    `👤 <b>Name:</b> ${p.firstName} ${p.lastName}\n` +
    `🆔 <b>ID:</b> <code>${userId}</code>\n` +
    `🌍 <b>Country:</b> ${p.country}\n` +
    `🏅 <b>Level:</b> ${p.userMetadata?.tierNameAmbassador}\n` +
    `${buildAcsLine(p)}\n\n` +
    `<i>Created by: <a href="https://t.me/imhamiddev">Hamid Dev</a></i>`
  );
}

// ===== Keyboard Builder =====
function buildKeyboard(p, userId) {
  const keyboard = { inline_keyboard: [] };

  if (Array.isArray(p.socialLinks)) {
    let row = [];
    p.socialLinks.forEach((item) => {
      if (item?.link && item?.social) {
        row.push({
          text: item.social.toUpperCase(),
          url: item.link,
          style: "danger",
        });
        if (row.length === 2) {
          keyboard.inline_keyboard.push(row);
          row = [];
        }
      }
    });
    if (row.length > 0) keyboard.inline_keyboard.push(row);
  }

  keyboard.inline_keyboard.push(
    [
      {
        text: "🔄 Refresh",
        callback_data: `refresh_${userId}`,
        style: "primary",
      },
    ],
    [{ text: "View Profile", url: PROFILE_URL(userId), style: "success" }],
  );

  return keyboard;
}

async function handleUpdate(update, env) {
  // ================= CALLBACK HANDLER =================
  if (update?.callback_query) {
    const query = update.callback_query;
    await fetch(`${TELEGRAM_API(env.BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: query.id, show_alert: false }),
    });

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    // --- Refresh ---
    if (data?.startsWith("refresh_")) {
      const userId = data.split("_")[1];
      if (!userId) return;

      try {
        await editMessage(env.BOT_TOKEN, chatId, messageId, "🔄 Refreshing...");

        const res = await fetch(INTERLINK_API(userId));
        const dataApi = await res.json();

        if (!res.ok || !dataApi?.data?.haveProfile) {
          return editMessage(
            env.BOT_TOKEN,
            chatId,
            messageId,
            "❌ Failed to refresh data",
          );
        }

        const p = dataApi.data;
        const textRes = buildProfileText(p, userId);
        const keyboard = buildKeyboard(p, userId);

        return editMessage(env.BOT_TOKEN, chatId, messageId, textRes, keyboard);
      } catch {
        return editMessage(
          env.BOT_TOKEN,
          chatId,
          messageId,
          "⚠️ Error while refreshing",
        );
      }
    }

    // --- Profile detail (from /compare) ---
    if (data?.startsWith("profile_")) {
      const userId = data.split("_")?.[1];
      if (!userId) return;

      try {
        const res = await fetch(INTERLINK_API(userId));
        const d = await res.json();

        if (!d?.data?.haveProfile) {
          return editMessage(
            env.BOT_TOKEN,
            chatId,
            messageId,
            "❌ Profile not found",
          );
        }

        const p = d.data;
        const text = buildProfileText(p, userId);
        const keyboard = buildKeyboard(p, userId);

        return editMessage(env.BOT_TOKEN, chatId, messageId, text, keyboard);
      } catch {
        return editMessage(env.BOT_TOKEN, chatId, messageId, "⚠️ Error");
      }
    }

    return;
  }

  // ================= MESSAGE HANDLER =================
  const message = update?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const threadId = message.message_thread_id ?? null;

  const userIdUser = message?.from?.id;
  if (!userIdUser) return;

  const now = Date.now();
  if (!globalThis.__cooldown) globalThis.__cooldown = new Map();

  if (
    globalThis.__cooldown.get(userIdUser) &&
    now - globalThis.__cooldown.get(userIdUser) < 3000
  ) {
    return sendMessage(
      env.BOT_TOKEN,
      chatId,
      "⏳ Please wait a moment...",
      threadId,
    );
  }
  globalThis.__cooldown.set(userIdUser, now);

  await fetch(`${TELEGRAM_API(env.BOT_TOKEN)}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });

  // ================= /start =================
  if (text === "/start") {
    return sendMessage(
      env.BOT_TOKEN,
      chatId,
      `👋 Welcome to ACS Checker Bot!\n\nUse:\n<code>/ACS [ID]</code>\n<code>/compare [ID1] [ID2]</code>`,
      threadId,
    );
  }

  // ================= /compare =================
  const compareMatch = text.match(/^\/compare\s+(\d+)\s+(\d+)$/i);
  if (compareMatch) {
    const id1 = compareMatch[1];
    const id2 = compareMatch[2];

    try {
      const [r1, r2] = await Promise.all([
        fetch(INTERLINK_API(id1)).then((r) => r.json()),
        fetch(INTERLINK_API(id2)).then((r) => r.json()),
      ]);

      if (!r1.data?.haveProfile || !r2.data?.haveProfile) {
        return sendMessage(
          env.BOT_TOKEN,
          chatId,
          "❌ One of the IDs is invalid",
          threadId,
        );
      }

      const a = r1.data;
      const b = r2.data;

      const nameA =
        `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || "User A";
      const nameB =
        `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim() || "User B";

      const acsA = a.acs ?? 0;
      const acsB = b.acs ?? 0;

      const winner = acsA > acsB ? nameA : acsB > acsA ? nameB : "Tie 🤝";

      const msg =
        `⚔️ <b>ACS Comparison</b>\n\n` +
        `👤 ${nameA}: <b>${parseFloat(acsA.toFixed(2))}</b>\n` +
        `👤 ${nameB}: <b>${parseFloat(acsB.toFixed(2))}</b>\n\n` +
        `🏆 Winner: <b>${winner}</b>\n\n` +
        `Tap a name to view their full profile 👇`;

      const keyboard = {
        inline_keyboard: [
          [{ text: `👤 ${nameA}`, callback_data: `profile_${id1}` }],
          [{ text: `👤 ${nameB}`, callback_data: `profile_${id2}` }],
        ],
      };

      return sendMessage(env.BOT_TOKEN, chatId, msg, threadId, keyboard);
    } catch {
      return sendMessage(env.BOT_TOKEN, chatId, "⚠️ Compare failed", threadId);
    }
  }

  // ================= /ACS =================
  const acsMatch = text.match(/^\/ACS\s+(\d+)$/i);
  if (!acsMatch) {
    return sendMessage(
      env.BOT_TOKEN,
      chatId,
      `❓ Unknown command\n\nUsage:\n<code>/ACS [ID]</code>\n<code>/compare [ID1] [ID2]</code>`,
      threadId,
    );
  }

  const userId = acsMatch[1];

  const loadingMsg = await sendMessageAndGetId(
    env.BOT_TOKEN,
    chatId,
    "🔍 Searching user...\n\n[░░░░░░░░░░] 0%",
    threadId,
  );
  const messageId = loadingMsg.result.message_id;

  try {
    for (let i = 1; i <= 10; i++) {
      const percent = i * 10;
      await new Promise((r) => setTimeout(r, 300));
      await editMessage(
        env.BOT_TOKEN,
        chatId,
        messageId,
        `🔍 Searching user...\n\n[${getProgressBar(percent)}] ${percent}%`,
      );
    }

    const res = await fetch(INTERLINK_API(userId));
    const data = await res.json();

    await deleteMessage(env.BOT_TOKEN, chatId, messageId).catch(() => {});

    if (!res.ok || !data?.data?.haveProfile) {
      return sendMessage(
        env.BOT_TOKEN,
        chatId,
        `❌ No profile found for <code>${userId}</code>.`,
        threadId,
      );
    }

    const p = data.data;
    const textRes = buildProfileText(p, userId);
    const keyboard = buildKeyboard(p, userId);

    if (p.avatar) {
      await fetch(`${TELEGRAM_API(env.BOT_TOKEN)}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: p.avatar,
          caption: textRes,
          parse_mode: "HTML",
          reply_markup: keyboard,
          ...(threadId && { message_thread_id: threadId }),
        }),
      });
    } else {
      await sendMessage(env.BOT_TOKEN, chatId, textRes, threadId, keyboard);
    }
  } catch {
    await deleteMessage(env.BOT_TOKEN, chatId, messageId).catch(() => {});
    return sendMessage(
      env.BOT_TOKEN,
      chatId,
      "⚠️ Error fetching data",
      threadId,
    );
  }
}

// ===== UTILS =====

async function sendMessageAndGetId(token, chatId, text, threadId = null) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (threadId) body.message_thread_id = threadId;

  const res = await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await res.json();
}

async function editMessage(token, chatId, messageId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`${TELEGRAM_API(token)}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deleteMessage(token, chatId, messageId) {
  await fetch(`${TELEGRAM_API(token)}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

async function sendMessage(
  token,
  chatId,
  text,
  threadId = null,
  replyMarkup = null,
) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (threadId) body.message_thread_id = threadId;
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getProgressBar(percent) {
  const total = 10;
  const filled = Math.round((percent / 100) * total);
  return "█".repeat(filled) + "░".repeat(total - filled);
}
