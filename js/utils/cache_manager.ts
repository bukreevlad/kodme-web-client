// Импортируем utils
import { Logger } from "./logs/logger.js";

/**
 * Данные медиа-ресурса для построения кешируемого URL.
 */
export interface MediaCacheRequest {
    /** URL ресурса (пустая строка — строить нечего). */
    url: string;
    /** Токен доступа к файлу (кладётся в query-параметр token). */
    file_token?: string | undefined;
    /** Тип кеша (image, voice, audio, video, file, media). */
    type?: string;
}

/**
 * ***************************************************************************
 * CacheManager - Класс для управления медиа-кешем (картинки, файлы).
 * ***************************************************************************
 */
export class CacheManager {

    static sessionId: string | null = null;
    static version = "1";
    static cacheBasePrefix = "codeme";

    // Доступные типы хранилищ
    static types = ["image", "voice", "audio", "video", "file", "media"];
    static defaultTTL = 24 * 60 * 60 * 1000;

    /**
     * ***************************************************************************
     * Формирует URL для запроса, который перехватит Service Worker.
     * @param {MediaCacheRequest} data - Данные ресурса.
     * @returns {string} - URL с параметрами кеширования.
     * ***************************************************************************
     */
    static getMediaSrc(data: MediaCacheRequest): string {
        if (!data.url) return "";
        try {
            const u = new URL(data.url);
            if (data.file_token) u.searchParams.set("token", data.file_token);
            u.searchParams.set("cache_type", data.type || "media");
            if (this.sessionId) u.searchParams.set("session_id", this.sessionId);
            return u.toString();
        } catch (e) {
            return data.url;
        }
    }

    /**
     * ***************************************************************************
     * Принудительно кеширует ресурс (например, для кнопки "Скачать").
     * @param {MediaCacheRequest} [data] - Данные ресурса.
     * @returns {Promise<boolean>} - true, если ресурс закеширован.
     * ***************************************************************************
     */
    static async fetch(data: MediaCacheRequest = { url: "", file_token: "", type: "media" }): Promise<boolean> {
        if (!this.isSupported()) return false;

        const swUrl = this.getMediaSrc(data);
        try {
            const response = await fetch(swUrl);
            return response.ok;
        } catch (error) {
            Logger.error("[app][cache]: Ошибка предзагрузки", error);
            return false;
        }
    }

    /**
     * ***************************************************************************
     * Удаляет закэшированный ресурс (например, при протухшем токене 401).
     * @param {MediaCacheRequest} [data] - Данные ресурса.
     * @returns {Promise<boolean>} - true, если удаление выполнено.
     * ***************************************************************************
     */
    static async remove(data: MediaCacheRequest = { url: "", file_token: "", type: "media" }): Promise<boolean> {
        if (!this.isSupported() || !this.sessionId) return false;

        try {
            const cache = await this.getCache(data.type || "media");

            // Кеш может быть недоступен (API не поддержан / нет сессии)
            if (!cache) return false;

            // Чистим URL перед поиском в кеше точно так же, как SW
            const cleanUrl = new URL(data.url, window.location.origin);
            cleanUrl.searchParams.delete("token");
            cleanUrl.searchParams.delete("cache_type");
            cleanUrl.searchParams.delete("session_id");

            await cache.delete(cleanUrl.toString());
            return true;
        } catch (error) {
            Logger.error("[app][cache]: Ошибка удаления ресурса", error);
            return false;
        }
    }

    /**
     * ***************************************************************************
     * Проверяем поддержку API.
     * @returns {boolean} - true, если кеш и Service Worker доступны.
     * ***************************************************************************
     */
    static isSupported(): boolean {
        return "caches" in window && "serviceWorker" in navigator;
    }

    /**
     * ***************************************************************************
     * Генерирует имя кеша.
     * @param {string} [type] - Тип кеша.
     * @param {string | null} [sessionId] - Id сессии (иначе текущая).
     * @returns {string} - Имя кеша.
     * ***************************************************************************
     */
    static generateCacheName(type: string = "media", sessionId: string | null = null): string {
        const session = sessionId || this.sessionId;
        return `${this.cacheBasePrefix}::${type}::${this.version}::${session}`;
    }

    /**
     * ***************************************************************************
     * Инициализирует сессию и уведомляет SW.
     * @param {string} sessionId - Id сессии.
     * @returns {Promise<boolean>} - true, если сессия передана в SW.
     * ***************************************************************************
     */
    static async initializeSessionCache(sessionId: string): Promise<boolean> {
        if (!this.isSupported()) return false;
        this.sessionId = sessionId;

        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: "SET_TOKEN",
                sessionId: sessionId
            });
        }
        return true;
    }

    /**
     * ***************************************************************************
     * Получает доступ к конкретному хранилищу.
     * @param {string} [type] - Тип кеша.
     * @param {string | null} [sessionId] - Id сессии (иначе текущая).
     * @returns {Promise<Cache | null>} - Хранилище или null, если API недоступен.
     * ***************************************************************************
     */
    static async getCache(type: string = "media", sessionId: string | null = null): Promise<Cache | null> {
        if (!this.isSupported()) return null;
        const cacheName = this.generateCacheName(type, sessionId);
        return await caches.open(cacheName);
    }

    /**
     * ***************************************************************************
     * Извлечение данных (Blob) для картинок или мелких файлов.
     * @param {string} [url] - URL ресурса.
     * @param {string} [type] - Тип кеша.
     * @returns {Promise<Blob | null>} - Данные ресурса или null.
     * ***************************************************************************
     */
    static async get(url: string = "", type: string = "media"): Promise<Blob | null> {
        if (!this.isSupported() || !this.sessionId) return null;

        try {
            const cache = await this.getCache(type);

            // Кеш может быть недоступен (API не поддержан / нет сессии)
            if (!cache) return null;

            // Чистим URL перед поиском в кеше точно так же, как SW
            const cleanUrl = new URL(url, window.location.origin);
            cleanUrl.searchParams.delete("token");
            cleanUrl.searchParams.delete("cache_type");
            cleanUrl.searchParams.delete("session_id");

            const response = await cache.match(cleanUrl.toString());

            if (!response) return null;
            return await response.blob();
        } catch (error) {
            return null;
        }
    }

    /**
     * ***************************************************************************
     * Очистка сессии.
     * @param {string | null} sessionId - Id сессии (иначе текущая).
     * @returns {Promise<boolean>} - true, если кеш очищен.
     * ***************************************************************************
     */
    static async clearSessionCache(sessionId: string | null): Promise<boolean> {
        const session = sessionId || this.sessionId;
        if (!this.isSupported() || !session) return false;

        const promises = this.types.map(type => caches.delete(this.generateCacheName(type, session)));
        await Promise.all(promises);
        return true;
    }

    /**
     * ***************************************************************************
     * Удаление старых версий кеша.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    static async deleteOldVersionCaches(): Promise<void> {
        if (!this.isSupported()) return;
        try {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
                if (name.startsWith(this.cacheBasePrefix) && !name.includes(`::${this.version}::`)) {
                    await caches.delete(name);
                }
            }
        } catch (error) {
            Logger.error("[app][cache]: Ошибка очистки старых версий", error);
        }
    }

}
