import { describe, expect, it } from 'vitest';
import type { Vocabulary } from '@/data/vocabulary';
import { createQuiz, getMaximumQuestionCount, isCorrectAnswer } from '@/lib/quiz';

const source = {
  nouns: [
    { id: 'book', german: 'Buch', english: 'book', plural: 'Bücher', article: 'das' },
    { id: 'city', german: 'Stadt', english: 'city', plural: 'Städte', article: 'die' },
  ],
  verbs: [
    { id: 'read', infinitive: 'lesen', english: 'to read', present: { ich: 'lese', wir: 'lesen' }, pastParticiple: 'gelesen', auxiliary: 'hat', case: 'Akkusativ' },
    { id: 'help', infinitive: 'helfen', english: 'to help', present: { ich: 'helfe' }, auxiliary: 'hat', case: 'Dativ' },
  ],
} satisfies Vocabulary;

describe('quiz generation', () => {
  it('calculates the available unique questions', () => {
    expect(getMaximumQuestionCount(source)).toBe(14);
  });

  it('returns the exact requested total and trims a final block', () => {
    expect(createQuiz(source, 1, () => 0.5)).toHaveLength(1);
    expect(createQuiz(source, 9, () => 0.5)).toHaveLength(9);
    expect(createQuiz(source, 99, () => 0.5)).toHaveLength(14);
  });

  it('keeps each word translation unique and limits verb follow-ups to three', () => {
    const quiz = createQuiz(source, 14, () => 0.25);
    const translations = quiz.filter((question) => question.id.endsWith('-translation'));
    expect(new Set(translations.map((question) => question.wordId)).size).toBe(4);
    expect(quiz.filter((question) => question.wordId === 'read')).toHaveLength(4);
  });

  it('uses unique, same-category translation options and supports small pools', () => {
    const quiz = createQuiz(source, 14, () => 0.75);
    for (const question of quiz.filter((item) => item.id.endsWith('-translation'))) {
      expect(new Set(question.options).size).toBe(question.options?.length);
      expect(question.options).toContain(question.correctAnswer);
      expect(question.options).toHaveLength(2);
    }
  });

  it('grades case-insensitively but preserves umlaut distinctions', () => {
    expect(isCorrectAnswer('  BÜCHER ', 'Bücher')).toBe(true);
    expect(isCorrectAnswer('Bucher', 'Bücher')).toBe(false);
  });
});
