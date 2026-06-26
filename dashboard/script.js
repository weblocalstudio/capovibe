const API_URL = 'https://capovibe.weblocalstudio.es/api';
const miId = localStorage.getItem('usuarioId');
const miEmail = localStorage.getItem('email');

let chatActivoId = null;
let bucleMensajes = null;
let ultimoMensajeIdGlobal = null;

// Control de renderizado para evitar que las animaciones se repitan en bucle
let idsMensajesRenderizados = new Set();
let ultimoChatIdCargado = null;
let mensajesNotificados = new Set();

// Solicitar Notificaciones inmediatamente mediante interacción transparente
document.body.addEventListener('click', () => {
    if (Notification.permission === "default") { 
        Notification.requestPermission(); 
    }
}, { once: true });

// Filtro estricto de dispositivo para Android
function verificarDispositivo() {
    const isMobile = window.innerWidth < 1024;
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) { 
        document.getElementById('block-screen').classList.remove('hidden'); 
    }
}
window.addEventListener('resize', verificarDispositivo);
verificarDispositivo();

// Redirección si no hay sesión activa
if (!miId) { 
    window.location.href = '../index.html'; 
}

document.getElementById('my-email').innerText = miEmail;
document.getElementById('my-id-badge').innerText = `ID: ${miId}`;

// Forzar que por defecto venga seleccionado España (Península)
if (!localStorage.getItem('user_region')) { 
    localStorage.setItem('user_region', 'peninsula'); 
}
const regionSelect = document.getElementById('region-select');
regionSelect.value = localStorage.getItem('user_region');

regionSelect.addEventListener('change', (e) => {
    localStorage.setItem('user_region', e.target.value);
    if (chatActivoId) { 
        ultimoChatIdCargado = null;
        cargarHistorial(); 
    }
    cargarChatsRecientes();
});

// Solicitar permisos de notificación tras el primer toque en la pantalla (Requisito móvil)
function inicializarNotificacionesMovil() {
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            Notification.requestPermission().then(perm => {
                console.log("Estado de permisos en móvil:", perm);
            }).catch(err => {
                console.error("Error al solicitar permisos:", err);
            });
        }
    } else {
        console.warn("Este navegador móvil no soporta la API de notificaciones nativas.");
    }
}

// Escuchador global en el cuerpo del documento para dispositivos táctiles
document.body.addEventListener('click', inicializarNotificacionesMovil, { once: true });
document.body.addEventListener('touchstart', inicializarNotificacionesMovil, { once: true });

// FUNCIÓN CORREGIDA: Ahora usa PUT y /leido como tu servidor pide
async function marcarComoLeidos(idChat) {
    try {
        await fetch(`${API_URL}/mensajes/leido`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emisorId: idChat, receptorId: miId })
        });
    } catch (err) { 
        console.error("Error al marcar como leído:", err); 
    }
}

// Navegación Pestañas Inferiores (Ajustes / Chats)
document.getElementById('nav-settings-btn').addEventListener('click', () => {
    document.getElementById('nav-chats-btn').classList.remove('active');
    document.getElementById('nav-settings-btn').classList.add('active');
    document.getElementById('sidebar-main').classList.add('hidden');
    
    const settings = document.getElementById('sidebar-settings');
    settings.classList.remove('hidden');
    settings.classList.remove('animate-slide-in');
    void settings.offsetWidth; 
    settings.classList.add('animate-slide-in');
});

document.getElementById('nav-chats-btn').addEventListener('click', () => {
    document.getElementById('nav-settings-btn').classList.remove('active');
    document.getElementById('nav-chats-btn').classList.add('active');
    document.getElementById('sidebar-settings').classList.add('hidden');
    
    const main = document.getElementById('sidebar-main');
    main.classList.remove('hidden');
    main.classList.remove('animate-slide-in');
    void main.offsetWidth; 
    main.classList.add('animate-slide-in');
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '../index.html';
});

// Soporte de borrado de cuenta en zona de peligro
document.getElementById('btn-delete-container').addEventListener('click', async () => {
    const inputPass = document.getElementById('delete-password');
    if (inputPass.classList.contains('hidden')) {
        inputPass.classList.remove('hidden');
        inputPass.focus();
        return;
    }
    const password = inputPass.value;
    if (!password) return;
    if (confirm("¿Eliminar cuenta de forma irreversible?")) {
        try {
            const r = await fetch(`${API_URL}/auth/eliminar-cuenta`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: miEmail, password })
            });
            if (!r.ok) throw new Error("Error en password");
            localStorage.clear();
            window.location.href = '../index.html';
        } catch (err) { 
            alert("Error al eliminar la cuenta."); 
        }
    }
});

function linkify(text) {
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    const emailPattern = /((([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,})))/g;
    return text
        .replace(urlPattern, '<a href="$1" target="_blank">$1</a>')
        .replace(emailPattern, '<a href="mailto:$1">$1</a>');
}

function computarFechaCustom(fechaString) {
    const fecha = new Date(fechaString);
    const region = localStorage.getItem('user_region');
    const horasASumar = region === 'canarias' ? 1 : 2;
    fecha.setHours(fecha.getHours() + horasASumar);
    return fecha;
}

function obtenerEtiquetaDia(fechaObj) {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    if (fechaObj.toDateString() === hoy.toDateString()) return "Hoy";
    if (fechaObj.toDateString() === ayer.toDateString()) return "Ayer";

    return fechaObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function abrirConversacion(id, email) {
    chatActivoId = id;
    
    const emptyState = document.getElementById('no-chat-selected');
    if (emptyState) emptyState.remove();
    
    document.getElementById('chat-active').classList.remove('hidden');
    document.getElementById('chat-target-title').innerText = email;
    document.body.classList.add('chat-opened');
    
    await marcarComoLeidos(id);
    
    comprobarModuloLlamadas();
    if (bucleMensajes) clearInterval(bucleMensajes);
    cargarHistorial();
    bucleMensajes = setInterval(cargarHistorial, 3000);
}

document.getElementById('btn-back-to-list').addEventListener('click', () => {
    document.body.classList.remove('chat-opened');
});

async function comprobarModuloLlamadas() {
    try {
        const response = await fetch(`${API_URL}/funciones/comprobar/llamadas`);
        const data = await response.json();
        const btnCall = document.getElementById('btn-call');
        if (data.visible) btnCall.classList.remove('hidden');
        else btnCall.classList.add('hidden');
    } catch (err) { 
        console.error(err); 
    }
}

async function cargarChatsRecientes() {
    try {
        const response = await fetch(`${API_URL}/mensajes/recientes/${miId}`);
        const chats = await response.json();
        const container = document.getElementById('chats-container');
        container.innerHTML = '';
        
        chats.forEach(chat => {
            const fechaAjustada = computarFechaCustom(chat.fecha_envio);
            const horaString = String(fechaAjustada.getHours()).padStart(2, '0') + ':' + String(fechaAjustada.getMinutes()).padStart(2, '0');
            
            const item = document.createElement('div');
            item.className = 'chat-item';
            item.innerHTML = `
                <div class="chat-info">
                    <h4>${chat.chat_con_email}</h4>
                    <p>${chat.ultimo_mensaje}</p>
                </div>
                <div class="chat-meta">${horaString}</div>
            `;
            item.addEventListener('click', () => abrirConversacion(chat.chat_con_id, chat.chat_con_email));
            container.appendChild(item);
        });
    } catch (err) { 
        console.error(err); 
    }
}

async function cargarHistorial() {
    if (!chatActivoId) return;
    try {
        const response = await fetch(`${API_URL}/mensajes/${chatActivoId}?emisorId=${miId}`);
        const mensajes = await response.json();
        const view = document.getElementById('messages-view');
        const estabaAlFinal = view.scrollHeight - view.scrollTop <= view.clientHeight + 100;
        
        if (ultimoChatIdCargado !== chatActivoId) {
            view.innerHTML = '';
            idsMensajesRenderizados.clear();
            mensajesNotificados.clear();
            ultimoChatIdCargado = chatActivoId;
        }

        let ultimaEtiquetaFecha = "";
        let tieneMensajesNuevosDeOtros = false;
        const esCargaInicial = (idsMensajesRenderizados.size === 0);

        mensajes.forEach((msg) => {
            const fechaAjustada = computarFechaCustom(msg.fecha_envio);
            const etiquetaDiaActual = obtenerEtiquetaDia(fechaAjustada);
            const horaString = String(fechaAjustada.getHours()).padStart(2, '0') + ':' + String(fechaAjustada.getMinutes()).padStart(2, '0');
            
            if (msg.emisor_id !== miId && !msg.leido) {
                tieneMensajesNuevosDeOtros = true;
                msg.leido = true; 
            }

            const checkClass = msg.leido ? 'read' : 'unread';

            if (etiquetaDiaActual !== ultimaEtiquetaFecha) {
                ultimaEtiquetaFecha = etiquetaDiaActual;
                const separadoresExistentes = Array.from(view.querySelectorAll('.chat-date-separator'));
                const existeSeparador = separadoresExistentes.some(s => s.innerText === etiquetaDiaActual);
                
                if (!existeSeparador) {
                    const separator = document.createElement('div');
                    separator.className = 'chat-date-separator';
                    separator.innerText = etiquetaDiaActual;
                    view.appendChild(separator);
                }
            }

            if (idsMensajesRenderizados.has(msg.id)) {
                const msgExistente = document.getElementById(`msg-${msg.id}`);
                if (msgExistente && msg.emisor_id === miId) {
                    const checkSpan = msgExistente.querySelector('.msg-check');
                    if (checkSpan && msg.leido && checkSpan.classList.contains('unread')) {
                        checkSpan.className = 'msg-check read';
                    }
                }
                return; 
            }

            const div = document.createElement('div');
            div.id = `msg-${msg.id}`;
            
            const claseAnimacion = esCargaInicial ? '' : 'new-msg-anim';
            div.className = `msg ${msg.emisor_id === miId ? 'me' : 'them'} ${claseAnimacion}`;
            
            div.innerHTML = `
                ${linkify(msg.texto)}
                <div class="msg-meta-box">
                    <span class="msg-time">${horaString}</span>
                    ${msg.emisor_id === miId ? `<span class="msg-check ${checkClass}">✓✓</span>` : ''}
                </div>
            `;
            
            view.appendChild(div);
            idsMensajesRenderizados.add(msg.id);

            if (!esCargaInicial && msg.emisor_id !== miId && !mensajesNotificados.has(msg.id)) {
                mensajesNotificados.add(msg.id);
                if (Notification.permission === "granted") {
                    new Notification("CapoVibe", { 
                        body: `${document.getElementById('chat-target-title').innerText}: ${msg.texto}` 
                    });
                }
            }
        });
        
        if (tieneMensajesNuevosDeOtros) {
            await marcarComoLeidos(chatActivoId);
        }
        
        if (estabaAlFinal || esCargaInicial) view.scrollTop = view.scrollHeight;
    } catch (err) { 
        console.error("Error cargando historial:", err); 
    }
}

document.getElementById('msg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('msg-input');
    const texto = input.value.trim();
    if (!texto || !chatActivoId) return;
    try {
        await fetch(`${API_URL}/mensajes/enviar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emisorId: miId, receptorId: chatActivoId, texto })
        });
        input.value = '';
        cargarHistorial();
        cargarChatsRecientes();
    } catch (err) { 
        console.error(err); 
    }
});

document.getElementById('btn-search').addEventListener('click', async () => {
    const emailInput = document.getElementById('search-user').value.trim();
    if (!emailInput) return;
    try {
        const response = await fetch(`${API_URL}/usuarios`);
        const usuarios = await response.json();
        const encontrado = usuarios.find(u => u.email.toLowerCase() === emailInput.toLowerCase());
        if (encontrado) {
            if (encontrado.id === miId) return alert("No puedes abrir un chat contigo mismo.");
            abrirConversacion(encontrado.id, encontrado.email);
        } else { 
            alert("Usuario no registrado."); 
        }
    } catch (err) { 
        console.error(err); 
    }
});

cargarChatsRecientes();
setInterval(cargarChatsRecientes, 5000);