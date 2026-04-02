import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

interface SeedUser {
  email: string;
  name: string;
  password: string;
  role: "admin" | "move_captain";
}

const SEED_USERS: SeedUser[] = [
  {
    email: "alan@teemermoving.com",
    name: "Alan",
    password: "Teemer123!",
    role: "admin",
  },
  {
    email: "info@teemermoving.com",
    name: "Teemer Captain",
    password: "Alan123!",
    role: "move_captain",
  },
];

export async function seedAdmin(): Promise<void> {
  for (const user of SEED_USERS) {
    try {
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, user.email))
        .limit(1);

      if (existing) {
        logger.info({ email: user.email }, "User already exists, skipping seed");
        continue;
      }

      const passwordHash = await hashPassword(user.password);
      await db.insert(usersTable).values({
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
      });

      logger.info({ email: user.email, role: user.role }, "User seeded successfully");
    } catch (err) {
      logger.error({ err, email: user.email }, "Failed to seed user");
    }
  }
}
