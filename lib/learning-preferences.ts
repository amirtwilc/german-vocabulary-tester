import type { QuizQuestion } from '@/lib/quiz';
import type { Vocabulary } from '@/data/vocabulary';
import { writeLocalStorage } from '@/lib/storage';

export const HIDDEN_QUESTIONS_STORAGE_KEY =
  'wort-fuer-wort.hidden-questions.v1';
export const WORD_TYPES_STORAGE_KEY = 'wort-fuer-wort.word-types.v1';

export type EnabledWordType = QuizQuestion['wordType'];
export const DEFAULT_ENABLED_WORD_TYPES: readonly EnabledWordType[] = [
  'verb',
  'noun',
  'adjective',
  'preposition',
  'adverb',
];

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

interface WordTypesStorage {
  version: 1;
  enabledWordTypes: EnabledWordType[];
}

const isHiddenQuestion = (value: unknown): value is HiddenQuestion => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<HiddenQuestion>;
  return (
    typeof item.key === 'string' &&
    typeof item.word === 'string' &&
    ['noun', 'verb', 'preposition', 'adjective', 'adverb'].includes(
      String(item.wordType),
    ) &&
    typeof item.prompt === 'string' &&
    typeof item.hiddenAt === 'string'
  );
};

export const loadHiddenQuestions = (): HiddenQuestion[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(HIDDEN_QUESTIONS_STORAGE_KEY) ?? 'null',
    ) as Partial<HiddenQuestionStorage> | null;
    if (stored?.version !== 1 || !Array.isArray(stored.questions)) return [];
    const unique = new Map(
      stored.questions
        .filter(isHiddenQuestion)
        .map((question) => [question.key, question]),
    );
    return [...unique.values()];
  } catch {
    return [];
  }
};

export const saveHiddenQuestions = (questions: HiddenQuestion[]) => {
  const storage: HiddenQuestionStorage = { version: 1, questions };
  return writeLocalStorage(
    HIDDEN_QUESTIONS_STORAGE_KEY,
    JSON.stringify(storage),
  );
};

export const hiddenQuestionFrom = (question: QuizQuestion): HiddenQuestion => ({
  key: question.questionKey,
  word: question.word,
  wordType: question.wordType,
  prompt: question.prompt,
  hiddenAt: new Date().toISOString(),
});

export const loadEnabledWordTypes = (): EnabledWordType[] => {
  if (typeof window === 'undefined') return [...DEFAULT_ENABLED_WORD_TYPES];
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(WORD_TYPES_STORAGE_KEY) ?? 'null',
    ) as Partial<WordTypesStorage> | null;
    if (stored?.version !== 1 || !Array.isArray(stored.enabledWordTypes))
      return [...DEFAULT_ENABLED_WORD_TYPES];
    if (
      stored.enabledWordTypes.some(
        (wordType) => !DEFAULT_ENABLED_WORD_TYPES.includes(wordType),
      )
    )
      return [...DEFAULT_ENABLED_WORD_TYPES];
    return [
      ...new Set(
        DEFAULT_ENABLED_WORD_TYPES.filter((wordType) =>
          stored.enabledWordTypes?.includes(wordType),
        ),
      ),
    ];
  } catch {
    return [...DEFAULT_ENABLED_WORD_TYPES];
  }
};

export const saveEnabledWordTypes = (enabledWordTypes: EnabledWordType[]) => {
  const storage: WordTypesStorage = { version: 1, enabledWordTypes };
  return writeLocalStorage(WORD_TYPES_STORAGE_KEY, JSON.stringify(storage));
};

export const filterVocabularyByWordTypes = (
  source: Vocabulary,
  enabledWordTypes: readonly EnabledWordType[],
): Vocabulary => {
  const enabled = new Set(enabledWordTypes);
  return {
    nouns: enabled.has('noun') ? source.nouns : [],
    verbs: enabled.has('verb') ? source.verbs : [],
    prepositions: enabled.has('preposition') ? source.prepositions : [],
    adjectivesAndAdverbs: source.adjectivesAndAdverbs.filter((item) =>
      enabled.has(item.kind),
    ),
  };
};
