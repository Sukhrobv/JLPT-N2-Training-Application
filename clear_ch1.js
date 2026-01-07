import db from './server/db.js';

const chapterName = '第1回 模擬テスト';
const chapter = db.prepare('SELECT id FROM chapters WHERE name = ?').get(chapterName);

if (chapter) {
  db.transaction(() => {
    // Get question IDs
    const questions = db.prepare('SELECT id FROM questions WHERE chapter_id = ?').all(chapter.id);
    const questionIds = questions.map(q => q.id);
    
    if (questionIds.length > 0) {
      // Delete from session_questions
      const deleteSessionQs = db.prepare(`
        DELETE FROM session_questions 
        WHERE question_id IN (${questionIds.join(',')})
      `);
      const resSQ = deleteSessionQs.run();
      console.log(`Deleted ${resSQ.changes} session_questions.`);

      // Delete answers
      const deleteAnswers = db.prepare(`
        DELETE FROM answers 
        WHERE question_id IN (${questionIds.join(',')})
      `);
      const resAns = deleteAnswers.run();
      console.log(`Deleted ${resAns.changes} answers.`);
    }
    
    // Delete questions
    const resultQ = db.prepare('DELETE FROM questions WHERE chapter_id = ?').run(chapter.id);
    console.log(`Deleted ${resultQ.changes} questions.`);
    
    // Delete passages
    const resultP = db.prepare('DELETE FROM reading_passages WHERE chapter_id = ?').run(chapter.id);
    console.log(`Deleted ${resultP.changes} reading passages.`);
    
  })();
  console.log(`Cleared data for chapter: ${chapterName}`);
} else {
  console.log('Chapter not found.');
}
