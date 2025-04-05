// utils.js

// Симуляція покупок за останній тиждень
function getUserPurchases(userId) {
    return [
      { product: 'T-shirt', price: 25 },
      { product: 'Sneakers', price: 80 },
      { product: 'Backpack', price: 40 },
    ];
  }
  
  module.exports = {
    getUserPurchases
  };
  