const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from 'public' folder (modify if needed)
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
      //console.log(`Processing pages from ${i + 1} to ${end}`);
  
      currentPages.forEach((page) => {
        const width = page.getWidth();
        const height = page.getHeight();

    // Crop 100 units from each side (adjust if necessary)
    // For 1000 PDF
    // const left = 50;
    // const bottom = 535;
    // const right = width - 320;
    // const top = height - 613;
    
    // For 1000 PDF
    // const left = 58;
    // const bottom = 567;
    // const right = width - 319;
    // const top = height - 679;

    // For 3000 PDF
    // const left = 67;
    // const bottom = 555;
    // const right = width - 332;
    // const top = height - 630;

    // For 4000 PDF
    const left = 67;
    const bottom = 555;
    const right = width - 332;
    const top = height - 630;

    // Set the visible portion of the PDF using the media box
    //page.setMediaBox(left, bottom, right, top);

    // Set the crop box as well for PDF viewers that respect cropBox
    page.setCropBox(left, bottom, right, top);
  });

    // Copy pages to the new document (returns an array of copied pages)
    const copiedPages = await croppedPdf.copyPages(pdfDoc, [...Array(end - i).keys()].map(n => n + i));

    // Add each copied page to the new cropped PDF
    copiedPages.forEach((page) => {
        croppedPdf.addPage(page);
    });
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
    res.download(outputPdfPath); // Send the cropped PDF back for download
  } catch (error) {
    console.error('Error cropping PDF:', error);
    res.status(500).send('Error cropping PDF');
  }
});

// Start the server
// app.listen(PORT, () => {
//   console.log(`Server is running on http://localhost:${PORT}`);
// });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
