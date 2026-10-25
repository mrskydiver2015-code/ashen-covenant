const start = document.querySelector('#start');
start.disabled = true;
try {
  await import('./game.js');
  start.disabled = false;
  document.querySelector('#loading').hidden = true;
} catch (error) {
  console.error('Unable to enter the sanctum:', error);
  for (const panel of document.querySelectorAll('.panel')) panel.hidden = true;
  document.querySelector('#error-panel').hidden = false;
  document.querySelector('#overlay').classList.add('modal');
}
