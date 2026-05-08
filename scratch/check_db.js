const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTasks() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        assignee: true,
      }
    });
    console.log('--- ALL TASKS ---');
    tasks.forEach(t => {
      console.log(`Task: ${t.title}, Assignee: ${t.assignee?.fullName || 'Unassigned'}, AssigneeID: ${t.assigneeId}`);
    });

    const users = await prisma.user.findMany();
    console.log('\n--- ALL USERS ---');
    users.forEach(u => {
      console.log(`User: ${u.fullName}, Email: ${u.email}, ID: ${u.id}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkTasks();
