import { Component } from 'react'
import { Link } from 'react-router-dom'
import Button from './Button.jsx'

/**
 * Catches render errors so a single bad event payload (e.g. an admin
 * pricing edit that produces a downstream NaN) shows a recovery card
 * instead of a blank white page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Something went wrong loading this page
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          The event data couldn&rsquo;t be rendered. This is usually a
          temporary issue — try again, or head back home.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="secondary" type="button" onClick={this.handleReset}>
            Try again
          </Button>
          <Link to="/">
            <Button type="button">Back to home</Button>
          </Link>
        </div>
      </div>
    )
  }
}
