export function isFileProtocol() {
  return typeof window !== 'undefined' && window.location?.protocol === 'file:';
}

export function requireHttpRuntime(context = 'Este recurso') {
  if (!isFileProtocol()) return;

  throw new Error(
    `${context} precisa ser aberto por HTTP/HTTPS. ` +
      'Abra o pacote com um servidor local, por exemplo: python -m http.server 8000.'
  );
}
