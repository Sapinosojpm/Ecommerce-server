import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure upload directories exist
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Existing storage setup (kept unchanged)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // Default directory for uploads
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

// Additional storage setup for categorized uploads (resumes, images, documents, videos)
const categorizedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadFolder = "./uploads/others"; // Default folder

    if (file.fieldname === "resume") {
      uploadFolder = "./uploads/resumes";
    } else if (file.fieldname === "profileImage") {
      uploadFolder = "./uploads/images";
    } else if (file.fieldname === "document") {
      uploadFolder = "./uploads/documents";
    } else if (file.fieldname === "video") { 
      uploadFolder = "./uploads/videos"; // New directory for videos
    }

    ensureDirExists(uploadFolder);
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")); // Unique filename
  },
});

// File validation rules for specific uploads
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = {
    resume: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    profileImage: ["image/jpeg", "image/png", "image/gif"],
    document: ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    video: ["video/mp4", "video/mpeg", "video/quicktime"] // Allowed video formats
  };

  const fileType = file.fieldname; // Get fieldname (resume, profileImage, document, video)
  const isAllowed = allowedMimeTypes[fileType]?.includes(file.mimetype);

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

// Export both general and categorized upload configurations
const upload = multer({ storage }); // Your existing upload setup
const categorizedUpload = multer({ storage: categorizedStorage, fileFilter });

export { upload, categorizedUpload };
