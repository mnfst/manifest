import React from 'react'
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import BlogList from './BlogList'
import BlogPost from './BlogPost'

function App() {
  return (
    <Router>
      <div className="p-8">
        <Routes>
          <Route exact path="/" element={<BlogList />} />
          <Route path="/post/:postId" element={<BlogPost />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
