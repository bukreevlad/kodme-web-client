// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем типы
import type { LocalParticipant } from "livekit-client";
import type { Call } from "../index.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * Описание кнопки источника звука/видео в футере звонка: иконки
 * включённого и выключенного состояния. Ключи совпадают с атрибутами
 * кнопок в шаблоне формы.
 */
interface FooterSource {

    /** Селектор кнопки в шапке/футере. */
    selector: string;

    /** Иконка включённого состояния. */
    on: string;

    /** Иконка выключенного состояния. */
    off: string;

    /** Ключ подписи в локали футера. */
    label: "toggle_audio" | "toggle_video";

    /** Проверка, включён ли источник у локального участника. */
    isEnabled: (participant: LocalParticipant) => boolean;

}

/**
 * Источники футера звонка: микрофон и камера.
 */
const SOURCES: FooterSource[] = [
    {
        selector: "[action-toggle-audio]",
        on: "microphone",
        off: "microphone-off",
        label: "toggle_audio",
        isEnabled: p => p.isMicrophoneEnabled
    },
    {
        selector: "[action-toggle-video]",
        on: "video",
        off: "video-off",
        label: "toggle_video",
        isEnabled: p => p.isCameraEnabled
    }
];

/**
 * ***************************************************************************
 * Перерисовывает кнопки футера по реальному состоянию локального
 * участника.
 *
 * Единая точка правды для иконок нужна потому, что состояние меняет не
 * только пользователь: событие комнаты может прийти с уже другим состоянием
 * трека, и кнопка обязана догнать его без участия обработчика нажатия.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function updateFooter(form: Call): void {

    try {

        if (!form?.tpl) return;

        const local = form?.room?.localParticipant;
        const labels = I18n.tree.forms.call.footer;

        for (const source of SOURCES) {

            const button = form.tpl.querySelector<HTMLButtonElement>(`:scope ${source.selector}`);
            if (!button) continue;

            // Локального участника в комнате ещё может не быть —
            // в этом случае рисуем «выключено», это правда по умолчанию
            const isEnabled = local ? source.isEnabled(local) === true : false;

            // Иконка отражает состояние устройства; без иконки кнопку
            // оставляем пустой
            const icon = Icons.icon(isEnabled ? source.on : source.off, {
                classes: ["w-5", "h-5"]
            });
            button.innerHTML = icon?.outerHTML ?? "";

            // Включённый источник подсвечиваем
            button.classList.toggle("call-active", isEnabled);

            // aria-label дублирует подсказку: у иконочной кнопки нет текста
            button.title = labels[source.label] || "";
            button.setAttribute("aria-label", labels[source.label] || "");
            button.setAttribute("aria-pressed", String(isEnabled));

        }

        // Кнопка смены камеры: направление съёмки, состояние не меняет
        const switchCamera = form.tpl.querySelector<HTMLButtonElement>(":scope [action-switch-camera]");
        if (switchCamera) {
            switchCamera.title = labels.switch_camera || "";
            switchCamera.setAttribute("aria-label", labels.switch_camera || "");
            // Переключение доступно, только когда камера включена
            switchCamera.disabled = local ? local.isCameraEnabled !== true : true;
            switchCamera.classList.toggle("call-disabled", switchCamera.disabled);
        }

        // Кнопка приглашения доступна всегда: добавить участника можно
        // и во время прозвона, и в идущем звонке
        const addParticipant = form.tpl.querySelector<HTMLElement>(":scope [action-add-participant]");
        if (addParticipant) {
            addParticipant.title = labels.add_participant || "";
            addParticipant.setAttribute("aria-label", labels.add_participant || "");
        }

        // Кнопка выхода
        const leave = form.tpl.querySelector<HTMLElement>(":scope [action-leave]");
        if (leave) {
            leave.title = labels.leave || "";
            leave.setAttribute("aria-label", labels.leave || "");
        }

    } catch (error) {
        Logger.error("🚨 [app][call]: Ошибка обновления футера:", error);
    }

}
