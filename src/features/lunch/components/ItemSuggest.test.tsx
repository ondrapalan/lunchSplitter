import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { darkTheme } from '~/features/ui/theme'
import { ItemSuggest } from './ItemSuggest'

function renderItemSuggest(autoFocus?: boolean) {
  render(
    <ThemeProvider theme={darkTheme}>
      <ItemSuggest
        value=""
        onChange={() => {}}
        onSelect={() => {}}
        suggestions={[{ name: 'Kure', price: 145 }]}
        placeholder="Item name"
        autoFocus={autoFocus}
      />
    </ThemeProvider>,
  )
  return screen.getByPlaceholderText('Item name')
}

describe('ItemSuggest', () => {
  it('focuses its input on mount when autoFocus is set', () => {
    expect(renderItemSuggest(true)).toHaveFocus()
  })

  it('leaves focus alone when autoFocus is not set', () => {
    expect(renderItemSuggest()).not.toHaveFocus()
  })

  it('shows no suggestion dropdown when autofocused with an empty value', () => {
    renderItemSuggest(true)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
