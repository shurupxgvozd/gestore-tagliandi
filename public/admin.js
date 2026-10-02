const form = document.getElementById('tagliandoForm');
const appointmentsBody = document.getElementById('appointmentsBody');
const tagliandiBody = document.getElementById('tagliandiBody');
const filterInput = document.getElementById('filterInput');
const filterCount = document.getElementById('filterCount');
const countTotal = document.getElementById('countTotal');
const countInProgress = document.getElementById('countInProgress');
const countReady = document.getElementById('countReady');
const formMessage = document.getElementById('formMessage');
const exportDialog = document.getElementById('exportDialog');
const exportButton = document.getElementById('exportButton');
const downloadButton = document.getElementById('downloadButton');
const closeExport = document.getElementById('closeExport');
const cancelExport = document.getElementById('cancelExport');
const newTagliandoBtn = document.getElementById('newTagliandoBtn');

let records = [];
let appointments = [];
let filteredRecords = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function slugifyStatus(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[àèéìòù]/g, (char) => ({
      à: 'a',
      è: 'e',
      é: 'e',
      ì: 'i',
      ò: 'o',
      ù: 'u'
    }[char] || char));
}

function filterTable() {
  const query = filterInput.value.trim().toLowerCase('it');
  
  filteredRecords = records.filter((record) => {
    const searchText = `${record.veicolo} ${record.targa} ${record.intervento} ${record.cliente}`.toLowerCase('it');
    return searchText.includes(query);
  });

  filterCount.textContent = `${filteredRecords.length} risultati`;
  renderTable();
}

function renderTable() {
  if (!filteredRecords.length) {
    tagliandiBody.innerHTML = '<tr><td colspan="5" class="empty">Nessun tagliando trovato</td></tr>';
    return;
  }

  tagliandiBody.innerHTML = filteredRecords
    .map((record) => {
      const statusClass = slugifyStatus(record.stato || 'In lavorazione');
      return `
        <tr>
          <td>${escapeHtml(record.veicolo || '—')}</td>
          <td>${escapeHtml(record.targa || '—')}</td>
          <td>${escapeHtml(record.intervento || '—')}</td>
          <td><span class="tag ${escapeHtml(statusClass)}">${escapeHtml(record.stato || 'In lavorazione')}</span></td>
          <td class="actions-cell">
            <button type="button" class="edit-button" data-edit-id="${escapeHtml(record.id)}">✎ Modifica</button>
            <button type="button" class="delete-button" data-delete-id="${escapeHtml(record.id)}">🗑 Elimina</button>
          </td>
        </tr>
      `;
    })
    .join('');

  attachEventListeners();
}

function updateStats() {
  countTotal.textContent = String(records.length);
  countInProgress.textContent = String(records.filter((item) => item.stato === 'In lavorazione').length);
  countReady.textContent = String(records.filter((item) => item.stato === 'Pronto').length);
}

async function loadRecords() {
  try {
    const response = await fetch('/api/tagliandi');
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Errore nel caricamento');
    records = result;
    filteredRecords = [...records];
    updateStats();
    filterTable();
  } catch (error) {
    formMessage.textContent = `Errore: ${error.message}`;
    formMessage.classList.add('error');
  }
}

async function loadAppointments() {
  try {
    const response = await fetch('/api/appointments');
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Errore nel caricamento');
    appointments = result;
    renderAppointmentsTable();
  } catch (error) {
    console.error('Errore:', error);
  }
}

function renderAppointmentsTable() {
  if (!appointments.length) {
    appointmentsBody.innerHTML = '<tr><td colspan="6" class="empty">Nessun appuntamento</td></tr>';
    return;
  }

  appointmentsBody.innerHTML = appointments
    .map((apt) => `
      <tr data-apt-id-row="${escapeHtml(apt.id)}">
        <td>${escapeHtml(apt.cliente || '—')}</td>
        <td>${escapeHtml(apt.data || '—')}</td>
        <td>${escapeHtml(apt.ora || '—')}</td>
        <td>${escapeHtml(apt.intervento || '—')}</td>
        <td>${escapeHtml(apt.targa || '—')}</td>
        <td class="actions-cell">
          <button type="button" class="create-button" data-apt-id="${escapeHtml(apt.id)}">➕ Crea</button>
          <button type="button" class="edit-apt-button" data-apt-id="${escapeHtml(apt.id)}">✎ Modifica</button>
          <button type="button" class="delete-apt-button" data-apt-id="${escapeHtml(apt.id)}">🗑 Elimina</button>
        </td>
      </tr>
    `)
    .join('');
  // attach handlers
  appointmentsBody.querySelectorAll('[data-apt-id]').forEach(button => {
    button.addEventListener('click', async (e) => {
      const aptId = button.dataset.aptId;
      const apt = appointments.find(a => a.id == aptId);
      if (apt) {
        form.elements.namedItem('cliente').value = apt.cliente || '';
        form.elements.namedItem('telefono').value = apt.telefono || '';
        form.elements.namedItem('email').value = apt.email || '';
        form.elements.namedItem('indirizzo').value = apt.indirizzo || '';
        form.elements.namedItem('targa').value = apt.targa || '';
        form.elements.namedItem('veicolo').value = apt.veicolo || '';
        form.elements.namedItem('data').value = apt.data || '';
        form.elements.namedItem('intervento').value = apt.intervento || '';
        form.elements.namedItem('descrizione').value = apt.descrizione || '';
        document.getElementById('tagliandoId').value = '';
        form.elements.namedItem('intervento').focus();
      }
    });
  });

  // edit and delete appointment handlers
  appointmentsBody.querySelectorAll('.delete-apt-button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.aptId;
      if (!confirm('Elimina questo appuntamento?')) return;
      try {
        const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Errore');
        await loadAppointments();
      } catch (err) {
        console.error(err);
        alert('Errore durante l\'eliminazione');
      }
    });
  });

  appointmentsBody.querySelectorAll('.edit-apt-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.aptId;
      const row = document.querySelector(`tr[data-apt-id-row="${id}"]`);
      const apt = appointments.find(a => a.id == id);
      if (!row || !apt) return;

      // replace row with editable inputs
      row.innerHTML = `
        <td><input type="text" class="edit-apt-cliente" value="${escapeHtml(apt.cliente||'')}" /></td>
        <td><input type="date" class="edit-apt-data" value="${escapeHtml(apt.data||'')}" /></td>
        <td><input type="time" class="edit-apt-ora" value="${escapeHtml(apt.ora||'')}" /></td>
        <td><input type="text" class="edit-apt-intervento" value="${escapeHtml(apt.intervento||'')}" /></td>
        <td><input type="text" class="edit-apt-targa" value="${escapeHtml(apt.targa||'')}" /></td>
        <td class="actions-cell">
          <button class="save-apt" data-save-id="${escapeHtml(id)}">Salva</button>
          <button class="cancel-apt" data-cancel-id="${escapeHtml(id)}">Annulla</button>
        </td>
      `;

      row.querySelector('.cancel-apt').addEventListener('click', () => loadAppointments());
      row.querySelector('.save-apt').addEventListener('click', async () => {
        const payload = {
          cliente: row.querySelector('.edit-apt-cliente').value.trim(),
          telefono: apt.telefono || '',
          email: apt.email || '',
          indirizzo: apt.indirizzo || '',
          targa: row.querySelector('.edit-apt-targa').value.trim(),
          veicolo: apt.veicolo || '',
          data: row.querySelector('.edit-apt-data').value,
          ora: row.querySelector('.edit-apt-ora').value,
          intervento: row.querySelector('.edit-apt-intervento').value.trim(),
          descrizione: apt.descrizione || '',
          stato: apt.stato || 'in_attesa'
        };

        try {
          const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || 'Errore');
          await loadAppointments();
        } catch (err) {
          console.error(err);
          alert('Errore durante il salvataggio dell\'appuntamento');
        }
      });
    });
  });
}

function attachEventListeners() {
  tagliandiBody.querySelectorAll('[data-delete-id]').forEach(button => {
    button.addEventListener('click', async (e) => {
      const id = button.dataset.deleteId;
      if (!window.confirm('Elimina questo tagliando?')) return;

      try {
        const response = await fetch(`/api/tagliandi/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Errore');
        formMessage.textContent = 'Tagliando eliminato.';
        await loadRecords();
      } catch (error) {
        formMessage.textContent = `Errore: ${error.message}`;
        formMessage.classList.add('error');
      }
    });
  });

  tagliandiBody.querySelectorAll('[data-edit-id]').forEach(button => {
    button.addEventListener('click', (e) => {
      const id = button.dataset.editId;
      const record = records.find(r => r.id == id);
      if (record) {
        form.elements.namedItem('cliente').value = record.cliente || '';
        form.elements.namedItem('telefono').value = record.telefono || '';
        form.elements.namedItem('email').value = record.email || '';
        form.elements.namedItem('indirizzo').value = record.indirizzo || '';
        form.elements.namedItem('veicolo').value = record.veicolo || '';
        form.elements.namedItem('targa').value = record.targa || '';
        form.elements.namedItem('km').value = record.km || '';
        form.elements.namedItem('data').value = record.data || '';
        form.elements.namedItem('intervento').value = record.intervento || '';
        form.elements.namedItem('priorita').value = record.priorita || 'Media';
        form.elements.namedItem('stato').value = record.stato || 'In lavorazione';
        form.elements.namedItem('descrizione').value = record.descrizione || '';
        form.elements.namedItem('costo').value = record.costo || '';
        form.elements.namedItem('note').value = record.note || '';
        
        document.querySelectorAll('input[name="servizi"]').forEach(checkbox => {
          checkbox.checked = false;
        });
        if (record.servizi) {
          const servizi = record.servizi.split(', ');
          document.querySelectorAll('input[name="servizi"]').forEach(checkbox => {
            if (servizi.includes(checkbox.value)) checkbox.checked = true;
          });
        }
        
        document.getElementById('tagliandoId').value = id;
        form.scrollIntoView();
      }
    });
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const servizi = formData.getAll('servizi');
  const tagliandoId = document.getElementById('tagliandoId').value;

  const record = {
    cliente: formData.get('cliente')?.toString().trim() || '',
    veicolo: formData.get('veicolo')?.toString().trim() || '',
    targa: formData.get('targa')?.toString().trim() || '',
    km: formData.get('km') || '',
    data: formData.get('data') || '',
    intervento: formData.get('intervento') || '',
    priorita: formData.get('priorita') || '',
    stato: formData.get('stato') || 'In lavorazione',
    descrizione: formData.get('descrizione')?.toString().trim() || '',
    servizi: servizi.join(', '),
    costo: formData.get('costo') || '',
    telefono: formData.get('telefono')?.toString().trim() || '',
    email: formData.get('email')?.toString().trim() || '',
    indirizzo: formData.get('indirizzo')?.toString().trim() || '',
    note: formData.get('note')?.toString().trim() || ''
  };

  formMessage.textContent = '';
  formMessage.classList.remove('error');

  try {
    let response;
    if (tagliandoId) {
      response = await fetch(`/api/tagliandi/${tagliandoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } else {
      response = await fetch('/api/tagliandi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    }
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Errore nel salvataggio');

    form.reset();
    document.getElementById('tagliandoId').value = '';
    formMessage.textContent = tagliandoId ? 'Tagliando modificato!' : 'Tagliando salvato!';
    await loadRecords();
  } catch (error) {
    formMessage.textContent = `Errore: ${error.message}`;
    formMessage.classList.add('error');
  }
});

newTagliandoBtn.addEventListener('click', () => {
  form.reset();
  document.getElementById('tagliandoId').value = '';
  formMessage.textContent = '';
  formMessage.classList.remove('error');
  form.scrollIntoView();
});

filterInput.addEventListener('input', filterTable);

exportButton.addEventListener('click', () => {
  exportDialog.showModal();
});

closeExport.addEventListener('click', () => exportDialog.close());
cancelExport.addEventListener('click', () => exportDialog.close());

downloadButton.addEventListener('click', () => {
  const exportType = document.querySelector('input[name="exportType"]:checked').value;
  
  if (exportType === 'appointments') {
    exportAppointmentsToExcel();
  } else {
    exportTagliandiToExcel();
  }
  
  exportDialog.close();
});

function exportTagliandiToExcel() {
  if (!filteredRecords.length) {
    alert('Nessun tagliando da esportare');
    return;
  }

  const data = filteredRecords.map((tag) => ({
    'ID': tag.id || '',
    'Cliente': tag.cliente || '',
    'Telefono': tag.telefono || '',
    'Email': tag.email || '',
    'Veicolo': tag.veicolo || '',
    'Targa': tag.targa || '',
    'Km': tag.km || '',
    'Data Ingresso': tag.data || '',
    'Intervento': tag.intervento || '',
    'Priorita': tag.priorita || '',
    'Stato': tag.stato || '',
    'Descrizione': tag.descrizione || '',
    'Servizi': tag.servizi || '',
    'Costo': tag.costo || '',
    'Note': tag.note || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tagliandi');

  const now = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `tagliandi_${now}.xlsx`);
}

function exportAppointmentsToExcel() {
  if (!appointments.length) {
    alert('Nessun appuntamento da esportare');
    return;
  }

  const data = appointments.map((apt) => ({
    'Nome Cliente': apt.cliente || '',
    'Telefono': apt.telefono || '',
    'Email': apt.email || '',
    'Indirizzo': apt.indirizzo || '',
    'Targa': apt.targa || '',
    'Veicolo': apt.veicolo || '',
    'Data': apt.data || '',
    'Ora': apt.ora || '',
    'Intervento': apt.intervento || '',
    'Descrizione': apt.descrizione || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Appuntamenti');

  const now = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `appuntamenti_${now}.xlsx`);
}

loadRecords();
loadAppointments();
