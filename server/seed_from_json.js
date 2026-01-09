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
  // Reset sequence counters if needed, but SQLite handles ids automatically usually
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
