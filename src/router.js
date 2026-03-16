export async function loadPage(pageName) {
    try {
        const candidates = [
            `/${pageName}.html`,
            `./${pageName}.html`,
            `${window.location.origin}/${pageName}.html`,
        ];

        let html = null;

        for (const path of candidates) {
            const response = await fetch(path);
            if (response.ok) {
                html = await response.text();
                break;
            }
        }

        if (!html) {
            throw new Error(`Страница ${pageName}.html не найдена`);
        }

        document.getElementById('app').innerHTML = html;
        if (pageName === 'main-page') {
        }
    } catch (e) {
        console.error("Ошибка загрузки страницы:", e);
    }
}