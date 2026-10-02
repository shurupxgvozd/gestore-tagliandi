const form = document.getElementById('appointmentForm');
const appointmentsBody = document.getElementById('appointmentsBody');
const formMessage = document.getElementById('formMessage');
let appointments = [];

async function loadAppointments() {
  try {
    const response = await fetch('/api/appointments');
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Errore nel caricamento');
    appointments = result;
    renderAppointmentsTable();
  } catch (error) {
    formMessage.textContent = `Errore: ${error.message}`;
    formMessage.classList.add('error');
  }
}

function renderAppointmentsTable() {
  if (!appointments.length) {
    appointmentsBody.innerHTML = '<tr><td colspan="4" class="empty">Nessun appuntamento</td></tr>';
    return;
  }

  appointmentsBody.innerHTML = appointments
    .slice(0, 10)
    .map((apt) => `
      <tr>
        <td>${escapeHtml(apt.cliente || '—')}</td>
        <td>${escapeHtml(apt.data || '—')}</td>
        <td>${escapeHtml(apt.ora || '—')}</td>
        <td>${escapeHtml(apt.intervento || '—')}</td>
      </tr>
    `)
    .join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const appointment = {
    cliente: formData.get('cliente')?.toString().trim() || '',
    telefono: formData.get('telefono')?.toString().trim() || '',
    email: formData.get('email')?.toString().trim() || '',
    indirizzo: formData.get('indirizzo')?.toString().trim() || '',
    targa: formData.get('targa')?.toString().trim() || '',
    veicolo: formData.get('veicolo')?.toString().trim() || '',
    data: formData.get('data') || '',
    ora: formData.get('ora') || '',
    intervento: formData.get('intervento') || '',
    descrizione: formData.get('descrizione')?.toString().trim() || ''
  };

  formMessage.textContent = '';
  formMessage.classList.remove('error');

  try {
    // Client-side validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appointment.email)) {
      throw new Error('Email non valida');
    }
    if (!/^[0-9+()\-\s]{7,}$/.test(appointment.telefono)) {
      throw new Error('Numero di telefono non valido');
    }
    if (!appointment.indirizzo) {
      throw new Error('Inserisci l\'indirizzo');
    }
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Errore nel salvataggio');

    form.reset();
    formMessage.textContent = 'Appuntamento prenotato con successo!';
    await loadAppointments();
  } catch (error) {
    formMessage.textContent = `Errore: ${error.message}`;
    formMessage.classList.add('error');
  }
});

loadAppointments();
