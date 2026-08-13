const dashboard = {
  sidebar: document.querySelector('#dashboard-sidebar'),
  mobileMenu: document.querySelector('#mobile-menu-button'),
  darkModeToggle: document.querySelector('#dark-mode-toggle'),
  toast: document.querySelector('#dashboard-toast'),
  search: document.querySelector('#profile-search')
};

let toastTimer;

const showToast = (message) => {
  window.clearTimeout(toastTimer);
  dashboard.toast.textContent = message;
  dashboard.toast.classList.add('show');
  toastTimer = window.setTimeout(() => dashboard.toast.classList.remove('show'), 2800);
};

const closeMobileMenu = () => {
  dashboard.sidebar.classList.remove('open');
  dashboard.mobileMenu.setAttribute('aria-expanded', 'false');
};

dashboard.mobileMenu.addEventListener('click', () => {
  const isOpen = dashboard.sidebar.classList.toggle('open');
  dashboard.mobileMenu.setAttribute('aria-expanded', String(isOpen));
});

dashboard.darkModeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  dashboard.darkModeToggle.setAttribute('aria-pressed', String(isDark));
  localStorage.setItem('manglik-meets-dark-mode', String(isDark));
});

if (localStorage.getItem('manglik-meets-dark-mode') === 'true') {
  document.body.classList.add('dark-mode');
  dashboard.darkModeToggle.setAttribute('aria-pressed', 'true');
}

document.querySelectorAll('[data-nav-item]').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('[data-nav-item]').forEach((navItem) => navItem.classList.remove('active'));
    item.classList.add('active');
    closeMobileMenu();

    if (item.dataset.futureAction) {
      showToast(`${item.textContent.trim()} will connect to your account data soon.`);
    }
  });
});

document.querySelectorAll('[data-future-action]:not([data-nav-item])').forEach((element) => {
  element.addEventListener('click', () => {
    if (element.dataset.profileAction) return;
    const action = element.dataset.futureAction;
    const label = element.textContent.trim() || action;

    if (action === 'logout') {
      showToast('Logged out successfully.');
      return;
    }

    if (action === 'share-profile' && navigator.share) {
      navigator.share({
        title: 'Aanya Sharma · Manglik Meets',
        text: 'View Aanya’s Manglik Meets profile.',
        url: window.location.href
      }).catch(() => {});
      return;
    }

    showToast(`${label} updated.`);
  });
});

dashboard.search.addEventListener('search', () => {
  if (dashboard.search.value.trim()) {
    showToast(`Search for “${dashboard.search.value.trim()}” will be available with member data.`);
  }
});

dashboard.search.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    dashboard.search.dispatchEvent(new Event('search'));
  }
});
