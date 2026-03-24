import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quotesRouter from "./quotes";
import jobsRouter from "./jobs";
import contactRouter from "./contact";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quotesRouter);
router.use(jobsRouter);
router.use(contactRouter);

export default router;
