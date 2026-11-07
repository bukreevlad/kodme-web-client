// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Замеряет высоту плавающих панелей и кладёт её в CSS-переменные.
 *
 * Шапка и футер звонка абсолютные и висят поверх контента, поэтому браузер
 * не знает, сколько места они занимают. Переменные --form-header-height /
 * --form-footer-height нужны трём вещам: отступу сетки под шапкой, базовому
 * положению плашки «я» и любым расчётам от размера рабочей области.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function updateBarsHeight(form: Call): void {

    try {

        const content = form?.content;
        if (!content) return;

        // ---------- SAFE-AREA ФУТЕРА ----------
        // Капабилити safe_area оверлея (включён для всех форм) при открытии
        // прибавляет inset нативной обёртки к уже посчитанному padding-bottom
        // футера. Но отступ футера звонка заложен в CSS уже с учётом inset —
        // через var(--safeareabottom), который в браузере берёт
        // env(safe-area-inset-bottom), а в обёртке перекрыт значением от
        // PlatformBridge (js/utils/platform.bridge.ts). Снимаем инлайн-правку,
        // иначе inset складывается дважды и панель управления отъезжает
        // от края вдвое дальше нужного
        form.footer?.style.removeProperty("padding-bottom");
        // ---------- SAFE-AREA ФУТЕРА ----------

        // Скрытая панель высоты не имеет (в immersive-режиме её убирают)
        const height = (panel: HTMLElement | null) => (panel && !panel.classList.contains("hidden") ? (panel.offsetHeight || 0) : 0);

        content.style.setProperty("--form-header-height", `${height(form.header)}px`);
        content.style.setProperty("--form-footer-height", `${height(form.footer)}px`);

    } catch (error) {
        Logger.debug("[app][call]: Не удалось обновить высоту панелей", error);
    }

}
