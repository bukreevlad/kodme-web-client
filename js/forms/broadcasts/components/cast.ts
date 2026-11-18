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

    // Создаем DOM-элемент из шаблона
    const element = template();

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
            let thumbImage = element.querySelector<HTMLImageElement>(`:scope [data-thumbnail]`);
            let placeholderImage = element.querySelector<HTMLImageElement>(`:scope [data-img-placeholder]`);
            let name = element.querySelector<HTMLElement>(":scope [data-name]");
            let creator = element.querySelector<HTMLElement>(":scope [data-creator]");
            let isLive = element.querySelector<HTMLElement>(":scope [data-is-live]");

            if (next.thumbnail) {

                // Получения размера миниатюры
                const thumbnails = next.thumbnail.metadata?.thumbnails;
                const thumbSize = getThumbnailSizeQuery(thumbnails, 400);

                // Формируем ссылку через CacheManager
                const mediaUrl = CacheManager.getMediaSrc({
                    url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${next.thumbnail.id}${thumbSize?.string}`,
                    file_token: next.thumbnail.token,
                    type: "image"
                });

                // Устанавливаем ссылку
                if (thumbImage) thumbImage.src = mediaUrl;

                // Обложка есть — плейсхолдер прячем
                placeholderImage?.classList.add("hidden");

            } else {

                // Обложки нет (или убрали при обновлении) — src убираем,
                // плейсхолдер возвращаем
                thumbImage?.classList.add("hidden");
                placeholderImage?.classList.remove("hidden");

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

        } catch (error) {
            Logger.error(error);
        }

    }

}
