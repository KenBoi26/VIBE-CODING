// app.js

document.addEventListener('DOMContentLoaded', () => {
    const toggleThemeBtn = document.getElementById('toggleTheme');
    const newChatBtn = document.getElementById('newChatBtn');
    const chatForm = document.getElementById('chatForm');
    const promptInput = document.getElementById('promptInput');
    const messages = document.getElementById('messages');
    const chatsContainer = document.getElementById('chatsContainer');
  
    toggleThemeBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      document.body.classList.toggle('light-mode');
    });
  
    newChatBtn.addEventListener('click', () => {
      messages.innerHTML = '';
    });
  
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prompt = promptInput.value.trim();
      if (!prompt) return;
  
      addMessage(prompt, 'user');
      promptInput.value = '';
  
      const response = await fetch('http://127.0.0.1:5000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
  
      addMessage(data.answer, 'bot');
    });
  
    function addMessage(text, sender) {
      const div = document.createElement('div');
      div.classList.add('message', sender);
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }
  });
  