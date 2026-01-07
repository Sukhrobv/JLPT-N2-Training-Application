# Деплой приложения (бесплатно)

## Рекомендуемый вариант: Render.com

Render предлагает бесплатный хостинг для статических сайтов и Node.js приложений.

### Шаг 1: Подготовка

Добавьте в `package.json` скрипт для продакшена:

```json
{
  "scripts": {
    "start": "node server/server.js",
    "build": "vite build"
  }
}
```

### Шаг 2: Загрузка на GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/jlpt-trainer.git
git push -u origin main
```

### Шаг 3: Создание сервиса на Render

1. Зарегистрируйтесь на [render.com](https://render.com)
2. Нажмите **New → Web Service**
3. Подключите GitHub репозиторий
4. Настройте:
   - **Name**: `jlpt-trainer`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Нажмите **Create Web Service**

### Шаг 4: Настройка статики

Обновите `server/server.js` для раздачи фронтенда:

```javascript
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// После app.use(express.json()):
app.use(express.static(path.join(__dirname, "../dist")));

// В конце файла, перед app.listen():
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
```

---

## Альтернатива: Railway.app

1. Зарегистрируйтесь на [railway.app](https://railway.app)
2. Нажмите **New Project → Deploy from GitHub**
3. Выберите репозиторий
4. Railway автоматически определит Node.js проект

---

## Альтернатива: Vercel + Serverless

Для Vercel нужно переписать бэкенд как Serverless Functions, что сложнее.

---

## Важные замечания

### База данных в продакшене

⚠️ SQLite хранит данные в файле. При редеплое на Render/Railway **файл может быть перезаписан**!

**Решение 1**: Храните `jlpt.db` в постоянном хранилище (Render Persistent Disk — платно).

**Решение 2**: Используйте внешнюю БД:

- [Turso](https://turso.tech) — SQLite в облаке (бесплатно)
- [PlanetScale](https://planetscale.com) — MySQL (бесплатно)
- [Neon](https://neon.tech) — PostgreSQL (бесплатно)

### Переменные окружения

На Render/Railway добавьте:

- `PORT` — обычно выставляется автоматически
- `NODE_ENV=production`

---

## Быстрый деплой: Glitch.com

Самый простой вариант для тестирования:

1. Откройте [glitch.com](https://glitch.com)
2. **New Project → Import from GitHub**
3. Вставьте URL репозитория
4. Приложение автоматически запустится

**Минусы**: проект "засыпает" после неактивности, база данных может быть сброшена.
