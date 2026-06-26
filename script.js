const API_URL = 'https://capovibe.weblocalstudio.es/api';
let isLogin = true;

// CONTROL ESTRICTO DE RESOLUCIÓN EN LA RAÍZ
function verificarResolucionRaiz() {
    let blockScreen = document.getElementById('block-screen');
    
    if (window.innerWidth < 1024) {
        if (!blockScreen) {
            // Si no existía el contenedor en el HTML de la raíz, lo inyectamos
            blockScreen = document.createElement('div');
            blockScreen.id = 'block-screen';
            blockScreen.innerHTML = `
                <h2>Acceso no disponible</h2>
                <p>CapoVibe está optimizado exclusivamente para ordenadores. Por favor, accede desde una pantalla más grande.</p>
            `;
            document.body.appendChild(blockScreen);
        } else {
            blockScreen.classList.remove('hidden');
        }
    } else {
        if (blockScreen) {
            blockScreen.classList.add('hidden');
        }
    }
}

// Escuchadores para controlar los cambios de tamaño y carga
window.addEventListener('resize', verificarResolucionRaiz);
window.addEventListener('DOMContentLoaded', verificarResolucionRaiz);
verificarResolucionRaiz();

if (localStorage.getItem('usuarioId')) {
    window.location.href = 'dashboard/';
}

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
        window.location.href = 'dashboard/';
    } catch (err) {
        errorMsg.innerText = err.message;
    }
});