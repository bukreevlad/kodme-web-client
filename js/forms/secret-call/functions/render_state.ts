// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { startTimer, stopTimer } from "./start_timer.js";

// Импортируем типы
import type { SecretCallEndReason, SecretCallState } from "../../../core/managers/secret_calls_manager.js";
import type { SecretCall } from "../index.js";

// Пауза перед закрытием формы после завершения звонка (мс) — чтобы
// пользователь увидел причину
const END_SCREEN_DELAY = 1500;

/**
 * ***************************************************************************
 * endReasonLabel - подпись причины завершения звонка из локали.
 * @param reason - Причина завершения.
 * @returns Локализованная подпись.
 * ***************************************************************************
 */
export function endReasonLabel(reason: SecretCallEndReason): string {

    const locale = window._lc.forms.secret_call;
    switch (reason) {
        case "declined": return locale.status_declined;
        case "no_answer": return locale.status_no_answer;
        case "taken": return locale.status_taken;
        default: return locale.status_ended;
    }

}

/**
 * ***************************************************************************
 * renderCallState - отрисовка состояния звонка: статус в шапке, оверлей
 * вызова (прозвон/соединение/финал) и таймер длительности.
 * @param form - Экземпляр формы.
 * @param state - Состояние звонка.
 * @param overlayText - Текст оверлея (для финала с причиной завершения).
 * @returns void
 * ***************************************************************************
 */
export function renderCallState(form: SecretCall, state: SecretCallState, overlayText?: string): void {

    try {

        if (!form.tpl) return;

        const locale = window._lc.forms.secret_call;
        const status = form.tpl.querySelector<HTMLElement>(":scope >[data-header] [data-status]");
        const overlay = form.tpl.querySelector<HTMLElement>(":scope >[data-content] [data-call-overlay]");
        const overlayStatus = form.tpl.querySelector<HTMLElement>(":scope >[data-content] [data-overlay-status]");
        const cancelButton = form.tpl.querySelector<HTMLElement>(":scope >[data-content] [action-cancel]");

        // Подпись состояния
        let text = "";
        switch (state) {
            case "calling": text = locale.status_calling; break;
            case "incoming": text = locale.incoming_title; break;
            case "connecting": text = locale.status_connecting; break;
            case "reconnecting": text = locale.status_reconnecting; break;
            case "ended": text = overlayText ?? locale.status_ended; break;
            default: text = "";
        }

        if (status) status.textContent = state === "ended" ? "" : text;

        // Оверлей виден в прозвоне, соединении и финале: под ним видео
        // собеседника ещё нет или звонок уже закончен
        const overlayVisible = state === "calling" || state === "connecting" || state === "incoming" || state === "ended";
        if (overlay) {
            overlay.classList.toggle("hidden", !overlayVisible);
            overlay.classList.toggle("flex", overlayVisible);
        }
        if (overlayStatus) overlayStatus.textContent = text;

        // Кнопка отмены нужна только до соединения
        if (cancelButton) cancelButton.classList.toggle("hidden", state !== "calling" && state !== "incoming");

        // Таймер идёт только в разговоре
        if (state === "connected") startTimer(form);
        else stopTimer(form);

        // Финал: показываем причину и закрываем форму
        if (state === "ended") {
            if (form.endCloseTimer) clearTimeout(form.endCloseTimer);
            form.endCloseTimer = setTimeout(() => {
                form.endCloseTimer = null;
                form.modal?.close();
            }, END_SCREEN_DELAY);
        }

    } catch (error) {
        Logger.error("[app][secret-call]: ошибка отрисовки состояния:", error);
    }

}
