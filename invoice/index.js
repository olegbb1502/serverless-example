const fs = require('fs');
const path = require('path');
const { S3, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const PDFDocument = require('pdfkit');
const { getUserPurchases, calculateDiscount, generateDiscountCode } = require('./utils');

if (process.env.NODE_ENV === 'development') {
    S3.prototype.send = async function (command) {
      const params = command.input;
      const outputPath = path.join(__dirname, '../s3-mock', params.Key);
      const dir = path.dirname(outputPath);
  
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
      fs.writeFileSync(outputPath, params.Body);
      console.log(`[MOCK] File written locally to: ${outputPath}`);
    };
}
  
const s3 = new S3();

module.exports.handler = async (event) => {
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

  await new Promise((resolve, reject) => {
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', async () => {
      try {
        const pdfData = Buffer.concat(buffers);
        await s3.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: fileName,
          Body: pdfData,
          ContentType: 'application/pdf',
        }));
        console.log('✅ Uploaded to S3');
        resolve();
      } catch (err) {
        console.error('❌ Failed to upload:', err);
        reject(err);
      }
    });
    doc.end();
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

  const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: fileName,
      }),
      { expiresIn: 600 } // 10 хвилин
  );
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Invoice generated', url: signedUrl }),
  };
};
