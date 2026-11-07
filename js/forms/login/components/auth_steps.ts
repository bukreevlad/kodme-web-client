/**
 * Настройки разметки и обновления степпера.
 */
export interface AuthStepsOptions {
    /** Количество шагов (по умолчанию 3). */
    count?: number;
    /** Текущий шаг — индекс с нуля (по умолчанию 0). */
    current?: number;
    /** Подпись «Шаг 1 из 3» (по умолчанию пустая строка). */
    label?: string;
}

/**
 * ***************************************************************************
 * AUTH_STEPS - индикатор шагов многошаговой формы авторизации.
 * Рисует подпись «Шаг X из Y» и горизонтальный степпер из сегментов,
 * где пройденные шаги подсвечиваются брендовым цветом.
 *
 * Компонент построен на статических методах: формы встраивают разметку
 * в свой DOMParser-шаблон строкой, поэтому обновление идёт по живому DOM.
 * ***************************************************************************
 */
export class AuthSteps {

    /**
     * ***************************************************************************
     * Разметка степпера для встраивания в шаблон формы.
     * @param options - Настройки.
     * @returns HTML-строка разметки.
     * ***************************************************************************
     */
    static html({
        count = 3,
        current = 0,
        label = ""
    }: AuthStepsOptions = {}): string {

        // Собираем сегменты-точки степпера
        let segments = "";
        for (let i = 0; i < count; i++) {
            const isDone = i < current;
            const isActive = i === current;

            // Пройденный — брендовый, текущий — брендовый, будущий — нейтральный
            const classes = isDone || isActive
                ? "bg-[var(--color-brand)]"
                : "bg-[var(--color-black)]/10 dark:bg-[var(--color-white)]/15";

            segments += `<span data-seg class="w-8 h-1.5 rounded-full transition-all duration-300 ${classes}"></span>`;
        }

        return `
            <div class="cdm-auth-steps flex flex-col items-center gap-2">
                <span data-step-label class="text-[11px] font-semibold uppercase tracking-wider text-muted">${label}</span>
                <div class="flex flex-row items-center gap-1.5">
                    ${segments}
                </div>
            </div>
        `;

    }

    /**
     * ***************************************************************************
     * Обновляет степпер в живом DOM формы.
     * @param root - Контейнер `.cdm-auth-steps` в шаблоне формы.
     * @param options - Данные обновления.
     * ***************************************************************************
     */
    static update(root: HTMLElement, {
        current = 0,
        label = ""
    }: AuthStepsOptions = {}): void {

        if (!root) return;

        // Перекрашиваем сегменты в зависимости от состояния
        root.querySelectorAll("[data-seg]").forEach((seg, i) => {
            const isDone = i < current;
            const isActive = i === current;

            const classes = isDone || isActive
                ? "bg-[var(--color-brand)]"
                : "bg-[var(--color-black)]/10 dark:bg-[var(--color-white)]/15";

            seg.className = `w-8 h-1.5 rounded-full transition-all duration-300 ${classes}`;
        });

        // Меняем подпись шага
        const labelElement = root.querySelector("[data-step-label]");
        if (labelElement && label) {
            labelElement.textContent = label;
        }

    }

}
