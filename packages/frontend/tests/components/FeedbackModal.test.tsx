import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import FeedbackModal, { FEEDBACK_TAGS } from '../../src/components/FeedbackModal';

describe('FeedbackModal', () => {
  it('does not render when closed', () => {
    const { container } = render(() => (
      <FeedbackModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} />
    ));
    expect(container.querySelector('.modal-backdrop')).toBeNull();
  });

  it('renders when open', () => {
    const { container } = render(() => (
      <FeedbackModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    ));
    expect(container.querySelector('.modal-backdrop')).not.toBeNull();
    expect(container.querySelector('.modal')).not.toBeNull();
  });

  it('renders all feedback tags', () => {
    const { container } = render(() => (
      <FeedbackModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    ));
    const tags = container.querySelectorAll('.feedback-tag');
    expect(tags.length).toBe(FEEDBACK_TAGS.length);
    for (let i = 0; i < FEEDBACK_TAGS.length; i++) {
      expect(tags[i]!.textContent).toBe(FEEDBACK_TAGS[i]);
    }
  });

  it('toggles tag selection on click', () => {
    const { container } = render(() => (
      <FeedbackModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    ));
    const tag = container.querySelector('.feedback-tag') as HTMLElement;
    expect(tag.classList.contains('feedback-tag--selected')).toBe(false);
    fireEvent.click(tag);
    expect(tag.classList.contains('feedback-tag--selected')).toBe(true);
    fireEvent.click(tag);
    expect(tag.classList.contains('feedback-tag--selected')).toBe(false);
  });

  it('calls onSubmit with selected tags and details', () => {
    const onSubmit = vi.fn();
    const { container } = render(() => (
      <FeedbackModal open={true} onClose={vi.fn()} onSubmit={onSubmit} />
    ));
    const tags = container.querySelectorAll('.feedback-tag');
    fireEvent.click(tags[0]!);
    fireEvent.click(tags[2]!);

    const textarea = container.querySelector('.feedback-modal__textarea') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'test details' } });

    const submitBtn = container.querySelector('.btn--primary') as HTMLElement;
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      [FEEDBACK_TAGS[0], FEEDBACK_TAGS[2]],
      'test details',
    );
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <FeedbackModal open={true} onClose={onClose} onSubmit={vi.fn()} />
    ));
    const closeBtn = container.querySelector('.modal__close') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <FeedbackModal open={true} onClose={onClose} onSubmit={vi.fn()} />
    ));
    const backdrop = container.querySelector('.modal-backdrop') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking modal content', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <FeedbackModal open={true} onClose={onClose} onSubmit={vi.fn()} />
    ));
    const modal = container.querySelector('.modal') as HTMLElement;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(() => <FeedbackModal open={true} onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('resets state after submit', () => {
    const onSubmit = vi.fn();
    const { container } = render(() => (
      <FeedbackModal open={true} onClose={vi.fn()} onSubmit={onSubmit} />
    ));
    const tag = container.querySelector('.feedback-tag') as HTMLElement;
    fireEvent.click(tag);
    expect(tag.classList.contains('feedback-tag--selected')).toBe(true);

    const submitBtn = container.querySelector('.btn--primary') as HTMLElement;
    fireEvent.click(submitBtn);

    // After submit, tags should be deselected
    expect(tag.classList.contains('feedback-tag--selected')).toBe(false);
  });

  it('renders textarea with placeholder', () => {
    const { container } = render(() => (
      <FeedbackModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    ));
    const textarea = container.querySelector('.feedback-modal__textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.placeholder).toBe('Share details (optional)');
  });
});
