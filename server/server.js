import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// ==================== UTILITY FUNCTIONS ====================

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ==================== API ENDPOINTS ====================

// GET /api/chapters - List all chapters
app.get('/api/chapters', (req, res) => {
  try {
    const chapters = db.prepare(`
      SELECT c.*, COUNT(q.id) as question_count 
      FROM chapters c 
      LEFT JOIN questions q ON q.chapter_id = c.id 
      GROUP BY c.id 
      ORDER BY c.order_num
    `).all();
    res.json(chapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({ error: 'Failed to fetch chapters' });
  }
});

// GET /api/types - List all question types
app.get('/api/types', (req, res) => {
  try {
    const types = db.prepare(`
      SELECT qt.*, COUNT(q.id) as question_count 
      FROM question_types qt 
      LEFT JOIN questions q ON q.type_id = qt.id 
      GROUP BY qt.id
    `).all();
    res.json(types);
  } catch (error) {
    console.error('Error fetching types:', error);
    res.status(500).json({ error: 'Failed to fetch question types' });
  }
});

// POST /api/sessions - Create a new training session
app.post('/api/sessions', (req, res) => {
  try {
    const { typeId, chapterIds, limit } = req.body;
    
    // Build query conditions
    let conditions = [];
    let params = [];
    
    if (typeId) {
      conditions.push('q.type_id = ?');
      params.push(typeId);
    }
    
    if (chapterIds && chapterIds.length > 0) {
      conditions.push(`q.chapter_id IN (${chapterIds.map(() => '?').join(',')})`);
      params.push(...chapterIds);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Fetch questions with passage info
    const questions = db.prepare(`
      SELECT q.*, rp.id as reading_passage_id, rp.content as passage_content, rp.title as passage_title
      FROM questions q
      LEFT JOIN reading_passages rp ON q.passage_id = rp.id
      ${whereClause}
      ORDER BY q.passage_id, q.order_in_passage
    `).all(...params);
    
    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions found with selected filters' });
    }
    
    // Group questions by passage for reading comprehension
    const passageGroups = new Map();
    const standaloneQuestions = [];
    
    questions.forEach(q => {
      if (q.passage_id) {
        if (!passageGroups.has(q.passage_id)) {
          passageGroups.set(q.passage_id, {
            passageId: q.passage_id,
            passageContent: q.passage_content,
            passageTitle: q.passage_title,
            questions: []
          });
        }
        passageGroups.get(q.passage_id).questions.push(q);
      } else {
        standaloneQuestions.push(q);
      }
    });
    
    // Shuffle: standalone questions randomly, passage groups randomly (but keep questions within passage in order)
    const shuffledStandalone = shuffleArray(standaloneQuestions);
    const shuffledPassageGroups = shuffleArray([...passageGroups.values()]);
    
    // Flatten into final question order
    let finalQuestions = [];
    
    // Interleave standalone and passage groups randomly
    const allItems = [
      ...shuffledStandalone.map(q => ({ type: 'standalone', data: q })),
      ...shuffledPassageGroups.map(g => ({ type: 'passage', data: g }))
    ];
    const shuffledItems = shuffleArray(allItems);
    
    shuffledItems.forEach(item => {
      if (item.type === 'standalone') {
        finalQuestions.push(item.data);
      } else {
        // For passage, add all questions in order
        finalQuestions.push(...item.data.questions);
      }
    });
    
    // Apply limit if specified
    if (limit && limit > 0 && limit < finalQuestions.length) {
      finalQuestions = finalQuestions.slice(0, limit);
    }
    
    // Create session
    const sessionId = uuidv4();
    const insertSession = db.prepare(`
      INSERT INTO training_sessions (id, type_filter, chapter_filter, total_questions)
      VALUES (?, ?, ?, ?)
    `);
    
    insertSession.run(
      sessionId,
      typeId ? String(typeId) : null,
      chapterIds ? JSON.stringify(chapterIds) : null,
      finalQuestions.length
    );
    
    // Create session questions with shuffled answer orders
    const insertSessionQuestion = db.prepare(`
      INSERT INTO session_questions (session_id, question_id, display_order, shuffled_answer_order)
      VALUES (?, ?, ?, ?)
    `);
    
    finalQuestions.forEach((q, index) => {
      // Get answers for this question
      const answers = db.prepare('SELECT id FROM answers WHERE question_id = ?').all(q.id);
      
      // For 問題8 (type_id = 8), don't shuffle - order matters for sentence ordering
      const answerIds = answers.map(a => a.id);
      const finalAnswerOrder = q.type_id === 8 ? answerIds : shuffleArray(answerIds);
      
      insertSessionQuestion.run(sessionId, q.id, index, JSON.stringify(finalAnswerOrder));
    });
    
    res.json({
      sessionId,
      totalQuestions: finalQuestions.length
    });
    
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions/:id - Get current question for session
app.get('/api/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const indexParam = req.query.index;
    
    // Get session info
    const session = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const parsedIndex = Number.parseInt(indexParam, 10);
    let currentIndex = Number.isNaN(parsedIndex) ? session.current_index : parsedIndex;
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex >= session.total_questions) {
      currentIndex = Math.max(session.total_questions - 1, 0);
    }

    if (currentIndex !== session.current_index) {
      db.prepare('UPDATE training_sessions SET current_index = ? WHERE id = ?')
        .run(currentIndex, id);
    }
    
    // Get current session question
    const sessionQuestion = db.prepare(`
      SELECT sq.*, q.content as question_content, q.explanation as explanation, q.passage_id, q.type_id,
             rp.content as passage_content, rp.title as passage_title,
             qt.name as type_name, qt.name_ja as type_name_ja
      FROM session_questions sq
      JOIN questions q ON sq.question_id = q.id
      LEFT JOIN reading_passages rp ON q.passage_id = rp.id
      LEFT JOIN question_types qt ON q.type_id = qt.id
      WHERE sq.session_id = ? AND sq.display_order = ?
    `).get(id, currentIndex);
    
    if (!sessionQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    // Get answers in shuffled order
    const shuffledOrder = JSON.parse(sessionQuestion.shuffled_answer_order);
    const answers = shuffledOrder.map((answerId, index) => {
      const answer = db.prepare('SELECT id, content FROM answers WHERE id = ?').get(answerId);
      return {
        id: answer.id,
        content: answer.content,
        label: String.fromCharCode(65 + index) // A, B, C, D...
      };
    });
    
    // Check if this is part of a passage group
    let passageInfo = null;
    if (sessionQuestion.passage_id) {
      // Count questions in this passage within current session
      const passageQuestions = db.prepare(`
        SELECT sq.display_order
        FROM session_questions sq
        JOIN questions q ON sq.question_id = q.id
        WHERE sq.session_id = ? AND q.passage_id = ?
        ORDER BY sq.display_order
      `).all(id, sessionQuestion.passage_id);
      
      const currentPosition = passageQuestions.findIndex(pq => pq.display_order === currentIndex) + 1;
      
      passageInfo = {
        content: sessionQuestion.passage_content,
        title: sessionQuestion.passage_title,
        currentInPassage: currentPosition,
        totalInPassage: passageQuestions.length
      };
    }

    let answerState = null;
    if (sessionQuestion.user_answer_id !== null) {
      const correctAnswer = db.prepare('SELECT id FROM answers WHERE question_id = ? AND is_correct = 1')
        .get(sessionQuestion.question_id);
      answerState = {
        userAnswerId: sessionQuestion.user_answer_id,
        isCorrect: sessionQuestion.is_correct === 1,
        correctAnswerId: correctAnswer ? correctAnswer.id : null,
        explanation: sessionQuestion.explanation
      };
    }
    
    res.json({
      sessionId: id,
      currentIndex,
      totalQuestions: session.total_questions,
      completed: session.completed === 1,
      question: {
        content: sessionQuestion.question_content,
        type: sessionQuestion.type_name,
        typeJa: sessionQuestion.type_name_ja,
        answers
      },
      passage: passageInfo,
      answer: answerState
    });
    
  } catch (error) {
    console.error('Error fetching session question:', error);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

// POST /api/sessions/:id/answer - Submit answer for current question
app.post('/api/sessions/:id/answer', (req, res) => {
  try {
    const { id } = req.params;
    const { answerId, questionIndex } = req.body;
    
    if (!answerId) {
      return res.status(400).json({ error: 'Answer ID is required' });
    }
    
    // Get session
    const session = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const parsedIndex = Number.parseInt(questionIndex, 10);
    let targetIndex = Number.isNaN(parsedIndex) ? session.current_index : parsedIndex;
    if (targetIndex < 0 || targetIndex >= session.total_questions) {
      return res.status(400).json({ error: 'Question index is out of range' });
    }
    
    // Get target session question
    const sessionQuestion = db.prepare(`
      SELECT sq.*, q.explanation
      FROM session_questions sq
      JOIN questions q ON sq.question_id = q.id
      WHERE sq.session_id = ? AND sq.display_order = ?
    `).get(id, targetIndex);
    
    if (!sessionQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    if (sessionQuestion.user_answer_id !== null) {
      return res.status(400).json({ error: 'Question already answered' });
    }
    
    // Verify answer belongs to this question
    const answer = db.prepare('SELECT * FROM answers WHERE id = ? AND question_id = ?').get(answerId, sessionQuestion.question_id);
    
    if (!answer) {
      return res.status(400).json({ error: 'Invalid answer for this question' });
    }
    
    // Get correct answer
    const correctAnswer = db.prepare('SELECT id, content FROM answers WHERE question_id = ? AND is_correct = 1').get(sessionQuestion.question_id);
    
    const isCorrect = answer.is_correct === 1;
    
    // Update session question
    db.prepare(`
      UPDATE session_questions 
      SET user_answer_id = ?, is_correct = ?, answered_at = datetime('now')
      WHERE id = ?
    `).run(answerId, isCorrect ? 1 : 0, sessionQuestion.id);

    const answeredCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM session_questions
      WHERE session_id = ? AND user_answer_id IS NOT NULL
    `).get(id).count;

    const isCompleted = answeredCount >= session.total_questions;
    db.prepare('UPDATE training_sessions SET completed = ?, current_index = ? WHERE id = ?')
      .run(isCompleted ? 1 : 0, targetIndex, id);

    const nextUnanswered = db.prepare(`
      SELECT display_order
      FROM session_questions
      WHERE session_id = ? AND user_answer_id IS NULL
      ORDER BY display_order
      LIMIT 1
    `).get(id);
    const nextIndex = nextUnanswered ? nextUnanswered.display_order : null;
    
    res.json({
      isCorrect,
      correctAnswerId: correctAnswer.id,
      correctAnswerContent: correctAnswer.content,
      explanation: sessionQuestion.explanation,
      hasNext: nextIndex !== null,
      nextIndex,
      answeredCount,
      totalQuestions: session.total_questions,
      completed: isCompleted
    });
    
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// GET /api/sessions/:id/summary - Get session progress overview
app.get('/api/sessions/:id/summary', (req, res) => {
  try {
    const { id } = req.params;

    const session = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const questions = db.prepare(`
      SELECT display_order, user_answer_id, is_correct
      FROM session_questions
      WHERE session_id = ?
      ORDER BY display_order
    `).all(id);

    const answeredCount = questions.filter(q => q.user_answer_id !== null).length;
    let currentIndex = session.current_index;
    if (currentIndex >= session.total_questions) {
      currentIndex = Math.max(session.total_questions - 1, 0);
    }

    const firstUnanswered = questions.find(q => q.user_answer_id === null);

    res.json({
      sessionId: id,
      totalQuestions: session.total_questions,
      answeredQuestions: answeredCount,
      completed: session.completed === 1,
      currentIndex,
      firstUnansweredIndex: firstUnanswered ? firstUnanswered.display_order : null,
      questions: questions.map(q => ({
        index: q.display_order,
        answered: q.user_answer_id !== null,
        isCorrect: q.is_correct === 1
      }))
    });
  } catch (error) {
    console.error('Error fetching session summary:', error);
    res.status(500).json({ error: 'Failed to fetch session summary' });
  }
});

// GET /api/sessions/:id/results - Get session results
app.get('/api/sessions/:id/results', (req, res) => {
  try {
    const { id } = req.params;
    
    const session = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get all session questions with their results
    const results = db.prepare(`
      SELECT sq.*, q.content as question_content, q.explanation,
             a.content as user_answer_content,
             ca.content as correct_answer_content,
             qt.name as type_name, qt.name_ja as type_name_ja
      FROM session_questions sq
      JOIN questions q ON sq.question_id = q.id
      LEFT JOIN answers a ON sq.user_answer_id = a.id
      LEFT JOIN answers ca ON ca.question_id = q.id AND ca.is_correct = 1
      LEFT JOIN question_types qt ON q.type_id = qt.id
      WHERE sq.session_id = ?
      ORDER BY sq.display_order
    `).all(id);
    
    const correctCount = results.filter(r => r.is_correct === 1).length;
    const answeredCount = results.filter(r => r.user_answer_id !== null).length;
    
    res.json({
      sessionId: id,
      completed: session.completed === 1,
      totalQuestions: session.total_questions,
      answeredQuestions: answeredCount,
      correctAnswers: correctCount,
      percentage: Math.round((correctCount / session.total_questions) * 100),
      startedAt: session.started_at,
      details: results.map(r => ({
        questionContent: r.question_content,
        type: r.type_name,
        typeJa: r.type_name_ja,
        userAnswer: r.user_answer_content,
        correctAnswer: r.correct_answer_content,
        isCorrect: r.is_correct === 1,
        explanation: r.explanation
      }))
    });
    
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// ==================== ADMIN API ENDPOINTS ====================

// GET /api/admin/questions - List all questions with details
app.get('/api/admin/questions', (req, res) => {
  try {
    const questions = db.prepare(`
      SELECT q.*, c.name as chapter_name, qt.name_ja as type_name,
             rp.title as passage_title
      FROM questions q
      JOIN chapters c ON q.chapter_id = c.id
      JOIN question_types qt ON q.type_id = qt.id
      LEFT JOIN reading_passages rp ON q.passage_id = rp.id
      ORDER BY q.chapter_id, q.type_id, q.id
    `).all();
    
    // Get answers for each question
    const getAnswers = db.prepare('SELECT * FROM answers WHERE question_id = ?');
    const result = questions.map(q => ({
      ...q,
      answers: getAnswers.all(q.id)
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST /api/admin/chapters - Create a new chapter
app.post('/api/admin/chapters', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const maxOrder = db.prepare('SELECT MAX(order_num) as max FROM chapters').get();
    const orderNum = (maxOrder.max || 0) + 1;
    
    const result = db.prepare('INSERT INTO chapters (name, order_num) VALUES (?, ?)')
      .run(name, orderNum);
    
    res.json({ id: result.lastInsertRowid, name, order_num: orderNum });
  } catch (error) {
    console.error('Error creating chapter:', error);
    res.status(500).json({ error: 'Failed to create chapter' });
  }
});

// PUT /api/admin/chapters/:id - Update chapter
app.put('/api/admin/chapters/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    db.prepare('UPDATE chapters SET name = ? WHERE id = ?').run(name, id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating chapter:', error);
    res.status(500).json({ error: 'Failed to update chapter' });
  }
});

// DELETE /api/admin/chapters/:id - Delete chapter
app.delete('/api/admin/chapters/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if chapter has questions
    const count = db.prepare('SELECT COUNT(*) as count FROM questions WHERE chapter_id = ?').get(id);
    if (count.count > 0) {
      return res.status(400).json({ error: 'Cannot delete chapter with questions' });
    }
    
    db.prepare('DELETE FROM chapters WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    res.status(500).json({ error: 'Failed to delete chapter' });
  }
});

// GET /api/admin/passages - List all reading passages
app.get('/api/admin/passages', (req, res) => {
  try {
    const passages = db.prepare(`
      SELECT rp.*, c.name as chapter_name,
             (SELECT COUNT(*) FROM questions WHERE passage_id = rp.id) as question_count
      FROM reading_passages rp
      JOIN chapters c ON rp.chapter_id = c.id
      ORDER BY rp.chapter_id, rp.id
    `).all();
    res.json(passages);
  } catch (error) {
    console.error('Error fetching passages:', error);
    res.status(500).json({ error: 'Failed to fetch passages' });
  }
});

// POST /api/admin/passages - Create reading passage
app.post('/api/admin/passages', (req, res) => {
  try {
    const { chapterId, title, content } = req.body;
    if (!chapterId || !content) {
      return res.status(400).json({ error: 'Chapter ID and content are required' });
    }
    
    const result = db.prepare('INSERT INTO reading_passages (chapter_id, title, content) VALUES (?, ?, ?)')
      .run(chapterId, title || null, content);
    
    res.json({ id: result.lastInsertRowid, chapterId, title, content });
  } catch (error) {
    console.error('Error creating passage:', error);
    res.status(500).json({ error: 'Failed to create passage' });
  }
});

// DELETE /api/admin/passages/:id - Delete passage
app.delete('/api/admin/passages/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete associated questions first
    db.prepare('DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE passage_id = ?)').run(id);
    db.prepare('DELETE FROM questions WHERE passage_id = ?').run(id);
    db.prepare('DELETE FROM reading_passages WHERE id = ?').run(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting passage:', error);
    res.status(500).json({ error: 'Failed to delete passage' });
  }
});

// POST /api/admin/questions - Create a new question
app.post('/api/admin/questions', (req, res) => {
  try {
    const { chapterId, typeId, passageId, content, explanation, answers, orderInPassage } = req.body;
    
    if (!chapterId || !typeId || !content || !answers || answers.length === 0) {
      return res.status(400).json({ error: 'Chapter ID, type ID, content, and answers are required' });
    }
    
    // Validate at least one correct answer
    const hasCorrect = answers.some(a => a.isCorrect);
    if (!hasCorrect) {
      return res.status(400).json({ error: 'At least one answer must be correct' });
    }
    
    // Insert question
    const result = db.prepare(`
      INSERT INTO questions (chapter_id, type_id, passage_id, content, order_in_passage, explanation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(chapterId, typeId, passageId || null, content, orderInPassage || 0, explanation || null);
    
    const questionId = result.lastInsertRowid;
    
    // Insert answers
    const insertAnswer = db.prepare('INSERT INTO answers (question_id, content, is_correct) VALUES (?, ?, ?)');
    answers.forEach(a => {
      insertAnswer.run(questionId, a.content, a.isCorrect ? 1 : 0);
    });
    
    res.json({ id: questionId });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// PUT /api/admin/questions/:id - Update question
app.put('/api/admin/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { content, explanation, answers } = req.body;
    
    // Update question
    db.prepare('UPDATE questions SET content = ?, explanation = ? WHERE id = ?')
      .run(content, explanation || null, id);
    
    // Update answers if provided
    if (answers && answers.length > 0) {
      // Delete old answers
      db.prepare('DELETE FROM answers WHERE question_id = ?').run(id);
      
      // Insert new answers
      const insertAnswer = db.prepare('INSERT INTO answers (question_id, content, is_correct) VALUES (?, ?, ?)');
      answers.forEach(a => {
        insertAnswer.run(id, a.content, a.isCorrect ? 1 : 0);
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// DELETE /api/admin/questions/:id - Delete question
app.delete('/api/admin/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete answers first
    db.prepare('DELETE FROM answers WHERE question_id = ?').run(id);
    db.prepare('DELETE FROM questions WHERE id = ?').run(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// ==================== START SERVER ====================

// Catch-all route for SPA in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
