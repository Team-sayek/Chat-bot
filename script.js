// DOM elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const newChatButton = document.getElementById('newChatButton');
const themeToggle = document.getElementById('themeToggle');
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const closeModal = document.getElementById('closeModal');
const currentMode = document.getElementById('currentMode');

// API Configuration - UPDATE THIS WITH YOUR API KEY
let API_CONFIG = {
    provider: 'gemini', // 'gemini' or 'custom'
    geminiKey: 'AIzaSyAWzV_zRGow_5ruLuNRCv06cQ1AXrICsbo', // ← REPLACE WITH YOUR ACTUAL KEY
    customEndpoint: '',
    customKey: '',
    useMock: false // ← Set to false to use real API
};

// Chat history storage
let CHAT_HISTORY = [];

// Initialize the chat
function initChat() {
    console.log('Initializing chat...');
    console.log('API Config:', API_CONFIG);
    
    // Load theme preference, API config, and chat history
    loadTheme();
    loadAPIConfig();
    loadChatHistory();
    
    // Set up event listeners
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    newChatButton.addEventListener('click', startNewChat);
    themeToggle.addEventListener('click', toggleTheme);
    settingsButton.addEventListener('click', openSettings);
    closeModal.addEventListener('click', closeSettings);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettings();
        }
    });
    
    // Auto-resize textarea
    userInput.addEventListener('input', autoResizeTextarea);
    
    // Focus on input field
    userInput.focus();
    
    console.log('Chat initialized successfully');
}

// Send a message
async function sendMessage() {
    const message = userInput.value.trim();
    console.log('Sending message:', message);
    
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input and reset height
    userInput.value = '';
    autoResizeTextarea();
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Get response from API or mock
        const response = await getAPIResponse(message);
        
        // Remove typing indicator
        removeTypingIndicator();
        
        // Add bot response to chat with formatting
        addFormattedMessage(response, 'bot');
        
        // Save chat history after successful message
        saveChatHistory();
    } catch (error) {
        // Remove typing indicator
        removeTypingIndicator();
        
        // Show error message with details
        const errorMsg = `Sorry, I'm having trouble connecting to the AI service. Error: ${error.message}`;
        addMessage(errorMsg, 'bot');
        console.error('API Error Details:', error);
        
        // Switch back to demo mode on error
        API_CONFIG.useMock = true;
        console.log('Switched to demo mode due to API error');
        
        // Save chat history even on error
        saveChatHistory();
    }
}

// Get response from API or mock
async function getAPIResponse(message) {
    // If using mock responses (for demo purposes)
    if (API_CONFIG.useMock) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        return generateMockResponse(message);
    }
    
    // Real API implementation
    if (API_CONFIG.provider === 'gemini' && API_CONFIG.geminiKey) {
        return await callGeminiAPI(message);
    } else if (API_CONFIG.provider === 'custom' && API_CONFIG.customEndpoint) {
        return await callCustomAPI(message);
    } else {
        throw new Error('No valid API configuration found. Please check your API key.');
    }
}

// Call Gemini API - IMPROVED PROMPT FOR NATURAL RESPONSES
async function callGeminiAPI(message) {
    console.log('Calling Gemini API with key:', API_CONFIG.geminiKey ? 'Key exists' : 'No key');
    
    // Gemini 2.0 Models - LATEST ENDPOINTS
    const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${API_CONFIG.geminiKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_CONFIG.geminiKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-thinking:generateContent?key=${API_CONFIG.geminiKey}`,
    ];
    
    let lastError = null;
    
    for (const endpoint of endpoints) {
        try {
            console.log('Trying Gemini 2.0 endpoint:', endpoint);
            
            // SMART PROMPT - Context-aware responses
            const smartPrompt = `
You are a helpful AI assistant. Please respond naturally and appropriately to the user's message.

**Guidelines:**
- For simple greetings (hi, hello, hey): Respond warmly and briefly
- For casual conversation: Be friendly and conversational
- For technical/code questions: Provide well-structured code with explanations
- For complex topics: Use clear sections, bullet points, or numbered steps when helpful
- For creative requests: Be engaging and creative
- Always match the tone and complexity of the user's question

**Formatting (use only when helpful):**
- Use **bold** for emphasis
- Use bullet points for lists
- Use code blocks \`\`\` for code examples
- Keep paragraphs concise

**Current user message:** "${message}"

Please provide a natural, appropriate response:`;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: smartPrompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.8, // Slightly higher for more natural responses
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH", 
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                })
            });
            
            console.log('API Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error response:', errorText);
                
                if (response.status === 404) {
                    throw new Error(`Model endpoint not found (404). Trying next model...`);
                } else if (response.status === 400) {
                    throw new Error(`Bad request (400). Check your API key and request format.`);
                } else if (response.status === 403) {
                    throw new Error(`Access forbidden (403). Check if Gemini API is enabled and your API key is valid.`);
                } else if (response.status === 429) {
                    throw new Error(`Rate limit exceeded (429). Too many requests.`);
                } else {
                    throw new Error(`Gemini API error: ${response.status} - ${response.statusText}`);
                }
            }
            
            const data = await response.json();
            console.log('API Success response:', data);
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const responseText = data.candidates[0].content.parts[0].text;
                console.log(`Success with model: ${endpoint.split('/').pop()}`);
                return responseText;
            } else if (data.error) {
                throw new Error(`API Error: ${data.error.message}`);
            } else {
                throw new Error('Unexpected API response format');
            }
            
        } catch (error) {
            console.error(`Endpoint ${endpoint} failed:`, error);
            lastError = error;
            continue; // Try next endpoint
        }
    }
    
    throw lastError || new Error('All Gemini API endpoints failed. Please check your API key and ensure Gemini API is enabled in Google AI Studio.');
}

// Call Custom API
async function callCustomAPI(message) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (API_CONFIG.customKey) {
        headers['Authorization'] = `Bearer ${API_CONFIG.customKey}`;
    }
    
    const response = await fetch(API_CONFIG.customEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            message: message
        })
    });
    
    if (!response.ok) {
        throw new Error(`Custom API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response || data.message || data.answer || data.content;
}

// Add a formatted message to the chat with proper styling
function addFormattedMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    
    const avatarIcon = document.createElement('i');
    avatarIcon.className = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
    avatarDiv.appendChild(avatarIcon);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content formatted-content';
    
    // Format the text with proper HTML structure
    const formattedText = formatResponseText(text);
    contentDiv.innerHTML = formattedText;
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = getCurrentTime();
    
    contentDiv.appendChild(timestampSpan);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Add to chat history
    CHAT_HISTORY.push({
        text: text,
        sender: sender,
        timestamp: new Date().toISOString(),
        formatted: true
    });
    
    // Scroll to bottom
    scrollToBottom();
}

// Add a simple message (for errors, etc.)
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    
    const avatarIcon = document.createElement('i');
    avatarIcon.className = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
    avatarDiv.appendChild(avatarIcon);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textParagraph = document.createElement('p');
    textParagraph.textContent = text;
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = getCurrentTime();
    
    contentDiv.appendChild(textParagraph);
    contentDiv.appendChild(timestampSpan);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Add to chat history
    CHAT_HISTORY.push({
        text: text,
        sender: sender,
        timestamp: new Date().toISOString(),
        formatted: false
    });
    
    // Scroll to bottom
    scrollToBottom();
}

// Format response text with proper HTML structure
function formatResponseText(text) {
    if (!text) return '<p>No response received.</p>';
    
    let formattedText = text;
    
    // Convert markdown-style formatting to HTML
    formattedText = formattedText
        // Code blocks
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<div class="code-block"><div class="code-header">$1</div><pre><code>$2</code></pre></div>')
        .replace(/```([\s\S]*?)```/g, '<div class="code-block"><pre><code>$1</code></pre></div>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Lists
        .replace(/^\s*[-*]\s+(.+)$/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        // Line breaks and paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    // Ensure the text is wrapped in paragraphs if not already structured
    if (!formattedText.includes('<h1') && !formattedText.includes('<h2') && !formattedText.includes('<div class="code-block"')) {
        formattedText = formattedText.split('\n').map(line => {
            if (line.trim() === '') return '</p><p>';
            return line;
        }).join('');
        formattedText = '<p>' + formattedText + '</p>';
    }
    
    // Clean up any empty paragraphs
    formattedText = formattedText.replace(/<p><\/p>/g, '');
    
    return formattedText;
}

// Get current time for message timestamp
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Show typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.id = 'typingIndicator';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    
    const avatarIcon = document.createElement('i');
    avatarIcon.className = 'fas fa-robot';
    avatarDiv.appendChild(avatarIcon);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'typing-dots';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        dotsDiv.appendChild(dot);
    }
    
    contentDiv.appendChild(dotsDiv);
    typingDiv.appendChild(avatarDiv);
    typingDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Generate mock responses (fallback)
function generateMockResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        return "Hello! I'm Nexus AI, your intelligent assistant. How can I help you today?";
    } else if (lowerMessage.includes('how are you')) {
        return "I'm functioning perfectly! As an AI, I don't have feelings, but I'm ready to assist you with any questions or tasks you have.";
    } else if (lowerMessage.includes('name')) {
        return "I'm Nexus AI, a sophisticated language model designed to help with a wide variety of tasks.";
    } else if (lowerMessage.includes('thank')) {
        return "You're welcome! I'm glad I could help. Is there anything else you'd like to know?";
    } else if (lowerMessage.includes('weather')) {
        return "I don't have real-time weather data access in this demo. In a full implementation, I could connect to weather services to provide current conditions.";
    } else if (lowerMessage.includes('joke')) {
        const jokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "Why did the scarecrow win an award? He was outstanding in his field!",
            "Why don't skeletons fight each other? They don't have the guts!",
            "What do you call a fake noodle? An impasta!"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    } else if (lowerMessage.includes('help')) {
        return "I can help with a wide variety of tasks including answering questions, generating content, explaining concepts, assisting with coding, creative writing, and much more. What specific help do you need?";
    } else if (lowerMessage.includes('dark mode') || lowerMessage.includes('theme')) {
        return "You can toggle between dark and light mode by clicking the moon/sun icon in the top right corner!";
    } else if (lowerMessage.includes('api')) {
        return "I see you're asking about the API. If you're getting errors, please check: 1) Your API key is valid, 2) Billing is enabled on your Google Cloud account, 3) The Gemini API is enabled in your Google AI Studio.";
    } else {
        return "I understand you're asking: \"" + message + "\". This is a demonstration response. To get real AI responses, please configure a valid API key.";
    }
}

// Start a new chat
function startNewChat() {
    console.log('Starting new chat...');
    
    // Remove all messages except the first one (welcome message)
    while (chatMessages.children.length > 1) {
        chatMessages.removeChild(chatMessages.lastChild);
    }
    
    // Clear chat history
    CHAT_HISTORY = [];
    localStorage.removeItem('chatHistory');
    
    // Clear any typing indicator
    removeTypingIndicator();
    
    // Focus on input
    userInput.focus();
    
    console.log('New chat started');
}

// Save chat history to localStorage
function saveChatHistory() {
    try {
        localStorage.setItem('chatHistory', JSON.stringify(CHAT_HISTORY));
        console.log('Chat history saved:', CHAT_HISTORY.length, 'messages');
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

// Load chat history from localStorage
function loadChatHistory() {
    try {
        const savedHistory = localStorage.getItem('chatHistory');
        if (savedHistory) {
            CHAT_HISTORY = JSON.parse(savedHistory);
            console.log('Chat history loaded:', CHAT_HISTORY.length, 'messages');
            
            // Clear existing messages except the welcome message
            while (chatMessages.children.length > 1) {
                chatMessages.removeChild(chatMessages.lastChild);
            }
            
            // Recreate messages from history
            CHAT_HISTORY.forEach(message => {
                if (message.formatted) {
                    addFormattedMessage(message.text, message.sender);
                } else {
                    addMessage(message.text, message.sender);
                }
            });
        } else {
            console.log('No chat history found, starting fresh');
            CHAT_HISTORY = [];
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        CHAT_HISTORY = [];
    }
}

// Toggle between light and dark theme
function toggleTheme() {
    console.log('Toggling theme...');
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Update the icon
    const themeIcon = themeToggle.querySelector('i');
    if (themeIcon) {
        themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    // Save theme preference
    localStorage.setItem('theme', newTheme);
    
    console.log('Theme changed to:', newTheme);
}

// Load theme preference
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update the theme icon
    const themeIcon = themeToggle.querySelector('i');
    if (themeIcon) {
        themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// Load API configuration
function loadAPIConfig() {
    const savedConfig = localStorage.getItem('apiConfig');
    if (savedConfig) {
        try {
            API_CONFIG = { ...API_CONFIG, ...JSON.parse(savedConfig) };
            updateModeDisplay();
        } catch (e) {
            console.error('Error loading API config:', e);
        }
    }
}

// Update mode display in settings
function updateModeDisplay() {
    if (currentMode) {
        if (API_CONFIG.useMock) {
            currentMode.textContent = 'Demo Mode (Mock Responses)';
            currentMode.style.color = 'orange';
        } else if (API_CONFIG.provider === 'gemini') {
            currentMode.textContent = 'Gemini 2.0 API Mode - Active';
            currentMode.style.color = 'green';
        } else if (API_CONFIG.provider === 'custom') {
            currentMode.textContent = 'Custom API Mode - Active';
            currentMode.style.color = 'blue';
        }
    }
}

// Open settings modal
function openSettings() {
    console.log('Opening settings...');
    updateModeDisplay();
    settingsModal.style.display = 'flex';
}

// Close settings modal
function closeSettings() {
    settingsModal.style.display = 'none';
}

// Auto-resize textarea
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
}

// Scroll to bottom of chat
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// === API CONFIGURATION FUNCTIONS ===

// Set up Gemini API
window.setGeminiAPI = function(apiKey) {
    if (!apiKey || apiKey.trim() === '') {
        console.error('Please provide a valid API key');
        return 'Error: Please provide a valid API key';
    }
    
    API_CONFIG.provider = 'gemini';
    API_CONFIG.geminiKey = apiKey.trim();
    API_CONFIG.useMock = false;
    localStorage.setItem('apiConfig', JSON.stringify(API_CONFIG));
    console.log('Gemini API configured successfully!');
    updateModeDisplay();
    return 'Gemini 2.0 API configured! Try sending a message to test.';
};

// Set up Custom API
window.setCustomAPI = function(endpoint, apiKey = '') {
    API_CONFIG.provider = 'custom';
    API_CONFIG.customEndpoint = endpoint;
    API_CONFIG.customKey = apiKey;
    API_CONFIG.useMock = false;
    localStorage.setItem('apiConfig', JSON.stringify(API_CONFIG));
    console.log('Custom API configured successfully!');
    updateModeDisplay();
    return 'Custom API configured! Try sending a message to test.';
};

// Switch back to demo mode
window.setDemoMode = function() {
    API_CONFIG.useMock = true;
    localStorage.setItem('apiConfig', JSON.stringify(API_CONFIG));
    console.log('Switched to demo mode');
    updateModeDisplay();
    return 'Demo mode activated! Using mock responses.';
};

// Check current API configuration
window.getAPIConfig = function() {
    return API_CONFIG;
};

// Test API connection
window.testAPI = async function() {
    console.log('Testing Gemini 2.0 API connection...');
    try {
        const testMessage = "Hello, this is a test message. Please respond with 'Gemini 2.0 API is working!'";
        const response = await getAPIResponse(testMessage);
        console.log('Gemini 2.0 API Test Success:', response);
        return `Gemini 2.0 API Test Successful: ${response}`;
    } catch (error) {
        console.error('Gemini 2.0 API Test Failed:', error);
        return `Gemini 2.0 API Test Failed: ${error.message}`;
    }
};

// Get available Gemini 2.0 models
window.getGeminiModels = function() {
    return [
        'gemini-2.0-flash-lite (Free Tier - Recommended)',
        'gemini-2.0-flash (Latest & Most Capable)',
        'gemini-2.5-flash-lite-thinking (Experimental)',
    ];
};

// Clear all stored data (for debugging)
window.clearAllData = function() {
    localStorage.removeItem('chatHistory');
    localStorage.removeItem('apiConfig');
    localStorage.removeItem('theme');
    CHAT_HISTORY = [];
    location.reload();
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initChat);