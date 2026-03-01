export async function loadPage(pageName) {
    try {
        const response = await fetch(`/${pageName}.html`); 
        const html = await response.text();
        document.getElementById('app').innerHTML = html;
        if (pageName === 'main-page') {
        }
    } catch (e) {
        console.error("Ошибка загрузки страницы:", e);
    }
}