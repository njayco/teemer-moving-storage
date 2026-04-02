import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const ADMIN_EMAIL = "alan@teemermoving.com";
const ADMIN_NAME = "Alan";
const ADMIN_PASSWORD = "Teemer123!";

export async function seedAdmin(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, ADMIN_EMAIL))
      .limit(1);

    if (existing) {
      logger.info("Admin user already exists, skipping seed");
      return;
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    await db.insert(usersTable).values({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
    });

    logger.info({ email: ADMIN_EMAIL }, "Admin user seeded successfully");
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
