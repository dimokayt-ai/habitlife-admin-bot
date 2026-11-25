# HabitLife Admin Bot + API

Telegram-панель управления пользователями приложения. Бот и API используют **одну SQLite-базу**: команды из Telegram сразу видны приложению через API.

## Запуск

```bash
npm install
cp .env.example .env
# BOT_TOKEN от @BotFather, ADMIN_TG_ID от @userinfobot
npm run api    # сервер приложения :4000
npm start      # Telegram-бот
```

В приложении задайте `API_URL` адрес этого сервера и `GOOGLE_WEB_CLIENT_ID`.

## Что умеет бот

/start, /users (список с пагинацией), /find email (поиск), /add email name, /grant email, /revoke email, /stats. Кнопки под пользователем: роль, блокировка, лимит сканирований, удаление.

## Безопасность

Доступ только для ADMIN_TG_ID. Внутренние endpoint'ы /internal защищены INTERNAL_TOKEN. Роль меняется только сервером/ботом.
