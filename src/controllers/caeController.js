const supabase = require('../config/supabase');

const caeController = {
  async fetchScoreboard(req, res) {
    try {
      const programName = req.query.programName;

      if (!programName) {
        return res.status(400).json({ error: 'programName is required' });
      }

      const { data: allPrograms, error } = await supabase
        .from('programs')
        .select('*');

      console.log(allPrograms, error);

      const { data: program, error: programError } = await supabase
        .from('programs')
        .select('id')
        .eq('name', programName)
        .maybeSingle();

      console.log(program, programError);

      if (programError || !program) {
        return res.status(400).json({ error: 'Invalid programName' });
      }

      const { data: initiatives, error: initiativesError } = await supabase
        .from('initiatives')
        .select('name, description, image_url')
        .eq('program_id', program.id);

      console.log('Initatives', initiatives, initiativesError);

      if (initiativesError) {
        return res.status(400).json({ error: initiativesError.message });
      }

      const formatted = initiatives.map((i) => ({
        name: i.name,
        description: i.description,
        imageUrl: i.image_url,
      }));

      res.status(200).json({ initiatives: formatted });
    } catch (err) {
      console.error('Internal server error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async addInitiative(req, res) {
    try {
      const {
        programName,
        initiativeName,
        description,
        modesOfAction,
        imageUrl,
        metrics, // { People: [...], Place: [...], Policy: [...] }
      } = req.body;

      if (
        !programName ||
        !initiativeName ||
        !description ||
        !modesOfAction ||
        !imageUrl ||
        !metrics
      ) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const { data: program, error: programError } = await supabase
        .from('programs')
        .select('id')
        .eq('name', programName)
        .maybeSingle();

      if (programError || !program) {
        return res.status(400).json({ error: 'Invalid programName' });
      }

      const initiativeInsert = {
        name: initiativeName,
        description,
        image_url: imageUrl,
        program_id: program.id,
        mode_serve: modesOfAction.includes('Serve'),
        mode_educate: modesOfAction.includes('Educate'),
        mode_advocate: modesOfAction.includes('Advocate'),
      };

      const { data: initiative, error: initiativeError } = await supabase
        .from('initiatives')
        .insert([initiativeInsert])
        .select()
        .maybeSingle();

      if (initiativeError || !initiative) {
        return res.status(400).json({ error: 'Failed to insert initiative' });
      }

      const metricEntries = [];
      for (const category of ['People', 'Place', 'Policy']) {
        const metricArray = metrics[category] || [];
        for (const { label, value } of metricArray) {
          metricEntries.push({
            initiative_id: initiative.id,
            label,
            value,
            ppp: category,
          });
        }
      }

      const { error: metricError } = await supabase
        .from('metrics')
        .insert(metricEntries);

      if (metricError) {
        return res.status(400).json({ error: 'Failed to insert metrics' });
      }

      res.status(201).json({ message: 'Initiative created successfully' });
    } catch (err) {
      console.error('Internal server error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async fetchInitiative(req, res) {
    try {
      const { programName, initiativeName } = req.query;

      if (!programName || !initiativeName) {
        return res
          .status(400)
          .json({ error: 'programName and initiativeName are required' });
      }

      const { data: program, error: programError } = await supabase
        .from('programs')
        .select('id')
        .eq('name', programName)
        .maybeSingle();

      if (programError || !program) {
        return res.status(400).json({ error: 'Invalid programName' });
      }

      const { data: initiative, error: initiativeError } = await supabase
        .from('initiatives')
        .select('*')
        .eq('name', initiativeName)
        .eq('program_id', program.id)
        .maybeSingle();

      if (initiativeError || !initiative) {
        return res
          .status(400)
          .json({ error: 'Invalid initiativeName for given program' });
      }

      const modesOfAction = [];
      if (initiative.mode_serve) modesOfAction.push('Serve');
      if (initiative.mode_educate) modesOfAction.push('Educate');
      if (initiative.mode_advocate) modesOfAction.push('Advocate');

      const { data: metrics, error: metricError } = await supabase
        .from('metrics')
        .select('label, value, ppp')
        .eq('initiative_id', initiative.id);

      if (metricError) {
        return res.status(400).json({ error: 'Failed to fetch metrics' });
      }

      const groupedMetrics = {
        People: [],
        Place: [],
        Policy: [],
      };

      for (const m of metrics) {
        if (groupedMetrics[m.ppp]) {
          groupedMetrics[m.ppp].push({ label: m.label, value: m.value });
        }
      }

      res.status(200).json({
        programName,
        initiativeName,
        description: initiative.description,
        modesOfAction,
        imageUrl: initiative.image_url,
        metrics: groupedMetrics,
      });
    } catch (err) {
      console.error('Internal server error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async deleteInitiative(req, res) {
    try {
      const { programName, initiativeName } = req.body;

      if (!programName || !initiativeName) {
        return res
          .status(400)
          .json({ error: 'programName and initiativeName are required' });
      }

      const { data: program, error: programError } = await supabase
        .from('programs')
        .select('id')
        .eq('name', programName)
        .maybeSingle();

      if (programError || !program) {
        return res.status(400).json({ error: 'Invalid programName' });
      }

      const { data: initiative, error: initiativeError } = await supabase
        .from('initiatives')
        .select('id')
        .eq('name', initiativeName)
        .eq('program_id', program.id)
        .maybeSingle();

      if (initiativeError || !initiative) {
        return res
          .status(400)
          .json({ error: 'Initiative not found under that program' });
      }

      // Delete associated metrics first
      const { error: metricsDeleteError } = await supabase
        .from('metrics')
        .delete()
        .eq('initiative_id', initiative.id);

      if (metricsDeleteError) {
        return res.status(400).json({ error: 'Failed to delete metrics' });
      }

      // Then delete the initiative
      const { error: initiativeDeleteError } = await supabase
        .from('initiatives')
        .delete()
        .eq('id', initiative.id);

      if (initiativeDeleteError) {
        return res.status(400).json({ error: 'Failed to delete initiative' });
      }

      res.status(200).json({ message: 'Initiative deleted successfully' });
    } catch (err) {
      console.error('Internal server error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  async editInitiative(req, res) {
    try {
      const {
        programName,
        initiativeName,
        description,
        imageUrl,
        modesOfAction,
        metrics, // { People: [...], Place: [...], Policy: [...] }
      } = req.body;

      if (
        !programName ||
        !initiativeName ||
        !description ||
        !imageUrl ||
        !modesOfAction ||
        !metrics
      ) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Get program ID
      const { data: program, error: programError } = await supabase
        .from('programs')
        .select('id')
        .eq('name', programName)
        .maybeSingle();

      if (programError || !program) {
        return res.status(400).json({ error: 'Invalid programName' });
      }

      // Get initiative by name and program
      const { data: initiative, error: initiativeError } = await supabase
        .from('initiatives')
        .select('id')
        .eq('name', initiativeName)
        .eq('program_id', program.id)
        .maybeSingle();

      if (initiativeError || !initiative) {
        return res
          .status(400)
          .json({ error: 'Initiative not found under program' });
      }

      // Update initiative
      const { error: updateError } = await supabase
        .from('initiatives')
        .update({
          description,
          image_url: imageUrl,
          mode_serve: modesOfAction.includes('Serve'),
          mode_educate: modesOfAction.includes('Educate'),
          mode_advocate: modesOfAction.includes('Advocate'),
          updated_at: new Date(),
        })
        .eq('id', initiative.id);

      if (updateError) {
        return res.status(400).json({ error: 'Failed to update initiative' });
      }

      // Delete existing metrics
      const { error: deleteMetricsError } = await supabase
        .from('metrics')
        .delete()
        .eq('initiative_id', initiative.id);

      if (deleteMetricsError) {
        return res.status(400).json({ error: 'Failed to clear old metrics' });
      }

      // Insert new metrics
      const metricEntries = [];
      for (const category of ['People', 'Place', 'Policy']) {
        const metricArray = metrics[category] || [];
        for (const { label, value } of metricArray) {
          metricEntries.push({
            initiative_id: initiative.id,
            label,
            value,
            ppp: category,
          });
        }
      }

      const { error: insertMetricsError } = await supabase
        .from('metrics')
        .insert(metricEntries);

      if (insertMetricsError) {
        return res
          .status(400)
          .json({ error: 'Failed to insert updated metrics' });
      }

      res.status(200).json({ message: 'Initiative updated successfully' });
    } catch (err) {
      console.error('Internal server error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = caeController;
