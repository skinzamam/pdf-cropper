const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Set static folder for HTML and CSS
app.use(express.static('public'));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Crop PDF function
async function cropPDFInBatches(inputPath, outputPath, batchSize = 100) {
    const existingPdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const totalPages = pdfDoc.getPages().length;
    let croppedPdf = await PDFDocument.create();

    for (let i = 0; i < totalPages; i += batchSize) {
        const end = Math.min(i + batchSize, totalPages);
        const currentPages = pdfDoc.getPages().slice(i, end);

        currentPages.forEach((page) => {
            const width = page.getWidth();
            const height = page.getHeight();

            // Cropping coordinates (adjust as needed)
            const left = 67;
            const bottom = 555;
            const right = width - 332;
            const top = height - 630;

            // Apply cropping
            page.setCropBox(left, bottom, right, top);
        });

        // Copy pages to the new document
        const copiedPages = await croppedPdf.copyPages(pdfDoc, [...Array(end - i).keys()].map(n => n + i));
        copiedPages.forEach((page) => croppedPdf.addPage(page));
    }

    // Save the cropped PDF
    const croppedPdfBytes = await croppedPdf.save();
    fs.writeFileSync(outputPath, croppedPdfBytes);
}

// Handle PDF upload and cropping
app.post('/upload', upload.single('pdfFile'), async (req, res) => {
    const inputPdfPath = req.file.path;
    const outputPdfPath = `cropped_pdfs/cropped_${Date.now()}.pdf`;

    try {
        await cropPDFInBatches(inputPdfPath, outputPdfPath, 100);
        res.download(outputPdfPath);
    } catch (error) {
        console.error('Error cropping PDF:', error);
        res.status(500).send('Error cropping PDF');
    }
});

// Function to delete old .pdf files (excluding .gitkeep)
function deleteOldPDFFiles(directory, hours) {
    const now = Date.now();
    const threshold = hours * 60 * 60 * 1000; // Convert hours to milliseconds

    if (fs.existsSync(directory)) {
        fs.readdirSync(directory).forEach(file => {
            const filePath = path.join(directory, file);

            // Only delete .pdf files (ignore .gitkeep and other files)
            if (path.extname(file) === '.pdf') {
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        console.error(`Error reading file stats: ${err}`);
                        return;
                    }

                    // Check if file is older than the threshold
                    if (now - stats.mtimeMs > threshold) {
                        fs.unlink(filePath, (err) => {
                            if (err) {
                                console.error(`Error deleting file ${filePath}: ${err}`);
                            } else {
                                console.log(`Deleted old PDF file: ${filePath}`);
                            }
                        });
                    }
                });
            }
        });
    } else {
        console.log(`Directory not found: ${directory}`);
    }
}

// Schedule the cron job to delete old PDFs every hour
cron.schedule('* * * * *', () => {
    console.log('Running scheduled PDF cleanup...');

    // Delete PDF files older than 1 hours
    deleteOldPDFFiles('cropped_pdfs', 1);
    deleteOldPDFFiles('uploads', 1);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
