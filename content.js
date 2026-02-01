let isBold = false;
let isItalic = false;

// Voice recognition state
let isListening = false;
let recognition = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "getSelection") {
    const sel = window.getSelection ? window.getSelection().toString() : '';
    sendResponse({ text: sel });
    return true;
  }

  if (message.type === "getPageText") {
    const text = document.body && document.body.innerText ? document.body.innerText.trim() : '';
    sendResponse({ text: text });
    return true;
  }

  // Voice Recognition - runs in content script context (has mic access)
  if (message.type === "startVoiceRecognition") {
    startVoiceRecognition();
    sendResponse({ started: true });
    return true;
  }

  if (message.type === "fontSize") {
    document.body.style.fontSize = message.value + "px";
    document.querySelectorAll('p, span, div, a, li, td, th, h1, h2, h3, h4, h5, h6').forEach(el => {
      el.style.fontSize = message.value + "px";
    });
  }

  if (message.type === "lineHeight") {
    document.body.style.lineHeight = message.value;
    document.querySelectorAll('p, span, div, a, li, td, th').forEach(el => {
      el.style.lineHeight = message.value;
    });
  }

  if (message.type === "fontFamily") {
    const fontValue = message.value === "default" ? "" : message.value;
    document.body.style.fontFamily = fontValue;
    document.querySelectorAll('p, span, div, a, li, td, th, h1, h2, h3, h4, h5, h6').forEach(el => {
      el.style.fontFamily = fontValue;
    });
  }

  if (message.type === "bold") {
    isBold = !isBold;
    const weight = isBold ? "bold" : "normal";
    document.body.style.fontWeight = weight;
    document.querySelectorAll('p, span, div, a, li, td, th').forEach(el => {
      el.style.fontWeight = weight;
    });
  }

  if (message.type === "italic") {
    isItalic = !isItalic;
    const style = isItalic ? "italic" : "normal";
    document.body.style.fontStyle = style;
    document.querySelectorAll('p, span, div, a, li, td, th').forEach(el => {
      el.style.fontStyle = style;
    });
  }

  if (message.type === "read") {
    const text = document.body.innerText.slice(0, 5000);
    const speech = new SpeechSynthesisUtterance(text);
    speech.rate = message.rate || 1;
    speechSynthesis.speak(speech);
  }

  if (message.type === "stopReading") {
    speechSynthesis.cancel();
  }
});

// Voice Recognition Function
function startVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    chrome.runtime.sendMessage({ type: "voiceError", error: "Speech recognition not supported" });
    return;
  }

  if (isListening && recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  isListening = true;
  chrome.runtime.sendMessage({ type: "voiceListening", listening: true });

  recognition.start();

  recognition.onresult = (event) => {
    const command = event.results[0][0].transcript.toLowerCase();
    chrome.runtime.sendMessage({ type: "voiceResult", command: command });
    handleVoiceCommandLocally(command);
  };

  recognition.onerror = (event) => {
    chrome.runtime.sendMessage({ type: "voiceError", error: event.error });
    isListening = false;
  };

  recognition.onend = () => {
    isListening = false;
    chrome.runtime.sendMessage({ type: "voiceListening", listening: false });
  };
}

// Handle voice commands directly in content script
function handleVoiceCommandLocally(command) {
  // Font size commands
  if (command.includes("increase font") || command.includes("bigger") || command.includes("larger")) {
    const currentSize = parseInt(getComputedStyle(document.body).fontSize) || 16;
    const newSize = Math.min(currentSize + 4, 30);
    document.body.style.fontSize = newSize + "px";
    speak("Font size increased");
    return;
  }

  if (command.includes("decrease font") || command.includes("smaller")) {
    const currentSize = parseInt(getComputedStyle(document.body).fontSize) || 16;
    const newSize = Math.max(currentSize - 4, 12);
    document.body.style.fontSize = newSize + "px";
    speak("Font size decreased");
    return;
  }

  // Bold command
  if (command.includes("bold")) {
    isBold = !isBold;
    document.body.style.fontWeight = isBold ? "bold" : "normal";
    speak("Bold " + (isBold ? "enabled" : "disabled"));
    return;
  }

  // Italic command
  if (command.includes("italic")) {
    isItalic = !isItalic;
    document.body.style.fontStyle = isItalic ? "italic" : "normal";
    speak("Italic " + (isItalic ? "enabled" : "disabled"));
    return;
  }

  // Line spacing commands
  if (command.includes("increase spacing") || command.includes("more spacing")) {
    const currentHeight = parseFloat(getComputedStyle(document.body).lineHeight) || 1.5;
    document.body.style.lineHeight = Math.min(currentHeight + 0.3, 3);
    speak("Line spacing increased");
    return;
  }

  if (command.includes("decrease spacing") || command.includes("less spacing")) {
    const currentHeight = parseFloat(getComputedStyle(document.body).lineHeight) || 1.5;
    document.body.style.lineHeight = Math.max(currentHeight - 0.3, 1);
    speak("Line spacing decreased");
    return;
  }

  // Font family commands
  if (command.includes("arial")) {
    document.body.style.fontFamily = "Arial";
    speak("Font changed to Arial");
    return;
  }

  if (command.includes("georgia")) {
    document.body.style.fontFamily = "Georgia";
    speak("Font changed to Georgia");
    return;
  }

  if (command.includes("verdana")) {
    document.body.style.fontFamily = "Verdana";
    speak("Font changed to Verdana");
    return;
  }

  // Read page command
  if (command.includes("read") && (command.includes("page") || command.includes("this"))) {
    const text = document.body.innerText.slice(0, 5000);
    speak(text);
    return;
  }

  // Stop reading command
  if (command.includes("stop")) {
    speechSynthesis.cancel();
    return;
  }

  // Default response
  speak("Sorry, I didn't understand that command");
}

// Text-to-speech helper
function speak(text) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
  }
}
