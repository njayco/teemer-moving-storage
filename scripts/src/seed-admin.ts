import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

interface UserSeed {
  name: string;
  email: string;
  role: string;
  passwordEnvVar: string;
}

const USERS_TO_SEED: UserSeed[] = [
  {
    name: "Alan",
    email: "alan@teemermoving.com",
    role: "admin",
    passwordEnvVar: "ADMIN_PASSWORD",
  },
  {
    name: "Teemer Captain",
    email: "info@teemermoving.com",
    role: "move_captain",
    passwordEnvVar: "CAPTAIN_PASSWORD",
  },
];

async function upsertUser(seed: UserSeed) {
  const password = process.env[seed.passwordEnvVar];
  if (!password) {
    console.warn(`⚠ Skipping ${seed.email}: ${seed.passwordEnvVar} secret is not set.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, seed.email))
    .limit(1);

  if (existing) {
    await db
      .update(usersTable)
      .set({ passwordHash, name: seed.name, role: seed.role })
      .where(eq(usersTable.id, existing.id));
    console.log(`✓ Updated ${seed.role} user: ${seed.email} (id=${existing.id})`);
  } else {
    const [user] = await db
      .insert(usersTable)
      .values({
        name: seed.name,
        email: seed.email,
        passwordHash,
        role: seed.role,
      })
      .returning();
    console.log(`✓ Created ${seed.role} user: ${user.email} (id=${user.id})`);
  }
}

async function seedUsers() {
  for (const seed of USERS_TO_SEED) {
    await upsertUser(seed);
  }
  console.log("Done.");
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
