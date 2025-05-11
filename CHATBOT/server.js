const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to SQLite database
const db = new sqlite3.Database(path.join(__dirname, 'chatbot.db'), (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database');
        
        // Create database schema if it doesn't exist
        setupDatabase();
    }
});

// Setup database tables
function setupDatabase() {
    // Create the conversations table
    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create the messages table with foreign key relationship
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            content TEXT NOT NULL,
            sender TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        )
    `);
    
    // Create index to speed up queries
    db.run('CREATE INDEX IF NOT EXISTS idx_conversation_id ON messages (conversation_id)');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// Simplified NLP for intent recognition
const nlp = {
    intents: {
        greeting: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
        farewell: ['bye', 'goodbye', 'see you', 'later', 'take care'],
        thanks: ['thank', 'thanks', 'appreciate', 'grateful'],
        help: ['help', 'assist', 'support', 'guide'],
        about: ['who are you', 'what are you', 'your name', 'about you'],
        joke: ['joke', 'funny', 'humor', 'make me laugh'],
        weather: ['weather', 'temperature', 'forecast', 'rain', 'sunny'],
        time: ['time', 'clock', 'hour'],
        date: ['date', 'day', 'month', 'year', 'today'],
    },
    
    responses: {
        greeting: [
            "Hello! How can I help you today?",
            "Hi there! I'm your chatbot assistant. What can I do for you?",
            "Greetings! How may I assist you?",
            "Hey! What brings you here today?"
        ],
        farewell: [
            "Goodbye! Have a great day!",
            "See you later! Feel free to come back anytime.",
            "Farewell! It was nice talking with you.",
            "Take care! Looking forward to our next conversation."
        ],
        thanks: [
            "You're welcome! Happy to help.",
            "No problem at all! Let me know if you need anything else.",
            "Glad I could assist you!",
            "It's my pleasure to help!"
        ],
        help: [
            "I can help with answering questions, providing information, or just chatting. What do you need help with?",
            "I'm here to assist you. Could you please specify what kind of help you're looking for?",
            "I'd be happy to help. What topic do you need assistance with?",
            "How can I assist you today? Just let me know what you need."
        ],
        about: [
            "I'm Glossy, an AI chatbot assistant designed to help users with various tasks and questions.",
            "My name is Glossy. I'm a virtual assistant created to provide helpful responses to your queries.",
            "I'm your friendly AI assistant, Glossy, here to chat and answer questions!",
            "I'm an AI chatbot named Glossy, designed to have conversations and provide assistance."
        ],
        joke: [
            "Why don't scientists trust atoms? Because they make up everything!",
            "What did one wall say to the other wall? I'll meet you at the corner!",
            "Why did the scarecrow win an award? Because he was outstanding in his field!",
            "Why don't skeletons fight each other? They don't have the guts!",
            "What's the best thing about Switzerland? I don't know, but the flag is a big plus!"
        ],
        weather: [
            "I don't have real-time weather data, but I can suggest checking a weather service or app for the most accurate forecast.",
            "Weather information would require access to external APIs. Would you like me to provide some popular weather resources?",
            "I'm not connected to weather services at the moment. Is there anything else I can help with?"
        ],
        time: [
            `The current server time is ${new Date().toLocaleTimeString()}.`,
            `It's currently ${new Date().toLocaleTimeString()} on the server.`
        ],
        date: [
            `Today is ${new Date().toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}.`,
            `The current date is ${new Date().toLocaleDateString()}.`
        ],
        default: [
            "That's interesting. Tell me more about that.",
            "I see. How can I help with that?",
            "Interesting point. Would you like more information about this topic?",
            "I understand. Is there anything specific you'd like to know about that?",
            "Thanks for sharing. Is there a particular aspect of this you'd like to discuss?"
        ]
    },

    // Detect intent from user message
    detectIntent(message) {
        const text = message.toLowerCase();
        
        // Search through each intent's keywords
        for (const [intent, keywords] of Object.entries(this.intents)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return intent;
            }
        }
        
        // If no specific intent is found
        return 'default';
    },
    
    // Generate response based on detected intent
    generateResponse(message) {
        const intent = this.detectIntent(message);
        const responses = this.responses[intent] || this.responses.default;
        return responses[Math.floor(Math.random() * responses.length)];
    }
};

// REST API Routes

// Create a new conversation
app.post('/api/conversations', (req, res) => {
    const { title = 'New Conversation' } = req.body;
    const id = uuidv4();
    
    db.run(
        'INSERT INTO conversations (id, title) VALUES (?, ?)',
        [id, title],
        function(err) {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Failed to create conversation' });
            }
            
            // Add initial bot message
            const welcomeMessage = "Hello there! I'm your glossy assistant. How can I help you today?";
            
            db.run(
                'INSERT INTO messages (conversation_id, content, sender) VALUES (?, ?, ?)',
                [id, welcomeMessage, 'bot'],
                function(err) {
                    if (err) {
                        console.error('Database error:', err.message);
                        return res.status(500).json({ error: 'Failed to create welcome message' });
                    }
                    
                    res.status(201).json({ 
                        id, 
                        title, 
                        created_at: new Date().toISOString(),
                        messages: [{
                            id: this.lastID,
                            content: welcomeMessage,
                            sender: 'bot',
                            timestamp: new Date().toISOString()
                        }]
                    });
                }
            );
        }
    );
});

// Get all conversations
app.get('/api/conversations', (req, res) => {
    db.all('SELECT * FROM conversations ORDER BY created_at DESC', [], (err, conversations) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to retrieve conversations' });
        }
        
        res.json({ conversations });
    });
});

// Get a specific conversation with its messages
app.get('/api/conversations/:id', (req, res) => {
    const { id } = req.params;
    
    // First get the conversation
    db.get('SELECT * FROM conversations WHERE id = ?', [id], (err, conversation) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to retrieve conversation' });
        }
        
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // Then get all messages for this conversation
        db.all(
            'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC', 
            [id], 
            (err, messages) => {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ error: 'Failed to retrieve messages' });
                }
                
                res.json({ 
                    ...conversation, 
                    messages 
                });
            }
        );
    });
});

// Update conversation title
app.put('/api/conversations/:id', (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }
    
    db.run(
        'UPDATE conversations SET title = ? WHERE id = ?',
        [title, id],
        function(err) {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Failed to update conversation' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Conversation not found' });
            }
            
            res.json({ id, title });
        }
    );
});

// Delete a conversation
app.delete('/api/conversations/:id', (req, res) => {
    const { id } = req.params;
    
    // Begin transaction
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Delete all messages first (due to foreign key constraint)
        db.run('DELETE FROM messages WHERE conversation_id = ?', [id], function(err) {
            if (err) {
                console.error('Database error deleting messages:', err.message);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to delete conversation messages' });
            }
            
            // Then delete the conversation
            db.run('DELETE FROM conversations WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('Database error deleting conversation:', err.message);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to delete conversation' });
                }
                
                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(404).json({ error: 'Conversation not found' });
                }
                
                db.run('COMMIT');
                res.status(200).json({ message: 'Conversation deleted successfully' });
            });
        });
    });
});

// Send a message and get a response
app.post('/api/conversations/:id/messages', (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Verify conversation exists
    db.get('SELECT id FROM conversations WHERE id = ?', [id], (err, conversation) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Failed to verify conversation' });
        }
        
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        // Store user message
        db.run(
            'INSERT INTO messages (conversation_id, content, sender) VALUES (?, ?, ?)',
            [id, content, 'user'],
            function(err) {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ error: 'Failed to save user message' });
                }
                
                const userMessageId = this.lastID;
                
                // Generate bot response
                const botResponse = nlp.generateResponse(content);
                
                // Store bot response
                db.run(
                    'INSERT INTO messages (conversation_id, content, sender) VALUES (?, ?, ?)',
                    [id, botResponse, 'bot'],
                    function(err) {
                        if (err) {
                            console.error('Database error:', err.message);
                            return res.status(500).json({ error: 'Failed to save bot response' });
                        }
                        
                        res.status(201).json({
                            userMessage: {
                                id: userMessageId,
                                conversation_id: id,
                                content: content,
                                sender: 'user',
                                timestamp: new Date().toISOString()
                            },
                            botMessage: {
                                id: this.lastID,
                                conversation_id: id,
                                content: botResponse,
                                sender: 'bot',
                                timestamp: new Date().toISOString()
                            }
                        });
                    }
                );
            }
        );
    });
});

// Get all messages for a conversation
app.get('/api/conversations/:id/messages', (req, res) => {
    const { id } = req.params;
    
    db.all(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
        [id],
        (err, messages) => {
            if (err) {
                console.error('Database error:', err.message);
                return res.status(500).json({ error: 'Failed to retrieve messages' });
            }
            
            res.json({ messages });
        }
    );
});

// API endpoint for health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0', server_time: new Date().toISOString() });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        version: '1.0',
        description: 'GlossyWeb Chatbot API',
        endpoints: [
            { method: 'GET', path: '/api/health', description: 'Health check endpoint' },
            { method: 'GET', path: '/api/conversations', description: 'Get all conversations' },
            { method: 'POST', path: '/api/conversations', description: 'Create a new conversation' },
            { method: 'GET', path: '/api/conversations/:id', description: 'Get a specific conversation with its messages' },
            { method: 'PUT', path: '/api/conversations/:id', description: 'Update conversation title' },
            { method: 'DELETE', path: '/api/conversations/:id', description: 'Delete a conversation and its messages' },
            { method: 'GET', path: '/api/conversations/:id/messages', description: 'Get all messages for a conversation' },
            { method: 'POST', path: '/api/conversations/:id/messages', description: 'Send a message and get a response' }
        ]
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});