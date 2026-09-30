const form = document.getElementById('tagliandoForm');
const body = document.getElementById('tagliandiBody');
const countTotal = document.getElementById('countTotal');
const countInProgress = document.getElementById('countInProgress');
const countReady = document.getElementById('countReady');
const formMessage = document.getElementById('formMessage');
let records = [];

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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function renderTable() {
  if (!records.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">Nessun tagliando inserito</td></tr>';
    countTotal.textContent = '0';
    countInProgress.textContent = '0';
    countReady.textContent = '0';
    return;
  }

  body.innerHTML = records
    .map((record) => {
      const item = record;
      const statusClass = slugifyStatus(item.stato || 'In lavorazione').replace(/[^a-z0-9-]/g, '');

      return `
        <tr>
          <td>${escapeHtml(item.veicolo || '—')}</td>
          <td>${escapeHtml(item.targa || '—')}</td>
          <td>${escapeHtml(item.intervento || '—')}</td>
          <td><span class="tag ${escapeHtml(statusClass)}">${escapeHtml(item.stato || 'In lavorazione')}</span></td>
        </tr>
      `;
    })
    .join('');

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
    renderTable();
  } catch (error) {
    formMessage.textContent = `Errore: ${error.message}`;
    formMessage.classList.add('error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const servizi = formData.getAll('servizi');

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
    note: formData.get('note')?.toString().trim() || ''
  };

  formMessage.textContent = '';
  formMessage.classList.remove('error');

  try {
    const response = await fetch('/api/tagliandi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Errore nel salvataggio');

    form.reset();
    formMessage.textContent = 'Tagliando salvato correttamente.';
    await loadRecords();
  } catch (error) {
    formMessage.textContent = `Errore: ${error.message}`;
    formMessage.classList.add('error');
  }
});

loadRecords();
