require('dotenv').config({ path: '../../../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB for seeding...');

  // Clean existing data
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    Comment.deleteMany({}),
  ]);

  // Create users
  const admin = await User.create({
    name: 'Alex Admin',
    email: 'admin@taskflow.com',
    password: 'password123',
    role: 'admin',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  });

  const member1 = await User.create({
    name: 'Sam Developer',
    email: 'sam@taskflow.com',
    password: 'password123',
    role: 'member',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sam',
  });

  const member2 = await User.create({
    name: 'Jordan Designer',
    email: 'jordan@taskflow.com',
    password: 'password123',
    role: 'member',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan',
  });

  // Create projects
  const project1 = await Project.create({
    name: 'TaskFlow Platform',
    description: 'The main product development project',
    owner: admin._id,
    members: [admin._id, member1._id, member2._id],
    color: '#6c63ff',
  });

  const project2 = await Project.create({
    name: 'Marketing Website',
    description: 'Company marketing and landing pages',
    owner: admin._id,
    members: [admin._id, member2._id],
    color: '#ff6584',
  });

  // Create tasks for project1
  const tasks = await Task.insertMany([
    { title: 'Setup authentication system', description: 'Implement JWT-based auth with refresh tokens', project: project1._id, assignee: member1._id, createdBy: admin._id, status: 'done', priority: 'critical', order: 0 },
    { title: 'Design database schema', description: 'Model all entities and relationships in MongoDB', project: project1._id, assignee: member1._id, createdBy: admin._id, status: 'done', priority: 'high', order: 1 },
    { title: 'Build Kanban board UI', description: 'Create drag-and-drop board with React', project: project1._id, assignee: member2._id, createdBy: admin._id, status: 'in_progress', priority: 'high', order: 0 },
    { title: 'Implement file uploads', description: 'Cloudinary integration for task attachments', project: project1._id, assignee: member1._id, createdBy: admin._id, status: 'in_progress', priority: 'medium', order: 1 },
    { title: 'Add comment system', description: 'Allow team members to comment on tasks', project: project1._id, assignee: member2._id, createdBy: admin._id, status: 'in_review', priority: 'medium', order: 0 },
    { title: 'Write unit tests', description: 'Cover auth and task endpoints with Jest', project: project1._id, assignee: null, createdBy: admin._id, status: 'todo', priority: 'low', order: 0 },
    { title: 'Deploy to production', description: 'Setup Vercel + Render deployment pipeline', project: project1._id, assignee: member1._id, createdBy: admin._id, status: 'todo', priority: 'high', order: 1 },
    { title: 'Performance optimization', description: 'Add caching and optimize slow queries', project: project1._id, assignee: null, createdBy: admin._id, status: 'todo', priority: 'medium', order: 2 },
  ]);

  // Add comments
  await Comment.insertMany([
    { content: 'Great work on the auth system! The refresh token rotation is solid.', task: tasks[0]._id, author: admin._id },
    { content: 'Thanks! I also added rate limiting on the auth endpoints.', task: tasks[0]._id, author: member1._id },
    { content: 'The DnD implementation is looking smooth. Almost done.', task: tasks[2]._id, author: member2._id },
    { content: 'Make sure it works on mobile too.', task: tasks[2]._id, author: admin._id },
  ]);

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Demo accounts:');
  console.log('  Admin:  admin@taskflow.com / password123');
  console.log('  Member: sam@taskflow.com   / password123');
  console.log('  Member: jordan@taskflow.com / password123');

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
