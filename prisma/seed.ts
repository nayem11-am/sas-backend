import { PrismaClient, Role, GoalStatus, TaskStatus, Priority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 0. Cleanup existing mock data to prevent unique constraint errors
  console.log('🧹 Cleaning up old mock data...');
  await prisma.announcement.deleteMany({ where: { workspace: { slug: 'main-workspace' } } });
  await prisma.task.deleteMany({ where: { workspace: { slug: 'main-workspace' } } });
  await prisma.goal.deleteMany({ where: { workspace: { slug: 'main-workspace' } } });

  // 1. Create a demo user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@saas.com' },
    update: {},
    create: {
      email: 'admin@saas.com',
      password: hashedPassword,
      fullName: 'System Administrator',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
    },
  });

  console.log(`✅ User created: ${user.email}`);

  // 2. Create a demo workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'main-workspace' },
    update: {},
    create: {
      name: 'Main Workspace',
      slug: 'main-workspace',
      ownerId: user.id,
      accentColor: '#6366f1',
    },
  });

  console.log(`✅ Workspace created: ${workspace.name}`);

  // 3. Add user as Admin to workspace
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    },
    update: {
      role: Role.ADMIN,
    },
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: Role.ADMIN,
    },
  });

  // 4. Create Mock Goals
  const goals = [
    {
      title: 'Launch SaaS Platform',
      description: 'Complete all critical tasks for the official launch.',
      status: GoalStatus.IN_PROGRESS,
      progress: 65,
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
    },
    {
      title: 'Acquire 100 Early Adopters',
      description: 'Focus on marketing and outreach to get our first users.',
      status: GoalStatus.IN_PROGRESS,
      progress: 20,
      dueDate: new Date(new Date().setDate(new Date().getDate() + 60)),
    },
    {
      title: 'Finalize Pricing Model',
      description: 'Research and set the monthly subscription tiers.',
      status: GoalStatus.COMPLETED,
      progress: 100,
      dueDate: new Date(),
    },
  ];

  for (const goalData of goals) {
    await prisma.goal.create({
      data: {
        ...goalData,
        workspaceId: workspace.id,
        ownerId: user.id,
        assigneeId: user.id,
      },
    });
  }

  console.log('✅ Mock Goals added');

  // 5. Create Mock Tasks
  const tasks = [
    {
      title: 'Fix Sidebar Mobile Lag',
      description: 'The sidebar flickers when opening on mobile devices.',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
    },
    {
      title: 'Implement Dark Mode',
      description: 'Add theme support for dark mode across the platform.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
    },
    {
      title: 'Add Real-time Notifications',
      description: 'Use Socket.io to push alerts to active users.',
      status: TaskStatus.TODO,
      priority: Priority.URGENT,
    },
    {
      title: 'Optimize Database Queries',
      description: 'Ensure the task board loads in under 200ms.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
    },
  ];

  for (const taskData of tasks) {
    await prisma.task.create({
      data: {
        ...taskData,
        workspaceId: workspace.id,
        creatorId: user.id,
        assigneeId: user.id,
      },
    });
  }

  console.log('✅ Mock Tasks added');

  // 6. Create Mock Announcements
  const announcements = [
    {
      title: 'Welcome to the New Platform!',
      content: 'We have officially migrated to our new decoupled architecture. Enjoy the speed!',
      isPinned: true,
    },
    {
      title: 'Server Maintenance',
      content: 'Brief downtime expected this Sunday at 2 AM UTC for database optimization.',
      isPinned: false,
    },
  ];

  for (const annData of announcements) {
    await prisma.announcement.create({
      data: {
        ...annData,
        workspaceId: workspace.id,
        authorId: user.id,
      },
    });
  }

  console.log('✅ Mock Announcements added');

  console.log('🚀 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
