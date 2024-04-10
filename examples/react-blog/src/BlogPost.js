import React from 'react'
import { useParams } from 'react-router-dom'

const posts = [
  {
    id: 1,
    title: 'My First Post',
    content: 'This is the content of my first post.'
  }
  // Your posts here
]

function BlogPost() {
  let { postId } = useParams()
  const post = posts.find((post) => post.id.toString() === postId)

  if (!post) return <div>Post not found!</div>

  return (
    <div>
      <h1 className="font-bold text-2xl mb-4">{post.title}</h1>
      <p>{post.content}</p>
    </div>
  )
}

export default BlogPost
