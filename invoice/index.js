const fs = require('fs');
const path = require('path');
const { S3, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const PDFDocument = require('pdfkit');
const csv = require('csv-parser');
const { calculateDiscount, generateDiscountCode } = require('./utils.js');

const s3 = new S3();

module.exports.handler = async (event) => {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event;
    const userId = body.userId || 'unknown';
    const fileName = `purchases/${userId}.csv`;
    const outputPdf = `invoices/${userId}.pdf`;

    const purchases = [];

    if (process.env.NODE_ENV === 'development') {
        // 🔄 Зчитуємо CSV з локального мок-файлу
        const filePath = path.join(__dirname, '../s3-mock', fileName);
        await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => purchases.push({
                product: row.Product,
                price: parseFloat(row.Price),
            }))
            .on('end', resolve)
            .on('error', reject);
        });
    } else {
        // 🟢 Отримуємо CSV з S3
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: fileName,
        });
        const response = await s3.send(command);
        await new Promise((resolve, reject) => {
        response.Body
            .pipe(csv())
            .on('data', (row) => purchases.push({
                product: row.Product,
                price: parseFloat(row.Price),
            }))
            .on('end', resolve)
            .on('error', reject);
        });
    }

    const totalPrice = purchases.reduce((sum, p) => sum + p.price, 0);
    const discount = calculateDiscount(purchases);
    const discountCode = generateDiscountCode();

    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));

    await new Promise((resolve, reject) => {
        doc.on('end', async () => {
            const pdfData = Buffer.concat(buffers);

            if (process.env.NODE_ENV === 'development') {
                // 📝 Зберігаємо PDF локально
                const outputPath = path.join(__dirname, '../s3-mock', outputPdf);
                const dir = path.dirname(outputPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(outputPath, pdfData);
                console.log(`✅ Saved PDF locally to ${outputPath}`);
                resolve();
            } else {
                try {
                    // ☁️ Завантажуємо PDF у S3
                    await s3.send(new PutObjectCommand({
                        Bucket: process.env.S3_BUCKET,
                        Key: outputPdf,
                        Body: pdfData,
                        ContentType: 'application/pdf',
                    }));
                    console.log('✅ Uploaded PDF to S3');
                    resolve();
                } catch(e) {
                    console.log('✅ S3 Error: ' + e);
                    reject();
                }
            }
        });

        doc.fontSize(16).text(`Invoice for User ID: ${userId}`);
        doc.moveDown();
        purchases.forEach(p =>
            doc.text(`Product: ${p.product}, Price: $${p.price.toFixed(2)}`)
        );
        doc.moveDown();
        doc.text(`Total Price: $${totalPrice.toFixed(2)}`);
        doc.moveDown();
        doc.text(`Discount: ${discount}%`);
        doc.moveDown();
        doc.text(`Final Price after discount: $10`);
        doc.moveDown();
        doc.text(`Discount Code: ${discountCode}`);
        doc.end();
    });

    if (process.env.NODE_ENV === 'development') {
        return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Invoice generated locally (DEV)',
            file: path.join('s3-mock', outputPdf),
        }),
        };
    }

    const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: outputPdf,
        }),
        { expiresIn: 600 }
    );

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Invoice created',
            url: signedUrl,
        }),
    };
};
