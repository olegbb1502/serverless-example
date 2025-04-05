const fs = require('fs');
const path = require('path');
const { S3, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getUserPurchases } = require('./utils.js');

const s3 = new S3();

module.exports.handler = async (event) => {
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
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event;
  const userId = body.userId || 'unknown';

  const purchases = getUserPurchases(userId);

  const csvContent = ['Product,Price']
    .concat(purchases.map(p => `${p.product},${p.price}`))
    .join('\n');

  const fileName = `purchases/${userId}.csv`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: fileName,
    Body: csvContent,
    ContentType: 'text/csv',
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'CSV generated',
      file: fileName,
    }),
  };
};
