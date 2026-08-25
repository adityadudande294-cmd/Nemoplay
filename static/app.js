/**
 * Nemoplay - Application Logic
 * Powered by NVIDIA Nemotron 3 Ultra NIM
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const chatFeed = document.getElementById('chat-feed') || document.querySelector('.overflow-y-auto');
  const messagesList = document.getElementById('messages-list');
  const welcomeState = document.getElementById('welcome-state');
  const messageInput = document.getElementById('user-input') || document.getElementById('message-input') || document.querySelector('textarea');
  const sendButton = document.getElementById('send-btn') || document.querySelector('button[type="submit"]');
  const stopButton = document.getElementById('stop-generation-btn');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const newChatBtn = document.getElementById('new-chat-btn');
  const chatHistoryList = document.getElementById('chat-history-list');
  const chatCount = document.getElementById('chat-count');
  
  // Persona Elements
  const personaDropdownBtn = document.getElementById('persona-dropdown-btn');
  const personaDropdownMenu = document.getElementById('persona-dropdown-menu');
  const currentPersonaTitle = document.getElementById('current-persona-title');
  const currentPersonaIcon = document.getElementById('current-persona-icon');
  const badgePersonaName = document.getElementById('badge-persona-name');
  const personaOptions = document.querySelectorAll('.persona-option');

  // Sidebar Elements
  const sidebar = document.getElementById('sidebar');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
  const closeSidebarBtn = document.getElementById('close-sidebar-btn');

  // Settings Modal Elements
  const settingsModal = document.getElementById('settings-modal');
  const settingsTriggerBtn = document.getElementById('settings-trigger-btn');
  const topSettingsBtn = document.getElementById('top-settings-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const apiKeyInput = document.getElementById('api-key-input');
  const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const clearKeyBtn = document.getElementById('clear-key-btn');
  const modalStatusMsg = document.getElementById('modal-status-msg');
  const apiKeyStatusPill = document.getElementById('api-key-status-pill');

  // Starter Prompt Chips
  const promptChips = document.querySelectorAll('.prompt-chip');

  // State
  let messages = [];
  let isGenerating = false;
  let currentAbortController = null;
  let selectedPersona = 'General Assistant';

  const PERSONA_CONFIG = {
    'general': {
      name: 'General Assistant',
      badge: 'General',
      icon: 'fa-robot'
    },
    'coder': {
      name: 'Coding & Data Science Expert',
      badge: 'Coder',
      icon: 'fa-code'
    },
    'architect': {
      name: 'System Architect',
      badge: 'Architect',
      icon: 'fa-sitemap'
    }
  };

  // Configure Marked with Highlight.js
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      highlight: function (code, lang) {
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
          } catch (e) {
            // fallback
          }
        }
        if (typeof hljs !== 'undefined') {
          try {
            return hljs.highlightAuto(code).value;
          } catch (e) {
            // fallback
          }
        }
        return code;
      },
      breaks: true,
      gfm: true
    });
  }

  // Render Markdown Helper
  function renderMarkdown(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined') {
      try {
        return marked.parse(text);
      } catch (err) {
        console.error('Markdown parse error:', err);
      }
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function escapeHtml(string) {
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(string).replace(/[&<>"']/g, s => entityMap[s]);
  }

  // Auto Scroll Helper
  function scrollToBottom(smooth = false) {
    if (!chatFeed) return;
    if (smooth) {
      chatFeed.scrollTo({
        top: chatFeed.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      chatFeed.scrollTop = chatFeed.scrollHeight;
    }
  }

  // Attach Copy Buttons to Code Blocks
  function attachCodeCopyButtons(container) {
    if (!container) return;
    const preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach((pre) => {
      if (pre.dataset.hasCopyBtn) return;
      pre.dataset.hasCopyBtn = 'true';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper relative group';

      // Detect language if present
      const codeElem = pre.querySelector('code');
      let lang = 'code';
      if (codeElem) {
        const classNames = codeElem.className.split(' ');
        for (const cls of classNames) {
          if (cls.startsWith('language-')) {
            lang = cls.replace('language-', '');
            break;
          }
        }
      }

      // Code Block Header
      const header = document.createElement('div');
      header.className = 'code-block-header flex items-center justify-between text-xs text-gray-400 bg-[#141418] px-3 py-1.5 border-b border-white/5';
      header.innerHTML = `
        <span class="font-mono text-[11px] text-gray-400 uppercase tracking-wider">${lang}</span>
        <button type="button" class="copy-btn flex items-center gap-1 hover:text-red-400 transition-colors text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 hover:bg-red-500/10">
          <i class="fa-regular fa-copy"></i>
          <span>Copy</span>
        </button>
      `;

      const copyBtn = header.querySelector('.copy-btn');
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const codeToCopy = (codeElem ? codeElem.innerText : pre.innerText).trim();
        try {
          await navigator.clipboard.writeText(codeToCopy);
          copyBtn.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i> <span class="text-emerald-400">Copied!</span>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> <span>Copy</span>';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy code:', err);
        }
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });
  }

  // Append Message to Feed
  function appendMessage(role, text = '') {
    if (welcomeState) {
      welcomeState.classList.add('hidden');
    }

    const container = messagesList || chatFeed;
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} my-4 animate-fade-in`;

    let bubble;
    if (role === 'user') {
      bubble = document.createElement('div');
      bubble.className = 'bg-[#1E293B] text-white px-5 py-3 rounded-2xl max-w-2xl border border-gray-700/80 shadow-md whitespace-pre-wrap text-sm leading-relaxed';
      bubble.textContent = text;
      msgDiv.appendChild(bubble);
    } else {
      // Assistant Bubble with Avatar Icon
      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 text-sm shrink-0 mr-3 mt-1';
      avatarDiv.innerHTML = '<i class="fa-solid fa-microchip"></i>';

      bubble = document.createElement('div');
      bubble.className = 'bg-[#1A1A1E] text-gray-200 px-6 py-4 rounded-2xl max-w-3xl border border-red-500/20 shadow-lg prose-nemoplay text-sm leading-relaxed min-w-[120px] overflow-hidden';
      
      if (!text) {
        bubble.innerHTML = `
          <div class="flex items-center gap-2 text-red-400">
            <span class="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span class="text-xs font-mono tracking-wider animate-pulse">Thinking...</span>
          </div>`;
      } else {
        bubble.innerHTML = renderMarkdown(text);
        attachCodeCopyButtons(bubble);
      }

      msgDiv.appendChild(avatarDiv);
      msgDiv.appendChild(bubble);
    }

    container.appendChild(msgDiv);
    scrollToBottom(true);

    return bubble;
  }

  // Render Quota Exhausted Card
  function renderQuotaCard(container, customMessage) {
    const message = customMessage || 'Token quota exceeded on server. Please add your personal NVIDIA NIM API key to continue chatting.';
    container.innerHTML = `
      <div class="quota-card">
        <div class="flex items-center gap-2 text-red-400 font-bold text-sm mb-1.5">
          <i class="fa-solid fa-triangle-exclamation text-base"></i>
          <span>Quota Limit Reached</span>
        </div>
        <p class="text-xs text-gray-300 mb-3 leading-relaxed">${escapeHtml(message)}</p>
        <button type="button" class="open-key-settings-btn px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-medium flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all">
          <i class="fa-solid fa-key text-xs"></i>
          <span>Configure API Key</span>
        </button>
      </div>
    `;

    const btn = container.querySelector('.open-key-settings-btn');
    if (btn) {
      btn.addEventListener('click', () => openSettingsModal());
    }
  }

  // Render Error Boundary Bubble
  function renderErrorBubble(container, errorText) {
    container.innerHTML = `
      <div class="p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs">
        <div class="font-bold flex items-center gap-2 mb-1 text-red-400">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>Request Error</span>
        </div>
        <div class="leading-relaxed text-gray-300 font-mono text-[11px] break-words">${escapeHtml(errorText)}</div>
      </div>
    `;
  }

  // Send Message Handler
  async function sendMessage() {
    if (isGenerating) return;
    const text = messageInput.value.trim();
    if (!text) return;

    // Reset Input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Display user message & save state
    appendMessage('user', text);
    messages.push({ role: 'user', content: text });

    // Create assistant placeholder bubble with "Thinking..."
    const aiBubble = appendMessage('assistant', '');

    // Update UI State for Streaming
    isGenerating = true;
    if (sendButton) sendButton.disabled = true;
    if (stopButton) stopButton.classList.remove('hidden');

    currentAbortController = new AbortController();
    const customKey = localStorage.getItem('nemoplay_custom_api_key') || '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          messages: messages,
          persona: selectedPersona,
          custom_api_key: customKey
        }),
        signal: currentAbortController.signal
      });

      // Handle Non-200 HTTP responses immediately
      if (!response.ok) {
        let errDetail = 'Request failed with status ' + response.status;
        try {
          const errData = await response.json();
          if (errData.error_type === 'QUOTA_EXHAUSTED' || response.status === 429 || response.status === 402) {
            renderQuotaCard(aiBubble, errData.detail || errData.text);
            return;
          }
          errDetail = errData.detail || errData.error || errDetail;
        } catch (_) {
          const rawText = await response.text();
          if (rawText) errDetail = rawText;
        }
        renderErrorBubble(aiBubble, errDetail);
        return;
      }

      // Check if body is readable
      if (!response.body) {
        renderErrorBubble(aiBubble, 'Readable stream not supported by browser.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let hasReceivedFirstToken = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the incomplete line segment in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.replace(/^data:\s*/, '').trim();
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);

            // Check for error payloads from backend
            if (parsed.error_type === 'QUOTA_EXHAUSTED') {
              renderQuotaCard(aiBubble, parsed.text);
              return;
            }

            if (parsed.error) {
              renderErrorBubble(aiBubble, parsed.error);
              return;
            }

            if (parsed.text) {
              // Immediately remove "Thinking..." placeholder on the very first token received
              if (!hasReceivedFirstToken) {
                hasReceivedFirstToken = true;
                aiBubble.innerHTML = '';
              }

              accumulatedText += parsed.text;
              aiBubble.innerHTML = renderMarkdown(accumulatedText);
              attachCodeCopyButtons(aiBubble);
              scrollToBottom(false);
            }
          } catch (jsonErr) {
            // Partial or malformed SSE line, skip
          }
        }
      }

      // Handle case where stream finished without tokens
      if (!accumulatedText && !hasReceivedFirstToken) {
        renderErrorBubble(aiBubble, 'No response received from NVIDIA Nemotron.');
      } else if (accumulatedText) {
        messages.push({ role: 'assistant', content: accumulatedText });
        saveSessionToHistory();
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        if (!accumulatedText) {
          aiBubble.innerHTML = '<span class="text-xs text-gray-400 italic">Generation stopped by user.</span>';
        } else {
          messages.push({ role: 'assistant', content: accumulatedText });
        }
      } else {
        renderErrorBubble(aiBubble, `Network / Connection Error: ${error.message}`);
      }
    } finally {
      isGenerating = false;
      currentAbortController = null;
      if (sendButton) sendButton.disabled = false;
      if (stopButton) stopButton.classList.add('hidden');
      scrollToBottom(true);
    }
  }

  // Stop Generation Button
  if (stopButton) {
    stopButton.addEventListener('click', () => {
      if (currentAbortController) {
        currentAbortController.abort();
      }
    });
  }

  // Send Button Click
  if (sendButton) {
    sendButton.addEventListener('click', (e) => {
      e.preventDefault();
      sendMessage();
    });
  }

  // Textarea Keydown & Auto-Grow
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    });
  }

  // Persona Selection Logic
  if (personaDropdownBtn && personaDropdownMenu) {
    personaDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      personaDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!personaDropdownBtn.contains(e.target) && !personaDropdownMenu.contains(e.target)) {
        personaDropdownMenu.classList.add('hidden');
      }
    });

    personaOptions.forEach((btn) => {
      btn.addEventListener('click', () => {
        const pKey = btn.dataset.persona;
        const config = PERSONA_CONFIG[pKey] || PERSONA_CONFIG['general'];
        selectedPersona = config.name;

        if (currentPersonaTitle) currentPersonaTitle.textContent = config.name;
        if (badgePersonaName) badgePersonaName.textContent = config.badge;
        if (currentPersonaIcon) {
          currentPersonaIcon.className = `fa-solid ${config.icon} text-red-400`;
        }

        personaDropdownMenu.classList.add('hidden');
      });
    });
  }

  // Starter Prompt Chips
  promptChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const pText = chip.querySelector('p')?.innerText.trim() || chip.innerText.trim();
      if (messageInput) {
        messageInput.value = pText;
        messageInput.focus();
        sendMessage();
      }
    });
  });

  // Clear Chat Logic
  function clearChat() {
    messages = [];
    if (messagesList) {
      messagesList.innerHTML = '';
    }
    if (welcomeState) {
      welcomeState.classList.remove('hidden');
    }
    if (messageInput) {
      messageInput.value = '';
      messageInput.style.height = 'auto';
    }
  }

  if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);
  if (newChatBtn) newChatBtn.addEventListener('click', clearChat);

  // Sidebar Toggle (Mobile & Desktop)
  if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      sidebar.classList.toggle('hidden');
    });
  }

  if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', () => {
      sidebar.classList.add('hidden');
    });
  }

  // Settings Modal Logic
  function openSettingsModal() {
    if (!settingsModal) return;
    const storedKey = localStorage.getItem('nemoplay_custom_api_key') || '';
    if (apiKeyInput) {
      apiKeyInput.value = storedKey;
    }
    if (modalStatusMsg) {
      modalStatusMsg.className = 'hidden text-xs p-2.5 rounded-lg font-medium';
      modalStatusMsg.textContent = '';
    }
    settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    if (!settingsModal) return;
    settingsModal.classList.add('hidden');
  }

  function updateApiKeyStatusPill() {
    if (!apiKeyStatusPill) return;
    const storedKey = localStorage.getItem('nemoplay_custom_api_key') || '';
    if (storedKey) {
      apiKeyStatusPill.textContent = 'Custom Key';
      apiKeyStatusPill.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium';
    } else {
      apiKeyStatusPill.textContent = 'Default (Server)';
      apiKeyStatusPill.className = 'text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium';
    }
  }

  if (settingsTriggerBtn) settingsTriggerBtn.addEventListener('click', openSettingsModal);
  if (topSettingsBtn) topSettingsBtn.addEventListener('click', openSettingsModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeSettingsModal);

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }

  if (toggleKeyVisibilityBtn && apiKeyInput) {
    toggleKeyVisibilityBtn.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleKeyVisibilityBtn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });
  }

  if (saveKeyBtn && apiKeyInput) {
    saveKeyBtn.addEventListener('click', () => {
      const keyVal = apiKeyInput.value.trim();
      if (keyVal) {
        localStorage.setItem('nemoplay_custom_api_key', keyVal);
        if (modalStatusMsg) {
          modalStatusMsg.className = 'text-xs p-2.5 rounded-lg font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-500/30';
          modalStatusMsg.textContent = 'Custom API Key saved successfully!';
        }
      } else {
        localStorage.removeItem('nemoplay_custom_api_key');
        if (modalStatusMsg) {
          modalStatusMsg.className = 'text-xs p-2.5 rounded-lg font-medium bg-yellow-950/60 text-yellow-300 border border-yellow-500/30';
          modalStatusMsg.textContent = 'Custom key cleared. Nemoplay will use server default.';
        }
      }
      updateApiKeyStatusPill();
      setTimeout(closeSettingsModal, 1000);
    });
  }

  if (clearKeyBtn && apiKeyInput) {
    clearKeyBtn.addEventListener('click', () => {
      localStorage.removeItem('nemoplay_custom_api_key');
      apiKeyInput.value = '';
      if (modalStatusMsg) {
        modalStatusMsg.className = 'text-xs p-2.5 rounded-lg font-medium bg-yellow-950/60 text-yellow-300 border border-yellow-500/30';
        modalStatusMsg.textContent = 'Key removed from browser storage.';
      }
      updateApiKeyStatusPill();
    });
  }

  // Session History Management
  function saveSessionToHistory() {
    if (!messages.length) return;
    try {
      const sessions = JSON.parse(localStorage.getItem('nemoplay_chat_history') || '[]');
      const firstUserMsg = messages.find(m => m.role === 'user');
      const title = firstUserMsg ? firstUserMsg.content.slice(0, 32) + (firstUserMsg.content.length > 32 ? '...' : '') : 'Chat Session';
      
      const newSession = {
        id: Date.now(),
        title: title,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: messages
      };

      // Keep only top 15 recent chats
      const updated = [newSession, ...sessions.slice(0, 14)];
      localStorage.setItem('nemoplay_chat_history', JSON.stringify(updated));
      renderHistoryList();
    } catch (e) {
      console.warn('Could not save session:', e);
    }
  }

  function renderHistoryList() {
    if (!chatHistoryList) return;
    try {
      const sessions = JSON.parse(localStorage.getItem('nemoplay_chat_history') || '[]');
      if (chatCount) chatCount.textContent = sessions.length;

      if (!sessions.length) {
        chatHistoryList.innerHTML = '<div class="text-[11px] text-gray-600 px-3 py-2 italic">No previous chats</div>';
        return;
      }

      chatHistoryList.innerHTML = '';
      sessions.forEach((s) => {
        const item = document.createElement('div');
        item.className = 'w-full px-3 py-2 rounded-lg hover:bg-white/5 text-left text-xs text-gray-300 hover:text-white flex items-center justify-between cursor-pointer group transition-all';
        item.innerHTML = `
          <div class="flex items-center gap-2 truncate">
            <i class="fa-regular fa-message text-[10px] text-red-400"></i>
            <span class="truncate">${escapeHtml(s.title)}</span>
          </div>
          <span class="text-[10px] text-gray-600 group-hover:text-gray-400">${escapeHtml(s.timestamp || '')}</span>
        `;

        item.addEventListener('click', () => {
          messages = s.messages || [];
          if (welcomeState) welcomeState.classList.add('hidden');
          if (messagesList) {
            messagesList.innerHTML = '';
            messages.forEach((msg) => {
              appendMessage(msg.role, msg.content);
            });
          }
        });

        chatHistoryList.appendChild(item);
      });
    } catch (e) {
      console.warn('Could not render history:', e);
    }
  }

  // Initialize
  updateApiKeyStatusPill();
  renderHistoryList();
});