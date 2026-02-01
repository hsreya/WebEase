// === Message Sending ===
function sendMessage(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message, callback);
    }
  });
}

// === Basic Controls ===
document.getElementById("fontSize").addEventListener("input", (e) => {
  sendMessage({ type: "fontSize", value: e.target.value });
});

document.getElementById("lineHeight").addEventListener("input", (e) => {
  sendMessage({ type: "lineHeight", value: e.target.value });
});

document.getElementById("fontFamily").addEventListener("change", (e) => {
  sendMessage({ type: "fontFamily", value: e.target.value });
});

document.getElementById("bold").addEventListener("click", () => {
  sendMessage({ type: "bold" });
  showVoiceFeedback("Bold toggled");
});

document.getElementById("italic").addEventListener("click", () => {
  sendMessage({ type: "italic" });
  showVoiceFeedback("Italic toggled");
});

// === Voice Assistant ===
const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");
const voiceFeedback = document.getElementById("voiceFeedback");

let isListening = false;

function showVoiceFeedback(message) {
  voiceFeedback.textContent = message;
  voiceFeedback.classList.add("active");
  setTimeout(() => {
    voiceFeedback.classList.remove("active");
  }, 3000);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "voiceListening") {
    if (message.listening) {
      voiceBtn.classList.add("listening");
      voiceStatus.textContent = "Listening...";
      isListening = true;
    } else {
      voiceBtn.classList.remove("listening");
      voiceStatus.textContent = "Tap to Speak";
      isListening = false;
    }
  }

  if (message.type === "voiceResult") {
    showVoiceFeedback('Heard: "' + message.command + '"');
  }

  if (message.type === "voiceError") {
    showVoiceFeedback("Error: " + message.error);
    voiceBtn.classList.remove("listening");
    voiceStatus.textContent = "Tap to Speak";
    isListening = false;
  }
});

voiceBtn.addEventListener("click", () => {
  if (isListening) {
    return;
  }

  voiceBtn.classList.add("listening");
  voiceStatus.textContent = "Listening...";
  isListening = true;

  // Send message to content script to start voice recognition
  sendMessage({ type: "startVoiceRecognition" }, (response) => {
    if (chrome.runtime.lastError) {
      showVoiceFeedback("Error: Make sure you are on a webpage (not chrome:// pages)");
      voiceBtn.classList.remove("listening");
      voiceStatus.textContent = "Tap to Speak";
      isListening = false;
    }
  });
});

// === Text-to-Speech Controls ===
const speechRateSlider = document.getElementById("speechRate");
const speedLabel = document.getElementById("speedLabel");

speechRateSlider.addEventListener("input", (e) => {
  speedLabel.textContent = e.target.value + "x";
});

document.getElementById("readPageBtn").addEventListener("click", () => {
  sendMessage({ type: "getPageText" }, (response) => {
    if (chrome.runtime.lastError) {
      showVoiceFeedback("Unable to read page");
      return;
    }
    const text = response && response.text ? response.text.slice(0, 5000) : "";
    if (!text) {
      showVoiceFeedback("No readable text found");
      return;
    }
    showVoiceFeedback("Reading page aloud...");
    // Use content script to speak (better compatibility)
    sendMessage({ type: "read", rate: parseFloat(speechRateSlider.value) });
  });
});

document.getElementById("stopReadBtn").addEventListener("click", () => {
  sendMessage({ type: "stopReading" });
  showVoiceFeedback("Stopped reading");
});

// === AI Summarization ===
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const STOPWORDS = new Set([
  'the', 'and', 'is', 'in', 'it', 'of', 'to', 'a', 'that', 'this', 'for', 'on', 'with', 'as', 'are', 'was', 'were', 'be', 'by', 'or', 'an', 'from', 'at', 'which', 'but', 'not', 'have', 'has', 'had'
]);

function splitIntoSentences(text) {
  const matches = text.match(/[^.!?]+[.!?]?/g);
  return matches ? matches.map(s => s.trim()) : [text];
}

function summarizeText(text, sentenceCount) {
  if (!text || !text.trim()) return '';
  const sentences = splitIntoSentences(text);
  const words = tokenize(text).filter(w => !STOPWORDS.has(w));

  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  const scores = sentences.map((s, idx) => {
    const toks = tokenize(s).filter(w => !STOPWORDS.has(w));
    let score = 0;
    toks.forEach(t => { if (freq[t]) score += freq[t]; });
    return { idx, score, text: s };
  });

  scores.sort((a, b) => b.score - a.score);
  const selected = scores.slice(0, Math.max(1, Math.min(sentenceCount, scores.length)));
  selected.sort((a, b) => a.idx - b.idx);
  return selected.map(s => s.text).join(' ');
}

function showSummary(text) {
  const out = document.getElementById('summaryOutput');
  out.textContent = text || 'No summary available.';
}

document.getElementById('summarizePageBtn').addEventListener('click', () => {
  const DEFAULT_SENTENCES = 3;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'getPageText' }, (response) => {
      if (chrome.runtime.lastError) {
        showVoiceFeedback('Unable to get page text');
        return;
      }
      const text = response && response.text ? response.text : '';
      if (!text) {
        showSummary('No visible text found on this page.');
        return;
      }
      const summary = summarizeText(text, DEFAULT_SENTENCES);
      showSummary(summary);
      showVoiceFeedback('Page summarized');
    });
  });
});
