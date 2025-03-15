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
        const { id } = req.params;
        const userId = req.user.id; // Galing sa auth middleware

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Please log in." });
        }

        const voucher = await VoucherAmountModel.findById(id);
        if (!voucher || !voucher.isActive) {
            return res.status(400).json({ message: "Voucher not available." });
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // ❌ Check kung nakuha na niya dati ang voucher
        if (user.claimedVouchers.includes(voucher._id.toString())) {
            return res.status(400).json({ message: "You have already claimed this voucher." });
        }

        // ✅ Add voucher to user's claimedVouchers array
        user.claimedVouchers.push(voucher._id);
        await user.save(); // 🚀 Ensure that it's saved in the database

        res.json({ success: true, message: "Voucher claimed successfully!", claimedVouchers: user.claimedVouchers });

    } catch (error) {
        console.error("❌ Error claiming voucher:", error);
        res.status(500).json({ message: "Error claiming voucher" });
    }
};

export const applyVoucher = async (req, res) => {
    console.log("🔍 applyVoucher function HIT!", req.body);

    try {
        const { code, totalAmount } = req.body;
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Please log in." });
        }
        if (!code) {
            return res.status(400).json({ message: "Voucher code is required" });
        }
        if (!totalAmount) {
            return res.status(400).json({ message: "Total amount is required" });
        }

        console.log("🔍 Received totalAmount:", totalAmount);

        // 🔍 Get user with populated vouchers
        const user = await UserModel.findById(userId).populate({
            path: "claimedVouchers",
            match: { code, isActive: true }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const voucher = user.claimedVouchers[0]; // 🎯 Directly access filtered voucher

        if (!voucher) {
            return res.status(400).json({ message: "Invalid or unclaimed voucher" });
        }

        if (voucher.expirationDate && new Date(voucher.expirationDate) < new Date()) {
            return res.status(400).json({ message: "Voucher expired" });
        }

        if (totalAmount < voucher.minimumPurchase) {
            return res.status(400).json({
                message: `This voucher requires a minimum purchase of ₱${voucher.minimumPurchase}`,
                minimumRequired: voucher.minimumPurchase,
                givenAmount: totalAmount
            });
        }

        console.log("✅ Voucher Applied Successfully:", voucher);
        res.json({ success: true, voucherAmount: voucher.voucherAmount, voucher });

    } catch (error) {
        console.error("❌ Error applying voucher:", error);
        res.status(500).json({ message: "Error applying voucher" });
    }
};


// UserController.js

export const getUserClaimedVouchers = async (req, res) => {
    try {
        const userId = req.user.id; // Get user ID from auth middleware
        const user = await UserModel.findById(userId).populate("claimedVouchers"); // Populate the claimedVouchers array
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json(user.claimedVouchers);
    } catch (error) {
        console.error("Error fetching claimed vouchers:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// VoucherAmountController.js

export const disableVoucherForUser = async (userId, voucherId) => {
    try {
        console.log(`Attempting to disable voucher ${voucherId} for user ${userId}`);

        const user = await UserModel.findById(userId);
        if (!user) {
            console.error(`User ${userId} not found.`);
            return;
        }

        console.log(`User ${userId} found. Claimed vouchers:`, user.claimedVouchers);

        const initialLength = user.claimedVouchers.length;

        user.claimedVouchers = user.claimedVouchers.filter(
            (claimedVoucher) => claimedVoucher.toString() !== voucherId.toString()
        );

        const finalLength = user.claimedVouchers.length;

        if (initialLength === finalLength) {
            console.warn(`Voucher ${voucherId} not found in user's claimed vouchers.`);
        } else {
            console.log(`Voucher ${voucherId} disabled for user ${userId}.`);
        }

        await user.save();

        console.log(`User ${userId} claimed vouchers after disable:`, user.claimedVouchers);

    } catch (error) {
        console.error(`Error disabling voucher ${voucherId} for user ${userId}:`, error);
    }
};