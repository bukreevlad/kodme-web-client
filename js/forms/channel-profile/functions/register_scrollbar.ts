// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем типы сторонних пакетов
import type { PartialOptions } from "overlayscrollbars";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { ChannelProfile, SectionScrollKey } from "../types.js";

/**
 * ***************************************************************************
 * Создаёт OverlayScrollbars для панели вкладки и запоминает экземпляр
 * на форме, чтобы teardown мог его разрушить.
 *
 * Зачем нужен реестр: OverlayScrollbars внутри держит наблюдатели, поэтому
 * неразрушенный экземпляр удерживает уже отсоединённый DOM. В форме их шесть
 * (по панели на вкладку), и ни один раньше не destroy'ился — форма оставляла
 * после себя шесть живых скроллбаров на каждом открытии.
 *
 * @param form - Экземпляр формы.
 * @param property - Имя свойства формы для экземпляра
 *   (например "osListPhotosScrollInstance").
 * @param element - Элемент, к которому подключается скроллбар.
 * @param options - Опции OverlayScrollbars.
 * @returns Экземпляр OverlayScrollbars или null при ошибке.
 * ***************************************************************************
 */
export function registerScrollbar(
    form: ChannelProfile,
    property: SectionScrollKey,
    element: HTMLElement,
    options: PartialOptions = {}
): OverlayScrollbars | null {

    // Без формы или элемента создавать нечего
    if (!form || !element) return null;

    try {

        // Создаём экземпляр
        const instance = OverlayScrollbars(element, {
            scrollbars: { autoHide: "scroll" },
            overflow: { x: "hidden", y: "scroll" },
            ...options
        });

        // Реестр живёт на форме: teardown обходит его и разрушает всё,
        // что зарегистрировано, не зная имён свойств
        form.osInstances = form.osInstances || [];
        form.osInstances.push({ property, instance });

        // Сохраняем и в свойство — им пользуются обработчики скролла
        form[property] = instance;

        return instance;

    } catch (error) {

        Logger.error("[app][channel-profile][register-scrollbar]:", error);
        return null;

    }

}
