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
      const entity = req.query.entity;
      console.log('Fetching Scoreboard for entity:', entity);

      if (!entity) {
        return res.status(400).json({ error: 'Entity name is required' });
      }

      // Fetch the entity's ID dynamically based on the provided entity name
      if (entity == 'beyond_waste') {
        table_entity_name = 'Beyond Waste';
      } else if (entity == 'edible_evanston') {
        table_entity_name = 'Edible Evanston';
      } else if (entity == 'energy') {
        table_entity_name = 'Energy';
      } else if (entity == 'environment_justice') {
        table_entity_name = 'Environmental Justice';
      } else if (entity == 'natural_habitat') {
        table_entity_name = 'Natural Habitat';
      } else if (entity == 'climate_action') {
        table_entity_name = 'Climate Action';
      }

      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .select('id')
        .eq('name', table_entity_name) // Use the dynamic entity name
        .maybeSingle();

      console.log('Entity query result:', entityData, entityError);

      if (entityError) {
        console.error('Error fetching entity:', entityError);
        return res.status(400).json({ error: entityError.message });
      }

      if (!entityData || !entityData.id) {
        return res
          .status(404)
          .json({ error: `Entity '${entity}' not found in database` });
      }

      // Fetch the initiatives related to the entity's ID
      const { data: initiatives, error: initiativesError } = await supabase
        .from('initiatives')
        .select('name, description')
        .eq('entity_id', entityData.id);

      console.log('Initiatives query result:', initiatives, initiativesError);

      if (initiativesError) {
        console.error('Error fetching initiatives:', initiativesError);
        return res.status(400).json({ error: initiativesError.message });
      }

      // Return the fetched initiatives
      res.status(200).json(initiatives);
    } catch (error) {
      console.error(
        'Internal server error details:',
        error.message,
        error.stack
      );
      res.status(500).json({
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
  async addInitiative(req, res) {
    try {
      const {
        organization_name,
        initiative_name,
        event_date,
        event_location,
        event_description,
      } = req.body;

      if (
        !organization_name ||
        !initiative_name ||
        !event_date ||
        !event_location ||
        !event_description
      ) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .select('id')
        .eq('name', organization_name) // Use the dynamic entity name
        .maybeSingle();

      console.log('Entity query result:', entityData, entityError);

      if (entityError) {
        console.error('Error fetching entity:', entityError);
        return res.status(400).json({ error: entityError.message });
      }

      if (!entityData || !entityData.id) {
        return res.status(404).json({
          error: `Entity '${organization_name}' not found in database`,
        });
      }

      console.log('Inserting new event:', req.body);

      const { data, error } = await supabase
        .from('initiatives')
        .insert([
          {
            entity_id: entityData.id,
            name: initiative_name,
            description: event_description,
          },
        ])
        .select();

      if (error) {
        console.error('Error inserting event:', error);
        return res.status(400).json({ error: error.message });
      }

      res.status(201).json({ message: 'Event created successfully', data });
    } catch (error) {
      console.error('Internal server error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = caeController;
