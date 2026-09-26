// ============================== State Management and Game Vars ==============================
let state = {
    continueGame: false,
    hasBlackJack: false,
    deck: [],
    playerHand: [], // Player's hand (array of card codes)
    dealerHand: [], // Dealer's hand (array of card codes)
    playerSum: 0,
    dealerSum: 0,
    dealerHiddenCard: null,
    dealerRevealed: false,
    bet: 0,
    message: ""
}

// Player object
let player = {
    name: "",
    chips: 150
}

// ============================== DOM elements ==================================
const ui = {
    // Player elements
    sumEl: document.getElementById("player-sum-el"),
    playerHandEl: document.getElementById("player-hand-el"),
    // Dealer elements
    messageEl: document.getElementById("message-el"),
    dealerHandEl: document.getElementById("dealer-hand-el"),
    dealerSumEl: document.getElementById("dealer-sum-el"),
    // Betting elements
    betEl: document.getElementById("bet-el"),
    increaseBetBtn: document.getElementById("increase-bet-btn"),
    decreaseBetBtn: document.getElementById("decrease-bet-btn"),
    increaseBet50Btn: document.getElementById("increase-bet-50-btn"),
    decreaseBet50Btn: document.getElementById("decrease-bet-50-btn"),
    // Action Buttons
    startGameBtn: document.getElementById("start-game-btn"),
    hitBtn: document.getElementById("hit-btn"),
    standBtn: document.getElementById("stand-btn"),
    // Modal elements
    nameModalOverlay: document.getElementById("name-modal-overlay"),
    nameInput: document.getElementById("name-input"),
    submitNameBtn: document.getElementById("submit-name-btn"),
}

// ============================== Game Logic ==============================
// Increase bet by 5
function increaseBet() {
    if (player.chips > state.bet) {
        state.bet += 5;
        updateBetDisplay();
    }
}

// Decrease bet by 5
function decreaseBet() {
    if (state.bet >= 5) {
        state.bet -= 5;
        updateBetDisplay();
    }
}

function increaseBet50() {
    if (player.chips >= state.bet + 50) {
        state.bet += 50;
        updateBetDisplay();
    }
}

// Decrease bet by 50
function decreaseBet50() {
    if (state.bet >= 50) {
        state.bet -= 50;
        updateBetDisplay();
    }
}

function startGame() {
    // Only start if bet is placed
    if (state.bet === 0 || state.bet > player.chips) {
        ui.messageEl.textContent = "Place a valid bet to start!";
        return;
    }
    // reset game state
    state.continueGame = true;
    state.hasBlackJack = false;
    state.playerHand = [];
    state.dealerHand = [];
    state.playerSum = 0;
    state.dealerSum = 0;
    state.dealerHiddenCard = null;
    state.dealerRevealed = false;

    // Subtract bet from chips
    player.chips -= state.bet;
    updatePlayerDisplay();

    // Prepare and shuffle deck
    createDeck();
    shuffleDeck();

    // Initial deal 2 cards each
    state.playerHand.push(dealCard());
    state.playerHand.push(dealCard());
    state.playerSum = getHandSum(state.playerHand);

    state.dealerHand = [dealCard()]; // Deal only the face-up card
    state.dealerHiddenCard = dealCard(); // Store the hidden card
    state.dealerSum = getHandSum(state.dealerHand);

    renderGame();
}

function renderGame() {
    // Game messages and state updates
    state.playerSum = getHandSum(state.playerHand);
    if (!state.dealerRevealed) {
        if (state.playerSum < 21) {
            state.message = "Do you want to hit or stand?";
        } else if (state.playerSum === 21 && state.playerHand.length === 2) { // check for natural blackjack
            state.message = "Blackjack! Stand to see the dealer's hand."; // auto stand?
            state.hasBlackJack = true;
        } else if (state.playerSum === 21) {
            state.message = "You've got 21! Stand to see dealer."; // auto stand?
            state.hasBlackJack = true;
        } else {
            state.message = "You busted! Lost: $" + state.bet;
            state.continueGame = false;
            state.bet = 0;
        }
    } else {
        // After dealer reveals
        let outcome = determineOutcome();
        state.message = outcome.message;
        state.continueGame = false;
        if (outcome.payout !== 0) {
            player.chips += outcome.payout;
            updatePlayerDisplay();
        }
    }

    // disable Start Game and Bet buttons based on game state
    ui.startGameBtn.disabled = state.continueGame;
    ui.increaseBetBtn.disabled = state.continueGame;
    ui.decreaseBetBtn.disabled = state.continueGame;
    ui.increaseBet50Btn.disabled = state.continueGame;
    ui.decreaseBet50Btn.disabled = state.continueGame;

    ui.hitBtn.disabled = !(state.continueGame && !state.hasBlackJack);
    ui.standBtn.disabled = !state.continueGame;

    // Update UI elements with the final state
    ui.messageEl.textContent = state.message;
    ui.sumEl.textContent = "Sum: " + state.playerSum;
    updateBetDisplay();

    // Player cards
    renderCards(ui.playerHandEl, state.playerHand);
    
    // Dealer cards
    ui.dealerHandEl.innerHTML = ""; // Clear dealer hand display
    if (!state.dealerRevealed) {
        // Show first card face up
        let faceUpCard = document.createElement('playing-card');
        faceUpCard.setAttribute('cid', state.dealerHand[0]);
        ui.dealerHandEl.appendChild(faceUpCard);
        // Show second card face down
        let hiddenElement = document.createElement('playing-card');
        hiddenElement.setAttribute('rank', '0');
        hiddenElement.setAttribute('backcolor', 'navy');
        ui.dealerHandEl.appendChild(hiddenElement);
        // Update sum based only on the visible card
        ui.dealerSumEl.textContent = "Sum: " + getCardValue(state.dealerHand[0]);
    } else {
        // Reveal all dealer cards
        renderCards(ui.dealerHandEl, state.dealerHand);
        ui.dealerSumEl.textContent = "Sum: " + getHandSum(state.dealerHand);
    }
}

// Outcome logic once dealer reveals
function determineOutcome() {
    let playerSum = getHandSum(state.playerHand);
    let dealerFinalSum = getHandSum(state.dealerHand);
    let payout = 0;
    let msg = "";

    if (dealerFinalSum > 21) {
        msg = "Dealer busted! You win $" + (state.bet * 2) + "!";
        payout = state.bet * 2;
    } else if (playerSum === 21 && state.playerHand.length === 2 && dealerFinalSum !== 21) {
        msg = "Blackjack! You win 3:2! Payout: $" + (Math.floor(state.bet * 2.5));
        payout = Math.floor(state.bet * 2.5);
    } else if (playerSum > dealerFinalSum) {
        msg = "You win $" + (state.bet * 2) + "!";
        payout = state.bet * 2;
    } else if (playerSum < dealerFinalSum) {
        msg = "Dealer wins! Lost: $" + state.bet;
    } else {
        msg = "Push! $" + state.bet + " is returned. ";
        payout = state.bet;
    }
    state.bet = 0; // Reset bet for next round
    return { message: msg, payout: payout };
}

// get a new card, push to cards, update sum
function newCard() {
    if (state.continueGame && !state.hasBlackJack) {
        let card = dealCard();
        state.playerHand.push(card);
        // sum will be recalculated inside renderGame
        renderGame();
    }
}

function stand() {
    if (!state.dealerRevealed && state.continueGame) {
        state.dealerRevealed = true;
        state.dealerSum = getHandSum(state.dealerHand);
        dealerPlay();
        state.continueGame = false; // Mark round as finished
        renderGame();
    }
}

// Dealer logic
function dealerPlay() {
    // Dealer reveals hidden card
    state.dealerHand.push(state.dealerHiddenCard);
    // hits until 17+
    while (getHandSum(state.dealerHand) < 17) {
        let card = dealCard();
        state.dealerHand.push(card);
    }
}

// ============================== Helper Functions ==============================
// --- Deck helpers ---
// Cardmeister deck setup
const suits = ['s', 'h', 'd', 'c'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 't', 'j', 'q', 'k', 'a'];

// Create a new deck of 52 cards (e.g., as, kd)
function createDeck() {
    state.deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            state.deck.push(rank + suit);
        }
    }
}

// Shuffle deck using Fisher-Yates algorithm
function shuffleDeck() {
    for (let i = state.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }
}

function dealCard() {
    if (state.deck.length === 0) {
        createDeck();
        shuffleDeck();
    }
    return state.deck.pop();
}

// --- Calculations ---
function getHandSum(hand) {
    let sum = 0;
    let aces = 0;
    for (let cardCode of hand) {
        let val = getCardValue(cardCode);
        if (val === 11) aces++;
        sum += val;
    }
    // Adjust ace values from 11 to 1 as needed
    while (sum > 21 && aces > 0) {
        sum -= 10;
        aces--;
    }
    return sum;
}

// Get the value of a card code (e.g., ks => 10, ad => 11 or 1)
// Refer to Cardmeister for card code details
function getCardValue(cardCode) {
    const rank = cardCode[0];
    if (rank === 'a') return 11;
    if (['k', 'q', 'j', 't'].includes(rank)) return 10;
    return parseInt(rank, 10);
}

// --- UI Helpers ---
function renderCards(containerElement, handArray) {
    containerElement.innerHTML = ""; // Clear existing cards
    for (let cardCode of handArray) {
        let cardElement = document.createElement("playing-card");
        cardElement.setAttribute("cid", cardCode);
        containerElement.appendChild(cardElement);
    }
}

function updatePlayerDisplay() {
    const playerEl = document.getElementById("player-el");
    playerEl.textContent = player.name + ": $" + player.chips;
}

// Update bet display
function updateBetDisplay() {
    ui.betEl.textContent = "Bet: $" + state.bet;
}

function handleNameSubmit() {
    const newName = ui.nameInput.value.trim();

    // If a name was entered, update the player object, otherwise use a default
    if (newName) {
        player.name = newName;
        updatePlayerDisplay();
        ui.nameModalOverlay.classList.add("hidden"); // hide on success
        ui.nameInput.classList.remove('input-error'); // Remove error style if it was there
    } else {
        ui.nameInput.value = ""; // bad input
        ui.nameInput.placeholder = "Enter a valid name!";
        ui.nameInput.classList.add('input-error');
    }
}

// ============================== Event Listeners ==============================
function init() {
    // Attach Event Listeners to UI elements
    ui.submitNameBtn.addEventListener("click", handleNameSubmit);
    ui.increaseBetBtn.addEventListener("click", increaseBet);
    ui.decreaseBetBtn.addEventListener("click", decreaseBet);
    ui.increaseBet50Btn.addEventListener("click", increaseBet50);
    ui.decreaseBet50Btn.addEventListener("click", decreaseBet50);
    ui.startGameBtn.addEventListener("click", startGame);
    ui.hitBtn.addEventListener("click", newCard);
    ui.standBtn.addEventListener("click", stand);
    
    // Also handle Enter key for the name modal for better UX
    ui.nameInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            handleNameSubmit();
        }
    });

    // Set initial UI state
    updateBetDisplay();
}

// Initialize when page loads
init();

// ============================== Progressive Web App Service Worker Registration ==============================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}