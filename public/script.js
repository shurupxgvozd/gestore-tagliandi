const form = document.getElementById('tagliandoForm');
const body = document.getElementById('tagliandiBody');
const countTotal = document.getElementById('countTotal');
const countInProgress = document.getElementById('countInProgress');
const countReady = document.getElementById('countReady');
const formMessage = document.getElementById('formMessage');
const contactsDialog = document.getElementById('contactsDialog');
const contactsSearch = document.getElementById('contactsSearch');
const contactsList = document.getElementById('contactsList');
const vehiclesDialog = document.getElementById('vehiclesDialog');
const vehiclesSearch = document.getElementById('vehiclesSearch');
const vehiclesList = document.getElementById('vehiclesList');
const settingsDialog = document.getElementById('settingsDialog');
let records = [];
let clients = [];
let vehicles = [];

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
  try {
    localStorage.setItem('theme', theme);
  } catch {}
  
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  themeRadios.forEach(radio => {
    radio.checked = radio.value === theme;
  });
}

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

document.querySelectorAll('input[name="theme"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      applyTheme(radio.value);
    }
  });
});

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

function renderContacts() {
  const query = contactsSearch.value.trim().toLocaleLowerCase('it');
  const filteredClients = clients.filter((client) =>
    `${client.nome} ${client.telefono} ${client.email} ${client.indirizzo}`.toLocaleLowerCase('it').includes(query),
  );

  contactsList.replaceChildren();
  if (!filteredClients.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'contacts-empty';
    emptyMessage.textContent = clients.length ? 'Nessun cliente trovato.' : 'La rubrica è ancora vuota.';
    contactsList.append(emptyMessage);
    return;
  }

  filteredClients.forEach((client) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'contact-option';

    const name = document.createElement('span');
    name.className = 'contact-name';
    name.textContent = client.nome;

    const phone = document.createElement('span');
    phone.className = 'contact-detail';
    phone.textContent = client.telefono || 'Telefono non disponibile';

    const email = document.createElement('span');
    email.className = 'contact-detail';
    email.textContent = client.email || 'Email da completare';

    const address = document.createElement('span');
    address.className = 'contact-address';
    address.textContent = client.indirizzo || 'Indirizzo da completare';

    button.append(name, phone, email, address);
    button.addEventListener('click', () => {
      form.elements.namedItem('cliente').value = client.nome;
      form.elements.namedItem('telefono').value = client.telefono;
      form.elements.namedItem('email').value = client.email;
      form.elements.namedItem('indirizzo').value = client.indirizzo;
      contactsDialog.close();
      form.elements.namedItem('cliente').focus();
    });
    contactsList.append(button);
  });
}

document.getElementById('openContacts').addEventListener('click', async () => {
  contactsDialog.showModal();
  contactsSearch.value = '';
  contactsList.textContent = 'Caricamento rubrica...';

  try {
    const response = await fetch('/api/clienti');
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Errore nel caricamento della rubrica');
    clients = result;
    renderContacts();
  } catch (error) {
    contactsList.textContent = `Errore: ${error.message}`;
  }
});

document.getElementById('closeContacts').addEventListener('click', () => contactsDialog.close());
contactsSearch.addEventListener('input', renderContacts);

function renderVehicles() {
  const query = vehiclesSearch.value.trim().toLocaleLowerCase('it');
  const filteredVehicles = vehicles.filter((vehicle) =>
    `${vehicle.veicolo} ${vehicle.targa} ${vehicle.cliente}`.toLocaleLowerCase('it').includes(query),
  );

  vehiclesList.replaceChildren();
  if (!filteredVehicles.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'vehicles-empty';
    emptyMessage.textContent = vehicles.length ? 'Nessun veicolo trovato.' : 'L\'archivio veicoli è ancora vuoto.';
    vehiclesList.append(emptyMessage);
    return;
  }

  filteredVehicles.forEach((vehicle) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vehicle-option';

    const model = document.createElement('span');
    model.className = 'vehicle-model';
    model.textContent = vehicle.veicolo || 'Modello non disponibile';

    const plate = document.createElement('span');
    plate.className = 'vehicle-detail';
    plate.textContent = `Targa: ${vehicle.targa || 'N/A'}`;

    const client = document.createElement('span');
    client.className = 'vehicle-detail';
    client.textContent = `Cliente: ${vehicle.cliente || 'N/A'}`;

    const km = document.createElement('span');
    km.className = 'vehicle-detail';
    km.textContent = `Km: ${vehicle.km || '—'}`;

    button.append(model, plate, client, km);
    button.addEventListener('click', () => {
      form.elements.namedItem('veicolo').value = vehicle.veicolo || '';
      form.elements.namedItem('targa').value = vehicle.targa || '';
      form.elements.namedItem('km').value = vehicle.km || '';
      vehiclesDialog.close();
      form.elements.namedItem('intervento').focus();
    });
    vehiclesList.append(button);
  });
}

document.getElementById('openVehicles').addEventListener('click', async () => {
  vehiclesDialog.showModal();
  vehiclesSearch.value = '';
  vehiclesList.textContent = 'Caricamento veicoli...';

  try {
    const response = await fetch('/api/tagliandi');
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Errore nel caricamento dei veicoli');
    
    const uniqueVehicles = {};
    result.forEach(record => {
      const key = `${record.veicolo}-${record.targa}`;
      if (!uniqueVehicles[key]) {
        uniqueVehicles[key] = record;
      }
    });
    vehicles = Object.values(uniqueVehicles);
    renderVehicles();
  } catch (error) {
    vehiclesList.textContent = `Errore: ${error.message}`;
  }
});

document.getElementById('closeVehicles').addEventListener('click', () => vehiclesDialog.close());
vehiclesSearch.addEventListener('input', renderVehicles);

document.getElementById('openSettings').addEventListener('click', () => {
  settingsDialog.showModal();
});

document.getElementById('closeSettings').addEventListener('click', () => settingsDialog.close());

document.getElementById('adminLoginButton').addEventListener('click', () => {
  document.getElementById('adminPasswordGroup').style.display = 'block';
  document.getElementById('adminPassword').focus();
});

document.getElementById('adminCancelButton').addEventListener('click', () => {
  document.getElementById('adminPasswordGroup').style.display = 'none';
  document.getElementById('adminPassword').value = '';
});

document.getElementById('adminSubmitButton').addEventListener('click', () => {
  const password = document.getElementById('adminPassword').value;
  if (password === 'chickengun') {
    window.location.href = './admin.html';
  } else {
    alert('Password errata');
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPassword').focus();
  }
});

document.getElementById('adminPassword').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('adminSubmitButton').click();
  }
});

function renderTable() {
  if (!records.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Nessun tagliando inserito</td></tr>';
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
          <td><button type="button" class="delete-button" data-delete-id="${escapeHtml(item.id)}">Elimina</button></td>
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

body.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-id]');
  if (!button || !window.confirm('Vuoi eliminare questo intervento?')) return;

  formMessage.textContent = '';
  formMessage.classList.remove('error');

  try {
    const response = await fetch(`/api/tagliandi/${encodeURIComponent(button.dataset.deleteId)}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Errore durante l’eliminazione');

    formMessage.textContent = 'Intervento eliminato.';
    await loadRecords();
  } catch (error) {
    formMessage.textContent = `Errore: ${error.message}`;
    formMessage.classList.add('error');
  }
});

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
    email: formData.get('email')?.toString().trim() || '',
    indirizzo: formData.get('indirizzo')?.toString().trim() || '',
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
