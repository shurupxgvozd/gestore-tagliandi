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

const settingsDialog = document.getElementById('settingsDialog');

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
