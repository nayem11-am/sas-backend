const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    const titlesToDelete = ["Finalize UI Mockups", "API Integration", "Setup CI/CD Pipeline"];
    const deleted = await prisma.task.deleteMany({
      where: {
        title: { in: titlesToDelete }
      }
    });
    console.log(`Deleted ${deleted.count} auto-generated tasks.`);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
