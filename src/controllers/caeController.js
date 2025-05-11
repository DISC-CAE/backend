const supabase = require('../config/supabase');
const multer = require('multer');
const path = require('path');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  },
});

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
        metrics, // { People: [...], Place: [...], Policy: [...] }
      } = req.body;

      if (
        !programName ||
        !initiativeName ||
        !description ||
        !modesOfAction ||
        !metrics ||
        !req.file
      ) {
        return res
          .status(400)
          .json({ error: 'All fields including image are required' });
      }

      // Upload image to Supabase Storage
      const fileBuffer = req.file.buffer;
      const fileName = `${Date.now()}-${req.file.originalname}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('initiative-images')
        .upload(fileName, fileBuffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        return res.status(400).json({ error: 'Failed to upload image' });
      }

      // Get public URL for the uploaded image
      const {
        data: { publicUrl },
      } = supabase.storage.from('initiative-images').getPublicUrl(fileName);

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
        image_url: publicUrl,
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
        // If initiative creation fails, delete the uploaded image
        await supabase.storage.from('initiative-images').remove([fileName]);
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
        // If metrics insertion fails, delete both the initiative and the image
        await supabase.from('initiatives').delete().eq('id', initiative.id);
        await supabase.storage.from('initiative-images').remove([fileName]);
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
        modesOfAction,
        metrics, // { People: [...], Place: [...], Policy: [...] }
      } = req.body;

      if (
        !programName ||
        !initiativeName ||
        !description ||
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
        .select('id, image_url')
        .eq('name', initiativeName)
        .eq('program_id', program.id)
        .maybeSingle();

      if (initiativeError || !initiative) {
        return res
          .status(400)
          .json({ error: 'Initiative not found under program' });
      }

      let imageUrl = initiative.image_url;

      // If a new image is uploaded, handle the upload
      if (req.file) {
        // Delete old image if it exists
        if (initiative.image_url) {
          const oldFileName = initiative.image_url.split('/').pop();
          await supabase.storage
            .from('initiative-images')
            .remove([oldFileName]);
        }

        // Upload new image
        const fileBuffer = req.file.buffer;
        const fileName = `${Date.now()}-${req.file.originalname}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('initiative-images')
          .upload(fileName, fileBuffer, {
            contentType: req.file.mimetype,
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          return res.status(400).json({ error: 'Failed to upload image' });
        }

        // Get public URL for the uploaded image
        const {
          data: { publicUrl },
        } = supabase.storage.from('initiative-images').getPublicUrl(fileName);

        imageUrl = publicUrl;
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
