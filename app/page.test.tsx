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
import {
  COLLECTIONS_STORAGE_KEY,
  vocabularyTemplateCsv,
} from '@/lib/collections';
import { HIDDEN_QUESTIONS_STORAGE_KEY } from '@/lib/learning-preferences';

const csvFile = (contents: string, name = 'vocabulary.csv') => {
  const file = new File([contents], name, { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => contents });
  return file;
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
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
    Object.defineProperty(file, 'text', {
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

  it('shows every hidden question and lets the user restore one', async () => {
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
      name: 'Hidden questions (1)',
    });
    await user.click(trigger);
    expect(screen.getByText('Conjugate “helfen” for ich.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(
      screen.getByRole('button', { name: 'Hidden questions (0)' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No questions are hidden yet/)).toBeInTheDocument();
  });
});
