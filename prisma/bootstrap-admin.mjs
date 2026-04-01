import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "./password-utils.mjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required");
  }

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      passwordHash: hashPassword(password),
      role: UserRole.PROFESSOR,
    },
    create: {
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      role: UserRole.PROFESSOR,
    },
  });

  console.log(`bootstrap professor ready: ${user.email}`);
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
