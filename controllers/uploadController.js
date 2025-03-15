import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/'); // Define the folder to save uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to the file name
  }
});

const upload = multer({ storage: storage });

const handleFileUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const filePath = path.join(__dirname, '..', '..', 'uploads', req.file.filename);
  
  try {
    // Read the file content using XLSX
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Extract data from the first sheet
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Process the data as needed (e.g., saving to DB or analytics)
    console.log(data);

    // Send success response
    res.status(200).json({ message: 'File uploaded and processed successfully', data });
  } catch (error) {
    console.error('Error processing the file:', error);
    res.status(500).send('Error processing the file.');
  }
};

export { upload, handleFileUpload };
