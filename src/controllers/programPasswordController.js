const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');

// Set or update a program's password
exports.setProgramPassword = async (req, res) => {
  const { programId, password } = req.body;
  if (!programId || !password) {
    return res
      .status(400)
      .json({ error: 'programId and password are required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    // Upsert: insert or update if exists
    const { error } = await supabase
      .from('program_passwords')
      .upsert(
        { program_id: programId, password_hash: hash },
        { onConflict: ['program_id'] }
      );
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set password' });
  }
};

// Authenticate a program's password
exports.programLogin = async (req, res) => {
  const { programId, password } = req.body;
  if (!programId || !password) {
    return res
      .status(400)
      .json({ error: 'programId and password are required' });
  }
  try {
    const { data, error } = await supabase
      .from('program_passwords')
      .select('password_hash')
      .eq('program_id', programId)
      .single();
    if (error || !data)
      return res.status(401).json({ error: 'Invalid program or password' });

    const match = await bcrypt.compare(password, data.password_hash);
    if (!match)
      return res.status(401).json({ error: 'Invalid program or password' });

    // You can generate a token here if needed
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};
