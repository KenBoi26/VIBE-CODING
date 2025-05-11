// Storage Keys
const STORAGE_KEYS = {
    THEME: 'glossyChat_theme',
    CHATS: 'glossyChat_chats',
    CURRENT_CHAT: 'glossyChat_currentChat'
};

// DOM Elements
const body = document.body;
const sidebar = document.querySelector('.sidebar');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const themeSwitch = document.getElementById('theme-switch');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const newChatBtn = document.getElementById('new-chat-btn');
const chatsList = document.getElementById('chats-list');
const chatHeader = document.getElementById('chat-header');

// IndexedDB Setup for storing chats (local database)
let db;

function initializeDB() {
    const request = indexedDB.open('ChatbotDB', 1);
    
    request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.errorCode);
    };
    
    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains('chats')) {
            const store = db.createObjectStore('chats', { keyPath: 'id' });
            store.createIndex('created', 'created', { unique: false });
        }
        if (!db.objectStoreNames.contains('messages')) {
            const messagesStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
            messagesStore.createIndex('chatId', 'chatId', { unique: false });
            messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
    };
    
    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('IndexedDB connected successfully');
        // Initialize app after DB connection
        const chatStore = new ChatStore();
        const ai = new AI();
        const uiManager = new UIManager(chatStore, ai);
    };
}

// Chat Class - Represents a chat session
class Chat {
    constructor(id = null, title = 'New Conversation', messages = []) {
        this.id = id || this.generateId();
        this.title = title;
        this.messages = messages.length > 0 ? messages : [{
            text: "Hello there! I'm your glossy assistant. How can I help you today?",
            sender: 'bot',
            timestamp: Date.now()
        }];
        this.created = Date.now();
    }

    generateId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    addMessage(text, sender) {
        const message = {
            text,
            sender,
            timestamp: Date.now()
        };
        this.messages.push(message);
        return message;
    }

    // Generate a title based on first user message
    generateTitle() {
        // Find first user message
        const firstUserMsg = this.messages.find(msg => msg.sender === 'user');
        if (firstUserMsg) {
            // Limit to first 20 chars
            let title = firstUserMsg.text.substring(0, 20);
            if (firstUserMsg.text.length > 20) title += '...';
            this.title = title;
            return title;
        }
        return this.title;
    }
}

// ChatStore Class - Manages chat data and storage operations
class ChatStore {
    constructor() {
        this.chats = [];
        this.currentChatId = null;
        this.loadChats();
    }

    async loadChats() {
        // Try to load from IndexedDB first
        try {
            if (db) {
                const transaction = db.transaction(['chats'], 'readonly');
                const store = transaction.objectStore('chats');
                const chatsRequest = store.getAll();
                
                chatsRequest.onsuccess = (event) => {
                    const chats = event.target.result;
                    
                    if (chats && chats.length > 0) {
                        this.chats = chats;
                        this.currentChatId = localStorage.getItem(STORAGE_KEYS.CURRENT_CHAT) || chats[0].id;
                    } else {
                        // Fallback to localStorage or create new chat
                        this.loadFromLocalStorage();
                    }
                    
                    // Notify UI to update
                    document.dispatchEvent(new CustomEvent('chats-loaded'));
                };
                
                chatsRequest.onerror = (error) => {
                    console.error('Error loading chats from IndexedDB:', error);
                    this.loadFromLocalStorage();
                };
            } else {
                this.loadFromLocalStorage();
            }
        } catch (error) {
            console.error('IndexedDB access error:', error);
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        // Load chats from localStorage
        const storedChats = localStorage.getItem(STORAGE_KEYS.CHATS);
        if (storedChats) {
            this.chats = JSON.parse(storedChats);
        }

        // Load current chat ID
        const storedCurrentChat = localStorage.getItem(STORAGE_KEYS.CURRENT_CHAT);
        if (storedCurrentChat) {
            this.currentChatId = storedCurrentChat;
        }

        // If no chats or current chat not found, create a new one
        if (this.chats.length === 0 || !this.getCurrentChat()) {
            const newChat = new Chat();
            this.chats.push(newChat);
            this.currentChatId = newChat.id;
            this.saveToStorage();
        }

        // Notify UI to update
        document.dispatchEvent(new CustomEvent('chats-loaded'));
    }

    saveToStorage() {
        // Save to localStorage for compatibility
        localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(this.chats));
        localStorage.setItem(STORAGE_KEYS.CURRENT_CHAT, this.currentChatId);
        
        // Save to IndexedDB if available
        if (db) {
            try {
                const transaction = db.transaction(['chats'], 'readwrite');
                const store = transaction.objectStore('chats');
                
                // Clear existing chats
                store.clear();
                
                // Add all chats
                this.chats.forEach(chat => {
                    store.add(chat);
                });
            } catch (error) {
                console.error('Error saving to IndexedDB:', error);
            }
        }
    }

    getCurrentChat() {
        return this.chats.find(chat => chat.id === this.currentChatId);
    }

    getChatById(id) {
        return this.chats.find(chat => chat.id === id);
    }

    createNewChat() {
        const newChat = new Chat();
        this.chats.push(newChat);
        this.currentChatId = newChat.id;
        this.saveToStorage();
        return newChat;
    }

    deleteChat(id) {
        const index = this.chats.findIndex(chat => chat.id === id);
        if (index !== -1) {
            this.chats.splice(index, 1);
            
            // If we deleted the current chat, set a new current chat
            if (this.currentChatId === id) {
                if (this.chats.length > 0) {
                    this.currentChatId = this.chats[0].id;
                } else {
                    // If no chats left, create a new one
                    const newChat = new Chat();
                    this.chats.push(newChat);
                    this.currentChatId = newChat.id;
                }
            }
            
            this.saveToStorage();
            return true;
        }
        return false;
    }

    addMessageToCurrentChat(text, sender) {
        const currentChat = this.getCurrentChat();
        if (currentChat) {
            const message = currentChat.addMessage(text, sender);
            
            // Generate title if this is the first user message
            if (sender === 'user' && 
                currentChat.messages.filter(m => m.sender === 'user').length === 1) {
                currentChat.generateTitle();
            }
            
            this.saveToStorage();
            return message;
        }
        return null;
    }

    setCurrentChat(id) {
        const chat = this.getChatById(id);
        if (chat) {
            this.currentChatId = id;
            this.saveToStorage();
            return chat;
        }
        return null;
    }
}

// AI Class - Manages chatbot responses
class AI {
    constructor() {
        // Keywords and responses
        this.responses = {
            "hello": "Hi there! Welcome to the enhanced chatbot. How can I assist you?",
            "hi": "Hello! I'm here to help. What can I do for you today?",
            "how are you": "I'm functioning perfectly! Thank you for asking. How about you?",
            "what is your name": "I'm your Glossy AI Assistant. You can call me Glossy!",
            "help": "You can ask me questions, have a conversation, or try out different features of this enhanced chat interface!",
            "bye": "Goodbye! Feel free to start a new conversation anytime.",
            "thanks": "You're welcome! Anything else you'd like to know?",
            "thank you": "My pleasure! Let me know if you need anything else.",
            "what can you do": "I can chat with you, remember our conversation history, and you can create multiple chat threads using the sidebar!",
            "tell me a joke": "Why did the chatbot go to therapy? It had too many unresolved queries!",
            "about this page": "This is an enhanced chatbot interface with dark/light mode, local storage for chat persistence, and multi-chat management."
        };
    }

    async generateResponse(input) {
        const cleanInput = input.toLowerCase().trim();
        
        // Check for direct keyword matches
        if (this.responses[cleanInput]) {
            return this.responses[cleanInput];
        }
        
        // Check for partial matches
        for (const [keyword, response] of Object.entries(this.responses)) {
            if (cleanInput.includes(keyword)) {
                return response;
            }
        }
        
        // Handle special queries
        if (cleanInput.includes("time")) {
            return `The current time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
        }
        
        if (cleanInput.includes("date")) {
            return `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
        }
        
        if (cleanInput.includes("theme") || cleanInput.includes("dark mode") || cleanInput.includes("light mode")) {
            return "You can toggle between dark and light mode using the theme switch in the sidebar!";
        }
        
        if (cleanInput.includes("save") || cleanInput.includes("store") || cleanInput.includes("remember")) {
            return "Don't worry! All your chat messages are automatically saved in your browser's local storage and IndexedDB.";
        }
        
        if (cleanInput.includes("delete") || cleanInput.includes("remove")) {
            return "You can delete any chat by clicking the trash icon next to it in the sidebar.";
        }
        
        // Process the input with basic NLP methods
        if (this.containsGreeting(cleanInput)) {
            return "Hello! How can I assist you today?";
        }
        
        if (this.containsQuestion(cleanInput)) {
            return this.generateInformationalResponse(cleanInput);
        }
        
        // General responses if no specific patterns match
        const generalResponses = [
            "I understand you're saying something about " + this.extractTopic(cleanInput) + ". Could you elaborate?",
            "That's an interesting point. Would you like to know more about " + this.extractTopic(cleanInput) + "?",
            "I see. Let me know if you have any specific questions about " + this.extractTopic(cleanInput) + ".",
            "Thanks for sharing that. Is there anything specific about " + this.extractTopic(cleanInput) + " you'd like to discuss?"
        ];
        
        return generalResponses[Math.floor(Math.random() * generalResponses.length)];
    }
    
    containsGreeting(input) {
        const greetings = ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening"];
        return greetings.some(greeting => input.includes(greeting));
    }
    
    containsQuestion(input) {
        return input.includes("?") || 
               input.startsWith("what") || 
               input.startsWith("how") || 
               input.startsWith("why") || 
               input.startsWith("when") || 
               input.startsWith("where") || 
               input.startsWith("who") || 
               input.startsWith("can you") || 
               input.startsWith("could you");
    }
    
    generateInformationalResponse(input) {
        const topic = this.extractTopic(input);
        
        const informationalResponses = [
            `Based on my knowledge, ${topic} is a complex topic. What specific aspect are you interested in?`,
            `Regarding ${topic}, there are several perspectives to consider. Could you be more specific about what you'd like to know?`,
            `When it comes to ${topic}, I can provide some insights if you clarify your question.`,
            `I'd be happy to discuss ${topic} with you. Could you narrow down your question a bit?`
        ];
        
        return informationalResponses[Math.floor(Math.random() * informationalResponses.length)];
    }
    
    extractTopic(input) {
        // Simple topic extraction by removing common words and taking remaining nouns
        const words = input.split(" ");
        const commonWords = ["a", "an", "the", "is", "are", "was", "were", "do", "does", 
                            "did", "has", "have", "had", "can", "could", "will", "would", 
                            "should", "about", "please", "tell", "me", "to", "for", "with",
                            "from", "in", "on", "at", "by", "your", "my", "i", "you", "he", "she", "they"];
        
        // Filter out common words and get potential topics
        const potentialTopics = words.filter(word => !commonWords.includes(word.toLowerCase()));
        
        if (potentialTopics.length > 0) {
            // Return the longest word as it's likely to be more significant
            return potentialTopics.sort((a, b) => b.length - a.length)[0];
        }
        
        return "this topic"; // Fallback
    }
}

// UI Manager - Handles UI updates and event listeners
class UIManager {
    constructor(chatStore, ai) {
        this.chatStore = chatStore;
        this.ai = ai;
        this.setupEventListeners();
        
        // Listen for chats-loaded event
        document.addEventListener('chats-loaded', () => {
            this.refreshUI();
        });
    }

    setupEventListeners() {
        // Theme toggle
        themeSwitch.addEventListener('change', () => this.toggleTheme());
        
        // Load theme from storage
        const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
        if (savedTheme === 'light') {
            themeSwitch.checked = true;
            this.setLightMode();
        } else {
            themeSwitch.checked = false;
            this.setDarkMode();
        }
        
        // Mobile menu
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
        
        // Send message
        sendButton.addEventListener('click', () => this.sendMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // New chat
        newChatBtn.addEventListener('click', () => this.createNewChat());

        // Close sidebar when clicking outside (on mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                e.target !== mobileMenuBtn) {
                sidebar.classList.remove('active');
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('active');
            }
        });
    }

    toggleTheme() {
        if (themeSwitch.checked) {
            this.setLightMode();
            localStorage.setItem(STORAGE_KEYS.THEME, 'light');
        } else {
            this.setDarkMode();
            localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
        }
    }

    setLightMode() {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        
        // Update accent classes
        newChatBtn.classList.remove('theme-accent-dark');
        newChatBtn.classList.add('theme-accent-light');
        sendButton.classList.remove('theme-accent-dark');
        sendButton.classList.add('theme-accent-light');
    }

    setDarkMode() {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        
        // Update accent classes
        newChatBtn.classList.remove('theme-accent-light');
        newChatBtn.classList.add('theme-accent-dark');
        sendButton.classList.remove('theme-accent-light');
        sendButton.classList.add('theme-accent-dark');
    }

    createNewChat() {
        const newChat = this.chatStore.createNewChat();
        this.renderChatsList();
        this.renderCurrentChat();
    }

    async sendMessage() {
        const userInput = chatInput.value.trim();
        if (userInput === "") return;
        
        // Add user message to chat and UI
        this.chatStore.addMessageToCurrentChat(userInput, 'user');
        this.addMessageToUI(userInput, 'user');
        chatInput.value = "";
        
        // Generate and add bot response
        const thinking = this.addThinkingIndicator();
        
        try {
            // Simulate network delay for realism
            const botResponse = await new Promise(resolve => {
                setTimeout(async () => {
                    const response = await this.ai.generateResponse(userInput);
                    resolve(response);
                }, 700 + Math.random() * 800);
            });
            
            // Remove thinking indicator
            thinking.remove();
            
            // Add bot response to chat and UI
            this.chatStore.addMessageToCurrentChat(botResponse, 'bot');
            this.addMessageToUI(botResponse, 'bot');
            
            // Update chat list if this is a new chat with title change
            this.renderChatsList();
        } catch (error) {
            console.error('Error generating response:', error);
            thinking.remove();
            this.addMessageToUI("Sorry, I had trouble processing that request. Please try again.", 'bot');
        }
    }

    addThinkingIndicator() {
        const thinkingDiv = document.createElement('div');
        thinkingDiv.classList.add('message', 'bot', 'new');
        thinkingDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        chatMessages.appendChild(thinkingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return thinkingDiv;
    }

    addMessageToUI(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender, 'new');
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Remove 'new' class after animation
        setTimeout(() => {
            messageDiv.classList.remove('new');
        }, 350);
    }

    switchChat(id) {
        const chat = this.chatStore.setCurrentChat(id);
        if (chat) {
            this.renderCurrentChat();
            this.renderChatsList();
            
            // Close sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
            }
        }
    }

    deleteChat(id, event) {
        // Prevent click from bubbling to parent (which would select the chat)
        event.stopPropagation();
        
        if (confirm('Are you sure you want to delete this chat?')) {
            this.chatStore.deleteChat(id);
            this.renderChatsList();
            this.renderCurrentChat();
        }
    }

    renderChatsList() {
        chatsList.innerHTML = '';
        
        // Sort chats by creation time (newest first)
        const sortedChats = [...this.chatStore.chats].sort((a, b) => b.created - a.created);
        
        sortedChats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.classList.add('chat-item');
            if (chat.id === this.chatStore.currentChatId) {
                chatItem.classList.add('active');
            }
            
            // Create container for chat title and delete button
            const chatContent = document.createElement('div');
            chatContent.textContent = chat.title;
            chatContent.style.overflow = 'hidden';
            chatContent.style.textOverflow = 'ellipsis';
            chatContent.style.whiteSpace = 'nowrap';
            chatContent.style.flexGrow = '1';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-btn');
            deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>`;
            deleteBtn.addEventListener('click', (e) => this.deleteChat(chat.id, e));
            
            chatItem.appendChild(chatContent);
            chatItem.appendChild(deleteBtn);
            chatItem.addEventListener('click', () => this.switchChat(chat.id));
            
            chatsList.appendChild(chatItem);
        });
    }

    renderCurrentChat() {
        const currentChat = this.chatStore.getCurrentChat();
        
        if (!currentChat) return;
        
        // Update chat header
        chatHeader.textContent = currentChat.title;
        
        // Clear and populate messages
        chatMessages.innerHTML = '';
        
        currentChat.messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', message.sender);
            messageDiv.textContent = message.text;
            chatMessages.appendChild(messageDiv);
        });
        
        // Focus input
        chatInput.focus();
    }

    refreshUI() {
        this.renderChatsList();
        this.renderCurrentChat();
    }
}

// Initialize the database when the page loads
document.addEventListener('DOMContentLoaded', initializeDB);