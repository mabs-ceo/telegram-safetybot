🛡️ Telegram Safety Bot
A role-based Telegram bot designed for workplace safety reporting and management. Built with Node.js, Telegraf, and MongoDB, this bot facilitates efficient reporting, assignment, rectification, and closure of safety findings via Telegram.

🚀 Features
Role-Based Access:

👷 Safety Officer: Upload safety findings (photos + location).

🧑‍💼 Moderator: View, assign, and close findings.

🛠️ In-Charge: Upload rectification images for assigned findings.

🧑‍🔬 Supervisor: View all findings, apply filters, and see statistics.

👨‍💼 Admin: Register users via /register.

Finding Lifecycle:

Report: Safety Officer submits finding (photo + location).

Assign: Moderator assigns to an In-Charge.

Rectify: In-Charge uploads a rectification photo.

Review: Safety Officer reviews and marks complete or flags incomplete.

Close: Moderator can close findings.

Interactive Telegram UI: Uses Telegraf's inline buttons and callback queries.

MongoDB Integration: Stores users, findings, and metadata.

📦 Installation
```bash
Copy
Edit
git clone https://github.com/yourusername/telegram-safety-bot.git
cd telegram-safety-bot
---
```bash
npm install
⚙️ Configuration
Create a .env file in the project root with:
---
```bash
env
Copy
Edit
BOT_TOKEN=your_telegram_bot_token
ADMIN_TELEGRAM_ID=your_admin_telegram_id
MONGODB_URI=your_mongodb_connection_string
⚠️ Make sure your bot is registered with @BotFather, and the token is active.
---

🧪 Running the Bot
```bash
Copy
Edit
node index.js
---
If everything is configured properly, you'll see:

 ```arduino
Copy
Edit
🚀 Bot is running...
🧑‍💼 Usage Guide
🔐 Admin
---

```bash
Copy
Edit
/register <telegramId> <role> [name]
Valid roles: safety_officer, moderator, in_charge, supervisor
---
👷 Safety Officer Flow
/start → Opens Safety Officer menu

Click "Upload Finding" → Send photo → Send location/description

🧑‍💼 Moderator Flow
/start → Opens Moderator menu

Click "View Pending" → Assign to In-Charge or Close

Click "Close" → Upload closure photo

🛠️ In-Charge Flow
/start → "My Assigned Findings"

Upload rectification photo via button

🧑‍🔬 Supervisor Flow
/start → View all findings, apply filters, or see summary stats

🗂️ Project Structure
```pgsql
Copy
Edit
├── config/
│   └── db.js           # MongoDB connection
├── models/
│   ├── User.js
│   └── Finding.js
├── middleware/
│   └── auth.js         # Role-based access control
├── utils/
│   └── roles.js        # Role constants
├── keyboards.js        # Inline menus
├── index.js            # Bot entry point
└── .env                # Environment variables
---
🧠 Tech Stack
Telegraf.js – Telegram Bot Framework

MongoDB + Mongoose – Database

Node.js – Backend runtime

dotenv – Environment config

📌 Future Enhancements
Image previews on dashboards

Audit trail for user actions

Web dashboard for reporting

Notifications to users when findings are assigned

📜 License
MIT License. Feel free to use, modify, and contribute.

Let me know if you'd like a version with setup screenshots or badges (e.g. GitHub Actions, License, Node version).





