const STORAGE_KEY = 'tagliandiAutoRecords';
const form = document.getElementById('tagliandoForm');
const body = document.getElementById('tagliandiBody');
const countTotal = document.getElementById('countTotal');
const countInProgress = document.getElementById('countInProgress');
const countReady = document.getElementById('countReady');

const initialRecords = [
  {
    cliente: 'Luca Bianchi',
    veicolo: 'Audi A4',
    targa: 'AB123CD',
    intervento: 'Manutenzione ordinaria',
    stato: 'In lavorazione',
    descrizione: 'Tagliando e verifica carrelli'
  },
  {
    cliente: 'Sara Verdi',
    veicolo: 'Volkswagen Golf',
    targa: 'FG456RT',
    intervento: 'Cambio pneumatici',
    stato: 'Pronto',
    descrizione: 'Sostituzione set gomme estate'
  }
];

function loadRecords() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialRecords));
    return [...initialRecords];
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [...initialRecords];
  } catch (error) {
    return [...initialRecords];
  }
}

let records = loadRecords();

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

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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
      const statusClass = slugifyStatus(item.stato || 'In lavorazione');

      return `
        <tr>
          <td>${item.veicolo || '—'}</td>
          <td>${item.targa || '—'}</td>
          <td>${item.intervento || '—'}</td>
          <td><span class="tag ${statusClass}">${item.stato || 'In lavorazione'}</span></td>
        </tr>
      `;
    })
    .join('');

  countTotal.textContent = String(records.length);
  countInProgress.textContent = String(records.filter((item) => item.stato === 'In lavorazione').length);
  countReady.textContent = String(records.filter((item) => item.stato === 'Pronto').length);
}

form.addEventListener('submit', (event) => {
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

  records.unshift(record);
  saveRecords();
  renderTable();
  form.reset();
});

renderTable();
