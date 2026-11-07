// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getSessionUserId } from "../../meet-play/functions/session_identity.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { setLayoutParams } from "../../meet-play/requests/set_layout.js";
import { setFocusRequest } from "../../meet-play/requests/set_focus.js";

// Импортиваем functions
import { applyLayout } from "../../meet-play/functions/apply_layout.js";

// Импортируем типы
import { isMeetLayout } from "../../meet-play/types.js";
import type { MeetLayout } from "../../meet-play/types.js";
import type { MeetPlay } from "../../meet-play/index.js";
import type { MeetGridSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Ключ в sessionStorage для личного режима сетки.
 * Личный выбор не должен слететь при перезаходе в конференцию, но и
 * не должен переживать закрытие вкладки — sessionStorage подходит
 * ровно под эту задачу.
 */
const LOCAL_LAYOUT_KEY = "meet_play_layout";

/**
 * Параметры решения о запросе по гейту «применить для всех».
 */
export interface ForceRequestParams {

    /** Выбранный в форме режим. */
    layout?: MeetLayout | null;

    /** Гейт «применить для всех». */
    force?: boolean;

    /** Пользователь создал конференцию. */
    isCreator?: boolean;

    /** Принудительный режим из room.metadata. */
    forcedLayout?: MeetLayout | string | null;

}

/**
 * Запрос принудительного режима: режим для всех либо снятие правила.
 */
export interface ForceRequest {

    /** Режим для всех (null — снять принудительный режим). */
    layout: MeetLayout | null;

    /** true, если запрос снимает ранее навязанный режим. */
    cleared: boolean;

}

/**
 * Параметры решения о запросе принудительного фокуса.
 */
export interface FocusRequestParams {

    /** Состояние чекбокса в форме. */
    focus?: boolean;

    /** Пользователь создал конференцию. */
    isCreator?: boolean;

    /** Принудительный фокус из room.metadata. */
    forcedFocus?: string | null;

    /** Identity организатора в комнате. */
    selfIdentity?: string | null;

}

/**
 * Запрос принудительного фокуса: показать организатора крупно у всех
 * либо снять правило.
 */
export interface FocusRequest {

    /** true — показать организатора крупно у всех. */
    focus: boolean;

    /** true, если запрос снимает ранее навязанный фокус. */
    cleared: boolean;

}

/**
 * ***************************************************************************
 * saveGridSettingsHandler - Применяет выбранный режим сетки.
 *
 * Два пути, разница только в области действия:
 *   - личный выбор — меняет вид только у текущего пользователя;
 *   - принудительный — уходит на сервер и применяется у всех.
 * @param dialog - Форма настроек сетки.
 * @returns Промис применения режима.
 * ***************************************************************************
 */
export async function saveGridSettingsHandler(dialog: MeetGridSettings): Promise<void> {

    try {

        // ---------- READ ----------
        const form = dialog?.meetPlayForm;
        if (!form) return;

        // Выбранный режим
        const layout = dialog.currentSettings.layout;

        // Применять для всех?
        const force = dialog.currentSettings.force === true;

        // Модерация доступна только создателю конференции.
        // Считаем здесь, а не ниже: от этого зависит, нужно ли вообще
        // трогать сервер — обычному участнику с гейтом (которого у него
        // в форме нет) снимать принудительный режим незачем
        const isCreator = form.meet?.created_user_id === getSessionUserId();

        // Identity организатора в комнате. Рантайм берём у комнаты
        // (`localParticipant`), а на случай, если он ещё не готов, падаем
        // на user_id: identity участника в этой комнате и есть его user_id,
        // на этом же стоит и сервер, когда пишет фокус в metadata
        const selfIdentity = dialog.selfIdentity || getSessionUserId();
        // ---------- READ ----------

        // ---------- VALIDATE ----------
        // Клиент не должен доверять собственному состоянию: набор режимов
        // один и тот же с серверным белым списком
        if (!isMeetLayout(layout)) {
            Logger.warn("[meet-play][grid]: Неизвестный режим сетки:", layout);
            return;
        }
        // ---------- VALIDATE ----------

        // ---------- LOCAL ----------
        // Личный выбор применяем всегда: даже при принудительном режиме
        // он сохранится и вернётся в силу, как только организатор его снимет
        form.localLayout = layout;
        saveLocalLayout(layout);

        // Перестраиваем сетку сразу, не дожидаясь ответа сервера
        form.layout = resolveLayout(form);
        applyLayout(form);
        // ---------- LOCAL ----------

        // ---------- FOCUS ----------
        // Принудительный фокус — отдельное правило комнаты,
        // не связанное с гейтом «применить для всех»: навязать крупную
        // плитку всем может только создатель, и делает он это самому себе.
        // Поэтому решается здесь, до раннего выхода ниже, иначе смена
        // фокуса молча терялась бы в форме без навязанного режима сетки
        const focusRequest = resolveFocusRequest({
            focus: dialog.currentSettings.focus === true,
            isCreator,
            forcedFocus: form.forcedFocus,
            selfIdentity
        });

        if (focusRequest) await applyFocus(dialog, form, focusRequest, selfIdentity);
        // ---------- FOCUS ----------

        // ---------- FORCE ----------
        const request = resolveForceRequest({
            layout,
            force,
            isCreator,
            forcedLayout: form.forcedLayout
        });

        // Ничего не навязано и навязывать нечего — запрос не нужен
        if (!request) {
            dialog.modal?.close();
            return;
        }

        // Гейт в форме рисуется только создателю, поэтому сюда мы попадаем
        // с `force === true` лишь при подделке состояния: клиент всё равно не
        // должен доверять собственному состоянию, сервер откажет
        if (!isCreator) {

            dialog.currentSettings.force = false;

            Toast.error(t("forms.meet_play.toasts.access_denied"));

            dialog.modal?.close();
            return;
        }

        // `layout: null` — снять принудительный режим. Сервер принимает null
        // и убирает ключ из metadata комнаты, а сам режим у всех подхватит
        // `RoomMetadataChanged` и пересчитает раскладку на личную
        const response = await setLayoutParams({
            meet_id: form.meetId,
            layout: request.layout
        });

        if (!response?.status) return;

        // Toast: режим применится у всех, когда придёт RoomMetadataChanged
        Toast.success(request.cleared
            ? t("forms.meet_play.toasts.success_layout_cleared")
            : t("forms.meet_play.toasts.success_layout"));

        dialog.modal?.close();
        // ---------- FORCE ----------

    } catch (error) {
        Logger.error("[meet-play][grid]: Ошибка применения режима сетки:", error);

        // ---------- ДОСТУП ----------
        if (String((error as Error)?.message).includes("ACCESS_DENIED")) {

            Toast.error(t("forms.meet_play.toasts.access_denied"));
            return;
        }
        // ---------- ДОСТУП ----------

        // ---------- ВАЛИДАЦИЯ ----------
        // Сервер не узнал режим: клиент и сервер разошлись в белом списке
        if (String((error as Error)?.message).includes("INVALID_LAYOUT")) {

            Toast.error(t("forms.meet_play.toasts.layout_error"));
            return;
        }
        // ---------- ВАЛИДАЦИЯ ----------

        // Прочая ошибка сервера
        Toast.error(t("forms.meet_play.toasts.layout_error"));

    }

}

/**
 * ***************************************************************************
 * resolveForceRequest - Решает, что уходит на сервер по гейту «применить
 *                       для всех».
 *
 * Повод для этой функции — баг: снятие гейта при уже включённом режиме было
 * молчаливым no-op. Запрос отправлялся только при `force === true`, поэтому
 * снять принудительный режим было нечем вовсе, а гейт в форме при этом
 * всегда стоял снятым и прямо обещал обратное.
 *
 * Три случая:
 *   - гейт включён → навязываем выбранный режим;
 *   - гейт снят, режим навязан → снимаем его (`layout: null`);
 *   - гейт снят, режим не навязан → запрос не нужен вовсе.
 *
 * Снятие доступно только создателю: у обычного участника гейта в форме
 * нет, и его личный выбор не должен превращаться в запрос, который сервер
 * отклонит.
 * @param e - Параметры решения.
 * @returns Запрос либо null, если он не нужен.
 * ***************************************************************************
 */
export function resolveForceRequest({
    layout,
    force,
    isCreator,
    forcedLayout
}: ForceRequestParams = {}): ForceRequest | null {

    // Гейт включён → навязываем выбранный режим. Без выбранного режима
    // отправлять нечего: `layout: null` в запросе означал бы снятие правила,
    // а не применение
    if (force === true) return layout ? { layout, cleared: false } : null;

    // Снимать нечего: и не навязывали, и снимать некому
    if (isCreator !== true || !isMeetLayout(forcedLayout)) return null;

    return { layout: null, cleared: true };

}

/**
 * ***************************************************************************
 * resolveFocusRequest - Решает, что уходит на сервер по чекбоксу «показать
 *                       меня крупно всем».
 *
 * Отдельная функция с тем же смыслом, что и `resolveForceRequest`: чекбокс
 * нельзя применять «как получится», иначе галка в форме и правило в
 * комнате разошлись бы без единого сообщения об этом.
 *
 * Три случая:
 *   - галочка включена и фокуса нет → навязываем себя крупным;
 *   - галочка снята, а фокус был → снимаем правило;
 *   - состояние не изменилось или правило недоступно → запрос не нужен.
 *
 * Запрос не нужен и у обычного участника: ему чекбокс не рисуется, а сам
 * сервер фокус от участника не примет — правило может
 * указывать только на самого организатора.
 * @param e - Параметры решения.
 * @returns Запрос либо null, если он не нужен.
 * ***************************************************************************
 */
export function resolveFocusRequest({
    focus,
    isCreator,
    forcedFocus,
    selfIdentity
}: FocusRequestParams = {}): FocusRequest | null {

    if (isCreator !== true || !selfIdentity) return null;

    // Фокус считается включённым, только если он указывает именно на меня:
    // иначе пустой `forcedFocus` сравнился бы с пустым `selfIdentity` и
    // отдавал бы «уже включено» в пустой комнате
    const enabled = !!forcedFocus && forcedFocus === selfIdentity;

    if (focus === enabled) return null;

    return { focus: focus === true, cleared: enabled };

}

/**
 * ***************************************************************************
 * applyFocus - Применяет принудительный фокус: локально сразу, запросом —
 *              на всю комнату.
 *
 * Локально перестраиваем сетку до ответа сервера, как и режим: ожидание
 * ack заставило бы организатора смотреть на старую сетку. При отказе
 * сервера возвращаем былое значение — иначе у себя в интерфейсе мы
 * показывали бы крупным себя, а у всех остальных это не сработало бы.
 * @param dialog - Форма настроек сетки.
 * @param form - Экземпляр формы.
 * @param request - Запрос из `resolveFocusRequest`.
 * @param selfIdentity - Identity организатора в комнате.
 * @returns Промис применения фокуса.
 * ***************************************************************************
 */
async function applyFocus(
    dialog: MeetGridSettings,
    form: MeetPlay,
    request: FocusRequest,
    selfIdentity: string | null
): Promise<void> {

    // Что было до перестроения — вернём это, если сервер откажет
    const previous = form.forcedFocus;

    // ---------- LOCAL ----------
    form.forcedFocus = request.focus ? selfIdentity : null;
    applyLayout(form);
    // ---------- LOCAL ----------

    try {

        const response = await setFocusRequest({
            meet_id: form.meetId,
            focus: request.focus
        });

        if (!response?.status) throw new Error("Ответ сервера без статуса");

        // Правило разлетелось по metadata комнаты само, отдельный push
        // не нужен
        Toast.success(request.cleared
            ? t("forms.meet_play.toasts.success_focus_cleared")
            : t("forms.meet_play.toasts.success_focus"));

    } catch (error) {

        Logger.error("[meet-play][grid]: Ошибка применения принудительного фокуса:", error);

        // Возвращаем сетку в былое состояние
        form.forcedFocus = previous;
        applyLayout(form);

        // ---------- ДОСТУП ----------
        if (String((error as Error)?.message).includes("ACCESS_DENIED")) {

            Toast.error(t("forms.meet_play.toasts.access_denied"));
            return;
        }
        // ---------- ДОСТУП ----------

        Toast.error(t("forms.meet_play.toasts.focus_error"));

    }

}

/**
 * ***************************************************************************
 * resolveLayout - Пересчитывает итоговый режим: принудительный
 *                 перекрывает личный.
 * @param form - Экземпляр формы.
 * @returns Итоговый режим.
 * ***************************************************************************
 */
function resolveLayout(form: MeetPlay): MeetLayout {

    return isMeetLayout(form.forcedLayout)
        ? form.forcedLayout
        : isMeetLayout(form.localLayout) ? form.localLayout : "grid";

}

/**
 * Сохраняет личный режим в sessionStorage.
 * Ошибка записи (приватный режим, переполнение) не должна ломать
 * переключение — режим уже применён в памяти формы.
 * @param layout - Режим сетки.
 * @returns {void}
 */
function saveLocalLayout(layout: MeetLayout): void {

    try {
        sessionStorage.setItem(LOCAL_LAYOUT_KEY, layout);
    } catch (error) {
        Logger.debug("[meet-play][grid]: Не удалось сохранить личный режим сетки:", error);
    }

}

/**
 * Читает личный режим из sessionStorage.
 * @returns Режим или null.
 */
export function loadLocalLayout(): MeetLayout | null {

    try {
        const layout = sessionStorage.getItem(LOCAL_LAYOUT_KEY);
        return isMeetLayout(layout) ? layout : null;
    } catch (error) {
        return null;
    }

}
