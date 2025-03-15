import express from "express";
import authUser from "../middleware/auth.js"; // Ensure authUser extracts req.userId
import User from "../models/userModel.js";

const router = express.Router();

// ✅ GET: Fetch user profile
router.get("/profile", authUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password"); // Exclude password

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PUT: Update user profile
router.put("/profile", authUser, async (req, res) => {
  try {
    console.log("Incoming Request Body:", req.body); // ✅ Log request data
    console.log("Received Region:", req.body.region); // ✅ Check if region is included

    const { firstName, lastName, email, phone, street, barangay, city, province, region, postalCode } = req.body;

    let user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    console.log("Before Update Region:", user.region); // ✅ Log existing region before update

    // ✅ Update only if provided
    user.firstName = firstName ?? user.firstName;
    user.lastName = lastName ?? user.lastName;
    user.email = email ?? user.email;
    user.phone = phone ?? user.phone;
    user.street = street ?? user.street;
    user.barangay = barangay ?? user.barangay;
    user.city = city ?? user.city;
    user.province = province ?? user.province;
    user.region = region ?? user.region;
    user.postalCode = postalCode ?? user.postalCode;

    await user.save();

    console.log("Updated User Region:", user.region); // ✅ Log updated region

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});




// ✅ GET: Fetch user details (if different from profile)
router.get("/details", authUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;
