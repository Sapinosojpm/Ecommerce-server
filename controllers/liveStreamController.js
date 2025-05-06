import LiveStream from '../models/LiveStream.js';

export const getLiveStreamStatus = async (req, res) => {
  try {
    const stream = await LiveStream.findOne();
    if (!stream) {
      const newStream = new LiveStream();
      await newStream.save();
      return res.json(newStream);
    }
    res.json(stream);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const toggleStreamStatus = async (req, res) => {
  try {
    console.log("Toggle stream request received:", req.body);
    const { isLive } = req.body;
    
    if (isLive === undefined) {
      return res.status(400).json({ 
        message: 'Missing isLive parameter in request body' 
      });
    }

    let stream = await LiveStream.findOne();
    
    if (!stream) {
      // Create new stream document if none exists
      stream = new LiveStream({
        isLive: isLive,
        viewers: isLive ? 0 : 0
      });
    } else {
      // Update existing stream document
      stream.isLive = isLive;
      // Reset viewers count when turning off stream
      if (!isLive) {
        stream.viewers = 0;
      }
    }
    
    await stream.save();
    
    console.log("Stream status updated to:", isLive);
    res.json({ 
      isLive: stream.isLive, 
      viewers: stream.viewers,
      message: `Stream is now ${isLive ? 'live' : 'offline'}`
    });
    
  } catch (err) {
    console.error("Error in toggleStreamStatus:", err);
    res.status(500).json({ error: err.message });
  }
};

export const postComment = async (req, res) => {
  try {
    const { name, comment } = req.body;
    
    if (!name || !comment) {
      return res.status(400).json({ message: 'Name and comment are required' });
    }
    
    const stream = await LiveStream.findOne();
    if (!stream) {
      const newStream = new LiveStream();
      newStream.comments.push({ name, comment });
      await newStream.save();
      return res.json({ message: 'Comment added to new stream' });
    }

    stream.comments.push({ name, comment });
    await stream.save();

    res.json({ message: 'Comment added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};