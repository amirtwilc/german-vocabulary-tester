import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ENABLED_WORD_TYPES,
  filterVocabularyByWordTypes,
  hiddenQuestionFrom,
  HIDDEN_QUESTIONS_STORAGE_KEY,
  loadEnabledWordTypes,
  loadHiddenQuestions,
  saveEnabledWordTypes,
  saveHiddenQuestions,
  WORD_TYPES_STORAGE_KEY,
} from '@/lib/learning-preferences';
import type { Vocabulary } from '@/data/vocabulary';
import type { QuizQuestion } from '@/lib/quiz';

const question: QuizQuestion = {
  id: 'default-helfen-present-ich',
  questionKey: 'v1:verb:helfen:present:ich',
  wordId: 'default-helfen',
  wordType: 'verb',
  word: 'helfen',
  prompt: 'Conjugate “helfen” for ich.',
  eyebrow: 'Verb · present tense',
  mode: 'text',
  correctAnswer: 'helfe',
};

describe('hidden-question preferences', () => {
  it('creates a browser-safe record from a quiz question', () => {
    expect(hiddenQuestionFrom(question)).toMatchObject({
      key: question.questionKey,
      word: 'helfen',
      wordType: 'verb',
      prompt: question.prompt,
    });
  });

  it('saves, loads, and deduplicates hidden questions', () => {
    const record = hiddenQuestionFrom(question);
    saveHiddenQuestions([record, record]);
    expect(loadHiddenQuestions()).toEqual([record]);
    expect(window.localStorage.getItem(HIDDEN_QUESTIONS_STORAGE_KEY)).toContain(
      '"version":1',
    );
  });

  it('ignores malformed or unsupported stored data', () => {
    window.localStorage.setItem(
      HIDDEN_QUESTIONS_STORAGE_KEY,
      JSON.stringify({ version: 2, questions: [] }),
    );
    expect(loadHiddenQuestions()).toEqual([]);
    window.localStorage.setItem(HIDDEN_QUESTIONS_STORAGE_KEY, '{bad json');
    expect(loadHiddenQuestions()).toEqual([]);
  });

  it('reports unavailable browser storage without throwing', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
    expect(saveHiddenQuestions([hiddenQuestionFrom(question)])).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    setItem.mockRestore();
  });
});

describe('word-type preferences', () => {
  it('defaults to all word types and persists a valid selection', () => {
    expect(loadEnabledWordTypes()).toEqual(DEFAULT_ENABLED_WORD_TYPES);
    saveEnabledWordTypes(['noun', 'adverb']);
    expect(loadEnabledWordTypes()).toEqual(['noun', 'adverb']);
  });

  it('falls back to all word types for malformed or unsupported data', () => {
    window.localStorage.setItem(
      WORD_TYPES_STORAGE_KEY,
      JSON.stringify({ version: 2, enabledWordTypes: ['noun'] }),
    );
    expect(loadEnabledWordTypes()).toEqual(DEFAULT_ENABLED_WORD_TYPES);
    window.localStorage.setItem(
      WORD_TYPES_STORAGE_KEY,
      JSON.stringify({ version: 1, enabledWordTypes: ['phrase'] }),
    );
    expect(loadEnabledWordTypes()).toEqual(DEFAULT_ENABLED_WORD_TYPES);
  });

  it('filters adjectives and adverbs independently', () => {
    const source = {
      nouns: [
        {
          id: 'book',
          german: 'Buch',
          english: 'book',
          plural: 'Bücher',
          article: 'das',
        },
      ],
      verbs: [],
      prepositions: [],
      adjectivesAndAdverbs: [
        { id: 'good', kind: 'adjective', german: 'gut', english: 'good' },
        { id: 'often', kind: 'adverb', german: 'oft', english: 'often' },
      ],
    } satisfies Vocabulary;
    const filtered = filterVocabularyByWordTypes(source, ['adverb']);
    expect(filtered.nouns).toEqual([]);
    expect(filtered.adjectivesAndAdverbs).toEqual([
      source.adjectivesAndAdverbs[1],
    ]);
  });
});
