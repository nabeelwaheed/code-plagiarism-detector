import { PrismaClient, AssignmentLanguage, UserRole } from "@prisma/client";
import { hashPassword } from "./password-utils.mjs";

const prisma = new PrismaClient();

async function main() {
  const professor = await prisma.user.upsert({
    where: { email: "professor@example.com" },
    update: {
      passwordHash: hashPassword("professor123"),
      role: UserRole.PROFESSOR,
    },
    create: {
      email: "professor@example.com",
      passwordHash: hashPassword("professor123"),
      role: UserRole.PROFESSOR,
    },
  });

  const assignment = await prisma.assignment.upsert({
    where: { id: "demo-assignment" },
    update: {
      title: "Demo Assignment",
      language: AssignmentLanguage.JAVA,
      professorId: professor.id,
    },
    create: {
      id: "demo-assignment",
      title: "Demo Assignment",
      language: AssignmentLanguage.JAVA,
      professorId: professor.id,
    },
  });

  await prisma.assignmentKey.upsert({
    where: { publicKey: "demo-key-1234" },
    update: {
      assignmentId: assignment.id,
      isActive: true,
    },
    create: {
      publicKey: "demo-key-1234",
      assignmentId: assignment.id,
      isActive: true,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
