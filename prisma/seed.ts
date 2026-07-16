import { PrismaClient, SystemRole, UserType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("kama@0507", 10);

  const user = await prisma.user.upsert({
    where: { email: "kamilatleugali7@gmail.com" },
    update: {},
    create: {
      email: "kamilatleugali7@gmail.com",
      fullName: "Камила Тлеугали",
      passwordHash,
      systemRole: SystemRole.РУКОВОДИТЕЛЬ,
      userType: UserType.ШТАТНЫЙ,
    },
  });

  console.log("Создан пользователь:", user.email, user.systemRole);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
