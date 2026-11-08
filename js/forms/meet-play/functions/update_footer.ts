// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем functions
import { resolveStateBlocks } from "./parse_room_state.js";
import { isHandRaised } from "./parse_participant.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import type { MeetBlockFlag } from "../types.js";
import type { Participant, RemoteParticipant } from "livekit-client";
import { I18n, t } from "../../../utils/i18n/index.js";

/**
 * Описание одного источника в футере конференции.
 */
interface FooterSource {

    /** Атрибут кнопки в шаблоне формы. */
    selector: string;

    /** Иконка включённого источника. */
    on: string;

    /** Иконка выключенного источника. */
    off: string;

    /** Ключ подписи в forms.meet_play.footer. */
    label: string;

    /** Текущее состояние источника у участника. */
    isEnabled: (p: Participant | RemoteParticipant) => boolean;

    /** Участник, у которого смотрим состояние. */
    getParticipant: (form: MeetPlay) => Participant | RemoteParticipant | undefined;

}

/**
 * Источники конференции в порядке их расположения в футере.
 *
 * Один объект вместо разбросанных по обработчикам проверок: и обработчики
 * нажатий, и события LiveKit, и блокировки организатора должны смотреть на
 * одну и ту же карту. Ключ — флаг блокировки, он же совпадает с ключом в
 * `room.metadata` (см. parse_room_state.ts).
 */
const SOURCES: Record<MeetBlockFlag, FooterSource> = {

    audio: {
        selector: "[action-toggle-audio]",
        on: "microphone",
        off: "microphone-off",
        label: "toggle_audio",
        isEnabled: p => p.isMicrophoneEnabled,
        getParticipant: form => form.room?.localParticipant
    },
    video: {
        selector: "[action-toggle-video]",
        on: "video",
        off: "video-off",
        label: "toggle_video",
        isEnabled: p => p.isCameraEnabled,
        getParticipant: form => form.room?.localParticipant
    },
    screen: {
        selector: "[action-toggle-screen]",
        on: "device-desktop",
        off: "device-desktop-off",
        label: "toggle_screen",
        isEnabled: p => p.isScreenShareEnabled,
        getParticipant: form => form.room?.localParticipant
    }

};

/**
 * ***************************************************************************
 * Перерисовывает кнопки футера по реальному состоянию локального
 * участника и по блокировкам, установленным организатором.
 *
 * Единая точка правды для иконок нужна по двум причинам:
 *   - состояние меняет не только пользователь (сервер может принудительно
 *     заглушить трек), значит обработчики нажатий не единственные авторы
 *     иконки;
 *   - «выключено участником» и «запрещено организатором» — разные вещи,
 *     и обе должны выглядеть по-разному, но обе влияют на одну кнопку.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function updateFooter(form: MeetPlay): void {

    try {

        if (!form?.tpl) return;

        // ---------- STATE ----------
        // Живой источник: то, что участник включил сам
        const local = form.room?.localParticipant;

        // Запрещённый источник: то, что организатор забрал
        const blocks = resolveStateBlocks(form.roomState, local?.identity);
        // ---------- STATE ----------

        // ---------- ЛОКАЛИЗАЦИЯ ----------
        // Подписи кнопок футера читаются по ключу источника, а набор
        // ключей узкий и известен — поэтому узкий Record<string, string>,
        // а не индексация по строке по умолчанию
        const labels: Record<string, string> = I18n.tree.forms.meet_play.footer;
        const blockedLabel = t("forms.meet_play.blocked_by_organizer");
        // ---------- ЛОКАЛИЗАЦИЯ ----------

        for (const [flag, source] of Object.entries(SOURCES)) {

            const button = form.tpl.querySelector<HTMLButtonElement>(`:scope ${source.selector}`);
            if (!button) continue;

            const participant = source.getParticipant(form);
            const isEnabled = participant ? source.isEnabled(participant) === true : false;
            const isBlocked = blocks[flag as MeetBlockFlag] === true;

            // Иконка отражает только устройство: если участник включил
            // микрофон, а организатор его запретил, иконка — «вкл.»,
            // а запрет показывают рамка и подсказка.
            // Иконки может не быть — тогда в кнопку уходит пустая строка
            const icon = Icons.icon(isEnabled ? source.on : source.off, {
                classes: ["w-5", "h-5"]
            });
            button.innerHTML = icon?.outerHTML ?? "";

            // Включённый источник подсвечиваем: иконка «микрофон
            // выключен» сама по себе читается нейтрально, и без подложки
            // непонятно, включён микрофон или сломался
            button.classList.toggle("meet-play-active", isEnabled && !isBlocked);

            // Запрещённый источник включить нельзя в принципе
            button.disabled = isBlocked;
            button.classList.toggle("meet-play-blocked", isBlocked);

            // Подсказка объясняет, почему кнопка не нажимается.
            // aria-label дублирует её: у иконочной кнопки нет текста,
            // и без него скринридер читает «кнопка»
            const title = isBlocked ? blockedLabel : (labels[source.label] || "");
            button.title = title;
            button.setAttribute("aria-label", title);
            button.setAttribute("aria-pressed", String(isEnabled));

        }

        // ---------- RAISE HAND ----------
        // Поднятая рука — не источник: организатор её не запрещает, и
        // блокировки на кнопку не действуют. Иконка одна, состояние
        // показывают подложка активности и `aria-pressed`
        const hand = form.tpl.querySelector<HTMLElement>(":scope [action-toggle-hand]");
        if (hand) {
            const raised = isHandRaised(local);
            hand.classList.toggle("meet-play-active", raised);

            const handLabel = labels.raise_hand || "";
            hand.title = handLabel;
            hand.setAttribute("aria-label", handLabel);
            hand.setAttribute("aria-pressed", String(raised));
        }
        // ---------- RAISE HAND ----------

        // ---------- SWITCH CAMERA ----------
        // Переключение фронтальной/задней камеры бессмысленно, если
        // камера запрещена, но иконку этой кнопки не трогаем — она
        // показывает направление съёмки, а не доступность
        const switchCamera = form.tpl.querySelector<HTMLButtonElement>(":scope [action-switch-camera]");
        if (switchCamera) {
            const isBlocked = blocks.video === true;
            switchCamera.disabled = isBlocked;
            switchCamera.classList.toggle("meet-play-blocked", isBlocked);
            const title = isBlocked ? blockedLabel : (labels.switch_camera || "");
            switchCamera.title = title;
            switchCamera.setAttribute("aria-label", title);
        }
        // ---------- SWITCH CAMERA ----------

    } catch (error) {
        Logger.error("🚨 [meet-play]: Ошибка обновления футера:", error);
    }

}
