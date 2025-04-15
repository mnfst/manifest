import './App.css'
import Manifest from '../../src/Manifest'
import { useEffect } from 'react'

export function App() {
  const manifest = new Manifest('http://localhost:1111')

  useEffect(() => {
    manifest
      .from('cats')
      .with(['owner'])
      .findOneById(1)
      .then((res) => {
        console.log(res)
      })
  }, [])

  return (
    <>
      <h1>React Sandbox app</h1>
      <p>
        Edit <code>src/App.tsx</code> to get test Manifest SDK integration in a
        React app.
      </p>
    </>
  )
}
