import JobApplication from "../models/jobApplicationModel.js";
import Job from "../models/jobModel.js";

// Apply for a job
export const applyForJob = async (req, res) => {
  try {
    const { jobId, firstName, lastName, address, experience } = req.body;
    const resume = req.file ? req.file.path : null;

    if (!jobId || !firstName || !lastName || !address || !experience || !resume) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Find the job title based on jobId
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    const newApplication = new JobApplication({
      jobId,
      jobTitle: job.title,  // <-- Save the job title
      firstName,
      lastName,
      address,
      experience,
      resume,
    });

    await newApplication.save();
    res.status(201).json({ success: true, message: "Application submitted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};


// Get all applications for a job
export const getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
    const applications = await JobApplication.find({ jobId });

    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};
