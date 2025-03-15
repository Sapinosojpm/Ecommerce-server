import Order from "../models/orderModel.js";

// Convert Excel Serial Date to JS Date
const convertExcelDate = (serial) => {
    const excelEpoch = new Date(1899, 11, 30); // Excel date system starts on Dec 30, 1899
    return new Date(excelEpoch.getTime() + serial * 86400000); // Add days in milliseconds
};

// Import orders from an Excel file
export const importOrders = async (req, res) => {
    try {
        const { orders } = req.body;

        const validatedOrders = orders.map(order => {
            let convertedDate;

            if (typeof order.date === "number" && order.date > 40000) {
                // It's an Excel serial date
                convertedDate = convertExcelDate(order.date);
            } else if (typeof order.date === "string" && order.date.includes("/")) {
                // It's in MM/DD/YYYY format
                const [month, day, year] = order.date.split("/").map(num => parseInt(num, 10));
                convertedDate = new Date(year, month - 1, day);
            } else {
                // Fallback to JS date parsing
                convertedDate = new Date(order.date);
            }

            if (isNaN(convertedDate.getTime())) {
                console.warn(`Invalid date detected: ${order.date} - Using current date.`);
                convertedDate = new Date();
            }

            console.log(`Original Date: ${order.date}, Converted Date: ${convertedDate.toISOString()}`);

            return {
                // userId: order.userId || "default-user-id",
                customerName: order.customerName || "Unknown",
                items: order.items || [],
                amount: Number(order.amount) || 0,
                status: order.status || "Order Placed",
                date: convertedDate, // Save the corrected date
                address: order.address || "Unknown Address",
                paymentMethod: order.paymentMethod || "Unknown",
                payment: order.payment || false,
            };
        });

        await Order.insertMany(validatedOrders);
        res.json({ success: true, message: "Orders imported successfully!" });
    } catch (error) {
        console.error("Error importing orders:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
