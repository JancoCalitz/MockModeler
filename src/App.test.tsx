import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { examQuestions, EXAMS, trackById } from './content/bank.ts';

const associate = trackById('associate');
const developer = trackById('developer');
// A fixed mock, as a random one would not repeat its questions in a known order.
const mockA = EXAMS.find((exam) => exam.id === 'associate-mock-a')!;

function startMockA() {
  fireEvent.change(screen.getByRole('combobox', { name: 'Mock exam' }), {
    target: { value: mockA.id },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Start test' }));
}

describe('App', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the real format of the chosen certification', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: associate.name })).toBeTruthy();
    expect(screen.getByText(`${associate.durationMinutes} minutes`)).toBeTruthy();
    expect(screen.getByText(`${associate.passMark}%`)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('switches certification, and remembers the choice', () => {
    const { unmount } = render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Developer' })[0]!);
    expect(screen.getByRole('heading', { name: developer.name })).toBeTruthy();
    expect(screen.getByText(`${developer.passMark}%`)).toBeTruthy();
    unmount();

    render(<App />);
    expect(screen.getByRole('heading', { name: developer.name })).toBeTruthy();
  });

  it('warns when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('blocked');
    });

    render(<App />);

    expect(screen.getByRole('alert').textContent).toContain('local storage');
    vi.restoreAllMocks();
  });

  it('shows study notes for each domain, with a drill to practise it', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Study notes' })[0]!);

    for (const domain of associate.domains) {
      expect(screen.getByRole('heading', { name: domain.label })).toBeTruthy();
    }
    fireEvent.click(screen.getAllByRole('button', { name: /^Drill / })[0]!);
    expect(screen.getByRole('heading', { name: 'Practice drill' })).toBeTruthy();
    expect(screen.getByText(/^Question 1 of/)).toBeTruthy();
  });

  it('starts a timed attempt, and resumes it after a reload', () => {
    const { unmount } = render(<App />);
    startMockA();

    expect(screen.getByRole('timer').textContent).toMatch(/2[45]:\d\d/);
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    unmount();

    render(<App />);

    expect(screen.getByRole('timer')).toBeTruthy();
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Question 1, answered' })).toBeTruthy();
  });

  it('asks for confirmation before the final submit, showing what is left', () => {
    render(<App />);
    startMockA();
    fireEvent.click(screen.getByRole('button', { name: 'Flag for review' }));

    fireEvent.click(screen.getByRole('button', { name: 'Submit test' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(`${mockA.questions.length} unanswered`);
    expect(dialog.textContent).toContain('1 flagged');

    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('timer')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Submit test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit final answers' }));
    expect(screen.getByRole('heading', { name: 'Test submitted' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Total score' }).nextElementSibling!.textContent,
    ).toBe('0%');
    expect(screen.getByText(/Below the real exam's 75% pass mark/)).toBeTruthy();
  });

  it('shows an expired attempt as finished when reopened after the deadline', () => {
    const { unmount } = render(<App />);
    startMockA();
    unmount();
    const saved = JSON.parse(localStorage.getItem('mockmodeler.attempt')!);
    localStorage.setItem(
      'mockmodeler.attempt',
      JSON.stringify({ ...saved, deadline: Date.now() - 1000 }),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Time is up' })).toBeTruthy();
  });

  it('scores a mock, reports by domain, and keeps it in progress for that track only', () => {
    render(<App />);
    startMockA();
    const first = examQuestions(mockA)[0]!;
    fireEvent.click(
      screen.getByRole('radio', { name: new RegExp(first.options[0]!.slice(0, 30)) }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit final answers' }));

    expect(
      screen.getByRole('heading', { name: 'Total score' }).nextElementSibling!.textContent,
    ).toBe('5%');
    expect(screen.getByRole('list', { name: 'Score by domain' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View progress' }));
    expect(screen.getByRole('heading', { name: 'Your progress' })).toBeTruthy();
    expect(screen.getByRole('meter')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review attempt 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take a weak areas mock' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Review attempt 1' }));
    expect(screen.getByRole('button', { name: 'Back to progress' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to progress' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Developer' })[0]!);
    expect(screen.getByText('Finish a test to see your progress here.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Associate' })[0]!);

    fireEvent.click(screen.getByRole('button', { name: "Delete this track's progress" }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'View progress' })).toBeNull();
  });

  it('never puts a practice-only question in a mock', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start test' }));
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Case study' })).toBeNull();
  });
});
