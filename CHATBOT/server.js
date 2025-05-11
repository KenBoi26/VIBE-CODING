const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to SQLite database
const db = new sqlite3.Database(path.join(__dirname, 'chatbot.db'), (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database');
        
        // Create the chats table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt TEXT NOT NULL,
                response TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from the root directory
app.use(express.static('./'));

// API routes
app.post('/api/chat', (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // Generate a simple response (in a real app, this would call an AI service)
    let response = generateResponse(prompt);
    
    // Store in database
    db.run(
        'INSERT INTO chats (prompt, response) VALUES (?, ?)',
        [prompt, response],
        function(err) {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Failed to save chat' });
            }
            
            return res.json({ response, chatId: this.lastID });
        }
    );
});

// Get chat history
app.get('/api/chats', (req, res) => {
    db.all('SELECT * FROM chats ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to retrieve chats' });
        }
        res.json({ chats: rows });
    });
});

// Simple response generator (replace with actual AI in production)
function generateResponse(prompt) {
    const lowercasePrompt = prompt.toLowerCase();
    
    // Simple keyword-based responses
    if (lowercasePrompt.includes('hello') || lowercasePrompt.includes('hi')) {
        return "Hello! How can I help you today?";
    } else if (lowercasePrompt.includes('how are you')) {
        return "I'm doing well, thanks for asking! How about you?";
    } else if (lowercasePrompt.includes('bye')) {
        return "Goodbye! Feel free to chat again anytime.";
    } else if (lowercasePrompt.includes('thank')) {
        return "You're welcome! Is there anything else you'd like to know?";
    } else if (lowercasePrompt.includes('name')) {
        return "I'm Glossy, your web assistant. How can I help you?";
    } else if (lowercasePrompt.includes('help')) {
        return "I'd be happy to help! Could you please provide more details about what you need assistance with?";
    } else if (lowercasePrompt.includes('time')) {
        return `The current time is ${new Date().toLocaleTimeString()}.`;
    } else if (lowercasePrompt.includes('joke')) {
        const jokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "Why did the chatbot go to therapy? It had too many unresolved queries!",
            "What do you call a fake noodle? An impasta!",
            "Why did the developer go broke? Because he used up all his cache!"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    } else {
        return `Thank you for your message: "${prompt}". I've recorded this in the database. In a full implementation, this would be processed by an AI to generate a more relevant response.`;
    }
}

// Handle 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});