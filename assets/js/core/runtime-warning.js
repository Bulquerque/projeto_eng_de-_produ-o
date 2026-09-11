const warning = document.getElementById('runtimeWarning');
if (warning && !['http:', 'https:'].includes(location.protocol)) {
  warning.removeAttribute('hidden');
}
