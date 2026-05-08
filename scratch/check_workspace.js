const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWorkspaceIds() {
  try {
    const tasks = await prisma.task.findMany({
      select: { title: true, workspaceId: true }
    });
    console.log('--- TASKS WORKSPACE IDS ---');
    tasks.forEach(t => console.log(`Task: ${t.title}, WorkspaceID: ${t.workspaceId}`));

    const memberships = await prisma.workspaceMember.findMany({
      include: { user: true }
    });
    console.log('\n--- USER MEMBERSHIPS ---');
    memberships.forEach(m => {
      console.log(`User: ${m.user.fullName}, WorkspaceID: ${m.workspaceId}, Role: ${m.role}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkWorkspaceIds();
