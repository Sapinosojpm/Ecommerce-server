// controllers/liveSellingController.js
import LiveSelling from '../models/liveSelling.js';
import User from '../models/userModel.js';

// liveSellingController.js
export const startLiveSelling = async (req, res) => {
    try {
        const user = await User.findById(req.user.id); // Corrected to req.user.id
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'You are not authorized to start live selling' });
        }

        const liveSession = new LiveSelling({
            isActive: true,
            adminId: user._id,
        });

        await liveSession.save();
        res.status(200).json({ message: 'Live selling started!' });
    } catch (error) {
        res.status(500).json({ message: 'Error starting live selling', error });
    }
};


export const stopLiveSelling = async (req, res) => {
    try {
      const user = await User.findById(req.user.id); // Corrected to req.user.id
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'You are not authorized to stop live selling' });
      }
  
      // Find the live session and set it to inactive
      const liveSession = await LiveSelling.findOneAndUpdate({ isActive: true }, { isActive: false }, { new: true });
  
      if (!liveSession) {
        return res.status(404).json({ message: 'No active live selling session found' });
      }
  
      res.status(200).json({ message: 'Live selling stopped!' });
    } catch (error) {
      res.status(500).json({ message: 'Error stopping live selling', error });
    }
  };
  

export const getLiveSellingStatus = async (req, res) => {
  try {
    const liveSession = await LiveSelling.findOne({ isActive: true });
    if (!liveSession) {
      return res.status(404).json({ message: 'No active live selling session found' });
    }
    res.status(200).json(liveSession);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching live selling status', error });
  }
};
