'use strict';

let state = { running: false, checkedIndex: 0, unfollowed: 0, skipped: 0 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function isBannedAccount(text) {
  const lines = text.split('\n').map(l => l.trim());
  const displayName = lines[0] || "";
  const hasBannedKeyword = text.includes('TikToker') || text.includes('找不到此帳號') || text.includes("Couldn't find this account");
  const isUserNumberName = /^user\d{6,}/i.test(displayName);
  return hasBannedKeyword || isUserNumberName;
}

// ── 強化版捲軸尋找器 ──
function findBestScroller() {
  const selectors = ['div[class*="DivUserListContainer"]', 'div[class*="DivFollowingList"]', 'ul[class*="UserList"]'];
  for (let s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  // 如果都找不到，找第一個有捲軸的父元素
  const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('關注中'));
  if (btns.length > 0) {
    let p = btns[0].parentElement;
    while (p && p !== document.body) {
      const s = window.getComputedStyle(p);
      if (s.overflowY === 'auto' || s.overflowY === 'scroll') return p;
      p = p.parentElement;
    }
  }
  return window;
}

async function run(skipLimit) {
  state.running = true;
  state.checkedIndex = 0; state.unfollowed = 0; state.skipped = 0;
  let retryCount = 0;

  console.log(`%c🚀 啟動 3.1 版：從第 ${skipLimit + 1} 人開始任務`, "color: #25f4ee; font-weight: bold; font-size: 14px;");

  while (state.running) {
    const buttons = Array.from(document.querySelectorAll('button')).filter(b => 
      b.innerText.includes('關注中') || b.innerText.includes('Following') || b.innerText.includes('已关注')
    );

    let foundNewInThisTurn = false;
    for (let btn of buttons) {
      if (!state.running) break;
      const container = btn.closest('li') || btn.parentElement.parentElement;
      if (!container || container.dataset.processed) continue;

      container.dataset.processed = "true";
      state.checkedIndex++;
      foundNewInThisTurn = true;
      retryCount = 0; // 只要有新人，重試計數就歸零

      if (state.checkedIndex <= skipLimit) {
        state.skipped++;
        container.style.opacity = "0.3"; 
        container.style.borderLeft = "4px solid #25f4ee";
        if (state.checkedIndex % 50 === 0) console.log(`⏩ 跳過中: ${state.checkedIndex}`);
        continue;
      }

      // --- 🎯 正式判定區 ---
      const accountText = container.innerText || "";
      const isBanned = isBannedAccount(accountText);
      const shortName = (accountText.split('\n')[0] || "未知").substring(0, 15);

      if (isBanned) {
        console.log(`%c🗑️ [#${state.checkedIndex}] 發現廢號: ${shortName}`, "color: #fe2c55; font-weight: bold;");
        container.style.backgroundColor = "rgba(254, 44, 85, 0.2)";
        btn.click();
        state.unfollowed++;
        chrome.runtime.sendMessage({ type: 'PROGRESS', checked: state.checkedIndex, unfollowed: state.unfollowed, skipped: state.skipped, message: `🗑️ 清理: ${shortName}` });
        await sleep(3000 + Math.random() * 2000);
      } else {
        console.log(`✅ [#${state.checkedIndex}] 正常: ${shortName}`);
        container.style.borderLeft = "4px solid #25f4ee";
        chrome.runtime.sendMessage({ type: 'PROGRESS', checked: state.checkedIndex, unfollowed: state.unfollowed, skipped: state.skipped, message: `✓ 正常: ${shortName}` });
        await sleep(100);
      }

      if (state.checkedIndex % 10 === 0) chrome.storage.local.set({ lastCheckedIndex: state.checkedIndex });
    }

    if (!state.running) break;

    // --- 捲動與重試機制 ---
    if (!foundNewInThisTurn) {
      retryCount++;
      console.log(`⏳ 畫面無新人，嘗試向下捲動 (第 ${retryCount}/5 次)...`);
      const scroller = findBestScroller();
      if (scroller === window) window.scrollBy(0, 1000); else scroller.scrollTop += 1000;
      
      await sleep(3000); // 給 TikTok 更多時間載入

      if (retryCount >= 5 && state.checkedIndex > skipLimit) {
        console.log("%c🏁 多次捲動無新人，任務結束或已被限制。", "color: #ffc107; font-weight: bold;");
        break;
      }
    } else {
      const scroller = findBestScroller();
      if (scroller === window) window.scrollBy(0, 600); else scroller.scrollTop += 600;
      await sleep(1500);
    }
  }
  state.running = false;
  chrome.runtime.sendMessage({ type: 'PROGRESS', message: "🏁 執行結束" });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'START') { run(msg.skip); sendResponse({ ok: true }); }
  else if (msg.action === 'STOP') { state.running = false; sendResponse({ ok: true }); }
  return true;
});