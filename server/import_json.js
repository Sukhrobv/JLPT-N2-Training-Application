import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Usage: node server/import_json.js path/to/data.json
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node server/import_json.js <path_to_json_file>');
  process.exit(1);
}

const filePath = args[0];
const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

if (!fs.existsSync(absolutePath)) {
  console.error(`File not found: ${absolutePath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

console.log(`Found ${data.length} items to import...`);

// Helper to get or create chapter
const chapterCache = {};
function getChapterId(name) {
  if (chapterCache[name]) return chapterCache[name];
  
  const row = db.prepare('SELECT id FROM chapters WHERE name = ?').get(name);
  if (row) {
    chapterCache[name] = row.id;
    return row.id;
  }
  
  // Create new
  const maxOrder = db.prepare('SELECT MAX(order_num) as max FROM chapters').get();
  const orderNum = (maxOrder.max || 0) + 1;
  const result = db.prepare('INSERT INTO chapters (name, order_num) VALUES (?, ?)').run(name, orderNum);
  chapterCache[name] = result.lastInsertRowid;
  console.log(`Created chapter: ${name}`);
  return result.lastInsertRowid;
}

// Helper to get type ID
function getTypeId(typeInput) {
  // If number 1-9
  if (typeof typeInput === 'number' || !isNaN(parseInt(typeInput))) {
    return parseInt(typeInput);
  }
  // If string "mondai1"
  if (typeof typeInput === 'string') {
    const match = typeInput.match(/(\d+)/);
    if (match) return parseInt(match[1]);
  }
  return 1; // Default
}

db.transaction(() => {
  let questionsAdded = 0;
  
  for (const item of data) {
    const chapterId = getChapterId(item.chapter || 'General');
    
    // Handle Reading Passages (Mondai 9)
    if (item.passageContent) {
      const passageResult = db.prepare('INSERT INTO reading_passages (chapter_id, title, content) VALUES (?, ?, ?)')
        .run(chapterId, item.passageTitle || null, item.passageContent);
      const passageId = passageResult.lastInsertRowid;
      
      if (item.questions && Array.isArray(item.questions)) {
        for (const q of item.questions) {
          insertQuestion(q, chapterId, passageId);
          questionsAdded++;
        }
      }
    } else {
      // Regular Question
      insertQuestion(item, chapterId, null);
      questionsAdded++;
    }
  }
  
  console.log(`Successfully imported ${questionsAdded} questions!`);
})();

function insertQuestion(q, chapterId, passageId) {
  const typeId = getTypeId(q.type);
  
  const result = db.prepare(`
    INSERT INTO questions (chapter_id, type_id, passage_id, content, order_in_passage, explanation)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    chapterId, 
    typeId, 
    passageId, 
    q.content, 
    q.order || 0, 
    q.explanation || null
  );
  
  const questionId = result.lastInsertRowid;
  
  const insertAnswer = db.prepare('INSERT INTO answers (question_id, content, is_correct) VALUES (?, ?, ?)');
  
  if (q.answers && Array.isArray(q.answers)) {
    q.answers.forEach((ans, index) => {
      // Support both object {content, isCorrect} and string "Answer" (using correctAnswerIndex)
      let content = ans;
      let isCorrect = false;
      
      if (typeof ans === 'object') {
        content = ans.content;
        isCorrect = ans.isCorrect;
      } else {
        // If answers are strings, check correctAnswerIndex (1-based or 0-based? Let's assume 1-based for user friendliness, or 0-based)
        // Let's support "correctAnswer" field which is the index (1-4)
        if (q.correctAnswer && q.correctAnswer === index + 1) {
          isCorrect = true;
        }
      }
      
      insertAnswer.run(questionId, content, isCorrect ? 1 : 0);
    });
  }
}
