/**
 * ***************************************************************************
 * SAFE_AREA - отступы под «безопасную зону» и высоты header/footer.
 * ***************************************************************************
 *
 * Что делает:
 * добавляет к header/footer (или к content, если их нет) отступы под
 * вырез экрана, а высоты header и footer выкладывает в CSS-переменные
 * `--form-header-height` / `--form-footer-height`. По ним контент формы
 * (см. `CDM_FORM_CONTENT_CLASSES`) отступает, чтобы не залезать под шапку
 * и подвал.
 *
 * Переменные — не «снимок на момент открытия»: высота абсолютной шапки
 * меняется и дальше (лента папок главной формы появляется при создании папки,
 * панели звонка переключаются, safe-area и системный масштаб шрифта подкручивают
 * панель). Поэтому за панелями следит ResizeObserver: без него отступ контента
 * устаревал бы и список оказывался перекрытым шапкой.
 *
 * Принадлежит только типу «form»: у модалок нет ни safe-area, ни такой
 * раскладки.
 */

// Импортируем типы
import type { OverlayCapability, OverlayLike } from "../types.js";

/**
 * ***************************************************************************
 * Замеряет высоты шапки/футера и поддерживает их в CSS-переменных контейнера.
 *
 * Первый замер выполняется сразу: наблюдатель отрабатывает асинхронно, и на
 * первом кадре переменные были бы 0px (контент уехал бы под шапку). Дальше
 * ResizeObserver пересчитывает значения при любом изменении размера панели.
 * События `resize` окна для этого недостаточно — высоту меняют и медиазапрос,
 * и системный шрифт, и safe-area, ни одно из которых не является ресайзом окна
 * (тот же приём применён в `forms/broadcast-play/functions/sync_header_offset.ts`).
 * @param form - Экземпляр контейнера.
 * @param header - Шапка формы (null, если её нет в шаблоне).
 * @param footer - Футер формы (null, если его нет в шаблоне).
 * @returns Наблюдатель для отписки в destroy() либо null, если следить не за чем
 *          или ResizeObserver недоступен.
 * ***************************************************************************
 */
function observePanelHeights(form: OverlayLike, header: HTMLElement | null, footer: HTMLElement | null): ResizeObserver | null {

    // Наблюдать не за чем — замер ниже всё равно не понадобится
    if (!header && !footer) return null;

    /**
     * Пишет текущие высоты панелей в переменные контейнера.
     * Одна функция нужна и для первого замера, и как реакция наблюдателя.
     */
    const apply = () => {

        // Панель с `inert` намеренно выведена из раскладки (immersive-режим
        // конференции): её высоту вручную обнуляет сама форма, капабилти
        // не должно перетирать это значение своим
        if (header && !header.hasAttribute("inert")) {
            form.content.style.setProperty("--form-header-height", `${header.offsetHeight}px`);
        }

        if (footer && !footer.hasAttribute("inert")) {
            form.content.style.setProperty("--form-footer-height", `${footer.offsetHeight}px`);
        }

    };

    // Первый замер — сразу, не дожидаясь срабатывания наблюдателя
    apply();

    // Без ResizeObserver остаётся одноразовый замер: переменные будут верны
    // на текущем кадре, просто не станут следить за дальнейшими изменениями
    if (typeof ResizeObserver === "undefined") return null;

    const observer = new ResizeObserver(apply);
    if (header) observer.observe(header);
    if (footer) observer.observe(footer);

    return observer;

}

export const safeArea: OverlayCapability = {

    /** @type {string} Имя капабилти. */
    name: "safe_area",

    /**
     * ***************************************************************************
     * Состояние капабилти на экземпляре: наблюдатель высот панелей
     * (создаётся в onMounted, отписывается в destroy).
     * ***************************************************************************
     */
    state: {
        panelHeightsObserver: null
    },

    /**
     * ***************************************************************************
     * Отступы считаются уже после монтирования: `offsetHeight` у несмонтированного
     * header равен нулю, и в `--form-header-height` попало бы 0px.
     * @param {OverlayLike} form - Экземпляр контейнера.
     * ***************************************************************************
     */
    onMounted(form) {

        // Получение элементы
        let header = form.content.querySelector<HTMLElement>(":scope .header");
        let content = form.content.querySelector<HTMLElement>(":scope .content");
        let footer = form.content.querySelector<HTMLElement>(":scope .footer");

        // Получаем значения safe-area
        let getSafeAreaTop = document.documentElement.style.getPropertyValue("--safeareatop");
        let getSafeAreaBottom = document.documentElement.style.getPropertyValue("--safeareabottom");

        // header
        if (header) {

            // Если есть safe-area
            if (getSafeAreaTop) {
                let currentPadding = getComputedStyle(header).paddingTop;
                header.style.paddingTop = `calc(${currentPadding} + var(--safeareatop))`;
            }

        } else {

            // content
            if (content) {

                // Если есть safe-area
                if (getSafeAreaTop) {
                    let currentPadding = getComputedStyle(content).paddingBottom;
                    content.style.paddingTop = `calc(${currentPadding} + var(--safeareatop))`;
                }

            }

        }

        // footer
        if (footer) {

            // Если есть safe-area
            if (getSafeAreaBottom) {
                let currentPadding = getComputedStyle(footer).paddingBottom;
                footer.style.paddingBottom = `calc(${currentPadding} + var(--safeareabottom))`;
            }

        } else {

            // content
            if (content) {

                // Если есть safe-area
                if (getSafeAreaBottom) {
                    let currentPadding = getComputedStyle(content).paddingBottom;
                    content.style.paddingBottom = `calc(${currentPadding} + var(--safeareabottom))`;
                }

            }

        }

        // Высота header/footer уходит в CSS-переменные: контент (а это шаблоны форм)
        // позиционируется относительно них через --form-header-height. Первый замер
        // делаем сразу, дальше значения держит наблюдатель.
        if (content) {

            // Повторное открытие того же экземпляра: прошлый наблюдатель
            // отписываем, иначе он останется висеть на старых панелях
            form.panelHeightsObserver?.disconnect();
            form.panelHeightsObserver = observePanelHeights(form, header, footer);

        }

    },

    /**
     * ***************************************************************************
     * Сброс. Самим капабилти правятся только inline-стили, а контейнер снимается
     * целиком — чистить их не нужно. Обязательно отписываем наблюдатель высот:
     * он пережил бы форму и продолжал писать в отсоединённый элемент.
     * @param {OverlayLike} form - Экземпляр контейнера.
     * ***************************************************************************
     */
    destroy(form) {

        if (form.panelHeightsObserver) {
            form.panelHeightsObserver.disconnect();
            form.panelHeightsObserver = null;
        }

    }

}
