/**
 * Статус секретного чата.
 * pending — создан, handshake не завершён (ждём собеседника в сети);
 * active — ключи согласованы, можно обмениваться сообщениями;
 * closed — чат удалён участниками.
 */
export type SecretChatStatus = "pending" | "active" | "closed";

/**
 * Значение таймера самоуничтожения сообщений (null — таймер выключен).
 */
export type SecretSelfDestructValue = "5s" | "1m" | "1h" | "1d" | "1w";

/**
 * Кто отправил сообщение секретного чата.
 */
export type SecretMessageSender = "me" | "peer";

/**
 * Тип сообщения секретного чата.
 */
export type SecretMessageType =
    | "text"
    | "sticker"
    | "image"
    | "video"
    | "document"
    | "voice_note"
    | "video_note"
    | "service";

/**
 * Статус доставки сообщения секретного чата:
 * queued — в локальной очереди «не доставлено»;
 * sending — передаётся по DataChannel;
 * sent — принят DataChannel'ом;
 * delivered — подтверждён собеседником;
 * read — просмотрен собеседником;
 * failed — обрыв/ошибка, нужен ручной повтор.
 */
export type SecretMessageStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "failed";

/**
 * Статус файла секретного чата.
 */
export type SecretFileStatus = "receiving" | "complete" | "failed";

/**
 * Запись секретного чата в IndexedDB (таблица secret_chats).
 */
export interface SecretChatRecord {
    /** Id чата (UUIDv7, генерирует инициатор, живёт на обоих устройствах). */
    id: string;
    /** Id собеседника. */
    peer_user_id: string;
    /** Id устройства собеседника (session_id): чат привязан к паре устройств. */
    peer_device_id: string | null;
    /** Статус чата. */
    status: SecretChatStatus;
    /** Сверка отпечатка ключей пройдена. */
    verified: boolean;
    /** Публичный ключ идентичности собеседника (SPKI, base64url) — для отпечатка сверки. */
    peer_identity_public?: string | null;
    /** Таймер самоуничтожения сообщений. */
    self_destruct: SecretSelfDestructValue | null;
    /**
     * Vault-контейнер ключевого материала чата: собственный приватный ключ
     * идентичности (PKCS8), счётчик nonce сообщений и служебные поля.
     */
    keys_encrypted: Uint8Array<ArrayBuffer> | null;
    /** Время создания чата (epoch ms). */
    created_at: number;
    /** Время последнего сообщения (epoch ms, для сортировки списка). */
    last_message_at: number;
}

/**
 * Запись сообщения секретного чата в IndexedDB (таблица secret_messages).
 * Расшифрованный payload (текст/ссылки на файлы) хранится в ciphertext
 * vault-шифротекстом.
 */
export interface SecretMessageRecord {
    /** Id сообщения (UUIDv7, локальный). */
    id: string;
    /** Id секретного чата. */
    chat_id: string;
    /** Отправитель. */
    sender: SecretMessageSender;
    /** Тип сообщения. */
    type: SecretMessageType;
    /** Зашифрованный payload (vault-шифротекст). */
    ciphertext: Uint8Array<ArrayBuffer>;
    /** Статус доставки. */
    status: SecretMessageStatus;
    /** Таймер самоуничтожения сообщения (фиксируется при отправке/приёме). */
    self_destruct?: SecretSelfDestructValue | null;
    /** Момент самоуничтожения (epoch ms) — ставится при первом просмотре. */
    self_destruct_at?: number | null;
    /** Время создания (epoch ms, из payload отправителя — для сортировки). */
    created_at: number;
}

/**
 * Запись файла секретного чата в IndexedDB (таблица secret_files).
 * Байты файла хранятся чанками vault-шифротекстом.
 */
export interface SecretFileRecord {
    /** Id файла (UUIDv7). */
    id: string;
    /** Id сообщения, к которому прикреплён файл. */
    message_id: string;
    /** Id секретного чата. */
    chat_id: string;
    /** Имя файла. */
    name: string;
    /** MIME-тип. */
    mime_type: string;
    /** Размер файла в байтах. */
    size: number;
    /** Длительность медиа в миллисекундах (null — не медиа). */
    duration: number | null;
    /** Ширина кадра (null — не изображение/видео). */
    width: number | null;
    /** Высота кадра (null — не изображение/видео). */
    height: number | null;
    /** Соль чанков файла (8 байт, для nonce каждого чанка). */
    chunk_salt: Uint8Array<ArrayBuffer>;
    /** Зашифрованные чанки файла (vault-шифротекст). */
    chunks: Blob[];
    /** Статус файла. */
    status: SecretFileStatus;
}
