const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Раздаем статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Временное хранилище в памяти (для продакшена нужна БД)
const roomsHistory = {}; // { roomName: [ { user, text, time } ] }
const activeUsers = {};  // { socketId: { username, room } }

io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // 1. Вход в комнату
    socket.on('join_room', ({ username, room }) => {
        socket.join(room);
        
        // Сохраняем данные пользователя
        activeUsers[socket.id] = { username, room };

        // Отправляем историю сообщений этой комнаты только вошедшему
        if (!roomsHistory[room]) roomsHistory[room] = [];
        socket.emit('chat_history', roomsHistory[room]);

        // Оповещаем комнату, что зашел новый юзер
        socket.to(room).emit('user_status', { username, status: 'joined' });

        // Обновляем список онлайн-пользователей в комнате
        updateRoomUsers(room);
    });

    // 2. Обработка нового сообщения
    socket.on('send_message', (data) => {
        const userMeta = activeUsers[socket.id];
        if (!userMeta) return;

        const messageData = {
            user: userMeta.username,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Сохраняем в историю
        roomsHistory[userMeta.room].push(messageData);
        // Ограничим историю последними 50 сообщениями
        if (roomsHistory[userMeta.room].length > 50) roomsHistory[userMeta.room].shift();

        // Рассылаем всем в комнате
        io.to(userMeta.room).emit('receive_message', messageData);
    });

    // 3. Индикатор "Печатает..."
    socket.on('typing', (isTyping) => {
        const userMeta = activeUsers[socket.id];
        if (!userMeta) return;

        // Отправляем всем в комнате, кроме самого автора
        socket.to(userMeta.room).emit('user_typing', {
            username: userMeta.username,
            isTyping
        });
    });

    // 4. Отключение пользователя
    socket.on('disconnect', () => {
        const userMeta = activeUsers[socket.id];
        if (userMeta) {
            const { username, room } = userMeta;
            delete activeUsers[socket.id];

            // Оповещаем, что юзер ушел и обновляем список онлайн
            socket.to(room).emit('user_status', { username, status: 'left' });
            updateRoomUsers(room);
        }
        console.log(`Пользователь отключился: ${socket.id}`);
    });
});

// Функция для сбора всех юзеров в конкретной комнате
function updateRoomUsers(room) {
    const usersInRoom = Object.values(activeUsers)
        .filter(user => user.room === room)
        .map(user => user.username);
    
    io.to(room).emit('online_users', usersInRoom);
}

const PORT = process.env.PORT || 3000;
// Замени старый server.listen(PORT...) на этот код:
const FINAL_PORT = process.env.PORT || 3000;

server.listen(FINAL_PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${FINAL_PORT}`);
});
