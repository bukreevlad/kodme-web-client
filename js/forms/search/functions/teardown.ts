// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем config формы
import { SECTION_IDS } from "../config/sections.js";

// Импортируем events
import { StoreEvents } from "../events/store/index.js";

// Импортируем типы
import type { Search } from "../index.js";

/**
 * ***************************************************************************
 * Единая точка выхода формы поиска: снимает подписки и разрушает скроллбары.
 *
 * Зачем: раньше `_onBeforeClose` чистил только сторы. Четыре инстанса
 * OverlayScrollbars оставались с `ResizeObserver`/`MutationObserver`/
 * `IntersectionObserver` на отсоединённых панелях и слушателями `scroll`,
 * замыкающимися на форму. Честная граница: глобальной утечки тут нет —
 * `createEnvironment` с `window.resize` создаётся один раз на модуль, а
 * реестр инстансов — `WeakMap`, поэтому цикл «форма → скроллбар → замыкание →
 * форма` соберёт GC сам. Но явный `destroy()` снимает наблюдатели сразу и
 * перестаёт зависеть от того, держит ли кто-то ссылку.
 *
 * Порядок важен: сначала отписки (иначе `destroy` может вызвать события в
 * подписчиках), потом скроллбары, в конце — сторы.
 *
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function teardown(form: Search): void {

    if (!form) return;

    // Помечаем форму закрытой: поздние ответы сети не должны воскрешать DOM
    form.isClosed = true;

    // ==========================
    // Подписки на сторы
    // ==========================
    StoreEvents.destroy(form);

    // ==========================
    // Отписки от скролла и полей ввода
    // ==========================
    // Накапливаются в handlers/on_scroll.ts и handlers/on_text_keydown.ts.
    // Гасят и слушатель, и таймер троттлинга: без этого отложенный вызов
    // «выстрелил» бы по удалённому DOM
    const unsubs = [...form.scrollUnsubs, ...form.uiUnsubs];
    form.scrollUnsubs = [];
    form.uiUnsubs = [];

    for (const unsub of unsubs) {
        try {
            unsub();
        } catch (error) {
            Logger.error("[app][search][teardown]::unsub", error);
        }
    }

    // ==========================
    // Скроллбары
    // ==========================
    for (const id of SECTION_IDS) {

        const instance = form.scrollInstances[id];
        if (!instance) continue;

        try {
            instance.destroy();
        } catch (error) {
            Logger.error(`[app][search][teardown][${id}]::destroy`, error);
        }

        form.scrollInstances[id] = null;

        // Менеджер якоря удерживает ссылку на разрушенный скроллбар —
        // обнуляем (состояние категории живёт в form.pagination[id])
        form.scrollManagers[id] = null;

    }

    // ==========================
    // Сторы
    // ==========================
    for (const id of SECTION_IDS) {

        try {
            form.stores[id]?.removeAll();
        } catch (error) {
            Logger.error(`[app][search][teardown][${id}]::removeAll`, error);
        }

    }

}
