import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('quiz interface', () => {
  it('starts a quiz and shows progress', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(screen.getByTestId('start-quiz'));
    expect(screen.getByText(/Question 1/)).toBeInTheDocument();
    expect(screen.getByText(/of 20/)).toBeInTheDocument();
  });

  it('prevents an empty written answer and supports the German keypad', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<Home />);
    fireEvent.click(screen.getByTestId('start-quiz'));
    fireEvent.click(screen.getAllByRole('button').find((button) => button.textContent === 'newspaper')!);
    await act(async () => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole('button', { name: 'die' }));
    await act(async () => vi.advanceTimersByTime(1000));
    const input = screen.getByLabelText('Your answer');
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByText('Enter an answer first.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ä' }));
    expect(input).toHaveValue('ä');
    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(input).toHaveValue('');
  });
});
