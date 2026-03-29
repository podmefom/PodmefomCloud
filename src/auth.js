import { supabase } from './supabaseClient.js';
import { loadPage } from './router.js';
import { refreshMainPage } from './main.js';

const loginTab = document.getElementById('btn-login-tab');
const regTab = document.getElementById('btn-register-tab');
const authBtn = document.getElementById('auth-btn-text');
const authForm = document.getElementById('auth-form');
const registerForm = document.getElementById('register-form');

function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

async function handleRegister(email, password,  username) {
    if (password.length < 6) { showToast("Пароль слишком короткий"); return; }
    const {data, error} = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                display_name: username,
            },
        },
    });

    if (error) {
        console.error("Ошибка:", error.message);
    } else {
        console.log("Успех!");
        document.querySelector('.auth-view').style.display = 'none';

        if (typeof window.refreshMainPage === 'function') {
            await window.refreshMainPage();
        }
    }
}

async function handleLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    console.error("Не удалось войти:", error.message);
  } else {
    console.log("Сессия открыта:", data.session);
  }

    if (error) {
        console.error("Ошибка:", error.message);
    } else {
        console.log("Успех!");
        document.querySelector('.auth-view').style.display = 'none';
        
        if (typeof window.refreshMainPage === 'function') {
            await window.refreshMainPage();
        }
    }
}

export async function handleLogout() {
    const {error} = await supabase.auth.signOut();
    if (error) {
        console.error("Ошибка при входе", error.message);
    } else {
        window.location.reload();
    }
}

export async function updateAuthUI() {
    const userBtnText = document.getElementById('user-btn-text');
    const { data: { user } } = await supabase.auth.getUser();

    if (user && userBtnText) {
        userBtnText.textContent = user.user_metadata.display_name || user.email.split('@')[0];
    } else if (userBtnText) {
        userBtnText.textContent = 'Войти';
    }
}

window.updateAuthUI = updateAuthUI;

loginTab.addEventListener('click', () => {
    regTab.classList.remove('active');
    loginTab.classList.add('active');
    authForm.style.display = 'block';
    registerForm.style.display = 'none';
});

regTab.addEventListener('click', () => {
    loginTab.classList.remove('active');
    regTab.classList.add('active');
    authForm.style.display = 'none';
    registerForm.style.display = 'block';
}); 

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    handleLogin(email, password);
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const username = document.getElementById('reg-username').value;

    handleRegister(email, password,  username);
});

export async function updateHeaderText() {
    const userBtnText = document.getElementById('user-btn-text');
    const { data: { user } } = await supabase.auth.getUser();

    if (user && userBtnText) {
        userBtnText.textContent = user.email.split('@')[0];
    }
}

window.updateHeaderText = updateHeaderText;