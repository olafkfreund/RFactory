const dark = window.matchMedia('(prefers-color-scheme: dark)');
let choice = 'system';
try { choice = localStorage.getItem('rfactory-theme') || 'system'; } catch (e) { /* Storage may be unavailable. */ }

function applyTheme() {
  document.documentElement.classList.toggle('dark', choice === 'dark' || (choice === 'system' && dark.matches));
  for (const button of document.querySelectorAll('[data-theme-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice));
  }
}

applyTheme();
const observer = new MutationObserver(() => {
  const switcher = document.querySelector('.f-theme-switch');
  if (switcher?.querySelectorAll('[data-theme-choice]').length !== 3) return;
  observer.disconnect();
  switcher.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-choice]');
    if (!button) return;
    choice = button.dataset.themeChoice;
    try { localStorage.setItem('rfactory-theme', choice); } catch (e) { /* Keep the current choice for this page. */ }
    applyTheme();
  });
  applyTheme();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
dark.addEventListener('change', applyTheme);
