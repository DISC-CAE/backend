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
  async fetchScoreboard(req, res) {
    try {
      const entity = req.query.entity; // Correcting the query parameter to be an object
      console.log(entity);
      if (!entity) {
        return res.status(400).json({ error: 'Entity ID is required' });
      }
      console.log('Fetching Scoreboard for entity:', entity);

      if (entity == 'beyond_waste') {
        // Fetch the entity's ID
        const { data: entityData, error: entityError } = await supabase
          .from('entities')
          .select('id')
          .eq('name', entity)
          .single();

        if (entityError) {
          console.error('Error fetching entity:', entityError);
          return res.status(400).json({ error: entityError.message });
        }

        // Fetch the initiatives related to the entity's ID
        const { data: initiatives, error: initiativesError } = await supabase
          .from('initiatives')
          .select('name, description')
          .eq('entity_id', entityData.id);

        if (initiativesError) {
          console.error('Error fetching initiatives:', initiativesError);
          return res.status(400).json({ error: initiativesError.message });
        }
        // Return the fetched initiatives
        res.status(200).json(initiatives);
      } else {
        res.status(400).json({ error: 'Entity not found' });
      }
    } catch (error) {
      console.error('Internal server error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = caeController;
