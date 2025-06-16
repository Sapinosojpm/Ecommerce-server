import express from "express";
import { facebookLogin, facebookSignup } from "../controllers/authFbController.js";

const router = express.Router();

router.post("/facebook-login", facebookLogin);
router.post("/facebook-signup", facebookSignup);

export default router;
