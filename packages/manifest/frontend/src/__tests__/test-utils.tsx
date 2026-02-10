import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withRouter?: boolean
}

export function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { withRouter = false, ...renderOptions } = options

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    if (withRouter) {
      return <BrowserRouter>{children}</BrowserRouter>
    }
    return <>{children}</>
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

export * from '@testing-library/react'
export { customRender as render }
