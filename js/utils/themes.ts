// Импортируем utils
import { LocalStorage, StoredTheme } from "./local_storage.js";
import { Logger } from "./logs/logger.js";
import { PlatformBridge } from "./platform.bridge.js";

// Импортируем forms
import { BotApp } from "../forms/bot-app/index.js";
import { t } from "./i18n/index.js";

/**
 * Параметры применения темы приложения (setAppTheme).
 */
interface SetAppThemeData {
    /** Цветовая схема приложения. */
    color_scheme?: "dark" | "light" | "system";
    /** Сторонняя тема приложения. */
    theme?: StoredTheme;
    /** Нужно ли обновить сессию. */
    update_session?: boolean;
}

/**
 * ***************************************************************************
 * Themes - темы и цветовые схемы приложения.
 * Управляет data-theme, стилями сторонних тем, цветом тулбара и фонами чатов;
 * синхронизирует статус-бар нативной обёртки через PlatformBridge.
 * ***************************************************************************
 */
export class Themes {

    /**
     * ***************************************************************************
     * Сохранение темы приложения.
     * @param {SetAppThemeData} [data] - Данные темы (цветовая схема / тема / флаг обновления сессии).
     * ***************************************************************************
     */
    static setAppTheme(data?: SetAppThemeData): void {

        try {

            // Если не переданы параметры
            if (!data) return;

            // Получаем сессию из LocalStorage
            let session = LocalStorage.getLastActionSession();
            if (!session && data.update_session) throw { text: t("forms.themes.toasts.save_error"), class: "error" };

            // Если передан color_scheme
            if (data.color_scheme != undefined) {

                // Устанавливаем dark или light цветовую схему
                if (data.color_scheme === "dark") {
                    document.documentElement.setAttribute("data-theme", "dark");

                    // Передаем данные в мобильные устройства
                    PlatformBridge.setStatusBarStyle(true);

                    // Обновляем на всех формах bot-web-app
                    this.updateAllBotWebAppForms();

                } else if (data.color_scheme === "light") {
                    document.documentElement.removeAttribute("data-theme");

                    // Передаем данные в мобильные устройства
                    PlatformBridge.setStatusBarStyle(false);

                    // Обновляем на всех формах bot-web-app
                    this.updateAllBotWebAppForms();

                } else if (data.color_scheme === "system") {

                    // Определяем тему устройства (светлая / темная)
                    let colorSchemeDevice = window.matchMedia("(prefers-color-scheme: dark)");
                    let setDeviceColorScheme = (match: { matches: boolean }): void => {
                        match.matches && document.documentElement.setAttribute("data-theme", "dark");
                        !match.matches && document.documentElement.removeAttribute("data-theme");

                        // Передаем данные в мобильные устройства
                        PlatformBridge.setStatusBarStyle(!!match.matches);

                        // Обновляем на всех формах bot-web-app
                        this.updateAllBotWebAppForms();

                    }
                    setDeviceColorScheme(colorSchemeDevice);

                }

                // Обновляем цвет тулбара
                this.setColorFromToolbar();

                // Если нужно обновить сессию
                // (без сессии обновлять нечего: выше уже брошен throw при update_session)
                if (data.update_session && session) {

                    // Обновляем данные сессии
                    session.settings.user.themes.color_scheme = data.color_scheme;
                    LocalStorage.updateSession(session);

                }

                // Обновляем фоны чатов
                this.updateChatsCanvasBackground();

            }

            // Если переданы стили темы
            if (data.theme) {

                // Установленная тема - удаляем
                let currentTheme = document.querySelector("style[application-theme]");
                currentTheme && currentTheme.remove();

                // Создание новой темы
                let newTheme = document.createElement("style");
                // style может быть undefined — нормализуем в "", иначе в <style>
                // попадёт строка "undefined" (невалидный CSS)
                let style = document.createTextNode(data.theme.style ?? "");
                newTheme.appendChild(style);
                newTheme.setAttribute("application-theme", "");

                // Установка новой темы
                document.body.append(newTheme);

                // Установка цвета туллбара
                this.setColorFromToolbar();

                // Если нужно обновить сессию
                // (без сессии обновлять нечего: выше уже брошен throw при update_session)
                if (data.update_session && session) {

                    // Устанавливаем параметры
                    session.settings.user.themes.current = data.theme;
                    LocalStorage.updateSession(session);

                }

                // Обновляем фоны чатов
                this.updateChatsCanvasBackground();

            } else {

                // Установка цвета туллбара
                this.setColorFromToolbar();

            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Сбросить текущую тему
    // ***************************************************************************
    static resetCurrentTheme(): void {

        // Установленная тема
        let currentTheme = document.querySelector("style[application-theme]");
        if (currentTheme) {
            currentTheme.remove();

            // Получаем текущую сессию
            let session = LocalStorage.session;
            if (session) {
                session.settings.user.themes.current = null;
                LocalStorage.updateSession(session);
            }

        }

        // Сбрасываем цвет тулбара
        this.setColorFromToolbar();

    }

    // ***************************************************************************
    // Установить цвет туллбара
    // ***************************************************************************
    static setColorFromToolbar(): void {

        // Получаем все meta color
        let meta = document.querySelectorAll("meta[name=theme-color]");

        // Создаем временный элемент для вычисления цвета
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = `background: var(--form-bg)`;
        document.body.appendChild(tempDiv);

        // Вычисляем цвет и удаляем элемент
        const computedColor = getComputedStyle(tempDiv).backgroundColor;
        document.body.removeChild(tempDiv);

        // Применяем цвета
        meta.forEach(m => {
            m.setAttribute("content", computedColor);
        });

    }

    // ***************************************************************************
    // Обновляем фоны чатов
    // ***************************************************************************
    static updateChatsCanvasBackground(): void {

        // Получаем сессию из LocalStorage
        let session = LocalStorage.session;

        // Без сессии настройки декораций недоступны — обновлять нечего
        if (!session) return;

        // Получаем все открытые формы posts
        let postsForm = document.querySelectorAll(".cm-form-content.posts");

        // Получаем значение рут переменной
        let root = document.documentElement;
        let styles = getComputedStyle(root);
        let postContentBGPatternColor = styles.getPropertyValue('--post-content-bg-pattern-color');

        // Проходим по формам
        postsForm.forEach(f => {

            // Если фоны чатов включены
            if (session.settings.user.decorations.chat_background.enabled) {

            } else {

                // Канвас (его может не быть в шаблоне формы — пропускаем форму)
                let canvas = f.querySelector<HTMLCanvasElement>("canvas.content-background");
                if (!canvas) return;

                let ctx = canvas.getContext('2d');
                if (!ctx) return;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

            }

        });

    }

    // ***************************************************************************
    // Определяем тему по сессии пользователя и применяем
    // ***************************************************************************
    static initialTheme(): void {

        // Сессия
        let session = LocalStorage.getLastActionSession();

        // Проверяем параметры выбор темы
        if (session && session.settings.user.themes) {

            // Устанавливаем стороннюю тему приложения
            if (session.settings.user.themes.current?.style) {
                this.setAppTheme({ theme: session.settings.user.themes.current });
            }

            // Определение цветовой схемы
            if (session.settings.user.themes.color_scheme === "system") {

                // Определяем тему устройства (светлая / темная)
                let colorSchemeDevice = window.matchMedia("(prefers-color-scheme: dark)");
                let setDeviceColorScheme = (e: { matches: boolean }): void => {
                    this.setAppTheme({
                        color_scheme: e.matches ? "dark" : "light",
                        update_session: false
                    });

                    // Передаем данные в мобильные устройства
                    PlatformBridge.setStatusBarStyle(!!e.matches);
                }
                setDeviceColorScheme(colorSchemeDevice);
                colorSchemeDevice?.addEventListener("change", setDeviceColorScheme);

            } else {

                // Устанавливаем dark или light цветовую схему
                if (session.settings.user.themes.color_scheme === "dark") {
                    this.setAppTheme({ color_scheme: "dark" });
                    this.setColorFromToolbar();

                    // Передаем данные в мобильные устройства
                    PlatformBridge.setStatusBarStyle(true);

                } else if (session.settings.user.themes.color_scheme === "light") {
                    this.setAppTheme({ color_scheme: "light" });
                    this.setColorFromToolbar();

                    // Передаем данные в мобильные устройства
                    PlatformBridge.setStatusBarStyle(false);
                }

            }

        } else {

            // Определяем тему устройства (светлая / темная)
            let colorSchemeDevice = window.matchMedia("(prefers-color-scheme: dark)");
            let setDeviceColorScheme = (e: { matches: boolean }): void => {
                this.setAppTheme({
                    color_scheme: e.matches ? "dark" : "light",
                    update_session: false
                });

                // Передаем данные в мобильные устройства
                PlatformBridge.setStatusBarStyle(!!e.matches);
            }
            setDeviceColorScheme(colorSchemeDevice);
            colorSchemeDevice?.addEventListener("change", setDeviceColorScheme);

        }

    }

    // ***************************************************************************
    // Передаем формам, что цветовая схема сменилась
    // ***************************************************************************
    static updateAllBotWebAppForms(): void {

        // Получаем все формы
        let forms = Array.from(BotApp?.instances?.values());
        if (forms && forms.length > 0) {
            forms.forEach(form => {
                form?.bridge?.sendThemeUpdate();
            })
        }

    }

}
