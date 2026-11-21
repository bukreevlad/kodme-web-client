// Импортируем utils
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем forms
import { BroadcastPlay } from "../../broadcast-play/index.js";

// Импортируем functions
import { startHoverPreview, PREVIEW_DELAY_MS } from "../functions/hover_preview.js";

// Импортируем типы
import { isBroadcastCast } from "../types.js";
import type { StoreEventName } from "../../../utils/store.js";
import type { HoverPreviewHandle } from "../functions/hover_preview.js";
import type { BroadcastCast } from "../types.js";
import type { Broadcasts } from "../index.js";

/**
 * Период обновления кадра эфира на карточке (мс): кадр на медиасервере
 * меняется каждую секунду, но чаще нужного его не запрашиваем.
 */
const LIVE_THUMB_REFRESH_MS = 10000;

/**
 * ***************************************************************************
 * createCastItem - карточка трансляции в списке.
 *
 * Состояния: обложка (thumbnail) или плейсхолдер с иконкой, бейдж «LIVE»
 * при is_live. Карточка кликабельна: открывает воспроизведение трансляции
 * (или вызывает callback формы, если он передан).
 *
 * Фабрика возвращает готовый DOM-элемент: `createCastItem(form, data)`.
 *
 * @param form - Экземпляр формы трансляций.
 * @param data - Данные трансляции.
 * @returns Готовый DOM-элемент карточки.
 * ***************************************************************************
 */
export function createCastItem(form: Broadcasts, data: BroadcastCast): HTMLElement {

    // Записываем данные: setup обновляет ссылку, как раньше это делал this.data
    let current = data;

    // Состояние hover-превью: таймер задержки и активный плеер
    let previewTimer: ReturnType<typeof setTimeout> | null = null;
    let preview: HoverPreviewHandle | null = null;

    // Таймер обновления кадра эфира (тикает только пока трансляция live)
    let thumbTimer: ReturnType<typeof setInterval> | null = null;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Картинка карточки: invariant — оба data-* селектора есть в шаблоне,
    // карточка создана из него же, элементы не пересоздаются
    const thumbImage = element.querySelector<HTMLImageElement>(`:scope [data-thumbnail]`);
    const placeholderImage = element.querySelector<HTMLImageElement>(`:scope [data-img-placeholder]`);

    // Проставляем id элементу: по нему ScrollManager ищет якорь скролла
    // при вставке пачки в начало списка (см. functions/get_casts.ts)
    if (data?.id) element.setAttribute("data-id", data.id);

    // Регистрируем DOM-копию строки в реестре стора
    form.store.registerDomElement(current.id, element);

    // Устанавливаем начальные данные
    setup(current);

    // Прикрепляем обработчики событий
    actions();

    // Подписываем на обновление
    subscribeToUpdates();

    // Возвращаем сам элемент для вставки в DOM
    return element;

    /**
     * ***************************************************************************
     * Шаблон элемента: DOMParser создаёт DOM без innerHTML.
     * @returns DOM-элемент карточки.
     * ***************************************************************************
     */
    function template(): HTMLElement {

        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        // Плейсхолдер без обложки — чистая поверхность (без иконки-заглушки);
        // при наведении карточка чуть увеличивается (только при отсутствии
        // запроса на reduced motion) и поднимается тенью
        return new DOMParser().parseFromString(`
            <div class="item flex flex-col gap-1 p-0 bg-[var(--second-bg)] cursor-pointer rounded-lg overflow-hidden transition-all duration-200 motion-reduce:transition-none motion-safe:hover:scale-[1.02] motion-safe:hover:shadow-md motion-safe:active:scale-[.99]">
                <div data-media class="relative flex flex-col gap-0 self-center w-full h-full aspect-16/9">
                    <img data-thumbnail class="w-full h-full aspect-16/9 object-cover bg-[var(--second-bg)]" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" draggable="false" />
                    <div data-placeholder class="absolute w-full h-full aspect-16/9 bg-[var(--second-bg)] pointer-events-none">
                        <img data-img-placeholder class="absolute w-full h-full aspect-16/9 object-cover bg-[var(--second-bg)]" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" draggable="false"/>    
                    </div>
                    <div data-is-live class="absolute top-2 left-2 hidden flex flex-row gap-1 px-2 py-1 items-center text-[0.7rem] font-semibold text-white bg-[var(--color-red)] rounded-full">
                        ${Icons.icon("circle-caret-right")?.outerHTML}
                        <span data-type-play class="font-mono">LIVE</span>
                    </div>
                </div>
                <div class="flex flex-col gap-0 p-2 items-start">
                    <span data-name class="font-semibold truncate w-full"></span>
                    <span data-creator class="truncate w-full text-secondary text-sm"></span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Новые данные трансляции.
     * ***************************************************************************
     */
    function setup(next: BroadcastCast): void {

        try {

            // Сохраняем актуальные данные
            current = next;

            // Устанавливаем элементы: invariant — все data-* селекторы ниже
            // есть в шаблоне template(), карточка создана из него же
            let name = element.querySelector<HTMLElement>(":scope [data-name]");
            let creator = element.querySelector<HTMLElement>(":scope [data-creator]");
            let isLive = element.querySelector<HTMLElement>(":scope [data-is-live]");

            // Обложка из БД: кадр офлайн-карточки и фолбэк, если кадр
            // с медиасервера не отдался
            const coverUrl = getCoverUrl(next);

            // Эфир идёт — на карточке текущий кадр с медиасервера
            // (обновляется по таймеру); иначе обложка из БД/плейсхолдер
            if (next.is_live && next.access_token) {
                showLiveThumb(next, coverUrl);
                startThumbRefresh();
            } else {
                stopThumbRefresh();
                showCover(coverUrl);
            }

            // Отображаем данные
            if (name) name.textContent = next.name;
            if (creator) creator.textContent = next.created_display_name ?? "";

            // Если активна
            if (next.is_live) {
                isLive?.classList.remove("hidden");
            } else {

                isLive?.classList.add("hidden");

                // Эфир остановили — активное превью гасим (обложка вернётся)
                stopPreview();

            }

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * URL обложки трансляции из БД.
     * @param next - Данные трансляции.
     * @returns URL обложки либо null, если обложки нет.
     * ***************************************************************************
     */
    function getCoverUrl(next: BroadcastCast): string | null {

        if (!next.thumbnail) return null;

        // Получения размера миниатюры
        const thumbnails = next.thumbnail.metadata?.thumbnails;
        const thumbSize = getThumbnailSizeQuery(thumbnails, 400);

        // Формируем ссылку через CacheManager
        return CacheManager.getMediaSrc({
            url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${next.thumbnail.id}${thumbSize?.string}`,
            file_token: next.thumbnail.token,
            type: "image"
        });

    }

    /**
     * ***************************************************************************
     * Показывает обложку из БД, при её отсутствии — плейсхолдер.
     * @param coverUrl - URL обложки (null — обложки нет).
     * ***************************************************************************
     */
    function showCover(coverUrl: string | null): void {

        if (!thumbImage || !placeholderImage) return;

        // Ошибка самой обложки уводит карточку в плейсхолдер, а не в битую картинку
        thumbImage.onerror = () => showPlaceholder();

        if (coverUrl) {

            thumbImage.classList.remove("hidden");
            thumbImage.src = coverUrl;

            // Обложка есть — плейсхолдер прячем
            placeholderImage.classList.add("hidden");

        } else {
            showPlaceholder();
        }

    }

    /**
     * ***************************************************************************
     * Показывает плейсхолдер вместо картинки карточки.
     * ***************************************************************************
     */
    function showPlaceholder(): void {

        thumbImage?.classList.add("hidden");
        placeholderImage?.classList.remove("hidden");

    }

    /**
     * ***************************************************************************
     * Показывает текущий кадр эфира с медиасервера. Кадр подгружается в
     * скрытый Image и на карточку попадает только успешным: битый src
     * мигнул бы пустым прямо поверх обложки. Если кадр не отдаётся (стрим
     * только стартует либо уже остановился), карточка остаётся на обложке
     * из БД.
     * @param next - Данные трансляции (нужны id и access_token).
     * @param coverUrl - URL обложки из БД — фолбэк при ошибке кадра.
     * ***************************************************************************
     */
    function showLiveThumb(next: BroadcastCast, coverUrl: string | null): void {

        // invariant: вызывается только при is_live с токеном
        if (!thumbImage || !next.access_token) return;

        // &_ — браузер не должен отдавать кадр из кэша: он меняется на ходу
        const url = `${window.location.protocol}//${window.location.hostname}/api/v1/cast/hls/live/${next.id}/thumb.jpg?token=${next.access_token}&_=${Date.now()}`;

        const probe = new Image();

        probe.onload = () => {

            // Данные могли устареть, пока кадр грузился — чужой не ставим
            if (current.id !== next.id || !current.is_live) return;

            thumbImage.onerror = null;
            thumbImage.classList.remove("hidden");
            thumbImage.src = url;

            // Кадр закрывает плейсхолдер
            placeholderImage?.classList.add("hidden");

        };

        probe.onerror = () => showCover(coverUrl);

        probe.src = url;

    }

    /**
     * ***************************************************************************
     * Запускает периодическое обновление кадра эфира (повторный вызов
     * при уже работающем таймере — no-op).
     * ***************************************************************************
     */
    function startThumbRefresh(): void {

        if (thumbTimer !== null) return;

        thumbTimer = setInterval(() => {

            // Карточку сняли из документа — тикать на снятой копии незачем
            // (запись могут удалить раньше, чем отработает подписка стора)
            if (!element.isConnected) {
                stopThumbRefresh();
                return;
            }

            // Вкладка скрыта — кадр не обновляем, тик возобновится после возврата
            if (document.hidden) return;

            // Карточка за пределами экрана — запрос откладываем до показа
            const rect = element.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) return;

            // Эфир мог закончиться, а данные списка ещё не пришли
            if (!current.is_live || !current.access_token) {
                stopThumbRefresh();
                showCover(getCoverUrl(current));
                return;
            }

            showLiveThumb(current, getCoverUrl(current));

        }, LIVE_THUMB_REFRESH_MS);

    }

    /**
     * ***************************************************************************
     * Останавливает обновление кадра эфира. Идемпотентна.
     * ***************************************************************************
     */
    function stopThumbRefresh(): void {

        if (thumbTimer === null) return;

        clearInterval(thumbTimer);
        thumbTimer = null;

    }

    /**
     * ***************************************************************************
     * Обработчики: открытие воспроизведения трансляции.
     * ***************************************************************************
     */
    function actions(): void {

        // Открыть трансляцию
        element.addEventListener("click", () => {

            // Клик открывает воспроизведение — превью больше не нужно
            stopPreview();

            // Если на форму передан callback
            if (form.callback) {
                form.callback(current);
            } else {

                let instance = FormsRegistry.getOwner<BroadcastPlay>(`broadcast-play:${current.id}`);
                if (instance) {
                    instance.modal?.activate();
                } else {
                    new BroadcastPlay({ castId: current.id })
                }

            }

        });

        // На тач-устройствах hover нет: превью не запускаем вовсе
        if (IsMobile.get()) return;

        // Наведение: через PREVIEW_DELAY_MS под обложкой появляется поток
        element.addEventListener("mouseenter", () => {

            // Превью только для живого эфира с токеном
            if (!current.is_live || !current.access_token) return;

            // Таймер уже стоит либо плеер уже играет — повторно не стартуем
            if (previewTimer !== null || preview !== null) return;

            // Cleanup регистрируем сразу: запись могут удалить, пока тикает
            // таймер — без регистрации снять превью было бы нечем
            form.hoverPreviews.set(current.id, stopPreview);

            previewTimer = setTimeout(() => {

                previewTimer = null;

                const container = element.querySelector<HTMLElement>(":scope [data-media]");

                // invariant: media-контейнер входит в шаблон карточки
                if (!container) return;

                preview = startHoverPreview(current, container);

                // Не запустилось (нет MSE/токена) — cleanup забираем обратно
                if (!preview) form.hoverPreviews.delete(current.id);

            }, PREVIEW_DELAY_MS);

        });

        // Увод мыши — таймер и плеер снимаются полностью
        element.addEventListener("mouseleave", stopPreview);

    }

    /**
     * ***************************************************************************
     * Остановка hover-превью: отменяет таймер, гасит плеер и забирает cleanup
     * из реестра формы. Идемпотентна — зовётся с mouseleave, кликом,
     * удалением записи и обновлением без эфира.
     * ***************************************************************************
     */
    function stopPreview(): void {

        if (previewTimer !== null) {
            clearTimeout(previewTimer);
            previewTimer = null;
        }

        if (preview) {
            preview.stop();
            preview = null;
        }

        form.hoverPreviews.delete(current.id);

    }

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления трансляции.
     * ***************************************************************************
     */
    function subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события
            let itemUpdatedEvent: StoreEventName = `item::updated::${current.id}`;

            // Подписываемся и сохраняем функцию отписки
            let unsubscribe = form.store.on(itemUpdatedEvent, (payload) => {

                // Стор шлёт payload как unknown — сверяемся guard'ом
                if (!isBroadcastCast(payload)) return;

                // Передаем новые данные в setup, чтобы перерисовать DOM
                setup(payload);

            });

            // Запоминаем отписку в сторе — она вызовется при удалении элемента
            form.store.addItemSubscription(current.id, unsubscribe);

            // Таймер кадра гасим тем же механизмом: mouseleave при удалении
            // из DOM не придёт, тикать он иначе продолжал бы на снятой копии
            form.store.addItemSubscription(current.id, stopThumbRefresh);

        } catch (error) {
            Logger.error(error);
        }

    }

}
