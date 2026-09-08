import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home, { getCompletionHeading } from '@/app/page';
import { COLLECTIONS_STORAGE_KEY, vocabularyTemplateCsv } from '@/lib/collections';

afterEach(() => { cleanup(); window.localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

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
    const choices = [...container.querySelectorAll<HTMLButtonElement>('.choice-button')];
    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices.length).toBeLessThanOrEqual(4);
    expect(choices.map((choice) => choice.querySelector('.choice-number')?.textContent)).toEqual(['1', '2', '3', '4'].slice(0, choices.length));
    fireEvent.keyDown(window, { key: '1' });
    expect(choices[0]).toHaveClass('selected');
    expect(choices.every((choice) => choice.disabled)).toBe(true);
  });

  it('prevents an empty written answer and supports the German keypad', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<Home />);
    fireEvent.click(screen.getByTestId('start-quiz'));
    fireEvent.click(container.querySelector<HTMLButtonElement>('.choice-button')!);
    await act(async () => vi.advanceTimersByTime(1000));
    fireEvent.click(container.querySelector<HTMLButtonElement>('.choice-button')!);
    await act(async () => vi.advanceTimersByTime(1000));
    const input = screen.getByLabelText('Your answer');
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
    await user.type(screen.getByLabelText('Collection name'), 'Chapter 4');
    const csv = vocabularyTemplateCsv();
    const file = new File([csv], 'chapter-4.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => csv });
    const importInput = [...container.querySelectorAll<HTMLInputElement>('input[type="file"]')].at(-1)!;
    fireEvent.change(importInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Chapter 4')).toBeInTheDocument());
    expect(screen.getByText(/was added with 3 valid words/)).toBeInTheDocument();
    expect(window.localStorage.getItem(COLLECTIONS_STORAGE_KEY)).toContain('Chapter 4');
  });
});
