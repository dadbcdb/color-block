(() => {
  const status = document.getElementById('offline-status');
  const retry = document.getElementById('offline-retry');
  let working = false;
  function show(message, state) { status.textContent = message; status.dataset.state = state; }
  function timeout(promise, ms, message) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]).finally(() => clearTimeout(timer));
  }
  function check(worker) {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('No reply')); }, 8000);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data.ready === true); };
      worker.postMessage({type: 'CHECK_OFFLINE_READY'}, [channel.port2]);
    });
  }
  async function prepare() {
    if (working) return;
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      show('오프라인 저장을 지원하지 않는 화면입니다. HTTPS 게임 주소를 사파리로 열어주세요.', 'error');
      return;
    }
    working = true;
    retry.hidden = true;
    show('게임을 기기에 저장하고 있어요…', 'saving');
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'});
      if (!registration.active) {
        await timeout(navigator.serviceWorker.ready, 25000, 'Download timed out');
      }
      const active = registration.active || (await navigator.serviceWorker.ready).active;
      if (!active || !(await check(active))) throw new Error('Game cache incomplete');
      show('✓ 오프라인 준비 완료 · 인터넷 없이 실행할 수 있어요.', 'ready');
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    } catch (error) {
      show('오프라인 저장을 완료하지 못했어요. 인터넷 연결 후 다시 시도해주세요.', 'error');
      retry.hidden = false;
    } finally { working = false; }
  }
  retry.addEventListener('click', prepare);
  window.addEventListener('online', () => { if (status.dataset.state !== 'ready') prepare(); });
  prepare();
})();
