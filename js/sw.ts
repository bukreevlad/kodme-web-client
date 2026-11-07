// ***************************************************************************
// Service Worker «Код.me»: офлайн-кеш, push-уведомления, перехват запросов.
// Файл-шаблон: токены __CACHE_NAME__ и __CACHE_FILES_ARRAY__
// подставляются при сборке.
// ***************************************************************************

// Токены сборки

/** Имя основного кеша приложения (подставляется при сборке). */
const CACHE_NAME = "__CACHE_NAME__";

/** Список precache-файлов манифеста (подставляется при сборке). */
declare const __CACHE_FILES_ARRAY__: string[];

const CACHE_PREFIX = "codeme";

/** Префикс кешей приложения (codeme::app::<hash>). */
const APP_CACHE_PREFIX = "codeme::app::";

const MEDIA_TYPES = ["image", "voice", "audio", "video", "file", "media"];

// Лимит размера медиа-файла для кеширования (10 МБ)
const MEDIA_CACHE_MAX_BYTES = 10 * 1024 * 1024;

// Индекс закешированных медиа: имя кеша → множество ключей
const mediaCacheIndex = new Map<string, Set<string>>();

// Идущие догрузки в кеш: "имя кеша::ключ" — защита от параллельных загрузок
const warmingMediaKeys = new Set<string>();

// ***************************************************************************
// Типы глобалов и событий Service Worker (дополняют lib.webworker)
// ***************************************************************************
interface WorkerGlobalScope {

    /** Регистрация текущего Service Worker. */
    readonly registration: ServiceWorkerRegistration;

    /** Окна, контролируемые Service Worker. */
    readonly clients: Clients;

    /** Принудительная активация Service Worker (вытеснение старой версии). */
    skipWaiting(): Promise<void>;

}

/** События Service Worker на глобале. */
interface WorkerGlobalScopeEventMap {

    /** Установка Service Worker (новая версия закеширована). */
    install: ExtendableEvent;

    /** Активация Service Worker (новая версия взяла контроль). */
    activate: ExtendableEvent;

    /** Пришло push-уведомление. */
    push: PushEvent;

    /** Пользователь кликнул по уведомлению. */
    notificationclick: NotificationEvent;

    /** Перехват сетевого запроса. */
    fetch: FetchEvent;

}

/** Кнопка (действие) в push-уведомлении. */
interface NotificationAction {

    /** Идентификатор действия. */
    action: string;

    /** Отображаемое название действия. */
    title: string;

    /** Иконка действия. */
    icon?: string;

}

interface NotificationOptions {

    /** Кнопки (действия) уведомления. */
    actions?: NotificationAction[];

    /** Картинка уведомления. */
    image?: string;

    /** Моно-плашка уведомления (badge). */
    badge?: string;

    /** Метка времени уведомления (мс). */
    timestamp?: number;

    /** Не скрывать уведомление автоматически (до действия пользователя). */
    requireInteraction?: boolean;

}

interface NotificationEvent {

    /** Текст ответа на уведомление (inline-reply). */
    reply?: string;

}

// ***************************************************************************
// Live-трансляции — мимо SW: тело потока бесконечно (FLV) или меняется
// на ходу (HLS), такие запросы нельзя пропускать через respondWith
// ***************************************************************************
const LIVE_STREAM_PATHS = [
    "/api/v1/cast/flv/",   // FLV-live: тело ответа никогда не завершается
    "/api/v1/cast/hls/",   // HLS-live: манифест и сегменты обновляются на ходу
    "/api/v1/cast/whep/",  // приём WebRTC-трансляции (WHEP)
    "/api/v1/cast/whip/",  // публикация WebRTC-трансляции (WHIP)
];

/**
 * Данные push-уведомления от сервера (тело сообщения push).
 */
interface PushNotificationPayload {

    /** Заголовок уведомления. */
    title: string;

    /** Текст уведомления. */
    body?: string;

    /** Тег уведомления (группировка). */
    tag?: string;

    /** Иконка уведомления. */
    icon?: string;

    /** Моно-плашка уведомления (badge). */
    badge?: string;

    /** Картинка уведомления. */
    image?: string;

    /** Метка времени уведомления (мс). */
    timestamp?: number;

    /** Действия уведомления. */
    actions?: NotificationAction[];

    /** Произвольные данные уведомления. */
    data?: unknown;

}

/**
 * Данные уведомления о посте (push-уведомления с сервера).
 */
interface PostPushNotificationData {

    /** Тип уведомления ("post" — уведомление о посте). */
    type?: string;

    /** Id push-токена. */
    pushId?: string;

    /** Id поста. */
    postId?: string;

    /** Id получателя. */
    forUserId?: string;

    /** URL открытия при клике на уведомление. */
    url?: string;

}

// ***************************************************************************
// Установка сервис воркера
// ***************************************************************************
self.addEventListener("install", (event: ExtendableEvent) => {
    console.log("[sw]: Инсталляция нового SW...");

    // self.skipWaiting() не вызываем: активация — по подтверждению пользователя

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[sw]: Кешируем файлы из списка:", __CACHE_FILES_ARRAY__.length);
            return cache.addAll(__CACHE_FILES_ARRAY__);
        }).catch(err => {
            console.error("[sw]: Ошибка при установке:", err);
        })
    );
});

// ***************************************************************************
// Активация сервис воркера
// ***************************************************************************
self.addEventListener("activate", (event: ExtendableEvent) => {
    console.log("[sw]: Активация нового SW. Захват клиентов...");
    event.waitUntil(self.clients.claim());

    event.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names.map((item) => {

                    // Медиа-кеши сохраняем, удаляем кеши приложения и чужие
                    const isAppCache = item.startsWith(APP_CACHE_PREFIX);
                    const isForeignCache = !item.startsWith(CACHE_PREFIX);

                    if (item !== CACHE_NAME && (isAppCache || isForeignCache)) {
                        console.log("[sw]: Удаляем устаревший кеш:", item);
                        return caches.delete(item);
                    }
                })
            );
        })
    );
});

// ***************************************************************************
// Пуш уведомления
// ***************************************************************************
self.addEventListener("push", (event: PushEvent) => {

    // Устанавливаем параметры
    let notifyData: PushNotificationPayload;

    try {

        // Пустой payload — уходим в уведомление по умолчанию
        if (!event.data) throw new Error("Пустой payload");

        // Данные уведомления
        notifyData = event.data.json();

    } catch {

        // Если ошибка - отображаем стандартное сообщение
        notifyData = {
            title: "Новое сообщение",
            body: "Сообщение скрыто",
        };

    }

    // Отмена звонка: закрываем показанное уведомление, нового не показываем
    if ((notifyData.data as { type?: string } | undefined)?.type === "CALL-CANCEL") {

        let callId = (notifyData.data as { callId?: string } | undefined)?.callId;

        event.waitUntil(
            self.registration.getNotifications({ tag: `incoming-call-${callId}` })
                .then((notifications) => notifications.forEach((notification) => notification.close()))
        );

        return;
    }

    // Показываем уведомление; иконки по умолчанию, если сервер не прислал свои
    event.waitUntil(
        self.registration.showNotification(notifyData.title, {
            tag: notifyData.tag || "",
            body: notifyData.body || "",
            icon: notifyData.icon || "/img/icon_192.png",
            badge: notifyData.badge || "/img/icon_128.png",
            image: notifyData.image || "",
            timestamp: notifyData.timestamp || 0,
            requireInteraction: (notifyData.data as { type?: string } | undefined)?.type === "INCOMING-CALL",
            actions: notifyData.actions || [],
            data: notifyData.data || ""
        })
    );
});

// ***************************************************************************
// При клике на уведомления
// ***************************************************************************
self.addEventListener("notificationclick", (event: NotificationEvent) => {
    event.notification.close();

    // Данные уведомления
    const notificationData: PostPushNotificationData = event.notification.data;

    // Действия для уведомлений о постах
    if (notificationData.type === "post") {

        // Event action: post-auto-read
        if (event.action === "auto-read") {

            // Отправляем данные на сервер
            event.waitUntil(
                fetch(`/push-notifications/post/auto-read`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pushId: notificationData.pushId,
                        postId: notificationData.postId,
                        forUserId: notificationData.forUserId,
                    })
                })
            );

        }

        // Event action: post-answer
        if (event.action === "answer") {

            // Отправляем данные на сервер
            event.waitUntil(
                fetch(`/push-notifications/post/answer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pushId: notificationData.pushId,
                        postId: notificationData.postId,
                        forUserId: notificationData.forUserId,
                        text: event.reply
                    })
                })
            );

        }

        // Event action: post-commenting
        if (event.action === "commenting") {

            // Отправляем данные на сервер
            event.waitUntil(
                fetch(`/push-notifications/post/comment`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pushId: notificationData.pushId,
                        postId: notificationData.postId,
                        forUserId: notificationData.forUserId,
                        text: event.reply
                    })
                })
            );

        }

        // Event action: post-like
        if (event.action === "like") {

            // Отправляем данные на сервер
            event.waitUntil(
                fetch(`/push-notifications/post/like`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pushId: notificationData.pushId,
                        postId: notificationData.postId,
                        forUserId: notificationData.forUserId
                    })
                })
            );

        }

    }

    // Клик по уведомлению: фокусируем окно приложения или открываем новое
    if (!event.action) {

        const host = self.location.origin;

        // Получаем все окна
        const promise = self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then((clientList) => {

            // Окно
            let windowClient: WindowClient | null = null;

            // Проходим по окнам
            for (const client of clientList) {
                if (client.url.startsWith(host)) {
                    windowClient = client;
                    break;
                }
            }

            // Проверка окна
            if (windowClient) {

                // Отправляем payload в приложение
                windowClient.postMessage({
                    type: "FOCUS_NOTIFICATION_CLICK",
                    data: notificationData
                });
                return windowClient.focus();

            } else {
                return self.clients.openWindow(notificationData.url || "/");
            }
        });

        event.waitUntil(promise);
    }

});

// ***************************************************************************
// Обработка сообщений от приложения:
// ***************************************************************************
self.addEventListener("message", (event: MessageEvent) => {

    // Принудительная активация
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }

});

// ***************************************************************************
// Обработка запросов (Fetch)
// ***************************************************************************
self.addEventListener("fetch", (event: FetchEvent) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== "GET") return;

    // Игнорируем внешние S3-домены
    if (url.origin !== self.location.origin) return;

    // Live-трансляции — мимо SW
    if (isLiveStreamRequest(url)) return;

    // Медиа хранилища (/api/v1/storage/<id>?token=…&cache_type=…&session_id=…)
    // кешируются для офлайна; ветка должна стоять выше проверки /api/ ниже
    const cacheType = url.searchParams.get("cache_type");

    // Проверка: относится ли запрос к медиа-хранилищу
    if (cacheType && MEDIA_TYPES.includes(cacheType)) {

        // Range-запросы (перемотка): попадание в кеше — отдаём из него,
        // промах — сеть напрямую (мимо SW) и догрузка файла в кеш
        if (request.headers.has("Range")) {
            const cacheName = mediaCacheName(cacheType, url.searchParams.get("session_id") || "common");
            const cacheKey = mediaCacheKey(url);
            const index = mediaCacheIndex.get(cacheName);

            // Промах — сеть напрямую и догрузка файла в кеш
            if (index && !index.has(cacheKey)) {
                event.waitUntil(warmUpMedia(cacheName, cacheKey, mediaFetchUrl(url)));
                return;
            }

            // Попадание (или холодный старт SW) — обслуживаем сами
            event.respondWith(serveMediaFromCache(event, cacheName, cacheKey, mediaFetchUrl(url)));
            return;
        }

        console.debug(`[sw]: 🔍 Перехват медиа: ${url.pathname} (тип: ${cacheType})`);
        event.respondWith(handleMediaFetch(event, cacheType));
        return;
    }

    // Остальной API не кешируем (токены в запросах, одноразовые ответы)
    if (url.pathname.startsWith("/api/")) return;

    // Статика приложения
    event.respondWith(handleAppFetch(event));
});

// ***************************************************************************
// Определение живого потока
// ***************************************************************************
/**
 * ***************************************************************************
 * Проверяет, что запрос относится к live-трансляции (FLV / HLS / WHEP / WHIP).
 * @param url - Разобранный URL запроса.
 * @returns - true, если это живой поток и его надо пропустить мимо SW.
 * ***************************************************************************
 */
function isLiveStreamRequest(url: URL): boolean {

    return LIVE_STREAM_PATHS.some((path) => url.pathname.startsWith(path));

}

// ***************************************************************************
// Логика кеширования статики приложения
// ***************************************************************************
/**
 * ***************************************************************************
 * Обслуживает запрос статики приложения: cache-first, при промахе — сеть.
 * Вызывается только для precache-файлов сборки и прочих статических ресурсов.
 * @param event - Событие fetch.
 * @returns - Ответ из кеша или из сети.
 * ***************************************************************************
 */
async function handleAppFetch(event: FetchEvent): Promise<Response> {

    const request = event.request;

    // Частичные ответы в кеш не кладём: это кусок файла, а не сам файл.
    const hasRange = request.headers.has("Range");

    const cache = await caches.open(CACHE_NAME);

    // Cache-first: файлы сборки уже в кеше; ignoreSearch — для навигаций с query
    const cachedResponse = await cache.match(request, { ignoreSearch: true });
    if (cachedResponse) return cachedResponse;

    const response = await fetch(request);

    // В кеш — только полные ответы 200 без Range
    if (!hasRange && response.status === 200 && response.body) {

        event.waitUntil(
            cache.put(request, response.clone()).catch((error) => {
                console.error("[sw]: ❌ Ошибка cache.put():", error);
            })
        );

    }

    return response;

}

// ***************************************************************************
// Кеш медиа: ключи, индекс, догрузка
// ***************************************************************************
/**
 * ***************************************************************************
 * Имя кеша медиа по типу и сессии.
 * @param {string} type - Тип медиа (image/voice/audio/video/file/media).
 * @param {string} sessionId - Id сессии.
 * @returns {string} - Имя кеша.
 * ***************************************************************************
 */
function mediaCacheName(type: string, sessionId: string): string {
    return `${CACHE_PREFIX}::${type}::1::${sessionId}`;
}

/**
 * ***************************************************************************
 * Ключ кеша медиа: URL без token/cache_type/session_id.
 * @param {URL} url - Разобранный URL запроса.
 * @returns {string} - Ключ.
 * ***************************************************************************
 */
function mediaCacheKey(url: URL): string {
    const cleanUrl = new URL(url.toString());
    cleanUrl.searchParams.delete("token");
    cleanUrl.searchParams.delete("cache_type");
    cleanUrl.searchParams.delete("session_id");
    return cleanUrl.toString();
}

/**
 * ***************************************************************************
 * URL для загрузки файла: без cache_type/session_id, токен оставляем в query.
 * @param {URL} url - Разобранный URL запроса.
 * @returns {URL} - URL загрузки.
 * ***************************************************************************
 */
function mediaFetchUrl(url: URL): URL {
    const fetchUrl = new URL(url.toString());
    fetchUrl.searchParams.delete("cache_type");
    fetchUrl.searchParams.delete("session_id");
    return fetchUrl;
}

/**
 * ***************************************************************************
 * Проверяет, что файл не больше лимита кеширования (по Content-Length).
 * @param {Response} response - Ответ сервера (заголовки уже получены).
 * @returns {boolean} - true, если файл можно кешировать.
 * ***************************************************************************
 */
function isCacheableSize(response: Response): boolean {
    const length = Number(response.headers.get("content-length") || 0);
    return length > 0 && length <= MEDIA_CACHE_MAX_BYTES;
}

/**
 * ***************************************************************************
 * Строит индекс закешированных ключей кеша (для синхронной проверки).
 * @param {string} cacheName - Имя кеша.
 * @returns {Promise<Set<string>>} - Множество ключей.
 * ***************************************************************************
 */
async function buildMediaIndex(cacheName: string): Promise<Set<string>> {
    let index = mediaCacheIndex.get(cacheName);
    if (index) return index;

    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    index = new Set(keys.map((key) => key.url));
    mediaCacheIndex.set(cacheName, index);
    return index;
}

/**
 * ***************************************************************************
 * Помечает ключ как закешированный в индексе.
 * @param {string} cacheName - Имя кеша.
 * @param {string} cacheKey - Ключ.
 * @returns {Promise<void>}
 * ***************************************************************************
 */
async function rememberCachedMedia(cacheName: string, cacheKey: string): Promise<void> {
    const index = await buildMediaIndex(cacheName);
    index.add(cacheKey);
}

/**
 * ***************************************************************************
 * Догружает медиа-файл в кеш, если он не больше лимита.
 * @param {string} cacheName - Имя кеша.
 * @param {string} cacheKey - Ключ.
 * @param {URL} fetchUrl - URL загрузки.
 * @returns {Promise<void>}
 * ***************************************************************************
 */
async function warmUpMedia(cacheName: string, cacheKey: string, fetchUrl: URL): Promise<void> {
    const index = await buildMediaIndex(cacheName);
    if (index.has(cacheKey)) return;

    const inflightKey = `${cacheName}::${cacheKey}`;
    if (warmingMediaKeys.has(inflightKey)) return;
    warmingMediaKeys.add(inflightKey);

    try {
        const controller = new AbortController();
        const response = await fetch(fetchUrl.toString(), {
            method: "GET",
            mode: "cors",
            credentials: "omit",
            signal: controller.signal
        });

        // Размер известен сразу по заголовкам: слишком большой файл не качаем
        if (!response.ok || !isCacheableSize(response)) {
            controller.abort();
            return;
        }

        const cache = await caches.open(cacheName);
        await cache.put(cacheKey, response);
        index.add(cacheKey);

    } catch (error) {
        console.error("[sw]: ❌ Ошибка догрузки в кеш:", error);
    } finally {
        warmingMediaKeys.delete(inflightKey);
    }
}

/**
 * ***************************************************************************
 * Обслуживает Range-запрос медиа: из кеша целиком, при промахе — сеть
 * и догрузка в кеш.
 * @param {FetchEvent} event - Событие fetch.
 * @param {string} cacheName - Имя кеша.
 * @param {string} cacheKey - Ключ.
 * @param {URL} fetchUrl - URL загрузки.
 * @returns {Promise<Response>} - Ответ из кеша или из сети.
 * ***************************************************************************
 */
async function serveMediaFromCache(event: FetchEvent, cacheName: string, cacheKey: string, fetchUrl: URL): Promise<Response> {
    const index = await buildMediaIndex(cacheName);
    const cache = await caches.open(cacheName);

    if (index.has(cacheKey)) {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;

        // Кеш чистили из настроек — индекс устарел
        index.delete(cacheKey);
    }

    event.waitUntil(warmUpMedia(cacheName, cacheKey, fetchUrl));
    return fetch(event.request).catch(() => new Response(null, { status: 502 }));
}

// ***************************************************************************
// Логика стриминга и кеширования медиа
// ***************************************************************************
/**
 * ***************************************************************************
 * Обслуживает запрос медиа из хранилища: персональный медиа-кеш по типу
 * и сессии, при промахе — сеть с runtime-кешированием.
 * @param event - Событие fetch.
 * @param type - Тип медиа (ключ кеша: image/voice/audio/video/file/media).
 * @returns - Ответ из кеша или из сети.
 * ***************************************************************************
 */
async function handleMediaFetch(event: FetchEvent, type: string): Promise<Response> {
    const request = event.request;
    const url = new URL(request.url);

    // Внешние хранилища (S3) — мимо SW
    if (url.origin !== self.location.origin) {
        return fetch(request).catch(() => new Response(null, { status: 502 }));
    }

    const cacheName = mediaCacheName(type, url.searchParams.get("session_id") || "common");
    const cacheKey = mediaCacheKey(url);
    const cache = await caches.open(cacheName);

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(mediaFetchUrl(url).toString(), {
            method: "GET",
            mode: "cors",
            credentials: "omit"
        });

        // В кеш — только файлы до лимита
        if (networkResponse.status === 200 && networkResponse.ok && isCacheableSize(networkResponse)) {
            const responseToCache = networkResponse.clone();
            event.waitUntil(
                cache.put(cacheKey, responseToCache).then(() => {
                    return rememberCachedMedia(cacheName, cacheKey);
                }).catch(err => {
                    console.error("[sw]: ❌ Ошибка cache.put():", err);
                })
            );
        }
        return networkResponse;

    } catch (error) {
        console.error("[sw]: ❌ Ошибка Fetch:", error);
        // Фолбэк при ошибке сети
        return fetch(request).catch(() => new Response("Network error", { status: 408 }));
    }
}
