import VoucherAmountModel from "../models/VoucherAmountModel.js";
import UserModel from "../models/userModel.js";

// CREATE SINGLE VOUCHER
export const createVoucherAmount = async (req, res) => {
    try {
        const { code, voucherAmount, expirationDate, minimumPurchase, autoAssign } = req.body;

        const newVoucher = new VoucherAmountModel({
            code,
            voucherAmount,
            expirationDate: expirationDate ? new Date(expirationDate) : null,
            minimumPurchase,
            isActive: true
        });

        await newVoucher.save();

        console.log("✅ New Voucher Created:", newVoucher._id);

        if (autoAssign) {
            const updateResult = await UserModel.updateMany(
                {},
                { $push: { claimedVouchers: newVoucher._id } }
            );
            console.log("✅ Users updated:", updateResult);
        }

        res.status(201).json({ 
            message: `Voucher created${autoAssign ? " and assigned to all users!" : "!"}`,
            newVoucher 
        });

    } catch (error) {
        console.error("❌ Error in createVoucherAmount:", error);
        res.status(500).json({ error: error.message });
    }
};

// GET ALL VOUCHERS
export const getVoucherAmounts = async (req, res) => {
    try {
        const vouchers = await VoucherAmountModel.find();
        res.json(vouchers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// UPDATE VOUCHER
export const updateVoucherAmount = async (req, res) => {
    try {
        const { id } = req.params;
        const { voucherAmount, expirationDate, minimumPurchase } = req.body;

        const updatedVoucher = await VoucherAmountModel.findByIdAndUpdate(
            id,
            { voucherAmount, expirationDate, minimumPurchase },
            { new: true }
        );

        res.json(updatedVoucher);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// CREATE MULTIPLE VOUCHERS
export const createMultipleVoucherAmounts = async (req, res) => {
    try {
        const { vouchers } = req.body;

        if (!Array.isArray(vouchers) || vouchers.length === 0) {
            return res.status(400).json({ message: "Invalid vouchers data." });
        }

        const savedVouchers = await VoucherAmountModel.insertMany(vouchers);
        res.status(201).json({ message: `${savedVouchers.length} vouchers created successfully!`, savedVouchers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// DELETE SINGLE VOUCHER
export const deleteVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        await VoucherAmountModel.findByIdAndDelete(id);
        res.json({ message: "Voucher deleted successfully." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// DELETE ALL VOUCHERS
export const deleteAllVouchers = async (req, res) => {
    try {
        await VoucherAmountModel.deleteMany({});
        res.json({ message: "All vouchers deleted successfully." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CLAIM VOUCHER
export const claimVoucher = async (req, res) => {
    try {
        // Try to get userId from authenticated user first, then from body
        const userId = req.user?.id || req.body.userId;
        const voucherId = req.params.id;

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const voucher = await VoucherAmountModel.findById(voucherId);
        if (!voucher) {
            return res.status(404).json({ success: false, message: "Voucher not found" });
        }

        if (!voucher.isActive) {
            return res.status(400).json({ success: false, message: "Voucher is inactive" });
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Check if already claimed (updated to match your schema)
        const alreadyClaimed = user.claimedVouchers.some(v => v.voucher.equals(voucherId));
        if (alreadyClaimed) {
            return res.status(400).json({ success: false, message: "Voucher already claimed" });
        }

        // Add the voucher to user's claimed vouchers
        user.claimedVouchers.push({
            voucher: voucher._id,
            voucherCode: voucher.code,
            voucherAmount: voucher.voucherAmount,
            voucherMinPurchase: voucher.minimumPurchase,
            isActive: true
        });

        await user.save();
        return res.status(200).json({ 
            success: true, 
            message: "Voucher claimed successfully", 
            voucherAmount: voucher.voucherAmount 
        });

    } catch (error) {
        console.error("Error claiming voucher:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};



export const applyVoucher = async (req, res) => {
    try {
        const { code, totalAmount } = req.body;
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: Please log in." });
        }
        if (!code) {
            return res.status(400).json({ success: false, message: "Voucher code is required" });
        }
        if (!totalAmount) {
            return res.status(400).json({ success: false, message: "Total amount is required" });
        }

        const user = await UserModel.findById(userId).populate("claimedVouchers.voucher");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const claimedVoucher = user.claimedVouchers.find(v => v.voucherCode === code);

        if (!claimedVoucher || !claimedVoucher.isActive) {
            return res.status(400).json({ success: false, message: "Voucher is no longer valid." });
        }

        const voucher = claimedVoucher.voucher;

        // Check if the voucher is expired
        if (voucher.expirationDate && new Date(voucher.expirationDate) < new Date()) {
            return res.status(400).json({ success: false, message: "Voucher has expired" });
        }

        // Ensure minimum purchase requirement
        if (totalAmount < voucher.minimumPurchase) {
            return res.status(400).json({
                success: false,
                message: `This voucher requires a minimum purchase of ₱${voucher.minimumPurchase}`,
                minimumRequired: voucher.minimumPurchase,
                givenAmount: totalAmount
            });
        }

        // Calculate the discount after applying the voucher
        const discountedAmount = totalAmount - voucher.voucherAmount;

        // Send successful response with the discount details
        return res.json({
            success: true,
            voucherAmount: voucher.voucherAmount,
            discountedAmount: discountedAmount,
            voucherCode: code,
            voucher
        });

    } catch (error) {
        console.error("❌ Error applying voucher:", error);
        return res.status(500).json({ success: false, message: "Error applying voucher" });
    }
};



export const getUserClaimedVouchers = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log("🔍 Fetching claimed vouchers for user:", userId);

        const user = await UserModel.findById(userId);

        if (!user) {
            console.log("❌ User not found.");
            return res.status(404).json({ message: "User not found." });
        }

        console.log("✅ User found:", user._id);

        // ✅ Return only the voucher IDs
        const claimedVoucherIds = user.claimedVouchers.map(cv => cv.voucher.toString());

        console.log("🎟️ Claimed Voucher IDs:", claimedVoucherIds);

        res.json(claimedVoucherIds); // Send only the claimed voucher IDs
    } catch (error) {
        console.error("❌ Error fetching claimed vouchers:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

export const getUserClaimedVouchers1 = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log("🔍 Fetching claimed vouchers for user:", userId);

        const user = await UserModel.findById(userId);

        if (!user) {
            console.log("❌ User not found.");
            return res.status(404).json({ message: "User not found." });
        }

        console.log("✅ User found:", user._id);

        // ✅ Return the full claimed vouchers array
        res.json(user.claimedVouchers);
    } catch (error) {
        console.error("❌ Error fetching claimed vouchers:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};


// VoucherAmountController.js

export const disableVoucherForUser = async (userId, voucherCode) => {
    try {
        console.log(`🛑 Attempting to disable voucher: ${voucherCode} for user: ${userId}`);

        const user = await UserModel.findById(userId);
        if (!user) {
            console.error(`❌ User not found: ${userId}`);
            return false;
        }

        console.log("📌 Current claimed vouchers:", user.claimedVouchers);

        let updated = false;
        user.claimedVouchers = user.claimedVouchers.map(voucher => {
            console.log(`🔍 Checking voucher: ${voucher.voucherCode} (Active: ${voucher.isActive})`);
            
            if (voucher.voucherCode === voucherCode && voucher.isActive) {
                console.log(`✅ Disabling voucher: ${voucherCode}`);
                voucher.isActive = false;
                updated = true;
            }
            return voucher;
        });

        console.log("📌 Updated claimed vouchers:", user.claimedVouchers);

        if (updated) {
            user.markModified("claimedVouchers"); // ✅ Important step to mark the field as modified
            await user.save(); // ✅ Save the changes to MongoDB
            console.log(`✅ Voucher ${voucherCode} successfully disabled.`);
            return true;
        } else {
            console.warn(`⚠️ Voucher ${voucherCode} was not found or already disabled.`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error disabling voucher: ${error.message}`);
        return false;
    }
};
