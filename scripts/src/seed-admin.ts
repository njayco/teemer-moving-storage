import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seedAdmin() {
  const email = "admin@teemer.com";
  const password = process.env.ADMIN_PASSWORD || "TeemerAdmin2024!";

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Admin user '${email}' already exists (id=${existing[0].id}). Skipping.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(usersTable)
    .values({
      name: "Admin",
      email,
      passwordHash,
      role: "admin",
    })
    .returning();

  console.log(`Created admin user: ${user.email} (id=${user.id})`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
