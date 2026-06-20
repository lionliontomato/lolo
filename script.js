const SHEET_ID = '1QYgwyZvRcnH6gsZ8rRR-E1ZZKT1giyHfsW7azHfzX-Q';
const SHEET_GID = '0';

let songs = [];
let tags = [];
let activeTag = null;
let query = '';
let sheetTimeout = null;

const palette = [
  ['#8d94a6','#f2f3f6'],['#9ba0ad','#f5f3ee'],['#7d8498','#eef0f5'],
  ['#a6988d','#f6f1ee'],['#8da69a','#eff5f1'],['#9b8da6','#f4eff6'],
  ['#a6a08d','#f6f4ee'],['#8d9fa6','#eef5f2'],['#939aae','#f1f2f6'],
  ['#a68d90','#f7f0f1'],['#78809a','#eef0f6'],['#8fa69d','#edf5f2']
];

function cell(row, i) {
  const c = row && row.c ? row.c[i] : null;
  return c ? String(c.f || c.v || '').trim() : '';
}

function parseTags(text) {
  return String(text || '')
    .replace(/[｜|／\/;；、，\n\r]/g, ',')
    .split(',')
    .map(function(t) { return t.trim(); })
    .filter(function(t) { return t && t !== '-' && t !== '—' && t !== '標籤'; });
}

function applySiteSettings(rows) {
  const title = cell(rows[1], 8) || '珞珞の歌單';
  const subtitle = cell(rows[2], 8) || '不喜歡我就不要看我，再看戳你馬啾！不會的歌也可以詢問喔w';
  const modalTitle = cell(rows[3], 8) || '🪭珞珞推薦';
  const closeText = cell(rows[4], 8) || '我是女孩，沒有積極！';

  const siteTitle = document.getElementById('siteTitle');
  const siteSubtitle = document.getElementById('siteSubtitle');
  const modalTitleEl = document.getElementById('modalTitle');
  const closeModal = document.getElementById('closeModal');

  if (siteTitle) siteTitle.textContent = title;
  if (siteSubtitle) siteSubtitle.textContent = subtitle;
  if (modalTitleEl) modalTitleEl.textContent = modalTitle;
  if (closeModal) closeModal.textContent = closeText;

  document.title = title;
}

function loadSheet() {
  const status = document.getElementById('status');
  status.textContent = '讀取中…';

  const oldScript = document.getElementById('sheetJsonp');
  if (oldScript) oldScript.remove();

  const callbackName = 'playlistSheetCallback_' + Date.now();
  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?gid=' + SHEET_GID + '&tqx=out:json;responseHandler:' + callbackName + '&t=' + Date.now();

  window[callbackName] = function(response) {
    clearTimeout(sheetTimeout);
    try {
      const rows = response && response.table && response.table.rows ? response.table.rows : [];

      applySiteSettings(rows);

      const loadedSongs = [];
      const masterTags = [];

      rows.forEach(function(row) {
        const title = cell(row, 0);
        const artist = cell(row, 1);
        const category = cell(row, 2);
        const link = cell(row, 3);
        const masterTagCell = cell(row, 5);

        parseTags(masterTagCell).forEach(function(t) {
          masterTags.push(t);
        });

        const looksLikeHeader = ['歌名', '歌曲', '曲名', 'title'].includes(title.toLowerCase());
        if (title && !looksLikeHeader) {
          loadedSongs.push({
            title: title,
            artist: artist || '未填歌手',
            category: category || '未分類',
            link: /^https?:\/\//i.test(link) ? link : ''
          });
        }
      });

      songs = loadedSongs;

      if (masterTags.length) {
        tags = Array.from(new Set(masterTags));
      } else {
        const fromSongs = [];
        songs.forEach(function(s) {
          parseTags(s.category).forEach(function(t) {
            fromSongs.push(t);
          });
        });
        tags = Array.from(new Set(fromSongs));
      }

      status.textContent = '';
      renderTags();
      renderSongs();
    } catch (err) {
      console.error(err);
      showSheetError('試算表格式解析失敗，請確認 A欄歌名、B欄歌手、C欄分類、F欄標籤。');
    } finally {
      delete window[callbackName];
      const s = document.getElementById('sheetJsonp');
      if (s) s.remove();
    }
  };

  const script = document.createElement('script');
  script.id = 'sheetJsonp';
  script.src = url;

  script.onerror = function() {
    clearTimeout(sheetTimeout);
    showSheetError('讀取不到試算表，請確認共用權限是「知道連結的任何人可檢視」。');
    delete window[callbackName];
  };

  document.body.appendChild(script);

  sheetTimeout = setTimeout(function() {
    showSheetError('讀取試算表逾時，請重新整理頁面或確認試算表權限。');
    delete window[callbackName];
  }, 12000);
}

function showSheetError(message) {
  songs = [];
  tags = [];
  document.getElementById('status').textContent = message;
  renderTags();
  renderSongs();
}

function renderTags() {
  const box = document.getElementById('tags');
  box.innerHTML = '';

  tags.forEach(function(t, i) {
    const colors = palette[i % palette.length];
    const b = document.createElement('button');
    b.className = 'tag' + (activeTag === t ? ' active' : '');
    b.textContent = t;
    b.style.setProperty('--tag', colors[0]);
    b.style.setProperty('--tagLight', colors[1]);

    b.onclick = function() {
      activeTag = activeTag === t ? null : t;
      renderTags();
      renderSongs();
    };

    box.appendChild(b);
  });
}

function matchSong(s) {
  const q = query.trim().toLowerCase();
  const categories = parseTags(s.category);
  const text = (s.title + ' ' + s.artist + ' ' + s.category).toLowerCase();
  const tagOk = !activeTag || categories.includes(activeTag) || s.artist === activeTag || s.category.includes(activeTag);

  return tagOk && (!q || text.includes(q));
}

function renderSongs() {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const count = document.getElementById('count');
  grid.innerHTML = '';

  const list = songs.filter(matchSong);

  count.textContent = '共 ' + list.length + ' 首 / 全部 ' + songs.length + ' 首';
  empty.style.display = list.length ? 'none' : 'block';

  list.forEach(function(s) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.title = s.title;

    const title = document.createElement('h3');
    title.className = 'song';
    title.textContent = s.title;

    const artist = document.createElement('div');
    artist.className = 'artist';
    artist.textContent = s.artist;

    const cat = document.createElement('span');
    cat.className = 'cat';
    cat.textContent = parseTags(s.category).join(' ') || '未分類';

    const copy = document.createElement('button');
    copy.className = 'copy';
    copy.type = 'button';
    copy.textContent = '複製';

    copy.onclick = async function() {
      const text = s.title + ' - ' + s.artist;

      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }

      copy.textContent = '✓ 已複製';
      copy.classList.add('done');

      setTimeout(function() {
        copy.textContent = '複製';
        copy.classList.remove('done');
      }, 1300);
    };

    card.append(title, artist, cat, copy);

    if (s.link) {
      card.addEventListener('dblclick', function() {
        window.open(s.link, '_blank', 'noopener,noreferrer');
      });

      card.title = '雙擊開啟歌曲連結';
    }

    grid.appendChild(card);
  });
}

document.getElementById('search').addEventListener('input', function(e) {
  query = e.target.value;
  renderSongs();
});

document.getElementById('randomBtn').onclick = function(e) {
  e.preventDefault();

  const list = songs.filter(matchSong);
  if (!list.length) return;

  const s = list[Math.floor(Math.random() * list.length)];

  document.getElementById('pickSong').textContent = s.title;
  document.getElementById('pickArtist').textContent = s.artist + '｜' + (parseTags(s.category).join(' ') || '未分類');
  document.getElementById('modal').classList.add('show');
};

document.getElementById('closeModal').onclick = function() {
  document.getElementById('modal').classList.remove('show');
};

document.getElementById('modal').onclick = function(e) {
  if (e.target.id === 'modal') {
    e.currentTarget.classList.remove('show');
  }
};

(function floats() {
  const symbols = ['❀','☁','月','竹','卷','琴','✦'];
  const layer = document.getElementById('floatLayer');

  for (let i = 0; i < 32; i++) {
    const el = document.createElement('span');
    el.className = 'float';
    el.textContent = symbols[i % symbols.length];
    el.style.setProperty('--left', Math.random() * 100 + '%');
    el.style.setProperty('--dur', (10 + Math.random() * 14) + 's');
    el.style.setProperty('--delay', (-Math.random() * 16) + 's');
    layer.appendChild(el);
  }
})();

loadSheet();
