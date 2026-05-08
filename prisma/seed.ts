const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Main Admin User
  const hashedPassword = await bcrypt.hash('admin123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@saas.com' },
    update: {},
    create: {
      email: 'admin@saas.com',
      password: hashedPassword,
      fullName: 'System Administrator',
    },
  });

  // 2. Create Main Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'main-workspace' },
    update: {},
    create: {
      name: 'Main Workspace',
      slug: 'main-workspace',
      description: 'Your primary workspace for team collaboration.',
      ownerId: admin.id,
      members: {
        create: {
          userId: admin.id,
          role: 'ADMIN',
        },
      },
    },
  });

  // 3. Create Demo Goals
  const goal1 = await prisma.goal.create({
    data: {
      title: 'Q2 Product Launch',
      description: 'Main product launch for the second quarter.',
      status: 'IN_PROGRESS',
      progress: 65,
      workspaceId: workspace.id,
      ownerId: admin.id,
    },
  });

  const goal2 = await prisma.goal.create({
    data: {
      title: 'Mobile App Redesign',
      description: 'Update the UI/UX for the mobile application.',
      status: 'AT_RISK',
      progress: 30,
      workspaceId: workspace.id,
      ownerId: admin.id,
    },
  });

  // 4. Create Demo Tasks
  await prisma.task.createMany({
    data: [
      {
        title: 'Finalize UI Mockups',
        status: 'DONE',
        priority: 'HIGH',
        workspaceId: workspace.id,
        goalId: goal1.id,
        creatorId: admin.id,
      },
      {
        title: 'API Integration',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        workspaceId: workspace.id,
        goalId: goal1.id,
        creatorId: admin.id,
      },
      {
        title: 'Setup CI/CD Pipeline',
        status: 'TODO',
        priority: 'MEDIUM',
        workspaceId: workspace.id,
        creatorId: admin.id,
      },
    ],
  });

  // 5. Create Demo Announcements
  await prisma.announcement.create({
    data: {
      title: 'Welcome to the new Platform!',
      content: 'We have successfully migrated to our custom Express & Prisma backend. Enjoy the new real-time features!',
      isPinned: true,
      workspaceId: workspace.id,
      authorId: admin.id,
    },
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
