import { describe, expect, it, vi } from 'vitest';
import {
  COLLECTIONS_STORAGE_KEY,
  CSV_COLUMNS,
  decodeVocabularyCsvBytes,
  loadCollections,
  mergeVocabularies,
  parseVocabularyCsv,
  saveCollections,
  vocabularyToCsv,
} from '@/lib/collections';
import type { Vocabulary } from '@/data/vocabulary';

const csvRow = (values: Record<string, string>) =>
  CSV_COLUMNS.map((column) => {
    const value = values[column] ?? '';
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(',');

const validCsv = [
  CSV_COLUMNS.join(','),
  csvRow({
    type: 'noun',
    german: 'Haus',
    english: 'house',
    article: 'das',
    plural: 'Häuser',
  }),
  csvRow({
    type: 'verb',
    german: 'lernen',
    english: 'to learn',
    case: 'Akkusativ',
    present_ich: 'lerne',
    present_du: 'lernst',
    present_er_sie_es: 'lernt',
    present_ihr: 'lernt',
    past_participle: 'gelernt',
    auxiliary: 'hat',
    notes: 'A useful, regular verb',
  }),
  csvRow({ type: 'preposition', german: 'mit', usage: 'fixed', case: 'Dativ' }),
  csvRow({
    type: 'adjective',
    german: 'gut',
    english: 'good',
    comparative: 'besser',
    superlative: 'am besten',
  }),
].join('\n');

describe('vocabulary CSV collections', () => {
  it('decodes umlauts from UTF-8 and Windows-1252 CSV files', () => {
    const utf8 = decodeVocabularyCsvBytes(
      new TextEncoder().encode('schön,größer,für,ß'),
    );
    expect(utf8).toEqual({
      text: 'schön,größer,für,ß',
      encoding: 'utf-8',
    });

    const windows1252 = decodeVocabularyCsvBytes(
      Uint8Array.from(
        Array.from('schön,größer,für,ß', (character) =>
          character.charCodeAt(0),
        ),
      ),
    );
    expect(windows1252).toEqual({
      text: 'schön,größer,für,ß',
      encoding: 'windows-1252',
    });
  });

  it('imports nouns, verbs, quoted cells, and prepositions', () => {
    const result = parseVocabularyCsv(validCsv);
    expect(result.errors).toEqual([]);
    expect(result.wordCount).toBe(4);
    expect(result.vocabulary?.nouns[0]).toMatchObject({
      german: 'Haus',
      article: 'das',
      plural: 'Häuser',
    });
    expect(result.vocabulary?.verbs[0]).toMatchObject({
      infinitive: 'lernen',
      present: { ich: 'lerne' },
      notes: 'A useful, regular verb',
    });
    expect(result.vocabulary?.prepositions[0]).toMatchObject({
      german: 'mit',
      usage: 'fixed',
      case: 'Dativ',
    });
    expect(result.vocabulary?.adjectivesAndAdverbs[0]).toMatchObject({
      kind: 'adjective',
      german: 'gut',
      comparative: 'besser',
      superlative: 'am besten',
    });
  });

  it('reports structural and row-level validation errors', () => {
    expect(parseVocabularyCsv('type,german\nnoun,Haus').errors[0]).toMatch(
      /Missing column/,
    );
    const duplicate = `${CSV_COLUMNS.join(',')}\nnoun,Haus,house,das,Häuser\nnoun,haus,home,das,Häuser`;
    expect(parseVocabularyCsv(duplicate).errors).toContain(
      'Row 3: duplicate noun “haus” in this file.',
    );
  });

  it('round-trips exported vocabulary without losing fields', () => {
    const imported = parseVocabularyCsv(validCsv).vocabulary!;
    const roundTrip = parseVocabularyCsv(vocabularyToCsv(imported));
    expect(roundTrip.errors).toEqual([]);
    expect(roundTrip.vocabulary).toEqual(imported);
  });

  it('skips duplicate words across selected collections, case-insensitively', () => {
    const first: Vocabulary = {
      nouns: [
        {
          id: 'one',
          german: 'Haus',
          english: 'house',
          article: 'das',
          plural: 'Häuser',
        },
      ],
      verbs: [],
      prepositions: [],
      adjectivesAndAdverbs: [],
    };
    const second: Vocabulary = {
      nouns: [
        {
          id: 'two',
          german: 'haus',
          english: 'home',
          article: 'das',
          plural: 'Häuser',
        },
      ],
      verbs: [],
      prepositions: [],
      adjectivesAndAdverbs: [],
    };
    const merged = mergeVocabularies([
      { id: 'first', vocabulary: first },
      { id: 'second', vocabulary: second },
    ]);
    expect(merged.duplicateCount).toBe(1);
    expect(merged.vocabulary.nouns).toHaveLength(1);
    expect(merged.vocabulary.nouns[0].english).toBe('house');
  });

  it('discards corrupt stored collections instead of crashing the quiz', () => {
    window.localStorage.setItem(
      COLLECTIONS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'broken',
          name: 'Broken',
          createdAt: 'now',
          updatedAt: 'now',
          vocabulary: {},
        },
      ]),
    );
    expect(loadCollections()).toEqual([]);
  });

  it('reports browser storage quota failures', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      });
    expect(saveCollections([])).toEqual({ ok: false, reason: 'quota' });
    setItem.mockRestore();
  });
});
