import express from "express";
import { getNavbarLinks, toggleNavbarLink, addNavbarLink } from "../controllers/NavbarController.js";

const router = express.Router();

router.get("/", getNavbarLinks);
router.put("/:id/toggle", toggleNavbarLink);
router.post("/add", addNavbarLink);

export default router;
