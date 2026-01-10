const API_BASE = 'http://localhost:3001/api';

// ==================== PUBLIC API ====================

export async function getChapters() {
  const response = await fetch(`${API_BASE}/chapters`);
  if (!response.ok) throw new Error('Failed to fetch chapters');
  return response.json();
}

export async function getTypes() {
  const response = await fetch(`${API_BASE}/types`);
  if (!response.ok) throw new Error('Failed to fetch types');
  return response.json();
}

export async function createSession({ typeId, chapterIds, limit }) {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ typeId, chapterIds, limit })
  });
  if (!response.ok) throw new Error('Failed to create session');
  return response.json();
}

export async function getSessionQuestion(sessionId, index = null) {
  const url = new URL(`${API_BASE}/sessions/${sessionId}`);
  if (Number.isInteger(index)) {
    url.searchParams.set('index', index);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch question');
  return response.json();
}

export async function submitAnswer(sessionId, answerId, questionIndex = null) {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answerId, questionIndex })
  });
  if (!response.ok) throw new Error('Failed to submit answer');
  return response.json();
}

export async function getSessionResults(sessionId) {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/results`);
  if (!response.ok) throw new Error('Failed to fetch results');
  return response.json();
}

export async function getSessionSummary(sessionId) {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/summary`);
  if (!response.ok) throw new Error('Failed to fetch session summary');
  return response.json();
}

// ==================== ADMIN API ====================

export async function getAdminQuestions() {
  const response = await fetch(`${API_BASE}/admin/questions`);
  if (!response.ok) throw new Error('Failed to fetch questions');
  return response.json();
}

export async function getAdminPassages() {
  const response = await fetch(`${API_BASE}/admin/passages`);
  if (!response.ok) throw new Error('Failed to fetch passages');
  return response.json();
}

export async function createChapter(name) {
  const response = await fetch(`${API_BASE}/admin/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!response.ok) throw new Error('Failed to create chapter');
  return response.json();
}

export async function updateChapter(id, name) {
  const response = await fetch(`${API_BASE}/admin/chapters/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!response.ok) throw new Error('Failed to update chapter');
  return response.json();
}

export async function deleteChapter(id) {
  const response = await fetch(`${API_BASE}/admin/chapters/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete chapter');
  }
  return response.json();
}

export async function createPassage(chapterId, title, content) {
  const response = await fetch(`${API_BASE}/admin/passages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapterId, title, content })
  });
  if (!response.ok) throw new Error('Failed to create passage');
  return response.json();
}

export async function deletePassage(id) {
  const response = await fetch(`${API_BASE}/admin/passages/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete passage');
  return response.json();
}

export async function createQuestion(data) {
  const response = await fetch(`${API_BASE}/admin/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to create question');
  }
  return response.json();
}

export async function updateQuestion(id, data) {
  const response = await fetch(`${API_BASE}/admin/questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update question');
  return response.json();
}

export async function deleteQuestion(id) {
  const response = await fetch(`${API_BASE}/admin/questions/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete question');
  return response.json();
}
