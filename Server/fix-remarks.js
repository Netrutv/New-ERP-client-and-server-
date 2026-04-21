const mongoose = require('mongoose');
const Note = require('./models/Note');

mongoose.connect('mongodb://127.0.0.1:27017/tracking')
    .then(async () => {
        console.log('✅ Connected...');

        // See what's actually in your old notes
        const notes = await Note.find({}).select('remark className').limit(10);
        console.log('Sample notes:', JSON.stringify(notes, null, 2));

        mongoose.disconnect();
    })
    .catch(err => console.error('❌ Error:', err));