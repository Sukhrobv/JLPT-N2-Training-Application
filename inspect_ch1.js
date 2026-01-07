import db from './server/db.js';

const chapterName = '第1回 模擬テスト';
const chapter = db.prepare('SELECT id FROM chapters WHERE name = ?').get(chapterName);

if (!chapter) {
  console.log(`Chapter '${chapterName}' not found.`);
} else {
  console.log(`Chapter ID: ${chapter.id}`);
  
  const questions = db.prepare('SELECT id, content FROM questions WHERE chapter_id = ?').all(chapter.id);
  console.log(`Found ${questions.length} questions.`);
  
  if (questions.length > 0) {
    const qId = questions[0].id;
    const answers = db.prepare('SELECT * FROM answers WHERE question_id = ?').all(qId);
    console.log('Answers for first question:', answers);
    
    const correctCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM answers a 
      JOIN questions q ON a.question_id = q.id 
      WHERE q.chapter_id = ? AND a.is_correct = 1
    `).get(chapter.id);
    
    console.log(`Total correct answers in chapter: ${correctCount.count}`);
  }
}
