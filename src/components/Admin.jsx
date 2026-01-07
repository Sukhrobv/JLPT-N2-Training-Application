import { useState, useEffect } from 'react';
import * as api from '../services/api';
import './Admin.css';

// Русские названия для типов вопросов
const TYPE_NAMES = {
  'mondai1': '問題1 - Чтение кандзи',
  'mondai2': '問題2 - Написание кандзи',
  'mondai3': '問題3 - Образование слов',
  'mondai4': '問題4 - Контекст',
  'mondai5': '問題5 - Синонимы',
  'mondai6': '問題6 - Употребление',
  'mondai7': '問題7 - Грамматика',
  'mondai8': '問題8 - Порядок (★)',
  'mondai9': '問題9 - Чтение',
};

export default function Admin({ onBack }) {
  const [tab, setTab] = useState('questions'); // 'questions', 'chapters', 'passages'
  const [chapters, setChapters] = useState([]);
  const [types, setTypes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [passages, setPassages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [filterChapter, setFilterChapter] = useState('');
  const [filterType, setFilterType] = useState('');
  
  // Form states
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [showPassageForm, setShowPassageForm] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newPassage, setNewPassage] = useState({ chapterId: '', title: '', content: '' });
  const [newQuestion, setNewQuestion] = useState({
    chapterId: '',
    typeId: '',
    passageId: '',
    content: '',
    explanation: '',
    answers: [
      { content: '', isCorrect: true },
      { content: '', isCorrect: false },
      { content: '', isCorrect: false },
      { content: '', isCorrect: false },
    ],
    // For 問題8
    mondai8StarPosition: 2 // Position of ★ (0-3)
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [chaptersData, typesData, questionsData, passagesData] = await Promise.all([
        api.getChapters(),
        api.getTypes(),
        api.getAdminQuestions(),
        api.getAdminPassages()
      ]);
      setChapters(chaptersData);
      setTypes(typesData);
      setQuestions(questionsData);
      setPassages(passagesData);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCreateChapter = async () => {
    if (!newChapterName.trim()) return;
    try {
      await api.createChapter(newChapterName);
      setNewChapterName('');
      setShowChapterForm(false);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteChapter = async (id) => {
    if (!confirm('Удалить эту главу?')) return;
    try {
      await api.deleteChapter(id);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreatePassage = async () => {
    if (!newPassage.chapterId || !newPassage.content.trim()) {
      setError('Выберите главу и введите текст');
      return;
    }
    try {
      await api.createPassage(newPassage.chapterId, newPassage.title, newPassage.content);
      setNewPassage({ chapterId: '', title: '', content: '' });
      setShowPassageForm(false);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeletePassage = async (id) => {
    if (!confirm('Удалить этот текст и все связанные вопросы?')) return;
    try {
      await api.deletePassage(id);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setNewQuestion({
      chapterId: '',
      typeId: '',
      passageId: '',
      content: '',
      explanation: '',
      answers: [
        { content: '', isCorrect: true },
        { content: '', isCorrect: false },
        { content: '', isCorrect: false },
        { content: '', isCorrect: false },
      ],
      mondai8StarPosition: 2
    });
  };

  const handleEditQuestion = (q) => {
    setEditingQuestionId(q.id);
    
    // Determine star position for Mondai 8
    let starPos = 2;
    if (q.type_id === 8) {
      const correctIdx = q.answers.findIndex(a => a.is_correct);
      if (correctIdx !== -1) starPos = correctIdx;
    }

    setNewQuestion({
      chapterId: q.chapter_id,
      typeId: q.type_id,
      passageId: q.passage_id || '',
      content: q.content,
      explanation: q.explanation || '',
      answers: q.answers.map(a => ({
        content: a.content,
        isCorrect: !!a.is_correct
      })),
      mondai8StarPosition: starPos
    });
    setShowQuestionForm(true);
  };

  const handleCreateQuestion = async () => {
    if (!newQuestion.chapterId || !newQuestion.typeId || !newQuestion.content.trim()) {
      setError('Заполните обязательные поля');
      return;
    }
    
    const validAnswers = newQuestion.answers.filter(a => a.content.trim());
    if (validAnswers.length < 2) {
      setError('Добавьте минимум 2 варианта ответа');
      return;
    }
    
    if (!validAnswers.some(a => a.isCorrect)) {
      setError('Отметьте правильный ответ');
      return;
    }
    
    try {
      if (editingQuestionId) {
        await api.updateQuestion(editingQuestionId, {
          content: newQuestion.content,
          explanation: newQuestion.explanation,
          answers: validAnswers
        });
      } else {
        await api.createQuestion({
          chapterId: parseInt(newQuestion.chapterId),
          typeId: parseInt(newQuestion.typeId),
          passageId: newQuestion.passageId ? parseInt(newQuestion.passageId) : null,
          content: newQuestion.content,
          explanation: newQuestion.explanation,
          answers: validAnswers
        });
      }
      
      resetQuestionForm();
      setShowQuestionForm(false);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Удалить этот вопрос?')) return;
    try {
      await api.deleteQuestion(id);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateAnswer = (index, field, value) => {
    const newAnswers = [...newQuestion.answers];
    if (field === 'isCorrect' && value) {
      // Only one correct answer
      newAnswers.forEach((a, i) => a.isCorrect = i === index);
    } else {
      newAnswers[index][field] = value;
    }
    setNewQuestion({ ...newQuestion, answers: newAnswers });
  };

  if (loading) {
    return (
      <div className="admin loading">
        <div className="spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <button className="back-button" onClick={onBack}>← Назад</button>
        <h1>Редактор вопросов</h1>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={tab === 'questions' ? 'active' : ''}
          onClick={() => setTab('questions')}
        >
          Вопросы ({questions.length})
        </button>
        <button 
          className={tab === 'chapters' ? 'active' : ''}
          onClick={() => setTab('chapters')}
        >
          Главы ({chapters.length})
        </button>
        <button 
          className={tab === 'passages' ? 'active' : ''}
          onClick={() => setTab('passages')}
        >
          Тексты ({passages.length})
        </button>
      </div>

      {/* Questions Tab */}
      {tab === 'questions' && (
        <div className="admin-section">
          <div className="admin-controls">
            <button className="add-button" onClick={() => {
              resetQuestionForm();
              setShowQuestionForm(true);
            }}>
              + Добавить вопрос
            </button>
            
            <div className="filters">
              <select 
                value={filterChapter} 
                onChange={e => setFilterChapter(e.target.value)}
                className="filter-select"
              >
                <option value="">Все главы</option>
                {chapters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="">Все типы</option>
                {types.map(t => (
                  <option key={t.id} value={t.id}>
                    {TYPE_NAMES[t.name] || t.name_ja}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showQuestionForm && (
            <div className="modal-overlay">
              <div className="modal">
                <h2>{editingQuestionId ? 'Редактировать вопрос' : 'Новый вопрос'}</h2>
                
                <div className="form-row">
                  <label>Глава *</label>
                  <select 
                    value={newQuestion.chapterId}
                    onChange={e => setNewQuestion({...newQuestion, chapterId: e.target.value})}
                    disabled={!!editingQuestionId}
                  >
                    <option value="">Выберите главу</option>
                    {chapters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label>Тип (問題) *</label>
                  <select 
                    value={newQuestion.typeId}
                    onChange={e => setNewQuestion({...newQuestion, typeId: e.target.value})}
                    disabled={!!editingQuestionId}
                  >
                    <option value="">Выберите тип</option>
                    {types.map(t => (
                      <option key={t.id} value={t.id}>
                        {TYPE_NAMES[t.name] || t.name_ja}
                      </option>
                    ))}
                  </select>
                </div>

                {newQuestion.typeId === '9' && (
                  <div className="form-row">
                    <label>Текст для чтения</label>
                    <select 
                      value={newQuestion.passageId}
                      onChange={e => setNewQuestion({...newQuestion, passageId: e.target.value})}
                    >
                      <option value="">Без текста</option>
                      {passages.filter(p => p.chapter_id == newQuestion.chapterId).map(p => (
                        <option key={p.id} value={p.id}>{p.title || 'Без названия'}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-row">
                  <label>{newQuestion.typeId === '8' ? 'Шаблон вопроса *' : 'Текст вопроса *'}</label>
                  <textarea
                    value={newQuestion.content}
                    onChange={e => setNewQuestion({...newQuestion, content: e.target.value})}
                    placeholder={newQuestion.typeId === '8' 
                      ? '動物_____★_____子どもを捨てるなんて許せない。' 
                      : '例：田中さんは忙しい（　　）、いつも笑顔。'}
                    rows={3}
                  />
                  {newQuestion.typeId === '8' && (
                    <small>Используйте _____ для пробелов и ★ для позиции ответа</small>
                  )}
                </div>

                {/* Special UI for 問題8 */}
                {newQuestion.typeId === '8' ? (
                  <div className="form-row mondai8-form">
                    <label>Части предложения (в правильном порядке)</label>
                    <div className="mondai8-parts">
                      {newQuestion.answers.map((answer, i) => (
                        <div key={i} className="mondai8-part">
                          <span className="part-number">{i + 1}</span>
                          <input
                            type="text"
                            value={answer.content}
                            onChange={e => updateAnswer(i, 'content', e.target.value)}
                            placeholder={`Часть ${i + 1}`}
                          />
                          <button
                            type="button"
                            className={`star-btn ${newQuestion.mondai8StarPosition === i ? 'active' : ''}`}
                            onClick={() => {
                              const newAnswers = newQuestion.answers.map((a, idx) => ({
                                ...a,
                                isCorrect: idx === i
                              }));
                              setNewQuestion({...newQuestion, mondai8StarPosition: i, answers: newAnswers});
                            }}
                            title="Отметить как позицию ★"
                          >
                            {newQuestion.mondai8StarPosition === i ? '★' : '☆'}
                          </button>
                        </div>
                      ))}
                    </div>
                    <small>★ — позиция, которую спрашивают (правильный ответ)</small>
                  </div>
                ) : (
                  <div className="form-row">
                    <label>Варианты ответа</label>
                    {newQuestion.answers.map((answer, i) => (
                      <div key={i} className="answer-row">
                        <input
                          type="radio"
                          name="correct"
                          checked={answer.isCorrect}
                          onChange={() => updateAnswer(i, 'isCorrect', true)}
                        />
                        <input
                          type="text"
                          value={answer.content}
                          onChange={e => updateAnswer(i, 'content', e.target.value)}
                          placeholder={`Вариант ${i + 1}`}
                        />
                      </div>
                    ))}
                    <small>Отметьте правильный ответ радиокнопкой</small>
                  </div>
                )}

                <div className="form-row">
                  <label>Объяснение (опционально)</label>
                  <textarea
                    value={newQuestion.explanation}
                    onChange={e => setNewQuestion({...newQuestion, explanation: e.target.value})}
                    placeholder="Почему этот ответ правильный..."
                    rows={2}
                  />
                </div>

                <div className="modal-actions">
                  <button className="cancel-button" onClick={() => setShowQuestionForm(false)}>
                    Отмена
                  </button>
                  <button className="save-button" onClick={handleCreateQuestion}>
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="questions-list">
            {questions
              .filter(q => !filterChapter || q.chapter_id == filterChapter)
              .filter(q => !filterType || q.type_id == filterType)
              .map(q => (
              <div key={q.id} className="question-card">
                <div className="question-meta">
                  <span className="type-badge">{TYPE_NAMES[types.find(t => t.id === q.type_id)?.name] || q.type_name}</span>
                  <span className="chapter-badge">{q.chapter_name}</span>
                </div>
                <div className="question-content">{q.content}</div>
                <div className="question-answers">
                  {q.answers.map((a, i) => (
                    <span 
                      key={a.id} 
                      className={`answer ${a.is_correct ? 'correct' : ''}`}
                    >
                      {q.type_id === 8 && a.is_correct ? '★ ' : ''}
                      {q.type_id === 8 ? `${i + 1}: ` : `${String.fromCharCode(65 + i)}: `}
                      {a.content}
                    </span>
                  ))}
                </div>
                <div className="card-actions">
                  <button className="edit-button" onClick={() => handleEditQuestion(q)}>
                    Изменить
                  </button>
                  <button className="delete-button" onClick={() => handleDeleteQuestion(q.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chapters Tab */}
      {tab === 'chapters' && (
        <div className="admin-section">
          <button className="add-button" onClick={() => setShowChapterForm(true)}>
            + Добавить главу
          </button>

          {showChapterForm && (
            <div className="modal-overlay">
              <div className="modal small">
                <h2>Новая глава</h2>
                <div className="form-row">
                  <label>Название</label>
                  <input
                    type="text"
                    value={newChapterName}
                    onChange={e => setNewChapterName(e.target.value)}
                    placeholder="Глава 1"
                  />
                </div>
                <div className="modal-actions">
                  <button className="cancel-button" onClick={() => setShowChapterForm(false)}>
                    Отмена
                  </button>
                  <button className="save-button" onClick={handleCreateChapter}>
                    Создать
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="chapters-list">
            {chapters.map(c => (
              <div key={c.id} className="chapter-card">
                <span className="chapter-name">{c.name}</span>
                <span className="chapter-count">{c.question_count} вопросов</span>
                <button 
                  className="delete-button"
                  onClick={() => handleDeleteChapter(c.id)}
                  disabled={c.question_count > 0}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Passages Tab */}
      {tab === 'passages' && (
        <div className="admin-section">
          <button className="add-button" onClick={() => setShowPassageForm(true)}>
            + Добавить текст для чтения
          </button>

          {showPassageForm && (
            <div className="modal-overlay">
              <div className="modal">
                <h2>Новый текст для 問題9</h2>
                <div className="form-row">
                  <label>Глава *</label>
                  <select
                    value={newPassage.chapterId}
                    onChange={e => setNewPassage({...newPassage, chapterId: e.target.value})}
                  >
                    <option value="">Выберите главу</option>
                    {chapters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Название (опционально)</label>
                  <input
                    type="text"
                    value={newPassage.title}
                    onChange={e => setNewPassage({...newPassage, title: e.target.value})}
                    placeholder="Например: О землетрясениях"
                  />
                </div>
                <div className="form-row">
                  <label>Текст *</label>
                  <textarea
                    value={newPassage.content}
                    onChange={e => setNewPassage({...newPassage, content: e.target.value})}
                    placeholder="Японский текст для чтения..."
                    rows={8}
                  />
                </div>
                <div className="modal-actions">
                  <button className="cancel-button" onClick={() => setShowPassageForm(false)}>
                    Отмена
                  </button>
                  <button className="save-button" onClick={handleCreatePassage}>
                    Создать
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="passages-list">
            {passages.map(p => (
              <div key={p.id} className="passage-card">
                <div className="passage-header">
                  <span className="passage-title">{p.title || 'Без названия'}</span>
                  <span className="chapter-badge">{p.chapter_name}</span>
                </div>
                <div className="passage-preview">
                  {p.content.substring(0, 200)}...
                </div>
                <div className="passage-footer">
                  <span>{p.question_count} вопросов</span>
                  <button className="delete-button" onClick={() => handleDeletePassage(p.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
