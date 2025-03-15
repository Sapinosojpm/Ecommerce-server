import userModel from "../models/userModel.js";

// add products to user cart
const addToCart = async (req, res) => {
    try {
        const{userId,itemId}= req.body;

        const userData = await userModel.findById(userId)
        let cartData = await userData.cartData;

        if(cartData[itemId]){
            if(cartData[itemId]){
                (cartData[itemId])+=1
            }
            else{
                cartData[itemId]=1
            }
        }else{
            cartData[itemId]={}
            cartData[itemId]=1
        }

        await userModel.findByIdAndUpdate(userId,{cartData})
        res.json({success:true, message:"Item added to cart"})

    } catch (error) {
        console.log(error);
        res.json({success:false, message:error.message})
    }
    

}


// update user cart
const updateCart = async (req, res) => {
    try {
        
        const {userId, itemId, size, quantity} = req.body;

        const userData = await userModel.findById(userId)
        let cartData = await userData.cartData;

        cartData[itemId] = quantity

        await userModel.findByIdAndUpdate(userId,{cartData})
        res.json({success:true, message:"Cart updated"})



    } catch (error) {
        console.log(error);
        res.json({success:false, message:error.message})
    }
}

// get user cart
const getUserCart = async (req, res) => {

    try {
        
        const {userId} = req.body;
        
        const userData = await userModel.findById(userId)
        let cartData = await userData.cartData;

        res.json({success:true, cartData})

    } catch (error) {
        console.log(error);
        res.json({success:false, message:error.message})
    }
}

// Clear user cart
const clearCart = async (req, res) => {
    try {
        const userId = req.body.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User ID missing" });
        }

        // ✅ Fix: Set `cartData` to an empty array `[]` instead of `{}`
        await userModel.findByIdAndUpdate(userId, { $set: { cartData: [] } });

        res.json({ success: true, message: "Cart cleared successfully" });
    } catch (error) {
        console.error("Error clearing cart:", error);
        res.status(500).json({ success: false, message: "Failed to clear cart." });
    }
};



export { addToCart, updateCart, getUserCart, clearCart }