// script.js - Improved mobile support, auto-stop/translate, and cleanup

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const speechOut = document.getElementById("speech");
const transOut = document.getElementById("translated");
const sourceSelect = document.getElementById("sourceLang");
const targetSelect = document.getElementById("targetLang");

let recognition = null;
let isListening = false;
let finalTranscript = "";
let silenceTimer = null; // Timer for auto-translation

// --- Configuration ---
// Minimal list of languages.
const LANGS = [
    { srclang: "en-US", target: "en", label: "English (US)" },
    { srclang: "hi-IN", target: "hi", label: "Hindi" },
    { srclang: "gu-IN", target: "gu", label: "Gujarati" },
    { srclang: "ta-IN", target: "ta", label: "Tamil" },
    { srclang: "fr-FR", target: "fr", label: "French" },
    { srclang: "es-ES", target: "es", label: "Spanish" },
    { srclang: "ar-SA", target: "ar", label: "Arabic" },
    { srclang: "de-DE", target: "de", label: "German" },
    { srclang: "bn-IN", target: "bn", label: "Bengali" }
];

const TARGET_TTS_MAP = {
    en: "en-US", hi: "hi-IN", gu: "gu-IN", ta: "ta-IN", fr: "fr-FR", es: "es-ES", ar: "ar-SA", de: "de-DE", bn: "bn-IN"
};

const SILENCE_TIMEOUT_MS = 2000; // 2 seconds of silence

// --- Initialization ---

function populateLangs() {
    LANGS.forEach(l => {
        // Source Language Select
        const o1 = document.createElement("option");
        o1.value = l.srclang;
        o1.textContent = l.label;
        sourceSelect.appendChild(o1);

        // Target Language Select
        const o2 = document.createElement("option");
        o2.value = l.target;
        o2.textContent = l.label;
        targetSelect.appendChild(o2);
    });
    // Set defaults
    sourceSelect.value = "en-US";
    targetSelect.value = "hi";
}

populateLangs();

// Request mic permission on load (best effort)
async function requestMicPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        return true;
    } catch (err) {
        console.error("Mic permission denied:", err);
        return false;
    }
}

// --- Speech Recognition Logic ---

function stopRecognition() {
    if (recognition) {
        try { recognition.stop(); } catch (e) { console.warn("Error stopping recognition:", e); }
    }
    isListening = false;
    clearTimeout(silenceTimer);
    startBtn.disabled = false;
    stopBtn.disabled = true;
    window.speechSynthesis.cancel(); // Stop any pending speech
    console.log("Stopped listening and translator reset.");
}

// Function to handle the auto-translation after silence
function triggerAutoTranslation() {
    if (finalTranscript.trim().length > 0) {
        const toTranslate = finalTranscript.trim();
        finalTranscript = ""; // Reset accumulator
        callTranslateAndSpeak(toTranslate, targetSelect.value);
    }
    stopRecognition(); // Stop listening after translation is initiated
}

function resetSilenceTimer() {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(triggerAutoTranslation, SILENCE_TIMEOUT_MS);
}

function initRecognition(sourceLang) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Speech Recognition is not supported in this browser. Use Chrome/Edge.");
        return null;
    }

    const recog = new SpeechRecognition();
    recog.lang = sourceLang || "en-US";
    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    // --- Event Handlers ---

    recog.onerror = (e) => {
        console.error("Recognition error", e);
        // If an error occurs, and we were listening, stop gracefully
        if (isListening) {
            stopRecognition();
        }
    };

    recog.onstart = () => {
        console.log("Recognition started");
        isListening = true;
        // Start the silence timer immediately
        resetSilenceTimer(); 
    };

    recog.onend = () => {
        console.log("Recognition ended (possibly due to browser timeout)");
        // If we were listening, try to restart (mobile fix), otherwise the stop button was pressed.
        if (isListening) {
            try {
                // This restart is key for mobile browsers that impose time limits
                recog.start();
                console.log("Recognition auto-restarted.");
            } catch (e) {
                console.warn("Could not restart recognition:", e);
                // If restart fails, stop gracefully.
                stopRecognition();
            }
        }
    };

    recog.onresult = (event) => {
        resetSilenceTimer(); // Reset timer on every result (user is still speaking)

        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
                // Accumulate final result
                finalTranscript += res[0].transcript.trim() + " ";
            } else {
                interim += res[0].transcript;
            }
        }
        
        // Update UI with accumulated final + current interim
        speechOut.textContent = (finalTranscript + interim).trim() || "Listening...";
    };

    return recog;
}

// --- Translation and TTS ---

async function callTranslateAndSpeak(text, targetLangShort) {
    transOut.textContent = "Translating...";
    try {
        // Uses the Express route /api/translate
        const resp = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, target: targetLangShort })
        });
        const data = await resp.json();
        
        if (data.error) {
            transOut.textContent = `Translate error: ${data.error}`;
            console.error(data);
            return;
        }
        
        const translated = data.translatedText || "";
        transOut.textContent = translated;
        speakText(translated, targetLangShort);
    } catch (err) {
        console.error("Translation request failed:", err);
        transOut.textContent = "Translation request failed";
    }
}

function speakText(message, targetShort) {
    if (!("speechSynthesis" in window)) return;
    
    // Check if voices are loaded before trying to find one
    if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            _performSpeech(message, targetShort);
        };
    } else {
        _performSpeech(message, targetShort);
    }
}

function _performSpeech(message, targetShort) {
    const utter = new SpeechSynthesisUtterance(message);
    
    utter.lang = TARGET_TTS_MAP[targetShort] || targetShort || "en-US";
    utter.rate = 1;
    utter.pitch = 1;

    // Try to pick a voice that matches language (best-effort)
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => 
        (v.lang || "").toLowerCase().startsWith((utter.lang || "").slice(0, 2))
    );
    if (voice) utter.voice = voice;

    window.speechSynthesis.cancel(); // Stop previous speech
    window.speechSynthesis.speak(utter);
}


// --- Event Listeners ---

startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    finalTranscript = ""; // Clear any previous transcript
    speechOut.textContent = "Preparing...";
    transOut.textContent = "-";
    
    const allowed = await requestMicPermission();
    if (!allowed) {
        alert("Please allow microphone access in your browser settings.");
        startBtn.disabled = false;
        stopBtn.disabled = true;
        return;
    }

    // Initialize or re-initialize recognition if language changed
    const currentSourceLang = sourceSelect.value;
    if (!recognition || recognition.lang !== currentSourceLang) {
        if (recognition) {
            try { recognition.stop(); } catch (e) { console.warn("Stopping old recognition:", e); }
        }
        recognition = initRecognition(currentSourceLang);
        if (!recognition) {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            return;
        }
    }

    try {
        recognition.start();
        // UI updates are handled in onstart/onend/onresult
    } catch (err) {
        console.error("Start failed:", err);
        alert("Failed to start recognition. Try reloading the page.");
        startBtn.disabled = false;
        stopBtn.disabled = true;
        isListening = false;
    }
});

stopBtn.addEventListener("click", () => {
    // Manual stop will also trigger translation if there is final text
    if (finalTranscript.trim().length > 0) {
        const toTranslate = finalTranscript.trim();
        finalTranscript = ""; 
        callTranslateAndSpeak(toTranslate, targetSelect.value);
    }
    stopRecognition();
});