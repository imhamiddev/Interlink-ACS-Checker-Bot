# 🤖 Interlink ACS Checker Bot

A simple, fast, and efficient Telegram bot to fetch and display **ACS (Ambassador Contribution Score)** from Interlink profiles.

Built using **Cloudflare Workers**, this bot allows users to quickly check ambassador data with a single command.

---

## ✨ Features

* 🔍 Fetch ACS score using a numeric ID
* 👤 Display full ambassador profile (Name, Region, Level, Score)
* 🖼️ Supports profile avatars
* 🔗 Includes quick-access buttons (Profile + Social Links)
* ⚡ Fast & serverless (powered by Cloudflare Workers)
* 🧵 Works inside Telegram topics (threads supported)

---

## 🚀 How It Works

Users send a command like:

```
/ACS 123456
```

The bot:

1. Fetches data from Interlink API
2. Validates if the profile exists
3. Formats the response
4. Sends back a clean, styled message (with buttons & avatar)

---

## 🛠️ Setup Guide (Step-by-Step)

### 1️⃣ Create a Telegram Bot

* Open Telegram
* Search for **@BotFather**
* Run:

  ```
  /start
  /newbot
  ```
* Choose a name and username
* Copy your **BOT_TOKEN**

---

### 2️⃣ Prepare Cloudflare Workers

* Go to Cloudflare

* Create an account (if you don’t have one)

* Install Wrangler CLI:

  ```bash
  npm install -g wrangler
  ```

* Login:

  ```bash
  wrangler login
  ```

---

### 3️⃣ Create Your Worker

```bash
wrangler init interlink-acs-bot
cd interlink-acs-bot
```

Replace the default code with your bot script.

---

### 4️⃣ Configure Environment Variables

Edit your `wrangler.toml`:

```toml
name = "interlink-acs-bot"
main = "index.js"
compatibility_date = "2024-01-01"

[vars]
SECRET = "your-secret-path"
```

Then set your bot token securely:

```bash
wrangler secret put BOT_TOKEN
```

---

### 5️⃣ Deploy the Worker

```bash
wrangler deploy
```

After deployment, you’ll get a URL like:

```
https://your-worker.workers.dev
```

---

### 6️⃣ Set Webhook

Open this URL in your browser:

```
https://your-worker.workers.dev/setup
```

This will automatically connect your bot to the worker.

---

## 💬 Bot Commands

| Command     | Description                        |
| ----------- | ---------------------------------- |
| `/start`    | Show welcome message               |
| `/ACS [ID]` | Get ACS score by numeric ID        |
| `/give`     | Show current Topic ID (for groups) |

---

## 📦 Example Output

```
👤 Name: John Doe
🆔 ID: 123456
🌍 Region: USA
🏅 Level: Gold (Level 3)
⭐ ACS Score: 87
```

With:

* Profile button
* Social media buttons (max 2 per row)
* Avatar (if available)

---

## ⚠️ Notes

* Only numeric IDs are supported
* If a profile is not found, the bot will notify the user
* Works in private chats, groups, and topics

---

## 🧠 Tech Stack

* **Cloudflare Workers** (serverless runtime)
* **Telegram Bot API**
* **Interlink API**

---

## ❤️ Contribution

Feel free to fork, improve, or customize this bot for your needs.

---

## 📄 License

MIT License
