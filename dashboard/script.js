const API_URL = 'https://capovibe.weblocalstudio.es/api';
const miId = localStorage.getItem('usuarioId');
const miEmail = localStorage.getItem('email');

let chatActivoId = null;
let bucleMensajes = null;
let ultimoMensajeIdGlobal = null;

// Control de renderizado para evitar que las animaciones se repitan en bucle
let idsMensajesRenderizados = new Set();
let ultimoChatIdCargado = null;

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
    window.location.href = '../'; 
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
        // Forzamos reseteo al cambiar de región para recalcular horas
        ultimoChatIdCargado = null;
        cargarHistorial(); 
    }
    cargarChatsRecientes();
});

// Marcar mensajes como leídos en el servidor
async function marcarComoLeidos(idChat) {
    try {
        await fetch(`${API_URL}/mensajes/leer`, {
            method: 'POST',
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
    document.getElementById('sidebar-settings').classList.remove('hidden');
});

document.getElementById('nav-chats-btn').addEventListener('click', () => {
    document.getElementById('nav-settings-btn').classList.remove('active');
    document.getElementById('nav-chats-btn').classList.add('active');
    document.getElementById('sidebar-settings').classList.add('hidden');
    document.getElementById('sidebar-main').classList.remove('hidden');
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '../';
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
            window.location.href = '../';
        } catch (err) { 
            alert("Error al eliminar la cuenta."); 
        }
    }
});

// Detección automática de enlaces y correos
function linkify(text) {
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    const emailPattern = /((([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,})))/g;
    return text
        .replace(urlPattern, '<a href="$1" target="_blank">$1</a>')
        .replace(emailPattern, '<a href="mailto:$1">$1</a>');
}

// Cómputo de horas exacto: Península +2h, Canarias +1h
function computarFechaCustom(fechaString) {
    const fecha = new Date(fechaString);
    const region = localStorage.getItem('user_region');
    const horasASumar = region === 'canarias' ? 1 : 2;
    fecha.setHours(fecha.getHours() + horasASumar);
    return fecha;
}

// Formateador de días estilo WhatsApp
function obtenerEtiquetaDia(fechaObj) {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    if (fechaObj.toDateString() === hoy.toDateString()) return "Hoy";
    if (fechaObj.toDateString() === ayer.toDateString()) return "Ayer";

    return fechaObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Abrir conversación activa
async function abrirConversacion(id, email) {
    chatActivoId = id;
    
    const emptyState = document.getElementById('no-chat-selected');
    if (emptyState) emptyState.remove();
    
    document.getElementById('chat-active').classList.remove('hidden');
    document.getElementById('chat-target-title').innerText = email;
    
    // Activar clase responsiva para pantallas móviles (iPhone)
    document.body.classList.add('chat-opened');
    
    // Marcar como leído inmediatamente al entrar
    await marcarComoLeidos(id);
    
    comprobarModuloLlamadas();
    if (bucleMensajes) clearInterval(bucleMensajes);
    cargarHistorial();
    bucleMensajes = setInterval(cargarHistorial, 3000);
}

// Botón volver atrás para entornos móviles
document.getElementById('btn-back-to-list').addEventListener('click', () => {
    document.body.classList.remove('chat-opened');
});

// Comprobar si el botón de llamada debe aparecer según el servidor
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

// Cargar barra lateral con chats recientes
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

// Cargar historial con auto-lectura e inyección incremental de mensajes sin parpadeos
async function cargarHistorial() {
    if (!chatActivoId) return;
    try {
        const response = await fetch(`${API_URL}/mensajes/${chatActivoId}?emisorId=${miId}`);
        const mensajes = await response.json();
        const view = document.getElementById('messages-view');
        const estabaAlFinal = view.scrollHeight - view.scrollTop <= view.clientHeight + 100;
        
        // Si cambiamos a un chat distinto, vaciamos la vista y el set de memoria
        if (ultimoChatIdCargado !== chatActivoId) {
            view.innerHTML = '';
            idsMensajesRenderizados.clear();
            ultimoChatIdCargado = chatActivoId;
        }

        let ultimaEtiquetaFecha = "";
        let tieneMensajesNuevosDeOtros = false;

        mensajes.forEach((msg) => {
            const fechaAjustada = computarFechaCustom(msg.fecha_envio);
            const etiquetaDiaActual = obtenerEtiquetaDia(fechaAjustada);
            const horaString = String(fechaAjustada.getHours()).padStart(2, '0') + ':' + String(fechaAjustada.getMinutes()).padStart(2, '0');
            const checkClass = msg.leido ? 'read' : 'unread';

            if (msg.emisor_id !== miId && !msg.leido) {
                tieneMensajesNuevosDeOtros = true;
            }

            // Inyección controlada de separadores flotantes estilo WhatsApp
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

            // Si el mensaje ya existe en pantalla, solo actualizamos los tics
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

            // Crear nodo físico únicamente para los mensajes que entran nuevos
            const div = document.createElement('div');
            div.id = `msg-${msg.id}`;
            
            // Si el set está vacío es la primera carga (sin animación). Si ya hay datos, es tiempo real (con animación).
            const claseAnimacion = idsMensajesRenderizados.size === 0 ? '' : 'new-msg-anim';
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
        });
        
        // Auto-leer los mensajes entrantes en caliente
        if (tieneMensajesNuevosDeOtros) {
            await marcarComoLeidos(chatActivoId);
        }
        
        // Alertas globales mediante notificaciones
        if (mensajes.length > 0) {
            const ultimoMsg = mensajes[mensajes.length - 1];
            if (ultimoMsg.id !== ultimoMensajeIdGlobal && ultimoMsg.emisor_id !== miId) {
                ultimoMensajeIdGlobal = ultimoMsg.id;
                if (Notification.permission === "granted" && !document.body.classList.contains('chat-opened')) {
                    new Notification("CapoVibe", { body: `${document.getElementById('chat-target-title').innerText}: ${ultimoMsg.texto}` });
                }
            }
        }
        if (estabaAlFinal) view.scrollTop = view.scrollHeight;
    } catch (err) { 
        console.error(err); 
    }
}

// Envío del formulario de mensajes
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

// Evento de búsqueda e inicio de chat por correo electrónico
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

// Inicialización de flujos concurrentes
cargarChatsRecientes();
setInterval(cargarChatsRecientes, 5000);