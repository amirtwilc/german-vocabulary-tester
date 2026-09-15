import type { QuizQuestion } from '@/lib/quiz';
import { writeLocalStorage, type StorageWriteResult } from '@/lib/storage';

export const QUIZ_SESSION_STORAGE_KEY = 'german-vocabulary-quiz-session';
export const QUIZ_QUESTIONS_STORAGE_PREFIX =
  'german-vocabulary-quiz-questions:';

export interface SavedQuizSession {
  version: 2;
  id: string;
  questions: QuizQuestion[];
  questionIndex: number;
  answers: { answer: string; correct: boolean }[];
  draftAnswer: string;
  elapsed: number;
  newlyMasteredKeys: string[];
}

type SavedProgress = Omit<SavedQuizSession, 'questions'>;

const questionKey = (id: string) => `${QUIZ_QUESTIONS_STORAGE_PREFIX}${id}`;
const progressFrom = ({
  questions: _questions,
  ...progress
}: SavedQuizSession): SavedProgress => progress;

const remove = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be disabled; the active quiz still works in memory.
  }
};

const read = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveQuizProgress = (
  session: SavedQuizSession,
): StorageWriteResult =>
  writeLocalStorage(
    QUIZ_SESSION_STORAGE_KEY,
    JSON.stringify(progressFrom(session)),
  );

export const startQuizSession = (
  session: SavedQuizSession,
): StorageWriteResult => {
  const previous = read(QUIZ_SESSION_STORAGE_KEY) as { id?: unknown } | null;
  const savedQuestions = writeLocalStorage(
    questionKey(session.id),
    JSON.stringify({
      version: 2,
      id: session.id,
      questions: session.questions,
    }),
  );
  if (!savedQuestions.ok) return savedQuestions;
  const savedProgress = saveQuizProgress(session);
  if (!savedProgress.ok) {
    remove(questionKey(session.id));
    return savedProgress;
  }
  if (typeof previous?.id === 'string' && previous.id !== session.id)
    remove(questionKey(previous.id));
  return savedProgress;
};

export const clearQuizSession = () => {
  const progress = read(QUIZ_SESSION_STORAGE_KEY) as { id?: unknown } | null;
  if (typeof progress?.id === 'string') remove(questionKey(progress.id));
  remove(QUIZ_SESSION_STORAGE_KEY);
};

const validQuestions = (questions: unknown): questions is QuizQuestion[] =>
  Array.isArray(questions) &&
  questions.length > 0 &&
  questions.every(
    (question) =>
      question &&
      typeof question.id === 'string' &&
      typeof question.questionKey === 'string' &&
      typeof question.prompt === 'string' &&
      typeof question.correctAnswer === 'string' &&
      (question.mode === 'text' ||
        (question.mode === 'choice' &&
          Array.isArray(question.options) &&
          question.options.every(
            (option: unknown) => typeof option === 'string',
          ))),
  );

const validProgress = (
  progress: Partial<SavedProgress>,
  questions: QuizQuestion[],
) =>
  Number.isInteger(progress.questionIndex) &&
  progress.questionIndex! >= 0 &&
  progress.questionIndex! < questions.length &&
  Array.isArray(progress.answers) &&
  progress.answers.length >= progress.questionIndex! &&
  progress.answers.length <= progress.questionIndex! + 1 &&
  progress.answers.every(
    (record) =>
      record &&
      typeof record.answer === 'string' &&
      typeof record.correct === 'boolean',
  ) &&
  typeof progress.draftAnswer === 'string' &&
  typeof progress.elapsed === 'number' &&
  Number.isFinite(progress.elapsed) &&
  progress.elapsed >= 0 &&
  Array.isArray(progress.newlyMasteredKeys) &&
  progress.newlyMasteredKeys.every((key) => typeof key === 'string');

export const loadQuizSession = (): SavedQuizSession | null => {
  const saved = read(QUIZ_SESSION_STORAGE_KEY);
  if (!saved || typeof saved !== 'object') return null;
  const progress = saved as Partial<SavedProgress> & { questions?: unknown };
  if (progress.version === 2 && typeof progress.id === 'string') {
    const questionRecord = read(questionKey(progress.id)) as {
      version?: unknown;
      id?: unknown;
      questions?: unknown;
    } | null;
    if (
      questionRecord?.version !== 2 ||
      questionRecord.id !== progress.id ||
      !validQuestions(questionRecord.questions) ||
      !validProgress(progress, questionRecord.questions)
    )
      return null;
    return {
      ...progress,
      questions: questionRecord.questions,
    } as SavedQuizSession;
  }

  // Migrate checkpoints written before questions and progress were split.
  if (
    (progress as { version?: unknown }).version !== 1 ||
    !validQuestions(progress.questions) ||
    !validProgress(progress, progress.questions)
  )
    return null;
  const session: SavedQuizSession = {
    ...progress,
    version: 2,
    id: crypto.randomUUID(),
    questions: progress.questions,
  } as SavedQuizSession;
  return startQuizSession(session).ok ? session : null;
};
