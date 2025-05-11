// Storage Keys
const STORAGE_KEYS = {
  THEME: 'glossyChat_theme',
  CHATS: 'glossyChat_chats',
  CURRENT_CHAT: 'glossyChat_currentChat'
};

// API configuration
const API_URL = 'http://localhost:3000/api';

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

// ChatStore Class - Manages chat data and localStorage operations
class ChatStore {
  constructor() {
      this.chats = [];
      this.currentChatId = null;
      this.loadFromStorage();
  }

  loadFromStorage() {
      // Load chats
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
  }

  saveToStorage() {
      localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(this.chats));
      localStorage.setItem(STORAGE_KEYS.CURRENT_CHAT, this.currentChatId);
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

// ChatAPI Class - Handles communication with the backend
class ChatAPI {
  constructor(baseUrl) {
      this.baseUrl = baseUrl;
  }

  async sendMessage(message) {
      try {
          const response = await fetch(`${this.baseUrl}/chat`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ prompt: message })
          });

          if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
          }

          return await response.json();
      } catch (error) {
          console.error('API Error:', error);
          throw error;
      }
  }
}

// UI Manager - Handles UI updates and event listeners
class UIManager {
  constructor(chatStore, chatAPI) {
      this.chatStore = chatStore;
      this.chatAPI = chatAPI;
      this.setupEventListeners();
      this.refreshUI();
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
          // Send to backend API
          const response = await this.chatAPI.sendMessage(userInput);
          
          // Remove thinking indicator
          thinking.remove();
          
          // Add bot response to chat and UI
          this.chatStore.addMessageToCurrentChat(response.response, 'bot');
          this.addMessageToUI(response.response, 'bot');
          
          // Update chat list if this is a new chat with title change
          this.renderChatsList();
      } catch (error) {
          console.error('Error getting response:', error);
          thinking.remove();
          this.addMessageToUI("Sorry, I had trouble processing that request. Please check if the backend server is running.", 'bot');
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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  const chatStore = new ChatStore();
  const chatAPI = new ChatAPI(API_URL);
  const uiManager = new UIManager(chatStore, chatAPI);
});