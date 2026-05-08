const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting to downgrade old admins...");
  
  // Find all workspace members who are ADMINs
  const admins = await prisma.workspaceMember.findMany({
    where: { role: 'ADMIN' },
    include: { user: true }
  });

  let count = 0;
  for (const admin of admins) {
    if (admin.user.email !== 'admin@saas.com') {
      await prisma.workspaceMember.update({
        where: { id: admin.id },
        data: { role: 'MEMBER' }
      });
      count++;
    }
  }

  console.log(`Successfully downgraded ${count} old admins to MEMBER.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
