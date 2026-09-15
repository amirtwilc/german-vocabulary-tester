import { afterEach, describe, expect, it, vi } from 'vitest';
import { vocabulary } from '@/data/vocabulary';
import { createQuiz } from '@/lib/quiz';
import {
  loadQuizSession,
  QUIZ_QUESTIONS_STORAGE_PREFIX,
  QUIZ_SESSION_STORAGE_KEY,
  saveQuizProgress,
  startQuizSession,
  type SavedQuizSession,
} from '@/lib/quiz-session';

const session = (id: string): SavedQuizSession => ({
  version: 2,
  id,
  questions: createQuiz(vocabulary, 3, () => 0),
  questionIndex: 0,
  answers: [],
  draftAnswer: '',
  elapsed: 0,
  newlyMasteredKeys: [],
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('saved quiz sessions', () => {
  it('writes questions once and keeps progress small', () => {
    const quiz = session('first');
    expect(startQuizSession(quiz).ok).toBe(true);
    const questionsKey = `${QUIZ_QUESTIONS_STORAGE_PREFIX}first`;
    const originalQuestions = window.localStorage.getItem(questionsKey);
    expect(originalQuestions).toContain(quiz.questions[0].prompt);

    expect(saveQuizProgress({ ...quiz, draftAnswer: 'ein Wort' }).ok).toBe(
      true,
    );
    expect(window.localStorage.getItem(questionsKey)).toBe(originalQuestions);
    expect(
      JSON.parse(window.localStorage.getItem(QUIZ_SESSION_STORAGE_KEY)!),
    ).not.toHaveProperty('questions');
    expect(loadQuizSession()?.draftAnswer).toBe('ein Wort');
  });

  it('rejects a mismatched question record', () => {
    const quiz = session('first');
    startQuizSession(quiz);
    window.localStorage.setItem(
      `${QUIZ_QUESTIONS_STORAGE_PREFIX}first`,
      JSON.stringify({ version: 2, id: 'other', questions: quiz.questions }),
    );
    expect(loadQuizSession()).toBeNull();
  });

  it('migrates an existing unsplit checkpoint', () => {
    const old = session('old');
    window.localStorage.setItem(
      QUIZ_SESSION_STORAGE_KEY,
      JSON.stringify({ ...old, version: 1, id: undefined }),
    );
    const migrated = loadQuizSession();
    expect(migrated?.version).toBe(2);
    expect(migrated?.questions).toEqual(old.questions);
    expect(
      JSON.parse(window.localStorage.getItem(QUIZ_SESSION_STORAGE_KEY)!),
    ).not.toHaveProperty('questions');
  });

  it('preserves the previous quiz when starting a replacement fails', () => {
    const first = session('first');
    startQuizSession(first);
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      function (this: Storage, key, value) {
        if (key === QUIZ_SESSION_STORAGE_KEY)
          throw new DOMException('Storage full', 'QuotaExceededError');
        originalSetItem.call(this, key, value);
      },
    );
    expect(startQuizSession(session('second')).ok).toBe(false);
    expect(loadQuizSession()?.id).toBe('first');
    expect(
      window.localStorage.getItem(`${QUIZ_QUESTIONS_STORAGE_PREFIX}second`),
    ).toBeNull();
  });
});
