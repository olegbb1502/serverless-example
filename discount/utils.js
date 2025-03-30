// utils.js

// Симуляція покупок за останній тиждень
function getUserPurchases(userId) {
    return [
      { product: 'T-shirt', price: 25 },
      { product: 'Sneakers', price: 80 },
      { product: 'Backpack', price: 40 },
    ];
  }
  
  // Проста знижка залежно від кількості покупок
  function calculateDiscount(purchases) {
    const total = purchases.length;
    return total > 10 ? 30 : total > 5 ? 20 : 10;
  }
  
  // Унікальний 6-значний код знижки
  function generateDiscountCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  module.exports = {
    getUserPurchases,
    calculateDiscount,
    generateDiscountCode,
  };
  