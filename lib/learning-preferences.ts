import type { QuizQuestion } from '@/lib/quiz';

export const HIDDEN_QUESTIONS_STORAGE_KEY = 'wort-fuer-wort.hidden-questions.v1';

export interface HiddenQuestion {
  key: string;
  word: string;
  wordType: QuizQuestion['wordType'];
  prompt: string;
  hiddenAt: string;
}

interface HiddenQuestionStorage {
  version: 1;
  questions: HiddenQuestion[];
}

const isHiddenQuestion = (value: unknown): value is HiddenQuestion => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<HiddenQuestion>;
  return typeof item.key === 'string' && typeof item.word === 'string' && typeof item.wordType === 'string' && typeof item.prompt === 'string' && typeof item.hiddenAt === 'string';
};

export const loadHiddenQuestions = (): HiddenQuestion[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(HIDDEN_QUESTIONS_STORAGE_KEY) ?? 'null') as Partial<HiddenQuestionStorage> | null;
    if (stored?.version !== 1 || !Array.isArray(stored.questions)) return [];
    const unique = new Map(stored.questions.filter(isHiddenQuestion).map((question) => [question.key, question]));
    return [...unique.values()];
  } catch { return []; }
};

export const saveHiddenQuestions = (questions: HiddenQuestion[]) => {
  const storage: HiddenQuestionStorage = { version: 1, questions };
  window.localStorage.setItem(HIDDEN_QUESTIONS_STORAGE_KEY, JSON.stringify(storage));
};

export const hiddenQuestionFrom = (question: QuizQuestion): HiddenQuestion => ({
  key: question.questionKey,
  word: question.word,
  wordType: question.wordType,
  prompt: question.prompt,
  hiddenAt: new Date().toISOString(),
});
