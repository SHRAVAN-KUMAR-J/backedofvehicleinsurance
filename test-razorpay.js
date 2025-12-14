const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

razorpay.orders.create({
  amount: 50000,
  currency: 'INR',
  receipt: 'test_receipt'
}, (err, order) => {
  if (err) {
    console.error('Razorpay Error:', err);
  } else {
    console.log('Razorpay Test Success:', order);
  }
});