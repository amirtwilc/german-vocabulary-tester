import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home, { getCompletionHeading } from '@/app/page';
import { vocabulary } from '@/data/vocabulary';
import {
  COLLECTIONS_STORAGE_KEY,
  vocabularyTemplateCsv,
} from '@/lib/collections';
import {
  HIDDEN_QUESTIONS_STORAGE_KEY,
  WORD_TYPES_STORAGE_KEY,
} from '@/lib/learning-preferences';
import { createQuiz, type QuizQuestion } from '@/lib/quiz';

const answerQuestion = (question: QuizQuestion, correct: boolean) => {
  if (question.mode === 'choice') {
    const choices = [
      ...document.querySelectorAll<HTMLButtonElement>('.choice-button'),
    ];
    const matchingChoice = choices.find(
      (choice) =>
        choice.querySelector('.choice-content span:last-child')?.textContent ===
        question.correctAnswer,
    );
    const choice = correct
      ? matchingChoice
      : choices.find((item) => item !== matchingChoice);
    if (!choice) throw new Error('Expected a suitable answer choice');
    fireEvent.click(choice);
    return;
  }
  const input = screen.getByLabelText('Your answer');
  fireEvent.change(input, {
    target: { value: correct ? question.correctAnswer : 'definitely wrong' },
  });
  fireEvent.submit(input.closest('form')!);
};

const setQuizLength = (count: number) => {
  fireEvent.change(
    document.querySelector<HTMLInputElement>('input[type="range"]')!,
    { target: { value: String(count) } },
  );
};

const csvFile = (contents: string, name = 'vocabulary.csv') => {
  const file = new File([contents], name, { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => contents });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new TextEncoder().encode(contents).buffer,
  });
  return file;
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: undefined,
  });
});

describe('quiz interface', () => {
  it('celebrates only a perfect score as amazing', () => {
    expect(getCompletionHeading(20, 20)).toBe('Amazing.');
    expect(getCompletionHeading(19, 20)).toBe('Nice work.');
  });

  it('starts a quiz and shows progress', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(screen.getByTestId('start-quiz'));
    expect(screen.getByText(/Question 1/)).toBeInTheDocument();
    expect(screen.getByText(/of 20/)).toBeInTheDocument();
  });

  it('filters question availability by persisted word-type controls', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(
      screen.getByRole('button', { name: 'Word types control' }),
    );
    for (const label of [
      'Verbs',
      'Nouns',
      'Adjectives',
      'Prepositions',
      'Adverbs',
    ]) {
      const checkbox = screen.getByRole('checkbox', { name: label });
      expect(checkbox).toBeChecked();
      await user.click(checkbox);
    }
    expect(screen.getByText('0 questions available.')).toBeInTheDocument();
    expect(
      screen.getByText('Select at least one word type to start a quiz.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('start-quiz')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Prepositions' }));
    expect(
      await screen.findByText('25 available · 0 mastered'),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(WORD_TYPES_STORAGE_KEY)).toContain(
      'preposition',
    );
  });

  it('counts hidden questions only for enabled word types', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      HIDDEN_QUESTIONS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        questions: [
          {
            key: 'v1:verb:helfen:present:ich',
            word: 'helfen',
            wordType: 'verb',
            prompt: 'Conjugate “helfen” for ich.',
            hiddenAt: new Date().toISOString(),
          },
        ],
      }),
    );
    render(<Home />);
    expect(await screen.findByText(/1 mastered/)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Word types control' }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'Verbs' }));
    expect(screen.getByText(/0 mastered/)).toBeInTheDocument();
  });

  it('shows a gapped preposition diagram in the quiz and a complete one in review', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    window.localStorage.setItem(
      WORD_TYPES_STORAGE_KEY,
      JSON.stringify({ version: 1, enabledWordTypes: ['preposition'] }),
    );
    const { container } = render(<Home />);
    await act(async () => vi.runOnlyPendingTimers());
    fireEvent.change(
      container.querySelector<HTMLInputElement>('input[type="range"]')!,
      { target: { value: '1' } },
    );
    fireEvent.click(screen.getByTestId('start-quiz'));
    const quizDiagram = screen.getByRole('img', {
      name: /Accusative, highlighted:/,
    });
    expect(
      quizDiagram.getAttribute('aria-label')?.match(/missing word/g),
    ).toHaveLength(3);
    expect(quizDiagram.querySelectorAll('.is-missing')).toHaveLength(3);
    expect(quizDiagram.querySelectorAll('.is-highlighted')).toHaveLength(1);
    expect(quizDiagram.querySelector('.is-highlighted h2')).toHaveTextContent(
      'Accusative',
    );
    expect(container.querySelectorAll('.choice-button')).toHaveLength(3);
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('.choice-button')!,
    );
    await act(async () => vi.advanceTimersByTime(1000));
    const reviewDiagram = screen.getByRole('img', {
      name: /Accusative: bis, durch, für, gegen, ohne, um/,
    });
    expect(reviewDiagram.querySelectorAll('.is-missing')).toHaveLength(0);
    expect(reviewDiagram.querySelectorAll('.is-highlighted')).toHaveLength(0);
    expect(reviewDiagram.querySelectorAll('.preposition-word')).toHaveLength(
      25,
    );
  });

  it('asks for confirmation before leaving an active quiz', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(screen.getByTestId('start-quiz'));
    await user.click(screen.getByRole('button', { name: 'Leave quiz' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Leave this quiz?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep studying' }));
    expect(screen.queryByText('Leave this quiz?')).not.toBeInTheDocument();
    expect(screen.getByText(/Question 1/)).toBeInTheDocument();
  });

  it('maps number keys to the visible multiple-choice order', async () => {
    const user = userEvent.setup();
    const { container } = render(<Home />);
    await user.click(screen.getByTestId('start-quiz'));
    const choices = [
      ...container.querySelectorAll<HTMLButtonElement>('.choice-button'),
    ];
    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices.length).toBeLessThanOrEqual(4);
    expect(
      choices.map(
        (choice) => choice.querySelector('.choice-number')?.textContent,
      ),
    ).toEqual(['1', '2', '3', '4'].slice(0, choices.length));
    fireEvent.keyDown(window, { key: '1' });
    expect(choices[0]).toHaveClass('selected');
    expect(choices.every((choice) => choice.disabled)).toBe(true);
  });

  it('offers mastery for five seconds after a correct answer', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const [question] = createQuiz(vocabulary, 1, () => 0);
    render(<Home />);
    setQuizLength(1);
    fireEvent.click(screen.getByTestId('start-quiz'));
    answerQuestion(question, true);

    expect(
      screen.getByRole('button', { name: 'Master this question' }),
    ).toHaveAttribute('aria-keyshortcuts', 'M');
    expect(screen.getByText('Click or press M to master')).toBeInTheDocument();
    expect(screen.getByText('5 seconds')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Correct');
    expect(document.querySelector('.feedback-slot')).not.toHaveAttribute(
      'aria-live',
    );

    await act(async () => vi.advanceTimersByTime(1000));
    expect(screen.getByText('4 seconds')).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(3999));
    expect(screen.queryByText('Quiz complete')).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1));
    expect(screen.getByText('Quiz complete')).toBeInTheDocument();
    expect(screen.getByText('0 newly mastered this quiz')).toBeInTheDocument();
  });

  it('continues after one second when the answer is incorrect', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const [question] = createQuiz(vocabulary, 1, () => 0);
    render(<Home />);
    setQuizLength(1);
    fireEvent.click(screen.getByTestId('start-quiz'));
    answerQuestion(question, false);
    expect(
      screen.queryByRole('button', { name: 'Master this question' }),
    ).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(999));
    expect(screen.queryByText('Quiz complete')).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1));
    expect(screen.getByText('Quiz complete')).toBeInTheDocument();
  });

  it('masters with the button or M and ignores modified mastery keys', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const [question] = createQuiz(vocabulary, 1, () => 0);
    const { unmount } = render(<Home />);
    setQuizLength(1);
    fireEvent.click(screen.getByTestId('start-quiz'));
    answerQuestion(question, true);
    fireEvent.keyDown(window, { key: 'm', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'm', repeat: true });
    expect(screen.queryByText('Quiz complete')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'M' });
    expect(screen.getByText('Quiz complete')).toBeInTheDocument();
    expect(screen.getByText('1 newly mastered this quiz')).toBeInTheDocument();
    expect(window.localStorage.getItem(HIDDEN_QUESTIONS_STORAGE_KEY)).toContain(
      question.questionKey,
    );

    unmount();
    window.localStorage.clear();
    const [buttonQuestion] = createQuiz(vocabulary, 1, () => 0);
    render(<Home />);
    setQuizLength(1);
    fireEvent.click(screen.getByTestId('start-quiz'));
    answerQuestion(buttonQuestion, true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Master this question' }),
    );
    expect(screen.getByText('1 newly mastered this quiz')).toBeInTheDocument();
  });

  it('supports deliberate touch swipes without hijacking other gestures', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const [question] = createQuiz(vocabulary, 1, () => 0);
    const { container } = render(<Home />);
    setQuizLength(1);
    fireEvent.click(screen.getByTestId('start-quiz'));
    answerQuestion(question, true);
    const card = container.querySelector<HTMLElement>('.question-card')!;

    for (const gesture of [
      { pointerType: 'touch', endX: 40, endY: 0 },
      { pointerType: 'touch', endX: 80, endY: 70 },
      { pointerType: 'mouse', endX: 100, endY: 0 },
    ]) {
      fireEvent.pointerDown(card, {
        pointerId: 1,
        pointerType: gesture.pointerType,
        clientX: 0,
        clientY: 0,
      });
      fireEvent.pointerUp(card, {
        pointerId: 1,
        pointerType: gesture.pointerType,
        clientX: gesture.endX,
        clientY: gesture.endY,
      });
      expect(screen.queryByText('Quiz complete')).not.toBeInTheDocument();
    }

    fireEvent.pointerDown(card, {
      pointerId: 2,
      pointerType: 'pen',
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(card, {
      pointerId: 2,
      pointerType: 'pen',
      clientX: 80,
      clientY: 15,
    });
    expect(screen.getByText('Quiz complete')).toBeInTheDocument();
    expect(screen.getByText('1 newly mastered this quiz')).toBeInTheDocument();
  });

  it('advances without mastering on a deliberate left swipe', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const [question] = createQuiz(vocabulary, 1, () => 0);
    const { container } = render(<Home />);
    setQuizLength(1);
    fireEvent.click(screen.getByTestId('start-quiz'));
    answerQuestion(question, true);
    const card = container.querySelector<HTMLElement>('.question-card')!;
    fireEvent.pointerDown(card, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 10,
    });
    fireEvent.pointerUp(card, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 20,
      clientY: 15,
    });
    expect(screen.getByText('Quiz complete')).toBeInTheDocument();
    expect(screen.getByText('0 newly mastered this quiz')).toBeInTheDocument();
    expect(
      window.localStorage.getItem(HIDDEN_QUESTIONS_STORAGE_KEY),
    ).toBeNull();
  });

  it('adapts the mastery hint when the primary pointer changes', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const listeners = new Set<() => void>();
    const mediaQuery = {
      matches: false,
      addEventListener: (_type: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.delete(listener),
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => mediaQuery,
    });
    const [question] = createQuiz(vocabulary, 1, () => 0);
    render(<Home />);
    setQuizLength(1);
    fireEvent.click(screen.getByTestId('start-quiz'));
    answerQuestion(question, true);
    expect(screen.getByText('Click or press M to master')).toBeInTheDocument();
    await act(async () => {
      mediaQuery.matches = true;
      listeners.forEach((listener) => listener());
    });
    expect(
      screen.getByText('Tap, swipe right to master, or left for next'),
    ).toBeInTheDocument();
  });

  it('prevents an empty written answer and supports the German keypad', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<Home />);
    fireEvent.click(screen.getByTestId('start-quiz'));
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('.choice-button')!,
    );
    await act(async () => vi.advanceTimersByTime(1000));
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('.choice-button')!,
    );
    await act(async () => vi.advanceTimersByTime(1000));
    const input = screen.getByLabelText('Your answer');
    expect(
      screen.getByText('Hint: You can also type ae, oe, ue, or ss.'),
    ).toBeInTheDocument();
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByText('Enter an answer first.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ä' }));
    expect(input).toHaveValue('ä');
    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(input).toHaveValue('');
  });

  it('imports a valid CSV as a named collection and saves it in the browser', async () => {
    const user = userEvent.setup();
    const { container } = render(<Home />);
    expect(screen.queryByLabelText('Collection name')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Expand word collection' }),
    );
    await user.type(screen.getByLabelText('Collection name'), 'Chapter 4');
    const csv = vocabularyTemplateCsv();
    const file = csvFile(csv, 'chapter-4.csv');
    const importInput = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    ].at(-1)!;
    fireEvent.change(importInput, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByText('Chapter 4')).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/was added with 4 valid words/),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(COLLECTIONS_STORAGE_KEY)).toContain(
      'Chapter 4',
    );
  });

  it('replaces and removes an imported collection', async () => {
    const user = userEvent.setup();
    const { container } = render(<Home />);
    await user.click(
      screen.getByRole('button', { name: 'Expand word collection' }),
    );
    await user.type(screen.getByLabelText('Collection name'), 'Chapter 4');
    const inputs = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    ];
    fireEvent.change(inputs[1], {
      target: { files: [csvFile(vocabularyTemplateCsv())] },
    });
    await screen.findByText('Chapter 4');

    await user.click(
      screen.getByRole('button', { name: 'Replace Chapter 4 from CSV' }),
    );
    const replacement = vocabularyTemplateCsv()
      .replace('Apfel', 'Birne')
      .replace('apple', 'pear');
    fireEvent.change(inputs[0], {
      target: { files: [csvFile(replacement, 'replacement.csv')] },
    });
    await screen.findByText(/was replaced with 4 valid words/);
    expect(window.localStorage.getItem(COLLECTIONS_STORAGE_KEY)).toContain(
      'Birne',
    );

    await user.click(screen.getByRole('button', { name: 'Remove Chapter 4' }));
    await user.click(screen.getByRole('button', { name: 'Remove collection' }));
    await waitFor(() =>
      expect(screen.queryByText('Chapter 4')).not.toBeInTheDocument(),
    );
    expect(window.localStorage.getItem(COLLECTIONS_STORAGE_KEY)).not.toContain(
      'Chapter 4',
    );
  });

  it('shows an actionable error when collection storage is full', async () => {
    const user = userEvent.setup();
    const { container } = render(<Home />);
    await user.click(
      screen.getByRole('button', { name: 'Expand word collection' }),
    );
    await user.type(screen.getByLabelText('Collection name'), 'Too large');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    const importInput = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    ].at(-1)!;
    fireEvent.change(importInput, {
      target: { files: [csvFile(vocabularyTemplateCsv())] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Browser storage is full',
    );
    expect(
      screen.queryByText('Too large', { selector: 'strong' }),
    ).not.toBeInTheDocument();
  });

  it('reports a file read failure', async () => {
    const user = userEvent.setup();
    const { container } = render(<Home />);
    await user.click(
      screen.getByRole('button', { name: 'Expand word collection' }),
    );
    await user.type(screen.getByLabelText('Collection name'), 'Unreadable');
    const file = new File([''], 'unreadable.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => {
        throw new Error('read failed');
      },
    });
    const importInput = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    ].at(-1)!;
    fireEvent.change(importInput, { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This CSV could not be read',
    );
  });

  it('finishes a short quiz and reviews an incorrect written answer', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<Home />);
    fireEvent.change(
      container.querySelector<HTMLInputElement>('input[type="range"]')!,
      { target: { value: '3' } },
    );
    fireEvent.click(screen.getByTestId('start-quiz'));
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('.choice-button')!,
    );
    await act(async () => vi.advanceTimersByTime(1000));
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('.choice-button')!,
    );
    await act(async () => vi.advanceTimersByTime(1000));
    fireEvent.change(screen.getByLabelText('Your answer'), {
      target: { value: 'falsch' },
    });
    fireEvent.submit(screen.getByLabelText('Your answer').closest('form')!);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Quiz complete')).toBeInTheDocument();
    expect(screen.getByText('Nice work.')).toBeInTheDocument();
    expect(screen.getAllByText('Correct answer')).toHaveLength(3);
  });

  it('lets the user skip mastery and change mastery from results', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const [question] = createQuiz(vocabulary, 1, () => 0);
    render(<Home />);
    setQuizLength(1);
    fireEvent.click(screen.getByTestId('start-quiz'));
    answerQuestion(question, true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('0 newly mastered this quiz')).toBeInTheDocument();
    expect(
      screen.getByText('0 mastered questions in total'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Master this question' }),
    );
    expect(screen.getByText('1 newly mastered this quiz')).toBeInTheDocument();
    expect(
      screen.getByText('1 mastered question in total'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Practise this question again' }),
    );
    expect(screen.getByText('0 newly mastered this quiz')).toBeInTheDocument();
    expect(
      screen.getByText('0 mastered questions in total'),
    ).toBeInTheDocument();
  });

  it('does not count mastery when browser storage rejects it', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const [question] = createQuiz(vocabulary, 1, () => 0);
    render(<Home />);
    setQuizLength(1);
    fireEvent.click(screen.getByTestId('start-quiz'));
    answerQuestion(question, true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Master this question' }),
    );
    expect(screen.getByText('Quiz complete')).toBeInTheDocument();
    expect(screen.getByText('0 newly mastered this quiz')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Browser storage is full',
    );
  });

  it('shows every mastered question and lets the user practise one again', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      HIDDEN_QUESTIONS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        questions: [
          {
            key: 'v1:verb:helfen:present:ich',
            word: 'helfen',
            wordType: 'verb',
            prompt: 'Conjugate “helfen” for ich.',
            hiddenAt: new Date().toISOString(),
          },
        ],
      }),
    );
    render(<Home />);
    const trigger = await screen.findByRole('button', {
      name: 'Mastered questions (1)',
    });
    expect(
      screen.getByText(
        'Quiz results aren’t saved. Mastered questions and imported collections are stored on this device.',
      ),
    ).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getByText('Conjugate “helfen” for ich.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Practise again' }));
    expect(
      screen.getByRole('button', { name: 'Mastered questions (0)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No questions are mastered yet/),
    ).toBeInTheDocument();
  });
});
