import Event from '../models/Event.js'; // Event model

// Fetch all events
const getEventsByDate = async (req, res) => {
  try {
    const events = await Event.find(); // Fetch all events
    res.json({ success: true, events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
};

// Create a new event
const createEvent = async (req, res) => {
  const { title, description, startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: 'Event start and end dates are required' });
  }

  try {
    const newEvent = new Event({
      title,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    await newEvent.save();
    res.status(201).json({ success: true, event: newEvent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
};


// Delete an event by ID
const deleteEvent = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedEvent = await Event.findByIdAndDelete(id);
    if (!deletedEvent) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
};



export { getEventsByDate, createEvent, deleteEvent };
