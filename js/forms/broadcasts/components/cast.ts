// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем forms
import { BroadcastPlay } from "../../broadcast-play/index.js";

// Импортируем типы
import { isBroadcastCast } from "../types.js";
import type { StoreEventName } from "../../../utils/store.js";
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
 * Фабрика возвращает готовый DOM-элемент (легаси-конструктор возвращал
 * элемент вместо this — в TS такой паттерн не типизируется честно):
 * `createCastItem(form, data)`.
 *
 * @param form - Экземпляр формы трансляций.
 * @param data - Данные трансляции.
 * @returns Готовый DOM-элемент карточки.
 * ***************************************************************************
 */
export function createCastItem(form: Broadcasts, data: BroadcastCast): HTMLElement {

    // Записываем данные: setup обновляет ссылку, как раньше это делал this.data
    let current = data;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Проставляем id элементу: по нему ScrollManager ищет якорь скролла
    // при вставке пачки в начало списка (см. functions/get_casts.ts)
    if (data?.id) element.setAttribute("data-id", data.id);

    // Записываем ссылку на dom элемент
    if (!current.__domElements__) {
        current.__domElements__ = [];
    }
    current.__domElements__.push(element);

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
                <div class="relative flex flex-col gap-0 self-center w-full h-full aspect-16/9">
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

            // Если на форму передан callback
            if (form.callback) {
                form.callback(current);
            } else {

                let instance = BroadcastPlay.instances.get(current.id);
                if (instance) {
                    instance.modal?.activate();
                } else {
                    new BroadcastPlay({ castId: current.id })
                }

            }

        });

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

            // Сохраняем функцию отписки в data, чтобы Main мог вызвать ее при удалении
            current.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    }

}
