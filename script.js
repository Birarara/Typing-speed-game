const typing_ground = document.querySelector('#textarea');
const show_sentence = document.querySelector('#showSentence');

let startTime, endTime, totalTimeTaken, author;
let isGameRunning = false; 

const fallbackQuotes = [
    { quote: "The quick brown fox jumps over the lazy dog.", author: "Traditional" },
    { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { quote: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { quote: "Code is like humor. When you have to explain it, it’s bad.", author: "Cory House" }
];

const renderSentenceWithSpans = (textString) => {
    show_sentence.innerHTML = "";
    const cleanText = textString
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '');
    cleanText.split("").forEach(char => {
        const charSpan = document.createElement('span');
        charSpan.innerText = char;
        show_sentence.appendChild(charSpan);
    });
};

const calculateTypingSpeed = (time_taken) => {
    let totalWords = typing_ground.value.trim();
    let actualWords = totalWords === '' ? 0 : totalWords.split(/\s+/).length;

    if (actualWords !== 0) {
        let typing_speed = Math.round((actualWords / time_taken) * 60);
        show_sentence.innerHTML = `Speed: ${typing_speed} WPM <br> Time: ${Math.round(time_taken)}s <br> Author: ${author} <br> [Press Enter to restart]`;
    } else {
        show_sentence.innerHTML = `Speed: 0 WPM | Time: ${Math.round(time_taken)}s [Press Enter to restart]`;
    }
};

const endTypingTest = () => {
    isGameRunning = false;
    let date = new Date();
    endTime = date.getTime();
    totalTimeTaken = (endTime - startTime) / 1000;

    calculateTypingSpeed(totalTimeTaken);
    typing_ground.value = "";
    typing_ground.setAttribute('disabled', 'true');
};

async function startTyping() {
    isGameRunning = true;
    show_sentence.innerHTML = "Fetching...";
    typing_ground.value = "";

    try {
        const response = await fetch('https://dummyjson.com/quotes/random');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        author = data.author;
        renderSentenceWithSpans(data.quote);
         
    } catch (error) {
        console.warn("Network offline, loading local fallback...");
        const randomIndex = Math.floor(Math.random() * fallbackQuotes.length);
        const selectedFallback = fallbackQuotes[randomIndex];
        
        author = selectedFallback.author;
        renderSentenceWithSpans(selectedFallback.quote);
    } finally {
        typing_ground.removeAttribute('disabled');
        typing_ground.focus();
        let date = new Date();
        startTime = date.getTime();
    }
}


typing_ground.addEventListener('input', () => {
    const arraySpans = show_sentence.querySelectorAll('span');
    
    
    let cleanInputValue = typing_ground.value.replace(/\n/g, '');
    const arrayValues = cleanInputValue.split('');

    arraySpans.forEach((characterSpan, index) => {
        const typedChar = arrayValues[index];
        if (typedChar == null) {
            characterSpan.classList.remove('correct-char', 'incorrect-char');
        } else if (typedChar === characterSpan.innerText) {
            characterSpan.classList.add('correct-char');
            characterSpan.classList.remove('incorrect-char');
        } else {
            characterSpan.classList.remove('correct-char');
            characterSpan.classList.add('incorrect-char');
        }
    });
});


window.addEventListener('keydown', (e) => {
    if (e.key === "Enter") {
        e.preventDefault(); 
        if (!isGameRunning) {
            startTyping();
        } else {
            endTypingTest();
        }
    }
});

window.addEventListener('click', () => {
    if (isGameRunning) typing_ground.focus();
});


show_sentence.innerHTML = "Press [ Enter ] to start typing";