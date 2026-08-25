document.addEventListener('DOMContentLoaded', () => {
  const chatFeed = document.getElementById('chat-feed') || document.querySelector('.flex-1.overflow-y-auto');
  const messageInput = document.getElementById('message-input') || document.querySelector('textarea');
  const sendButton = document.getElementById('send-btn') || document.querySelector('button[type="submit"]');
  const clearButton = document.getElementById('clear-chat-btn');
  const personaSelect = document.getElementById('persona-select');

  let messages = [];

  // Helper: Render Markdown with Highlight.js
  function renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        highlight: function (code, lang) {
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          }
          return typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : code;
        },
        breaks: true
      });
      return marked.parse(text);
    }
    return text.replace(/\n/g, '<br>');
  }

  // Append Message to UI
  function appendMessage(role, text = '') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} my-4`;

    const bubble = document.createElement('div');
    bubble.className = role === 'user'
      ? 'bg-[#1E293B] text-white px-5 py-3 rounded-2xl max-w-2xl border border-gray-700 shadow-md'
      : 'bg-[#1A1A1E] text-gray-200 px-6 py-4 rounded-2xl max-w-3xl border border-red-500/20 shadow-lg markdown-body';

    bubble.innerHTML = role === 'user' ? text : (renderMarkdown(text) || '<span class="animate-pulse text-red-400">Thinking...</span>');

    msgDiv.appendChild(bubble);
    chatFeed.appendChild(msgDiv);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    return bubble;
  }

  // Add Copy Button to Code Blocks
  function attachCodeCopyButtons(container) {
    container.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.copy-code-btn')) return;
      pre.classList.add('relative', 'group');
      const btn = document.createElement('button');
      btn.className = 'copy-code-btn absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded transition opacity-0 group-hover:opacity-100';
      btn.innerText = 'Copy';
      btn.onclick = () => {
        const code = pre.querySelector('code')?.innerText || pre.innerText;
        navigator.clipboard.writeText(code);
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = 'Copy', 2000);
      };
      pre.appendChild(btn);
    });
  }

  // Send Message Handler
  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    // Display user message
    appendMessage('user', text);
    messages.push({ role: 'user', content: text });
    messageInput.value = '';

    // Create AI message placeholder
    const aiBubble = appendMessage('assistant', '');

    try {
      const customKey = localStorage.getItem('nemoplay_custom_api_key') || '';
      const selectedPersona = personaSelect ? personaSelect.value : 'General Assistant';

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          persona: selectedPersona,
          custom_api_key: customKey
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        aiBubble.innerHTML = `<div class="p-3 bg-red-950/50 border border-red-500 rounded-lg text-red-300">
                    <strong>⚠️ Error:</strong> ${errData.detail || 'Request failed'}
                </div>`;
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulatedText += parsed.text;
                aiBubble.innerHTML = renderMarkdown(accumulatedText);
                attachCodeCopyButtons(aiBubble);
                chatFeed.scrollTop = chatFeed.scrollHeight;
              }
            } catch (e) {
              // Skip non-json lines
            }
          }
        }
      }

      messages.push({ role: 'assistant', content: accumulatedText });

    } catch (error) {
      aiBubble.innerHTML = `<span class="text-red-400">⚠️ Connection Error: ${error.message}</span>`;
    }
  }

  if (sendButton) sendButton.addEventListener('click', sendMessage);
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
});