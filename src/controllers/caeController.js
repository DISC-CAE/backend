const supabase = require('../config/supabase');

const caeController = {
  async getAllEvents(req, res) {
    try {
      console.log('Fetching all events...');

      const { data: events, error } = await supabase
        .from('events') // Replace 'events' with your actual table name
        .select('*');

      if (error) {
        console.error('Error fetching events:', error);
        return res.status(400).json({ error: error.message });
      }

      res.status(200).json(events);
    } catch (error) {
      console.error('Internal server error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = caeController;
