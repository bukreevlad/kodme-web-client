// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { NoiseGateProcessor } from "../../../utils/audio/noise_gate_processor.js";

// Импортируем components
import { Toggle } from "../../../components/toggle.js";

// Импортируем functions
import { loadNoiseSuppression } from "../../meet-play/functions/noise_suppression_storage.js";

// Импортируем типы
import type { MeetDeviceSettings } from "../index.js";

/**
 * ***************************************************************************
 * renderNoiseSetting - Рисует тумблер «Шумоподавление» в слоте формы
 *                      устройств.
 *
 * Единственный путь отрисовки секции «Звук»: функцию зовут из
 * `renderDevices`, поэтому у тумблера ровно одна гидратация и он
 * всегда в согласовании с хранилищем - после любого обновления списка
 * устройств состояние перечитывается, а не «запоминается» в DOM.
 *
 * Если браузер не поддерживает Web Audio, тумблер отключается, а под
 * ним появляется пояснение: фича не работает - но пользователь видит
 * причину, а не мёртвую кнопку без слов.
 * @param dialog - Экземпляр формы устройств.
 * @returns {void}
 * ***************************************************************************
 */
export function renderNoiseSetting(dialog: MeetDeviceSettings): void {

    try {

        // Слот создаётся в шаблоне и живёт всегда - его только
        // наполняем заново, как и списки устройств
        const slot = dialog?.tpl?.querySelector<HTMLElement>(":scope [data-noise]");
        if (!slot) return;

        const locales = window._lc.forms.meet_play.dialogs.device_settings;

        const supported = NoiseGateProcessor.isSupported();

        const toggle = Toggle.switch({
            name: "noise-suppression",
            toggleText: {
                on: locales.enabled,
                off: locales.disabled
            },
            // Описание объясняет опцию, а при отсутствии поддержки -
            // прямо говорит, почему тумблер не работает
            description: supported ? locales.noise_desc : locales.noise_unsupported,
            checked: loadNoiseSuppression(),
            // `disabled` у label визуально не рисуется (классы disabled:
            // привязаны к состоянию самого элемента), поэтому отключённое
            // состояние показываем явными классами контейнера
            classes: supported ? [] : ["opacity-50", "pointer-events-none"],
            attributes: supported ? [] : ["disabled"]
        });

        // Строки только что созданы - оживляем свежий корень
        slot.replaceChildren(toggle.dom);
        Toggle.hydrate(slot);

    } catch (error) {
        // Отрисовка настройки не должна ронять форма устройств
        Logger.warn("🔇 [meet-play][noise]: Не удалось отрисовать шумоподавление:", error);
    }

}
