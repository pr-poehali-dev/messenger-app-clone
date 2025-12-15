-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица чатов
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(id),
    user2_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id)
);

-- Таблица сообщений
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id),
    sender_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chats_users ON chats(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Вставка тестовых пользователей
INSERT INTO users (username, display_name, avatar_url, bio) VALUES
('alexey', 'Алексей Козлов', NULL, 'Разработчик из Москвы'),
('marina', 'Марина Петрова', NULL, 'Дизайнер интерфейсов'),
('dmitry', 'Дмитрий Смирнов', NULL, 'Любитель путешествий'),
('elena', 'Елена Иванова', NULL, 'Фотограф'),
('igor', 'Игорь Волков', NULL, 'Музыкант');