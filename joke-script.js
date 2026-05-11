// Joke API URLs
const JOKE_APIs = {
    RANDOM_JOKE_API: 'https://official-joke-api.appspot.com/jokes/random',
    JOKE_BY_TYPE_API: 'https://official-joke-api.appspot.com/jokes/{type}/random',
    ALL_TYPES_API: 'https://official-joke-api.appspot.com/types'
};

// State Management
let jokeCount = 0;
let favorites = [];
let currentJoke = null;
let isLoading = false;

// DOM Elements
const getJokeBtn = document.getElementById('getJokeBtn');
const copyJokeBtn = document.getElementById('copyJokeBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const jokeContent = document.getElementById('jokeContent');
const categorySelect = document.getElementById('categorySelect');
const jokeCountEl = document.getElementById('jokeCount');
const favoriteCountEl = document.getElementById('favoriteCount');
const favoritesSection = document.getElementById('favoritesSection');
const favoritesList = document.getElementById('favoritesList');
const clearFavoritesBtn = document.getElementById('clearFavoritesBtn');
const btnLoader = document.querySelector('.btn-loader');
const btnText = document.querySelector('.btn-text');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFavorites();
    getJokeBtn.addEventListener('click', fetchJoke);
    copyJokeBtn.addEventListener('click', copyJoke);
    favoriteBtn.addEventListener('click', toggleFavorite);
    categorySelect.addEventListener('change', resetJoke);
    clearFavoritesBtn.addEventListener('click', clearAllFavorites);
});

// Fetch Joke from API
async function fetchJoke() {
    if (isLoading) return;
    
    isLoading = true;
    getJokeBtn.disabled = true;
    btnLoader.style.display = 'inline';
    btnText.style.display = 'none';

    try {
        const category = categorySelect.value;
        let url = JOKE_APIs.RANDOM_JOKE_API;

        if (category !== 'any') {
            url = JOKE_APIs.JOKE_BY_TYPE_API.replace('{type}', category);
        }

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Handle single joke or array of jokes
        const joke = Array.isArray(data) ? data[0] : data;
        
        // Combine setup and delivery or use content
        const jokeText = joke.setup && joke.delivery 
            ? `${joke.setup}\n\n${joke.delivery}`
            : joke.joke || joke.content || 'Unable to load joke';

        currentJoke = {
            text: jokeText,
            type: joke.type || category,
            timestamp: new Date().toLocaleString()
        };

        displayJoke(currentJoke);
        jokeCount++;
        updateStats();
        showToast('Joke loaded! 😂', 'success');

    } catch (error) {
        console.error('Error fetching joke:', error);
        displayError(`Failed to load joke: ${error.message}`);
        showToast('Failed to load joke. Try again!', 'error');
    } finally {
        isLoading = false;
        getJokeBtn.disabled = false;
        btnLoader.style.display = 'none';
        btnText.style.display = 'inline';
    }
}

// Display Joke
function displayJoke(joke) {
    jokeContent.innerHTML = `<p>${escapeHtml(joke.text)}</p>`;
    copyJokeBtn.disabled = false;
    favoriteBtn.disabled = false;
    
    // Update favorite button state
    updateFavoriteButton();
}

// Display Error
function displayError(message) {
    jokeContent.innerHTML = `<p class="loading" style="color: #e74c3c;">${escapeHtml(message)}</p>`;
    copyJokeBtn.disabled = true;
    favoriteBtn.disabled = true;
}

// Copy Joke to Clipboard
function copyJoke() {
    if (!currentJoke) return;

    navigator.clipboard.writeText(currentJoke.text)
        .then(() => {
            showToast('Joke copied to clipboard! 📋', 'success');
            copyJokeBtn.style.transform = 'scale(1.1)';
            setTimeout(() => {
                copyJokeBtn.style.transform = 'scale(1)';
            }, 300);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy joke', 'error');
        });
}

// Toggle Favorite
function toggleFavorite() {
    if (!currentJoke) return;

    const isFavorited = favorites.some(fav => fav.text === currentJoke.text);

    if (isFavorited) {
        favorites = favorites.filter(fav => fav.text !== currentJoke.text);
        showToast('Removed from favorites', 'success');
    } else {
        favorites.push(currentJoke);
        showToast('Added to favorites! ❤️', 'success');
    }

    saveFavorites();
    updateStats();
    updateFavoriteButton();
    renderFavorites();
}

// Update Favorite Button State
function updateFavoriteButton() {
    if (!currentJoke) return;

    const isFavorited = favorites.some(fav => fav.text === currentJoke.text);
    const heartIcon = isFavorited ? '❤️' : '🤍';
    
    favoriteBtn.innerHTML = `<span>${heartIcon} ${isFavorited ? 'Favorited' : 'Favorite'}</span>`;
}

// Reset Joke Display
function resetJoke() {
    jokeContent.innerHTML = '<p class="loading">Select a category and click "Get Joke"!</p>';
    copyJokeBtn.disabled = true;
    favoriteBtn.disabled = true;
    currentJoke = null;
}

// Render Favorites List
function renderFavorites() {
    if (favorites.length === 0) {
        favoritesSection.style.display = 'none';
        return;
    }

    favoritesSection.style.display = 'block';
    favoritesList.innerHTML = '';

    favorites.forEach((fav, index) => {
        const div = document.createElement('div');
        div.className = 'favorite-item';
        div.innerHTML = `
            <div class="favorite-text">${escapeHtml(fav.text)}</div>
            <button class="favorite-remove" onclick="removeFavorite(${index})" title="Remove from favorites">✕</button>
        `;
        favoritesList.appendChild(div);
    });
}

// Remove Favorite
function removeFavorite(index) {
    favorites.splice(index, 1);
    saveFavorites();
    updateStats();
    updateFavoriteButton();
    renderFavorites();
    showToast('Removed from favorites', 'success');
}

// Clear All Favorites
function clearAllFavorites() {
    if (favorites.length === 0) return;

    if (confirm('Are you sure you want to clear all favorites?')) {
        favorites = [];
        saveFavorites();
        updateStats();
        updateFavoriteButton();
        renderFavorites();
        showToast('All favorites cleared', 'success');
    }
}

// Update Statistics
function updateStats() {
    jokeCountEl.textContent = jokeCount;
    favoriteCountEl.textContent = favorites.length;
}

// Save Favorites to LocalStorage
function saveFavorites() {
    localStorage.setItem('jokeGeneratorFavorites', JSON.stringify(favorites));
}

// Load Favorites from LocalStorage
function loadFavorites() {
    const saved = localStorage.getItem('jokeGeneratorFavorites');
    if (saved) {
        try {
            favorites = JSON.parse(saved);
            updateStats();
            renderFavorites();
        } catch (err) {
            console.error('Error loading favorites:', err);
            favorites = [];
        }
    }
}

// Show Toast Notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API Error Handling
window.addEventListener('online', () => {
    showToast('Back online! 📡', 'success');
});

window.addEventListener('offline', () => {
    showToast('No internet connection', 'error');
});
