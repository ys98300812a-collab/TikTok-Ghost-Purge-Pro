const $ = id => document.getElementById(id);
const btnStart = $('btn-start'), btnStop = $('btn-stop'), logEl = $('log'), skipInput = $('input-skip');

// 自動讀取上次儲存的進度
chrome.storage.local.get(['lastCheckedIndex'], (res) => {
  if (res.lastCheckedIndex) skipInput.value = res.lastCheckedIndex;
});

function addLog(msg) {
  const div = document.createElement('div');
  div.textContent = `> ${msg}`;
  logEl.prepend(div);
}

btnStart.onclick = async () => {
  const skipCount = parseInt(skipInput.value) || 0;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'START', skip: skipCount }, (res) => {
    if (res?.ok) {
      btnStart.disabled = true; btnStop.disabled = false;
      addLog(`啟動成功！將從第 ${skipCount + 1} 人開始`);
    }
  });
};

btnStop.onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'STOP' });
  btnStart.disabled = false; btnStop.disabled = true;
};

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'PROGRESS') {
    $('stat-total').textContent = msg.checked;
    $('stat-removed').textContent = msg.unfollowed;
    $('stat-skipped').textContent = msg.skipped || 0;
    if (msg.message) addLog(msg.message);
  }
});