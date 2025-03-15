import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  jobTitle: { type: String, required: true },  // <-- Store job title here
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  address: { type: String, required: true },
  experience: { type: String, required: true },
  resume: { type: String, required: true }, // File path to resume
  appliedAt: { type: Date, default: Date.now },
});

const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);
export default JobApplication;
