import React from 'react'
import { Link } from 'react-router-dom'

const posts = [
  {
    id: 1,
    title: 'My First Post',
    content: 'This is the content of my first post.'
  },
  {
    id: 2,
    title: 'My Second Post',
    content: 'This is the content of my second post.'
  }
  // Add more posts here
]

function BlogList() {
  return (
    <div>
      <h1 className="font-bold text-2xl mb-4">Blog Posts</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.id} className="mb-2">
            <Link
              to={`/post/${post.id}`}
              className="text-blue-500 hover:underline"
            >
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default BlogList
