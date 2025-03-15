import express from "express";
import { 
    createVoucherAmount,
    getVoucherAmounts,
    updateVoucherAmount,
    createMultipleVoucherAmounts,
    deleteVoucher,
    deleteAllVouchers,
    claimVoucher,
    applyVoucher,
    getUserClaimedVouchers, 
} from "../controllers/VoucherAmountController.js";
import authUser from "../middleware/adminAuth.js";
const router = express.Router();

router.post("/", createVoucherAmount);
router.get("/", getVoucherAmounts);
router.put("/:id", updateVoucherAmount);
router.post("/bulk", createMultipleVoucherAmounts);
router.delete("/:id", deleteVoucher);
router.delete("/", deleteAllVouchers);
router.post("/claim/:id", authUser,claimVoucher);
router.post("/apply",authUser, applyVoucher); // ✅ Dapat meron ito
console.log("✅ Apply Voucher Route Hit!");

router.get("/claimed-vouchers", authUser, getUserClaimedVouchers);
export default router;
