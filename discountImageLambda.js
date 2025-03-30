const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const { createCanvas } = require('canvas');
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

module.exports.generateDiscountImageHandler = async (event) => {
const body = typeof event.body === 'string'
    ? JSON.parse(event.body)
    : event;
  const userId = body.userId || 'unknown';
  const purchases = getUserPurchases(userId);
  const discount = calculateDiscount(purchases);
  const discountCode = generateDiscountCode();

  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f9f9f9';
  ctx.fillRect(0, 0, 800, 400);

  ctx.fillStyle = '#333';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(`Hello, User ${userId}`, 50, 100);
  ctx.fillText(`Your Discount: ${discount}%`, 50, 180);
  ctx.fillText(`Code: ${discountCode}`, 50, 260);

  const buffer = canvas.toBuffer('image/png');

  await s3.putObject({
    Bucket: process.env.S3_BUCKET,
    Key: `discounts/${userId}.png`,
    Body: buffer,
    ContentType: 'image/png',
  }).promise();

  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION || 'us-east-1';
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Discount generated', url: `https://${bucket}.s3.${region}.amazonaws.com/discounts/${userId}.png` }),
  };
};
