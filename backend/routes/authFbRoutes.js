import express from "express";
import { facebookLogin } from "../controllers/authFbController.js";

const router = express.Router();

router.post("/facebook-login", facebookLogin);

export default router;
