// Demo data for Social category components
// This file contains sample data used for component previews and documentation

export const demoXPost = {
  author: 'Elon Musk',
  username: 'elonmusk',
  avatar: 'https://i.pravatar.cc/150?u=elon',
  verified: true,
  content: 'The future of AI is here!',
  time: '2h',
  likes: '42K',
  retweets: '8.5K',
  replies: '3.2K',
  views: '45.2K',
}

export const demoInstagramPost = {
  author: 'National Geographic',
  avatar: 'https://i.pravatar.cc/150?u=natgeo',
  verified: true,
  image:
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  caption: 'Nature at its finest',
  likes: '125K',
  time: '2h',
}

export const demoLinkedInPost = {
  author: 'Satya Nadella',
  headline: 'CEO at Microsoft',
  avatar: 'S',
  content: 'Excited to announce our latest AI innovations...',
  time: '1d',
  reactions: '15K',
  topReactions: ['like', 'celebrate', 'love'] as ('like' | 'celebrate' | 'support' | 'love' | 'insightful' | 'funny')[],
  comments: '890',
  reposts: '2.1K',
  postUrl: 'https://linkedin.com/posts/satya',
  repostUrl: 'https://linkedin.com/shareArticle?url=...',
}

export const demoYouTubePost = {
  channel: 'TechTalks',
  avatar: 'https://i.pravatar.cc/150?u=techtalks',
  title: 'Building the Future of AI',
  views: '1.2M',
  time: '3 days ago',
  thumbnail:
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
  duration: '15:42',
}
