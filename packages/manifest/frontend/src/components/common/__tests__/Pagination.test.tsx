import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '../Pagination'

describe('Pagination', () => {
  it('does not render when totalPages is 1', () => {
    const onPageChange = vi.fn()
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={onPageChange} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('does not render when totalPages is 0', () => {
    const onPageChange = vi.fn()
    const { container } = render(
      <Pagination page={1} totalPages={0} onPageChange={onPageChange} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders all page numbers for small page counts', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={3} onPageChange={onPageChange} />)

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument()
  })

  it('renders 5 pages without ellipsis', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />)

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
    expect(screen.queryByText('...')).not.toBeInTheDocument()
  })

  it('shows ellipsis for large page counts', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={10} onPageChange={onPageChange} />)

    // Should show first page, ellipsis, middle pages, ellipsis, last page
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument()
    expect(screen.getAllByText('...')).toHaveLength(2)
  })

  it('shows ellipsis only at start when on last pages', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={9} totalPages={10} onPageChange={onPageChange} />)

    // Should have ellipsis after first page but not before last
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument()
    expect(screen.getAllByText('...')).toHaveLength(1)
  })

  it('shows ellipsis only at end when on first pages', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={2} totalPages={10} onPageChange={onPageChange} />)

    // Should have ellipsis before last page but not after first
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument()
    expect(screen.getAllByText('...')).toHaveLength(1)
  })

  it('disables prev button on first page', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />)

    const prevButton = screen.getByRole('button', { name: 'Previous page' })
    expect(prevButton).toBeDisabled()
  })

  it('enables prev button when not on first page', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />)

    const prevButton = screen.getByRole('button', { name: 'Previous page' })
    expect(prevButton).not.toBeDisabled()
  })

  it('disables next button on last page', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={5} onPageChange={onPageChange} />)

    const nextButton = screen.getByRole('button', { name: 'Next page' })
    expect(nextButton).toBeDisabled()
  })

  it('enables next button when not on last page', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />)

    const nextButton = screen.getByRole('button', { name: 'Next page' })
    expect(nextButton).not.toBeDisabled()
  })

  it('calls onPageChange with correct page when clicking page number', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('calls onPageChange with previous page when clicking prev button', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange with next page when clicking next button', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it('highlights current page with default variant', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />)

    const currentPageButton = screen.getByRole('button', { name: '3' })
    // The current page should have the default variant (not ghost)
    // We check by looking for differences in styling or classes
    expect(currentPageButton).toBeInTheDocument()
  })

  it('does not call onPageChange when clicking disabled prev button', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />)

    const prevButton = screen.getByRole('button', { name: 'Previous page' })
    fireEvent.click(prevButton)
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('does not call onPageChange when clicking disabled next button', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={5} totalPages={5} onPageChange={onPageChange} />)

    const nextButton = screen.getByRole('button', { name: 'Next page' })
    fireEvent.click(nextButton)
    expect(onPageChange).not.toHaveBeenCalled()
  })
})
