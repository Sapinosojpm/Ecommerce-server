import PageView from "../models/pageViewModel.js";

export const trackPageView = async (req, res) => {
  try {
    const { page, sessionId: clientSessionId } = req.body;
    let userId = req.body.userId || "guest"; // ✅ Ensure guest tracking

    let sessionId = clientSessionId || req.headers["x-session-id"]; // Get from request
    if (!sessionId) {
      sessionId = `guest-${Date.now()}`; // Create unique guest session ID
    }

    const existingView = await PageView.findOne({ page, sessionId });

    if (!existingView) {
      const newView = new PageView({ page, userId, sessionId });
      await newView.save();
      return res.status(200).json({ message: "Page view recorded", userId });
    }

    res.status(200).json({ message: "View already recorded in this session", userId });
  } catch (error) {
    res.status(500).json({ error: "Error tracking page views" });
  }
};





// Get all page views
export const getPageViews = async (req, res) => {
    try {
      const filter = req.query.filter || "monthly"; // Supports daily or monthly filtering
  
      const groupStage = {
        _id: {
          page: "$page",
          timePeriod: filter === "daily"
            ? { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
            : { $dateToString: { format: "%Y-%m", date: "$timestamp" } },
          userType: {
            $cond: { if: { $eq: ["$userId", "guest"] }, then: "Guest", else: "User" }
          }
        },
        views: { $sum: 1 }
      };
  
      const pageViews = await PageView.aggregate([
        { $group: groupStage },
        { $sort: { "_id.timePeriod": -1 } }
      ]);
  
      res.status(200).json(pageViews.map(v => ({
        page: v._id.page,
        timePeriod: v._id.timePeriod,
        userType: v._id.userType,
        views: v.views,
      })));
    } catch (error) {
      res.status(500).json({ error: "Error fetching page views" });
    }
  };
  