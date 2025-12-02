const socket = io('http://localhost:5000');

const startBtn = document.getElementById('startBtn');
const yourText = document.getElementById('yourText');
const translatedText = document.getElementById('translatedText');

const speakerLang = document.getElementById('speakerLang');
const listenerLang = document.getElementById('listenerLang');

let recognition = null;

// Speech Recognition Setup
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
} else {
    alert('Speech Recognition not supported! Use Chrome browser.');
}

startBtn.addEventListener('click', () => {
    if (!recognition) return;

    // Set speaker language
    recognition.lang = speakerLang.value;

    recognition.start();

    recognition.onresult = function(event) {
        let text = event.results[0][0].transcript;
        yourText.innerHTML = text;

        // Send text + languages to backend
        socket.emit('translate-message', {
            text,
            targetLang: listenerLang.value
        });
    };
});

// RECEIVE translated text
socket.on('translated-text', (data) => {
    translatedText.innerHTML = data.text;

    // Speak translated output
    let speech = new SpeechSynthesisUtterance(data.text);
    speech.lang = data.lang;
    speechSynthesis.speak(speech);
});
