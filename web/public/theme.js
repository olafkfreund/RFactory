const preference = () => localStorage.getItem('rfactory-theme') || 'system';
const dark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  let choice = 'system';
  try { choice = preference(); } catch (e) { /* Storage may be unavailable. */ }
  document.documentElement.classList.toggle('dark', choice === 'dark' || (choice === 'system' && dark.matches));
  for (const button of document.querySelectorAll('[data-theme-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice));
  }
}

applyTheme();
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.f-theme-switch').addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-choice]');
    if (!button) return;
    try { localStorage.setItem('rfactory-theme', button.dataset.themeChoice); } catch (e) { /* Keep the current choice for this page. */ }
    applyTheme();
  });
  applyTheme();
});
dark.addEventListener('change', applyTheme);
