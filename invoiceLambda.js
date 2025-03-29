const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit');
const { getUserPurchases, calculateDiscount, generateDiscountCode } = require('./utils');

if (process.env.NODE_ENV === 'development') {
    AWS.S3.prototype.putObject = function (params) {
        const outputPath = path.join(__dirname, 's3-mock', params.Key);
        const dir = path.dirname(outputPath);
    
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
        return {
          promise: async () => {
            fs.writeFileSync(outputPath, params.Body);
            console.log(`[MOCK] File written locally to: ${outputPath}`);
          }
        };
      };
}
const s3 = new AWS.S3();

module.exports.generateInvoiceHandler = async (event) => {
const body = typeof event.body === 'string'
    ? JSON.parse(event.body)
    : event;
  const userId = body.userId || 'unknown';
  const purchases = getUserPurchases(userId);
  const discount = calculateDiscount(purchases);
  const discountCode = generateDiscountCode();
  const totalPrice = purchases.reduce((sum, p) => sum + p.price, 0);
  const discountedPrice = totalPrice * (1 - discount / 100);

  const doc = new PDFDocument();
  const fileName = `invoices/${userId}.pdf`;
  const buffers = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', async () => {
    const pdfData = Buffer.concat(buffers);
    await s3.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: fileName,
      Body: pdfData,
      ContentType: 'application/pdf',
    }).promise();
  });

  doc.fontSize(16).text(`Invoice for User ID: ${userId}`);
  doc.moveDown();
  purchases.forEach(p => doc.text(`Product: ${p.product}, Price: $${p.price.toFixed(2)}`));
  doc.moveDown();
  doc.text(`Total Price: $${totalPrice.toFixed(2)}`);
  doc.text(`Discount: ${discount}%`);
  doc.text(`Final Price after discount: $${discountedPrice.toFixed(2)}`);
  doc.text(`Discount Code: ${discountCode}`);
  doc.end();

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Invoice generated', discountCode }),
  };
};
