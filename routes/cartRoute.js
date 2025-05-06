import express from 'express';
import { addToCart,getUserCart,updateCart,clearCart } from '../controllers/cartController.js';
import authUser from '../middleware/auth.js';


const cartRouter = express.Router();

cartRouter.post('/get', authUser, (req, res, next) => {
    console.log("🚀 GET CART route hit");
    next();
}, getUserCart);

cartRouter.post('/add', authUser, (req, res, next) => {
    console.log("🚀 ADD TO CART route hit");
    next();
}, addToCart);

cartRouter.post('/update', authUser, (req, res, next) => {
    console.log("🚀 UPDATE CART route hit");
    next();
}, updateCart);

cartRouter.delete('/clear', authUser, (req, res, next) => {
    console.log("🚀 CLEAR CART route hit");
    next();
}, clearCart);


export default cartRouter;