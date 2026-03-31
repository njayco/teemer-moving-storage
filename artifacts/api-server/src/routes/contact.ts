import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable } from "@workspace/db/schema";
import { sendContactNotificationEmail } from "../lib/email-service";

const router: IRouter = Router();

router.post("/contact", async (req, res) => {
  try {
    const body = req.body;
    await db.insert(contactsTable).values({
      name: body.name,
      phone: body.phone,
      email: body.email,
      moveDate: body.moveDate,
      moveType: body.moveType,
      origin: body.origin,
      destination: body.destination,
      message: body.message,
    });

    sendContactNotificationEmail({
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message || "",
    }).catch((err) => {
      req.log.error({ err }, "Failed to send contact notification email");
    });

    res.status(201).json({
      success: true,
      message: "Thank you for reaching out! We'll get back to you within 24 hours.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to submit contact form");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
