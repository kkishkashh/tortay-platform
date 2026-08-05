import { PrismaClient, SystemRole, UserType } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const EXECUTE = process.argv.includes("--execute");

type Person = {
  fullName: string;
  position: string | null;
  email: string | null;
  password: string | null;
  roleTag: string | null;
  existsInDb: boolean;
  keep: boolean;
};

async function main() {
  const rosterPath = path.join(__dirname, "onboarding-roster.local.json");
  const raw = JSON.parse(fs.readFileSync(rosterPath, "utf-8"));
  const people: Person[] = raw.people;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const person of people) {
    if (!person.keep || !person.email || !person.password) {
      skipped++;
      continue;
    }

    const email = person.email.toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, systemRole: true },
    });

    const passwordHash = await bcrypt.hash(person.password, 10);
    const promoteToAdmin = email === "a.chinibekova@tortay.kz";

    if (existing) {
      console.log(
        `[UPDATE] ${person.fullName} <${existing.email}> — reset password${
          promoteToAdmin && existing.systemRole !== SystemRole.АДМИН
            ? ", promote to АДМИН"
            : ""
        }`,
      );
      if (EXECUTE) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName: person.fullName,
            passwordHash,
            position: person.position ?? undefined,
            ...(promoteToAdmin ? { systemRole: SystemRole.АДМИН } : {}),
          },
        });
      }
      updated++;
    } else {
      console.log(`[CREATE] ${person.fullName} <${email}> — position: ${person.position ?? "—"}`);
      if (EXECUTE) {
        await prisma.user.create({
          data: {
            fullName: person.fullName,
            email,
            passwordHash,
            userType: UserType.ШТАТНЫЙ,
            systemRole: SystemRole.СОТРУДНИК,
            position: person.position ?? null,
            homeDepartmentId: null,
            isActive: true,
          },
        });
      }
      created++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Would create: ${created}`);
  console.log(`Would update (password reset): ${updated}`);
  console.log(`Skipped (not keep / no email-password): ${skipped}`);
  console.log(EXECUTE ? "\nEXECUTED — changes written to the database." : "\nDRY RUN — no changes written. Re-run with --execute to apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
