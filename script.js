const API_URL = 'https://capovibe.weblocalstudio.es/api';
let isLogin = true;

// Filtro de dispositivo: Bloquear si es pantalla pequeña y NO es iPhone/Mac/iPad
function verificarDispositivo() {
    const isMobile = window.innerWidth < 1024;
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    
    if (isMobile && !isApple) {
        document.getElementById('block-screen').classList.remove('hidden');
        document.getElementById('main-auth-ui').classList.add('hidden');
    }
}
window.addEventListener('resize', verificarDispositivo);
verificarDispositivo();

const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const btnSubmit = document.getElementById('btn-submit');
const toggleLink = document.getElementById('toggle-link');
const errorMsg = document.getElementById('error-msg');

toggleLink.addEventListener('click', () => {
    isLogin = !isLogin;
    authTitle.innerText = isLogin ? 'Iniciar Sesión' : 'Crear Cuenta';
    btnSubmit.innerText = isLogin ? 'Entrar' : 'Registrarse';
    toggleLink.innerText = isLogin ? 'Regístrate' : 'Inicia Sesión';
    errorMsg.innerText = '';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.innerText = '';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const endpoint = isLogin ? '/auth/login' : '/auth/registrar';
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error de autenticación');
        
        localStorage.setItem('usuarioId', data.usuarioId);
        localStorage.setItem('email', email);
        window.location.href = './dashboard/';
    } catch (err) {
        errorMsg.innerText = err.message;
    }
});