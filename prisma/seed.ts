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

  // 4. Create 50 Mock Goals
  console.log('⏳ Generating 50 goals...');
  const goalTitles = ['Expansion', 'Migration', 'Optimization', 'Security Audit', 'User Research', 'Brand Refresh', 'API V2', 'Performance Boost'];
  for (let i = 1; i <= 50; i++) {
    const title = `${goalTitles[i % goalTitles.length]} Phase ${i}`;
    await prisma.goal.create({
      data: {
        title,
        description: `High-level objective for ${title.toLowerCase()}. Goal number ${i}.`,
        status: i % 4 === 0 ? GoalStatus.COMPLETED : i % 3 === 0 ? GoalStatus.AT_RISK : GoalStatus.IN_PROGRESS,
        progress: i % 4 === 0 ? 100 : Math.floor(Math.random() * 90),
        dueDate: new Date(new Date().setDate(new Date().getDate() + (i * 2))),
        workspaceId: workspace.id,
        ownerId: user.id,
        assigneeId: user.id,
      },
    });
  }

  // 5. Create 150 Mock Tasks
  console.log('⏳ Generating 150 tasks...');
  const taskTitles = ['Fix issue', 'Develop feature', 'Review PR', 'Update docs', 'Refactor module', 'Test suite', 'Client meeting', 'UI Polish'];
  const statuses = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
  const priorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT];
  
  for (let i = 1; i <= 150; i++) {
    await prisma.task.create({
      data: {
        title: `${taskTitles[i % taskTitles.length]} #${i}`,
        description: `Detailed sub-task for project execution. Sequence id: ${i}`,
        status: statuses[i % 3],
        priority: priorities[i % 4],
        dueDate: new Date(new Date().setDate(new Date().getDate() + (i % 30))),
        workspaceId: workspace.id,
        creatorId: user.id,
        assigneeId: user.id,
      },
    });
  }

  // 6. Create 20 Mock Announcements
  console.log('⏳ Generating 20 announcements...');
  for (let i = 1; i <= 20; i++) {
    await prisma.announcement.create({
      data: {
        title: `Internal Update #${i}`,
        content: `This is an automated announcement for testing workspace feed scroll and performance. ID: ${i}`,
        isPinned: i <= 3,
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
