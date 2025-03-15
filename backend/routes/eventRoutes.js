import express from 'express';
import { getEventsByDate, createEvent, deleteEvent } from '../controllers/EventController.js';

const router = express.Router();

// Route to get all events
router.get('/events', getEventsByDate);

// Route to create a new event
router.post('/events', createEvent);

// Route to delete an event by ID
router.delete('/events/:id', deleteEvent);

export default router;
