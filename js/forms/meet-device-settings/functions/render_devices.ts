// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toggle } from "../../../components/toggle.js";

// Импортируем functions
import { enumerateDevices } from "./enumerate_devices.js";
import { renderNoiseSetting } from "./render_noise_setting.js";

// Импортируем типы
import type { AccessResult } from "./ensure_access.js";
import type { MediaDeviceItem } from "./enumerate_devices.js";
import type { MeetDeviceSettings } from "../index.js";

/**
 * Секции списка устройств. Ключ `kind` совпадает с `MediaDeviceKind`,
 * а слот — с data-атрибутом контейнера в шаблоне формы.
 */
const SECTIONS: Array<{ kind: "videoinput" | "audioinput"; slot: string; icon: string }> = [
    { kind: "videoinput", slot: "data-cameras", icon: "video" },
    { kind: "audioinput", slot: "data-microphones", icon: "microphone" }
];

/**
 * Опции отрисовки списка устройств.
 */
export interface RenderDevicesOptions {

    /** Результат `ensureAccess()`: нужен, чтобы объяснить пустой список
     *  причиной, а не догадкой. */
    access?: AccessResult;

}

/**
 * ***************************************************************************
 * renderDevices - Рисует списки камер и микрофонов в форме.
 *
 * Перерисовка целиком, а не точечное обновление: список короткий, а
 * перерисовка заодно снимает вопрос «а отмечен ли активный» — отметка
 * всегда считается от `room.getActiveDevice()`, то есть от реального
 * устройства LiveKit, а не от того, что пользователь нажимал.
 *
 * Запрос доступа здесь намеренно **не** делается: функцию зовут ещё и
 * после каждого переключения, а лишний `getUserMedia` при уже
 * опубликованном видео — это захват камеры на ровном месте. Доступ
 * запрашивается один раз при открытии формы (`_onBeforeOpen`).
 * @param dialog - Экземпляр формы устройств.
 * @param options - Опции.
 * @returns Промис отрисовки.
 * ***************************************************************************
 */
export async function renderDevices(dialog: MeetDeviceSettings, options?: RenderDevicesOptions): Promise<void> {

    try {

        if (!dialog?.tpl) return;

        // ---------- DEVICES ----------
        const devices = await enumerateDevices();
        // ---------- DEVICES ----------

        for (const section of SECTIONS) {

            // Секция с пустым списком не прячется: вместо неё рисуется
            // объяснение. Молчаливый исчезнувший заголовок выглядел бы
            // как ошибка вёрстки
            const container = dialog.tpl.querySelector<HTMLElement>(`:scope [${section.slot}]`);
            if (container) {
                container.replaceChildren(...buildItems(dialog, devices[section.kind] || [], section, options));

                // Строки только что созданы заново, поэтому и оживляем их
                // здесь: компонент следит, чтобы атрибут `checked` не
                // разъехался с реальным состоянием radio после клика
                Toggle.hydrate(container);
            }

        }

        // Секция «Звук» рисуется тем же проходом, что и списки: одна
        // точка отрисовки - значит, одна гидратация и согласованное
        // состояние тумблера после каждого обновления формы
        renderNoiseSetting(dialog);

    } catch (error) {
        Logger.error("🚨 [meet-play][devices]: Ошибка отрисовки устройств:", error);
    }

}

/**
 * ***************************************************************************
 * buildItems - Собирает DOM-элементы одной секции списка.
 *
 * Строка — штатный `Toggle.cardGroup`, тот же, что в настройках оформления и
 * в выборе режима сетки: подпись устройства попадает в разметку через
 * `textContent` (это делает сам компонент), а не строкой, потому что
 * приходит из системы, и там может оказаться что угодно, включая `<`.
 * @param dialog - Экземпляр формы устройств.
 * @param list - Устройства секции.
 * @param section - Описание секции (`kind`, `icon`).
 * @param options - Опции (см. `renderDevices`).
 * @returns Готовые элементы списка.
 * ***************************************************************************
 */
function buildItems(
    dialog: MeetDeviceSettings,
    list: MediaDeviceItem[],
    section: { kind: "videoinput" | "audioinput"; slot: string; icon: string },
    options?: RenderDevicesOptions
): HTMLElement[] {

    const locales = window._lc.forms.meet_play.dialogs.device_settings;

    // ---------- EMPTY ----------
    if (!Array.isArray(list) || list.length === 0) {
        return [buildEmpty(locales, section, options)];
    }
    // ---------- EMPTY ----------

    // Активное устройство знает только сам LiveKit: пока источник
    // выключен и трека нет, отметить нечего — и врать не стоит
    const activeId = dialog?.meetPlayForm?.room?.getActiveDevice?.(section.kind);

    // Список устройств — единый контейнер с безрамочными строками (cardGroupDom):
    // вызывающий вставляет его через replaceChildren и оживляет Toggle.hydrate
    return [Toggle.cardGroupDom(list.map(device => ({
        name: `device-${section.kind}`,
        value: device.deviceId,
        checked: activeId !== undefined && activeId === device.deviceId,
        icon: section.icon,
        text: device.label,
        // Атрибуты едут на сам radio **со значениями**: обработчик читает
        // по ним, что именно выбрали, и не берёт это из обработчика клика.
        // Голые имена поставили бы пустые значения, и выбор устройства
        // молча уходил бы в `return` на проверке класса устройства
        attributes: [
            { name: "data-device-id", value: device.deviceId },
            { name: "data-kind", value: section.kind }
        ]
    })))];

}

/**
 * ***************************************************************************
 * buildEmpty - Объяснение вместо пустого списка.
 *
 * Раньше здесь был один текст на все случаи («устройства не найдены или
 * браузер не дал к ним доступ») — то есть перечисление двух взаимоисключающих
 * причин, из которого пользователь не мог выбрать нужную. Теперь причина
 * известна заранее (результат `ensureAccess`), и текст один-одинозначный:
 * запрет в браузере лечится в его настройках, отсутствие камеры — это
 * «устройства нет», а не «что-то сломалось».
 * @param locales - Локализация формы.
 * @param section - Описание секции (`kind`).
 * @param options - Опции (см. `renderDevices`).
 * @returns Абзац с объяснением.
 * ***************************************************************************
 */
function buildEmpty(
    locales: typeof window._lc.forms.meet_play.dialogs.device_settings,
    section: { kind: "videoinput" | "audioinput"; slot: string; icon: string },
    options?: RenderDevicesOptions
): HTMLElement {

    // ---------- WHY ----------
    // Причину сообщаем только если её действительно знаем: без
    // `ensureAccess` единственный честный текст — «устройств нет»
    const state = options?.access?.[section.kind];
    const text = options?.access?.unsupported
        ? locales.unsupported
        : state === "denied" ? locales.access_denied
            : section.kind === "videoinput" ? locales.empty_camera : locales.empty_microphone;
    // ---------- WHY ----------

    const empty = document.createElement("p");
    empty.className = "px-3 py-2 text-xs text-secondary";
    empty.textContent = text;

    return empty;

}
