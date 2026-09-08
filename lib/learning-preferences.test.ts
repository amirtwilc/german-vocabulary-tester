import { describe, expect, it } from 'vitest';
import { hiddenQuestionFrom, HIDDEN_QUESTIONS_STORAGE_KEY, loadHiddenQuestions, saveHiddenQuestions } from '@/lib/learning-preferences';
import type { QuizQuestion } from '@/lib/quiz';

const question: QuizQuestion = {
  id: 'default-helfen-present-ich', questionKey: 'v1:verb:helfen:present:ich', wordId: 'default-helfen', wordType: 'verb', word: 'helfen',
  prompt: 'Conjugate “helfen” for ich.', eyebrow: 'Verb · present tense', mode: 'text', correctAnswer: 'helfe',
};

describe('hidden-question preferences', () => {
  it('creates a browser-safe record from a quiz question', () => {
    expect(hiddenQuestionFrom(question)).toMatchObject({ key: question.questionKey, word: 'helfen', wordType: 'verb', prompt: question.prompt });
  });

  it('saves, loads, and deduplicates hidden questions', () => {
    const record = hiddenQuestionFrom(question);
    saveHiddenQuestions([record, record]);
    expect(loadHiddenQuestions()).toEqual([record]);
    expect(window.localStorage.getItem(HIDDEN_QUESTIONS_STORAGE_KEY)).toContain('"version":1');
  });

  it('ignores malformed or unsupported stored data', () => {
    window.localStorage.setItem(HIDDEN_QUESTIONS_STORAGE_KEY, JSON.stringify({ version: 2, questions: [] }));
    expect(loadHiddenQuestions()).toEqual([]);
    window.localStorage.setItem(HIDDEN_QUESTIONS_STORAGE_KEY, '{bad json');
    expect(loadHiddenQuestions()).toEqual([]);
  });
});
