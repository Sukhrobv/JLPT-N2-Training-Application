import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('Starting full database refresh...');

// 1. Clear Database
console.log('Clearing existing data...');
db.transaction(() => {
  db.prepare('DELETE FROM session_questions').run();
  db.prepare('DELETE FROM answers').run();
  db.prepare('DELETE FROM questions').run();
  db.prepare('DELETE FROM reading_passages').run();
  db.prepare('DELETE FROM chapters').run();
  db.prepare('DELETE FROM question_types').run();

  // Insert 9 fixed question types (問題1-9)
  const insertType = db.prepare('INSERT INTO question_types (id, name, name_ja, description) VALUES (?, ?, ?, ?)');
  const types = [
    [1, 'mondai1', '問題1 - 漢字読み', 'Чтение кандзи: выбрать правильное чтение подчёркнутого слова'],
    [2, 'mondai2', '問題2 - 漢字書き', 'Написание кандзи: выбрать кандзи для хираганы'],
    [3, 'mondai3', '問題3 - 語形成', 'Образование слов: выбрать подходящее слово в контексте'],
    [4, 'mondai4', '問題4 - 文脈規定', 'Контекст: выбрать слово для заполнения пропуска'],
    [5, 'mondai5', '問題5 - 言い換え', 'Синонимы: выбрать близкое по значению слово'],
    [6, 'mondai6', '問題6 - 用法', 'Употребление: выбрать правильное использование слова'],
    [7, 'mondai7', '問題7 - 文法', 'Грамматика: выбрать правильную грамматическую конструкцию'],
    [8, 'mondai8', '問題8 - 文の組み立て', 'Порядок: расставить части предложения (★)'],
    [9, 'mondai9', '問題9 - 読解', 'Чтение: прочитать текст и ответить на вопросы'],
  ];
  types.forEach(([id, name, nameJa, desc]) => insertType.run(id, name, nameJa, desc));
  console.log(`Initialized ${types.length} question types.`);
})();
console.log('Database cleared.');

// 2. Find all chapter*.json files
const files = fs.readdirSync(rootDir).filter(file => /^chapter\d+\.json$/.test(file));
console.log(`Found ${files.length} chapter files:`, files);

// 3. Import each file
files.forEach(file => {
  const filePath = path.join(rootDir, file);
  console.log(`Importing ${file}...`);
  try {
    // We can reuse the logic from import_json.js by executing it
    // Or better, import the logic if it was a module, but it's a script.
    // So we'll execute it as a child process to keep it simple and reuse existing logic.
    execSync(`node server/import_json.js "${file}"`, { cwd: rootDir, stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to import ${file}:`, error.message);
  }
});

console.log('Database refresh complete!');
