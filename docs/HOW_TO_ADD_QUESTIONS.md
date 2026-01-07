# Как добавить вопросы в базу данных

## Структура данных

### Таблицы

1. **chapters** — главы (разделы учебника)
2. **question_types** — типы заданий (лексика, грамматика, чтение)
3. **reading_passages** — тексты для чтения (группируют вопросы)
4. **questions** — вопросы
5. **answers** — варианты ответов

## Способ 1: Редактирование seed.js

Откройте `server/seed.js` и добавьте вопросы в соответствующий массив:

### Добавить обычный вопрос (грамматика/лексика)

```javascript
// Добавьте в массив grammarQuestions или vocabQuestions:
{
  content: 'Текст вопроса на японском',
  explanation: 'Объяснение правильного ответа',
  answers: [
    { content: '正解', correct: true },    // Правильный ответ
    { content: '不正解1', correct: false },
    { content: '不正解2', correct: false },
    { content: '不正解3', correct: false },
  ]
}
```

### Добавить текст для чтения с вопросами

```javascript
// 1. Создайте текст:
const passageContent = `
Длинный текст на японском языке...
`;

const passageResult = insertPassage.run(
  ch3,
  passageContent.trim(),
  "Название текста"
);
const passageId = passageResult.lastInsertRowid;

// 2. Добавьте вопросы к тексту:
const readingQuestions = [
  {
    content: "Вопрос к тексту",
    order: 1, // Порядок вопроса в группе
    answers: [
      { content: "正解", correct: true },
      { content: "不正解", correct: false },
      // ...
    ],
  },
  // ... ещё вопросы
];

readingQuestions.forEach((q) => {
  const result = insertQuestion.run(
    ch3,
    readingType,
    passageId,
    q.content,
    q.order,
    null
  );
  const questionId = result.lastInsertRowid;
  q.answers.forEach((a) =>
    insertAnswer.run(questionId, a.content, a.correct ? 1 : 0)
  );
});
```

### Применить изменения

```bash
npm run seed
```

⚠️ **Внимание**: `npm run seed` очищает все существующие данные!

---

## Способ 2: SQL напрямую (без потери данных)

### Подключение к базе

```bash
# Установите SQLite CLI, если нет:
npm install -g better-sqlite3

# Или используйте любой SQLite-клиент (DB Browser for SQLite)
# Файл базы: server/jlpt.db
```

### Добавить новую главу

```sql
INSERT INTO chapters (name, order_num) VALUES ('第6章 - 新しい章', 6);
```

### Добавить вопрос

```sql
-- 1. Вставить вопрос
INSERT INTO questions (chapter_id, type_id, content, explanation)
VALUES (2, 2, 'Текст вопроса（　　）продолжение', 'Объяснение');

-- 2. Получить ID последнего вопроса
-- SQLite: SELECT last_insert_rowid();

-- 3. Вставить ответы (замените <question_id> на реальный ID)
INSERT INTO answers (question_id, content, is_correct) VALUES
(<question_id>, 'にもかかわらず', 1),  -- Правильный (1)
(<question_id>, 'につれて', 0),
(<question_id>, 'において', 0),
(<question_id>, 'に関して', 0);
```

---

## Импорт из JSON файла

Если у вас много вопросов, создайте `questions.json`:

```json
[
  {
    "chapter": 2,
    "type": "grammar",
    "content": "田中さんは忙しい（　　）、いつも笑顔。",
    "explanation": "Объяснение",
    "answers": [
      { "text": "にもかかわらず", "correct": true },
      { "text": "につれて", "correct": false },
      { "text": "において", "correct": false }
    ]
  }
]
```

Затем создайте скрипт `import-questions.js`:

```javascript
import db from "./db.js";
import fs from "fs";

const questions = JSON.parse(fs.readFileSync("questions.json", "utf8"));
const typeMap = { vocabulary: 1, grammar: 2, reading: 3, listening: 4 };

const insertQuestion = db.prepare(`
  INSERT INTO questions (chapter_id, type_id, content, explanation) 
  VALUES (?, ?, ?, ?)
`);
const insertAnswer = db.prepare(
  "INSERT INTO answers (question_id, content, is_correct) VALUES (?, ?, ?)"
);

questions.forEach((q) => {
  const result = insertQuestion.run(
    q.chapter,
    typeMap[q.type],
    q.content,
    q.explanation
  );
  q.answers.forEach((a) => {
    insertAnswer.run(result.lastInsertRowid, a.text, a.correct ? 1 : 0);
  });
});

console.log(`Imported ${questions.length} questions`);
```

Запустите:

```bash
node server/import-questions.js
```
