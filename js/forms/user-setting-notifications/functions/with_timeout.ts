/**
 * ***************************************************************************
 * Гонка промиса с таймаутом: если `promise` не завершился за `ms`
 * миллисекунд — отклоняется ошибкой с текстом из локализации.
 *
 * Таймер всегда сбрасывается при завершении гонки, чтобы не держать
 * висящие setTimeout.
 * @param promise - Обещание для ожидания.
 * @param ms - Время ожидания в миллисекундах.
 * @returns Результат промиса, либо ошибка при истечении таймаута.
 ***************************************************************************
 */
import { t } from "../../../utils/i18n/index.js";

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {

    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(t("forms.user_setting_notifications.toasts.timeout")));
        }, ms);
    });

    return Promise.race([promise, timeout])
        .finally(() => {
            clearTimeout(timeoutId);
        });

}
