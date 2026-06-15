const socket = io();

// Элементы авторизации
const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');

// Элементы чата
const roomTitle = document.getElementById('room-title');
const leaveBtn = document.getElementById('leave-btn');
const messagesBox = document.getElementById('messages-box');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const usersList = document.getElementById('users-list');
const userCount = document.getElementById('user-count');
const typingIndicator = document.getElementById('typing-indicator');

let currentUsername = '';
let currentRoom = '';
let typingTimeout;

// Логика входа в комнату
joinBtn.addEventListener('click', () => {
    currentUsername = usernameInput.value.trim();
    currentRoom = roomInput.value.trim();

    if (!currentUsername || !currentRoom) return alert('Заполните все поля!');

    // Отправляем событие на сервер
    socket.emit('join_room', { username: currentUsername, room: currentRoom });

    // Меняем экраны
    roomTitle.innerText = `Комната: ${currentRoom}`;
    loginContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
});

// Выход из чата
leaveBtn.addEventListener('click', () => {
    window.location.reload(); // Самый простой способ сбросить стейт сокета
});

// Отправка сообщения
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    socket.emit('send_message', { text });
    messageInput.value = '';
    
    // Сразу сообщаем, что прекратили печатать
    socket.emit('typing', false);
});

// Отслеживание печати юзера
messageInput.addEventListener('input', () => {
    socket.emit('typing', true);

    // Скидываем таймер "затишья", если юзер перестал нажимать клавиши
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', false);
    }, 1500); // Если 1.5 сек ничего не пишет, убираем статус
});

/* --- СЛУШАТЕЛИ СОБЫТИЙ SOCKET.IO --- */

// Загрузка истории сообщений
socket.on('chat_history', (history) => {
    messagesBox.innerHTML = ''; // Очищаем старое
    history.forEach(msg => appendMessage(msg));
});

// Получение нового сообщения
socket.on('receive_message', (data) => {
    appendMessage(data);
});

// Статусы входа/выхода других участников
socket.on('user_status', (data) => {
    const text = data.status === 'joined' ? `пользователь ${data.username} вошел в чат` : `пользователь ${data.username} покинул чат`;
    const html = `<div class="msg system">${text}</div>`;
    messagesBox.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
});

// Обновление списка онлайн-пользователей
socket.on('online_users', (users) => {
    userCount.innerText = users.length;
    usersList.innerHTML = users.map(user => `<li>${user} ${user === currentUsername ? '(Вы)' : ''}</li>`).join('');
});

// Отображение индикатора печати
socket.on('user_typing', (data) => {
    if (data.isTyping) {
        typingIndicator.innerText = `${data.username} печатает...`;
    } else {
        typingIndicator.innerText = '';
    }
});

// Вспомогательные функции
function appendMessage(data) {
    const isMe = data.user === currentUsername;
    const msgHtml = `
        <div style="display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'}">
            <div class="msg meta">${data.user} в ${data.time}</div>
            <div class="msg user-msg" style="background: ${isMe ? '#0084ff' : '#e4e6eb'}; color: ${isMe ? 'white' : 'black'}">
                ${data.text}
            </div>
        </div>
    `;
    messagesBox.insertAdjacentHTML('beforeend', msgHtml);
    scrollToBottom();
}

function scrollToBottom() {
    messagesBox.scrollTop = messagesBox.scrollHeight;
}
