# HabitLife Admin Bot

Админ-панель внутри Telegram. Бот хранит базу пользователей в SQLite, ищет по почте и управляет ролями.

## Запуск

```bash
npm install
cp .env.example .env
# BOT_TOKEN от @BotFather, ADMIN_TG_ID от @userinfobot
npm start
```

## Команды

/start, /users, /find email, /add email name, /grant email, /revoke email, /stats

Кнопки под пользователем: выдать/снять админ, блокировка, лимит, удаление.

Доступ только для ADMIN_TG_ID.
