import { Router } from "express";
import { getCurrentUser } from "../controllers/user-controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const userRouter = Router();

// IMPORTANT: requireAuth MUST be the second parameter
userRouter.get("/me", requireAuth, getCurrentUser);

export default userRouter;