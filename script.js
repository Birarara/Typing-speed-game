//  (actualWords / totalTimeTaken) * 60;

const typing_ground = document.querySelector('#textarea');
const btn = document.querySelector('#btn');
const score = document.querySelector('#score');
const show_sentence = document.querySelector('#showSentence');


let startTime, endTime, totalTimeTaken,author;



// step 5

const calculateTypingSpeed = (time_taken) => {
    let  totalWords = typing_ground.value.trim();
    let actualWords = totalWords === '' ? 0 : totalWords.split(" ").length;

    if(actualWords !== 0) {
        let typing_speed  =  (actualWords / time_taken) * 60;
        typing_speed = Math.round(typing_speed);
        score.innerHTML = `Your typing speed is ${typing_speed} words per minutes & you wrote ${actualWords} words & time taken ${time_taken} sec`;
    }else{
        score.innerHTML = `Your typing speed is 0 words per minutes & time taken ${time_taken} sec`;
    }
}

// step 4
const endTypingTest = () => {
    btn.innerText = "Start";

    let date = new Date();
    endTime = date.getTime();

    totalTimeTaken = (endTime -startTime) / 1000;

    // console.log(totalTimeTaken);

    calculateTypingSpeed(totalTimeTaken);
    show_sentence.innerHTML = "You just wrote a quote by " + author;
    typing_ground.value = "";
}


// step 3
async function startTyping() {
    show_sentence.innerHTML = "ready?";
    btn.innerText = "Loading...";
    btn.setAttribute('disabled', 'true');
    const apiKey='hDxbXV5HKtjMamBLUixSGVAtzegofCItWqCvz4VS';
    const proxyUrl = "https://cors-anywhere.herokuapp.com/";
    const apiUrl = `https://api.api-ninjas.com/v1/quotes`;
    try{
        const response = await fetch(proxyUrl + apiUrl,{
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type':'application/json'
            }
        });
        const data = await response.json();
        console.log(data)
        show_sentence.innerHTML = data[0].quote;
        author = data[0].author;
        typing_ground.removeAttribute('disabled');
        typing_ground.focus();
        btn.innerText="Done";
        btn.removeAttribute('disabled');

        let date = new Date();
        startTime = date.getTime();
    }
    catch (error){
        show_sentence.innerHTML = "Failed to load quote. Try clicking start again.";
        btn.innerText = "Start";
        btn.removeAttribute('disabled');
        typing_ground.setAttribute('disabled','true');
        console.error("API error: ",error);
    }
}




// step 2
btn.addEventListener('click', () => {
    switch (btn.innerText.toLowerCase()) {
        case "start":
            typing_ground.removeAttribute('disabled');
            startTyping();
            break;

        case "done":
            typing_ground.setAttribute('disabled' , 'true');
            endTypingTest();
            break;
    }
})