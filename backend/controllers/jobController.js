import Job from "../models/jobModel.js";

// Get all job postings
export const getJobPosting = async (req, res) => {
  try {
    const jobs = await Job.find(); // Get all jobs
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching job postings", error });
  }
};

// Add a new job posting (with image upload)
export const createJobPosting = async (req, res) => {
  try {
    const { title, description } = req.body;
    const image = req.file ? req.file.path : null; // Get uploaded image path

    const newJob = new Job({
      title,
      description,
      image,
    });

    await newJob.save(); // Save to database
    res.json({ success: true, job: newJob });
  } catch (error) {
    res.status(500).json({ message: "Error creating job posting", error });
  }
};

// Delete a job posting
export const deleteJobPosting = async (req, res) => {
  try {
    const { jobId } = req.params;
    await Job.findByIdAndDelete(jobId);
    res.json({ success: true, message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting job posting", error });
  }
};

// Get a single job posting by ID
export const getJobPostingById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId); // Find job by ID
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: "Error fetching job posting", error });
  }
};
