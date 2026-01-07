import db from './db.js';

// Clear existing data
db.exec(`
  DELETE FROM session_questions;
  DELETE FROM training_sessions;
  DELETE FROM answers;
  DELETE FROM questions;
  DELETE FROM reading_passages;
  DELETE FROM question_types;
  DELETE FROM chapters;
`);

// Insert chapters (example chapters)
const insertChapter = db.prepare('INSERT INTO chapters (name, order_num) VALUES (?, ?)');
const chapters = [
  ['Глава 1', 1],
  ['Глава 2', 2],
  ['Глава 3', 3],
];
chapters.forEach(([name, order]) => insertChapter.run(name, order));

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

// Get IDs
const getChapterId = db.prepare('SELECT id FROM chapters WHERE order_num = ?');
const ch1 = getChapterId.get(1).id;

// Insert sample questions
const insertQuestion = db.prepare(`
  INSERT INTO questions (chapter_id, type_id, passage_id, content, order_in_passage, explanation) 
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertAnswer = db.prepare('INSERT INTO answers (question_id, content, is_correct) VALUES (?, ?, ?)');

// === 問題1: Чтение кандзи ===
const mondai1Questions = [
  {
    content: 'ロボットは、工場はもちろん国際宇宙ステーションまで、<u>至る所</u>で使われている。',
    explanation: '「至る所」は「いたるところ」と読みます。',
    answers: [
      { content: 'いわゆる', correct: false },
      { content: 'あらゆる', correct: false },
      { content: 'いたる', correct: true },
      { content: 'とおる', correct: false },
    ]
  },
  {
    content: '10日前までに予約をすると、早期<u>割引</u>で宿泊料金が安くなる。',
    explanation: '「割引」は「わりびき」と読みます。',
    answers: [
      { content: 'わりひき', correct: false },
      { content: 'わりびき', correct: true },
      { content: 'かつひき', correct: false },
      { content: 'かつびき', correct: false },
    ]
  },
];

mondai1Questions.forEach(q => {
  const result = insertQuestion.run(ch1, 1, null, q.content, 0, q.explanation);
  const questionId = result.lastInsertRowid;
  q.answers.forEach(a => insertAnswer.run(questionId, a.content, a.correct ? 1 : 0));
});

// === 問題7: Грамматика ===
const mondai7Questions = [
  {
    content: '景気が悪くなる（　　）、新聞の広告が減ってくる。',
    explanation: '「に反して」は逆接、「に関して」は関連、「に応じて」は対応、「にしたがって」は変化の推移を表します。',
    answers: [
      { content: 'に反して', correct: false },
      { content: 'に関して', correct: false },
      { content: 'に応じて', correct: false },
      { content: 'にしたがって', correct: true },
    ]
  },
  {
    content: 'このレストランは安い（　　）おいしいので、いつも客でいっぱいだ。',
    explanation: '「わりに」は予想に反して、「かわりに」は代替を表します。',
    answers: [
      { content: 'わりに', correct: true },
      { content: 'かわりに', correct: false },
      { content: 'ついでに', correct: false },
      { content: 'ゆえに', correct: false },
    ]
  },
];

mondai7Questions.forEach(q => {
  const result = insertQuestion.run(ch1, 7, null, q.content, 0, q.explanation);
  const questionId = result.lastInsertRowid;
  q.answers.forEach(a => insertAnswer.run(questionId, a.content, a.correct ? 1 : 0));
});

// === 問題9: Чтение с текстом ===
const insertPassage = db.prepare('INSERT INTO reading_passages (chapter_id, content, title) VALUES (?, ?, ?)');

const passageContent = `地震のない国から日本に来た人が驚くことの1つに、テレビやラジオの緊急地震速報があります。番組の途中で突然チャイムが鳴り、「〇〇地方で地震です」とアナウンスが流れます。

これは1995年の阪神・淡路大震災を契機に地震計が日本各地に置かれ始め、そのデータをもとに地震の情報を少しでも早く（ 50 ）、研究が始まったものです。2007年から一般人向けに放送されるようになりました。世界でも初めてのシステムです。`;

const passageResult = insertPassage.run(ch1, passageContent.trim(), '緊急地震速報について');
const passageId = passageResult.lastInsertRowid;

const mondai9Questions = [
  {
    content: '（ 50 ）に入る最もよいものはどれですか。',
    order: 1,
    answers: [
      { content: '伝えまいと', correct: false },
      { content: '伝えようと', correct: true },
      { content: '伝えないと', correct: false },
      { content: '伝えるなら', correct: false },
    ]
  },
];

mondai9Questions.forEach(q => {
  const result = insertQuestion.run(ch1, 9, passageId, q.content, q.order, null);
  const questionId = result.lastInsertRowid;
  q.answers.forEach(a => insertAnswer.run(questionId, a.content, a.correct ? 1 : 0));
});

console.log('Database seeded successfully!');
console.log(`- ${chapters.length} chapters`);
console.log(`- ${types.length} question types (問題1-9)`);
console.log(`- ${mondai1Questions.length + mondai7Questions.length + mondai9Questions.length} sample questions`);
