// Импортируем utils
import { Logger } from "./logs/logger.js";
import { IndexedDB } from "./indexed_db.js";
import { CacheManager } from "./cache_manager.js";

// Импортируем config
import { Socket } from "../config/socket.js";

/**
 * Множители скругления интерфейса (ключи из Decorations.radius).
 */
export type RadiusKey = "compact" | "default" | "round";

/**
 * Тема приложения, сохранённая в сессии (сторонний CSS темы).
 */
export interface StoredTheme {
    /** CSS-стили темы. */
    style?: string;
    [key: string]: unknown;
}

/**
 * Настройки оформления пользователя (session.settings.user.decorations).
 */
export interface SessionDecorationsSettings {
    /** Фон чатов. */
    chat_background: {
        /** Включён ли фон чатов. */
        enabled: boolean;
        /** Путь к SVG-паттерну. */
        src: string;
    };
    /** Множитель размера интерфейса (строка-коэффициент). */
    interface_size: string;
    /** Множитель размера текста сообщений. */
    message_text_size: string;
    /** Размытие интерфейса. */
    blur: boolean;
    /** Пользовательский акцентный цвет (пустая строка — цвет темы). */
    brand_color: string;
    /** Режим скругления интерфейса. */
    ui_radius: RadiusKey;
    [key: string]: unknown;
}

/**
 * Настройки тем (session.settings.user.themes).
 */
export interface SessionThemesSettings {
    /** Текущая сторонняя тема (null — используется тема по умолчанию). */
    current: StoredTheme | null;
    /** Цветовая схема приложения. */
    color_scheme: "system" | "dark" | "light";
}

/**
 * Пользовательские настройки сессии (session.settings.user).
 */
export interface SessionUserSettings {
    decorations: SessionDecorationsSettings;
    themes: SessionThemesSettings;
    /** Код локали. */
    locale: string;
}

/**
 * Настройки сессии.
 */
export interface SessionSettings {
    user: SessionUserSettings;
    broadcasts: {
        /** Тип воспроизведения трансляций. */
        type_play: string;
        /** Глобальное медиа-событие трансляций. */
        type_global_media_event: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

/**
 * Сессия пользователя в localStorage.
 */
export interface StoredSession {
    /** Id сессии (строка). */
    id: string;
    /** Версия формата сессии. */
    version: string;
    /** Access-токен. */
    access_token: string;
    /** Refresh-токен. */
    refresh_token: string;
    /** Данные пользователя (приходят с сервера). */
    user: unknown;
    /** Настройки сессии. */
    settings: SessionSettings;
    /** Флаг последней активной сессии. */
    last_active?: boolean;
}

/**
 * Данные для сохранения сессии (ответ login/refresh-сервиса).
 */
export interface SessionCredentials {
    /** Данные пользователя. */
    user: unknown;
    /** Id сессии. */
    session_id: string;
    /** Access-токен. */
    access_token: string;
    /** Refresh-токен. */
    refresh_token: string;
}

/**
 * ***************************************************************************
 * LocalStorage - работа с сессиями пользователя в localStorage.
 *
 * Сессии хранятся под ключом "sessions" массивом. Внешние данные (JSON из
 * localStorage) проходят guard перед использованием: битый или чужой JSON
 * не должен ронять приложение.
 * ***************************************************************************
 */
export class LocalStorage {

    // Текущая сессия пользователя
    static sessionId: string | null = null;
    static session: StoredSession | null = null;
    static version = "6";

    // ***************************************************************************
    // Guard: похож ли разобранный JSON на сессию
    // ***************************************************************************
    private static _isStoredSession(value: unknown): value is StoredSession {
        if (!value || typeof value !== "object") return false;

        // Сужение unknown через in: проверяем идентификующие поля сессии
        return "id" in value && "version" in value
            && typeof value.id === "string" && typeof value.version === "string";
    }

    // ***************************************************************************
    // Удаляем сессии которые не совпадают с текущей версией
    // ***************************************************************************
    static deleteOldVersionSessions(): void {

        // NOTE(MIGRATION): исправлен реальный баг легаси: передавался объект {session_id} вместо строки id — вынесено в отдельный fix-коммит

        // Получаем список сессий (легаси: без try/catch — ошибка разбора летит наружу)
        // `?? "null"` сохраняет легаси-семантику: JSON.parse(null) → null (нет ключа → не массив)
        const sessions: unknown = JSON.parse(window.localStorage.getItem("sessions") ?? "null");

        // Проходим по сессиям (легаси-условие: sessions && sessions.length > 0)
        if (Array.isArray(sessions) && sessions.length > 0) {
            for (let i = sessions.length - 1; i >= 0; i--) {

                // Внешние данные: guard вместо прямого доступа к свойствам
                const session: unknown = sessions[i];
                if (this._isStoredSession(session) && session.version !== this.version) this.removeSession(session.id);

            }
        }

    }

    // ***************************************************************************
    // Получаем все сесии
    // ***************************************************************************
    static getAllSessions(): StoredSession[] {

        // Получаем данные
        let json = window.localStorage.getItem("sessions");

        try {

            // Устанавливаем
            let sessions = json ? JSON.parse(json) : [];
            if (!Array.isArray(sessions)) return [];

            // Внешние данные: принимаем только объекты, похожие на сессию
            return sessions.filter((session: unknown) => this._isStoredSession(session));

        } catch (e) {
            Logger.debug("[app][local-storage]: Ошибка", e);
            return [];
        }

    }

    // ***************************************************************************
    // Получаем выбранную сессию
    // ***************************************************************************
    static getSession(sessionId: string): StoredSession | undefined {

        // Получаем список сессий
        let sessions = this.getAllSessions();
        let session = sessions.find(s => s.id === sessionId);
        return session;

    }

    // ***************************************************************************
    // Устанавливаем последнюю активную сессию
    // ***************************************************************************
    static setLastActionSession(sessionId: string): void {

        // Получаем список сессий
        let sessions = this.getAllSessions();
        sessions.forEach(s => {
            s.last_active = s.id === sessionId;
        });
        window.localStorage.setItem("sessions", JSON.stringify(sessions));
    }

    // ***************************************************************************
    // Получаем последнюю активную сессию
    // ***************************************************************************
    static getLastActionSession(): StoredSession | undefined {

        // Получаем список сессий
        let sessions = this.getAllSessions();
        let session = sessions.find(s => s.last_active === true);
        return session;

    }

    // ***************************************************************************
    // Сбрасываем последнюю активную сессию
    // ***************************************************************************
    static dropLastActionSession(): void {

        // Получаем список сессий
        let sessions = this.getAllSessions();
        sessions.forEach(s => {
            if (s.last_active) s.last_active = false;
        });
        window.localStorage.setItem("sessions", JSON.stringify(sessions));
    }

    // ***************************************************************************
    // Сохраняем сессию
    // ***************************************************************************
    static saveSession(e: SessionCredentials = {
        user: "",
        session_id: "",
        access_token: "",
        refresh_token: ""
    }) {

        // Получаем список сессий
        let sessions = this.getAllSessions();
        let session = this.getSession(e.session_id);

        // Если сессиия не обнаружена
        if (!session) {

            // Создаем сессию
            let session: StoredSession = {

                // Записываем данные
                id: e.session_id,
                version: this.version,
                access_token: e.access_token,
                refresh_token: e.refresh_token,
                user: e.user,

                // Настройки трансляций
                settings: {
                    user: {
                        decorations: {
                            chat_background: {
                                enabled: true,
                                src: "img/svg-backgrounds/pattern_nature.svg",
                            },
                            interface_size: "0.875",
                            message_text_size: "1",
                            blur: false,
                            brand_color: "",
                            ui_radius: "default"
                        },
                        themes: {
                            current: {},
                            color_scheme: "system"
                        },
                        locale: "ru",
                    },
                    broadcasts: {
                        type_play: "flv",
                        type_global_media_event: "muted"
                    }
                }
            };

            // Добавляем сессию
            sessions.push(session);
            window.localStorage.setItem("sessions", JSON.stringify(sessions));

        } else {

            // Записываем данные
            let session = sessions.find(s => s.id === e.session_id);
            if (session) {
                session.user = e.user;
                session.access_token = e.access_token;
                session.refresh_token = e.refresh_token;
                window.localStorage.setItem("sessions", JSON.stringify(sessions));
            }

        }

    }

    // ***************************************************************************
    // Обновляем сессию
    // ***************************************************************************
    static updateSession(session: StoredSession | null | undefined) {

        // Если сессиия не обнаружена
        if (!session) {
            Logger.warn("[app][local-storage]: Сессия для обновления не найдена", session);
        } else {

            // Получаем список сессий
            let sessions = this.getAllSessions();

            // Перебираем сессии
            sessions.forEach(s => {
                if (s.id === session.id) {
                    Object.assign(s, session);
                    window.localStorage.setItem("sessions", JSON.stringify(sessions));

                    // Если это текущая сессия
                    // Обновляем данные
                    if (session.id === this.sessionId) {
                        this.session = s;
                    }

                }
            });

        }

    }

    // ***************************************************************************
    // Удаляем сессию
    // ***************************************************************************
    static async removeSession(sessionId: string | null): Promise<boolean> {

        try {

            // Получаем список сессий
            let sessions = this.getAllSessions();

            // Проходим по сессиям
            if (sessions.length > 0) {
                sessions = sessions.filter(s => s.id !== sessionId);
                window.localStorage.setItem("sessions", JSON.stringify(sessions));
            }

            // Получаем список всех баз данных
            let databases = await indexedDB.databases();

            // Поиск базы данных
            for (const database of databases) {
                if (database.name && database.name === `codeme::${sessionId}`) {
                    Logger.debug("[app][local-storage]: Удаляем базу данных", database.name);

                    // Закрываем БД если это текущая сессия
                    if (this.sessionId === sessionId) IndexedDB.close();

                    // Удаляем БД
                    indexedDB.deleteDatabase(database.name);

                }
            }

            // Удаляем все типы кеша
            if (sessionId) await CacheManager.clearSessionCache(sessionId);

            return true;

        } catch (error) {
            Logger.error("[app][local-storage]: Ошибка при удалении баз данных:", error);
            return false;
        }

    }

    // ***************************************************************************
    // Удаляем все сессии
    // ***************************************************************************
    static async removeAllSessions(): Promise<void> {

        // Получаем список сессий
        let sessions: StoredSession[] = [];
        window.localStorage.setItem("sessions", JSON.stringify(sessions));

        // Получаем список всех баз данных
        let databases = await indexedDB.databases();
        console.log("[app][db]: Удаляем базы данных");

        // Удаляем все базы данных
        for (const database of databases) {
            if (database.name) {
                indexedDB.deleteDatabase(database.name);
            }
        }

    }

    // ***************************************************************************
    // Входим в новую сессию
    // ***************************************************************************
    static enterSession(sessionId: string): void {

        // Сбрасываем параметры
        this.sessionId = null;
        this.session = null;

        // Сбрасываем последнюю активную сессию
        this.dropLastActionSession();

        // Отключаем БД
        IndexedDB.close();

        // Отключаем сокет
        Socket?.client?.disconnect();

        // Устанавливаем последнюю активную сессию
        this.setLastActionSession(sessionId);

        // Перезагружаем страницу
        window.location.reload();

    }

    // ***************************************************************************
    // Выходим для смены аккаунта
    // ***************************************************************************
    static exitSession(): void {

        // Сбрасываем параметры
        this.sessionId = null;
        this.session = null;

        // Сбрасываем последнюю активную сессию
        this.dropLastActionSession();

        // Отключаем БД
        IndexedDB.close();

        // Отключаем сокет
        Socket?.client?.disconnect();

        // Перезагружаем страницу
        window.location.reload();

    }

    // ***************************************************************************
    // Выходим из аккаунта полностью
    // ***************************************************************************
    static logOutSession(): void {

        // Получаем текущую сессию и удаляем ее
        this.removeSession(this.sessionId);

        // Сбрасываем параметры
        this.sessionId = null;
        this.session = null;

        // Отключаем БД
        IndexedDB.close();

        // Отключаем сокет
        Socket?.client?.disconnect();

        // Перезагружаем страницу
        window.location.reload();

    }

}
