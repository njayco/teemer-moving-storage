import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quotesRouter from "./quotes";
import jobsRouter from "./jobs";
import contactRouter from "./contact";
import authRouter from "./auth";
import emailLogsRouter from "./email-logs";
import trackingRouter from "./tracking";
import contractsRouter from "./contracts";
import settingsRouter from "./settings";
import discountCodesRouter from "./discount-codes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(quotesRouter);
router.use(jobsRouter);
router.use(contactRouter);
router.use(emailLogsRouter);
router.use(trackingRouter);
router.use(contractsRouter);
router.use(settingsRouter);
router.use(discountCodesRouter);

export default router;
