// import Order from '../models/importModel.js';
// import XLSX from 'xlsx';

// export const importOrders = async (req, res) => {
//     const { orders } = req.body;  // orders coming from the frontend Excel import
  
//     // Transform and validate orders as needed (see previous examples)
  
//     try {
//       await Order.insertMany(orders); // or transformedOrders if you're mapping fields
//       return res.status(200).json({
//         success: true,
//         message: 'Orders imported successfully!'
//       });
//     } catch (error) {
//       console.error(error);
//       return res.status(500).json({
//         success: false,
//         message: 'Failed to import orders',
//         error: error.message
//       });
//     }
//   };

// export const exportOrders = async (req, res) => {
//   try {
//     // Fetch all orders from the database
//     const orders = await Order.find();
    
//     // Convert orders data into a format suitable for Excel
//     const ordersData = orders.map(order => {
//       return order.items.map(item => ({
//         OrderID: order._id,
//         Amount: order.amount,
//         Status: order.status,
//         Product: item.name,
//         Quantity: item.quantity,
//         Date: new Date(order.date).toLocaleDateString(),
//       }));
//     }).flat();

//     // Convert the orders data to an Excel sheet
//     const worksheet = XLSX.utils.json_to_sheet(ordersData);
//     const workbook = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

//     // Generate a file and send it as a response
//     const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');
//     res.send(excelBuffer);

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Failed to export orders', error });
//   }
// };
